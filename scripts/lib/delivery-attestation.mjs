import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { inspectDeterministicZip, readStoredZipEntry } from './deterministic-zip.mjs';
import { normalizeSourcePath } from './source-manifest.mjs';

export const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const allowedGateStatuses = new Set(['PASS', 'FAIL', 'NOT_RUN']);
const safeEvidencePath = (value) => {
  const normalized = normalizeSourcePath(value);
  if (!normalized.startsWith('artifacts/validation/')) throw new Error(`Evidence path must be under artifacts/validation/: ${value}`);
  return normalized;
};

export const validateDeliveryAttestationContract = (contract) => {
  const failures = [];
  if (!contract || typeof contract !== 'object') return ['Contract must be an object.'];
  if (contract.schemaVersion !== 1) failures.push(`Unsupported schemaVersion=${contract.schemaVersion}`);
  if (contract.product !== 'ParsYuva AYM') failures.push(`Unexpected product=${contract.product}`);
  if (contract.stage !== 'Bronze RC2 Active Development') failures.push(`Unexpected stage=${contract.stage}`);
  if (typeof contract.attestationFileNameTemplate !== 'string' || !contract.attestationFileNameTemplate.includes('{build}') || !contract.attestationFileNameTemplate.includes('{version}')) failures.push('Attestation file name template must contain {build} and {version}.');
  const ids = new Set();
  for (const [index, item] of (contract.evidence ?? []).entries()) {
    if (!item || typeof item !== 'object') { failures.push(`evidence[${index}] must be an object.`); continue; }
    if (typeof item.id !== 'string' || item.id.length === 0) failures.push(`evidence[${index}] id is missing.`);
    else if (ids.has(item.id)) failures.push(`Duplicate evidence id=${item.id}`);
    else ids.add(item.id);
    try { safeEvidencePath(item.path); } catch (error) { failures.push(error.message); }
    if (typeof item.statusField !== 'string' || item.statusField.length === 0) failures.push(`evidence ${item.id} statusField is missing.`);
    if (typeof item.expectedStatus !== 'string' || item.expectedStatus.length === 0) failures.push(`evidence ${item.id} expectedStatus is missing.`);
  }
  if (ids.size === 0) failures.push('At least one evidence item is required.');
  const labels = new Set();
  for (const [index, claim] of (contract.gateClaims ?? []).entries()) {
    if (!claim || typeof claim !== 'object') { failures.push(`gateClaims[${index}] must be an object.`); continue; }
    if (typeof claim.label !== 'string' || claim.label.length === 0) failures.push(`gateClaims[${index}] label is missing.`);
    else if (labels.has(claim.label)) failures.push(`Duplicate gate claim label=${claim.label}`);
    else labels.add(claim.label);
    if (!ids.has(claim.evidenceId)) failures.push(`Gate claim ${claim.label} references unknown evidence=${claim.evidenceId}`);
    const selectorCount = Number(Boolean(claim.field)) + Number(Boolean(claim.resultId)) + Number(Array.isArray(claim.resultIds));
    if (selectorCount < 1) failures.push(`Gate claim ${claim.label} has no selector.`);
    if (claim.resultIds && (claim.aggregate !== 'required-gates' || claim.resultIds.length < 1)) failures.push(`Gate claim ${claim.label} aggregate is invalid.`);
  }
  const requiredLabels = ['Source preflight gate', 'Source integrity', 'Clean install gate', 'Full root `tsc --noEmit`', 'Unit and integration tests', 'Electron production build', 'Blocking smoke chain', 'Windows launch / installer'];
  for (const label of requiredLabels) if (!labels.has(label)) failures.push(`Required gate claim is missing=${label}`);
  return failures;
};

export const renderAttestationFileName = (contract, build, version) => contract.attestationFileNameTemplate.replaceAll('{build}', String(build)).replaceAll('{version}', version);
const statusFromClaim = (evidence, claim) => {
  if (Array.isArray(claim.resultIds)) {
    const statuses = claim.resultIds.map((id) => evidence.results?.find((result) => result.id === id)?.status ?? 'NOT_RUN');
    if (statuses.some((status) => status === 'FAIL')) return 'FAIL';
    if (statuses.every((status) => status === 'PASS')) return 'PASS';
    return 'NOT_RUN';
  }
  if (claim.resultId) return evidence.results?.find((result) => result.id === claim.resultId)?.[claim.field ?? 'status'] ?? 'NOT_RUN';
  return evidence[claim.field];
};
const documentGateStatus = (content, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.match(new RegExp(`^- ${escaped}: \\*\\*(PASS|FAIL|NOT_RUN)`, 'm'))?.[1] ?? null;
};
const archiveIdentity = (archive) => {
  const packageJson = JSON.parse(readStoredZipEntry(archive, 'package.json').toString('utf8'));
  const ledger = JSON.parse(readStoredZipEntry(archive, 'artifacts/manifests/VERSION_LEDGER.json').toString('utf8'));
  return { packageJson, current: ledger.entries?.at(-1) };
};

export const evaluateDeliveryAttestation = async ({ root = '.', archivePath, contractPath = 'config/delivery-attestation-contract.json' }) => {
  const absoluteRoot = resolve(root);
  const failures = [];
  const contract = JSON.parse(await readFile(resolve(absoluteRoot, contractPath), 'utf8'));
  failures.push(...validateDeliveryAttestationContract(contract));
  const archiveBytes = await readFile(resolve(archivePath));
  const inspection = inspectDeterministicZip(archiveBytes);
  if (inspection.status !== 'PASS') failures.push(...inspection.failures.map((failure) => `archive: ${failure}`));
  let identity = { packageJson: {}, current: {} };
  let rootStatus = '';
  let verificationReport = '';
  try {
    identity = archiveIdentity(archiveBytes);
    rootStatus = readStoredZipEntry(archiveBytes, 'BUILD_STATUS.md').toString('utf8');
    verificationReport = readStoredZipEntry(archiveBytes, 'VERIFICATION_REPORT.md').toString('utf8');
  } catch (error) { failures.push(`archive identity read failed: ${error.message}`); }
  const version = identity.current?.version ?? '';
  const packageVersion = identity.current?.packageVersion ?? identity.packageJson?.version ?? '';
  const build = identity.current?.sequence ?? null;
  if (identity.packageJson?.version !== packageVersion) failures.push(`Archive package.json version=${identity.packageJson?.version}; ledger=${packageVersion}`);
  const evidenceById = new Map();
  const evidenceRecords = [];
  for (const item of contract.evidence ?? []) {
    try {
      const relativePath = safeEvidencePath(item.path);
      const bytes = await readFile(resolve(absoluteRoot, relativePath));
      const json = JSON.parse(bytes.toString('utf8'));
      const reportedStatus = json[item.statusField];
      if (reportedStatus !== item.expectedStatus) failures.push(`Evidence ${item.id} status=${reportedStatus}; expected=${item.expectedStatus}`);
      evidenceById.set(item.id, json);
      evidenceRecords.push({ id: item.id, path: relativePath, bytes: bytes.length, sha256: sha256Bytes(bytes), reportedStatus, expectedStatus: item.expectedStatus });
    } catch (error) { failures.push(`Evidence ${item.id} read failed: ${error.message}`); }
  }
  const gateClaims = [];
  for (const claim of contract.gateClaims ?? []) {
    const evidence = evidenceById.get(claim.evidenceId);
    const evidenceStatus = evidence ? statusFromClaim(evidence, claim) : null;
    if (!allowedGateStatuses.has(evidenceStatus)) failures.push(`Gate ${claim.label} derived invalid status=${evidenceStatus}`);
    const buildStatus = documentGateStatus(rootStatus, claim.label);
    const reportStatus = documentGateStatus(verificationReport, claim.label);
    if (buildStatus !== evidenceStatus) failures.push(`BUILD_STATUS claim mismatch ${claim.label}: document=${buildStatus}, evidence=${evidenceStatus}`);
    if (reportStatus !== evidenceStatus) failures.push(`VERIFICATION_REPORT claim mismatch ${claim.label}: document=${reportStatus}, evidence=${evidenceStatus}`);
    gateClaims.push({ label: claim.label, evidenceId: claim.evidenceId, evidenceStatus, buildStatus, verificationReportStatus: reportStatus, status: buildStatus === evidenceStatus && reportStatus === evidenceStatus ? 'MATCH' : 'MISMATCH' });
  }
  const expectedAttestationFileName = Number.isInteger(build) ? renderAttestationFileName(contract, build, version) : null;
  for (const [path, content] of [['BUILD_STATUS.md', rootStatus], ['VERIFICATION_REPORT.md', verificationReport]]) if (expectedAttestationFileName && !content.includes(`\`${expectedAttestationFileName}\``)) failures.push(`${path} does not reference detached attestation=${expectedAttestationFileName}`);
  return {
    schemaVersion: 1,
    product: contract.product,
    stage: contract.stage,
    applicationVersion: version,
    packageVersion,
    build,
    archive: { fileName: basename(archivePath), bytes: archiveBytes.length, sha256: sha256Bytes(archiveBytes), deterministicStatus: inspection.status, entryCount: inspection.entryCount },
    expectedAttestationFileName,
    evidence: evidenceRecords,
    gateClaims,
    failures,
    status: failures.length === 0 ? 'PASS' : 'FAIL'
  };
};

export const verifyExistingDeliveryAttestation = async ({ attestation, root = '.', archivePath, contractPath }) => {
  const current = await evaluateDeliveryAttestation({ root, archivePath, contractPath });
  const failures = [...current.failures];
  for (const field of ['product', 'stage', 'applicationVersion', 'packageVersion', 'build', 'expectedAttestationFileName']) if (attestation[field] !== current[field]) failures.push(`Attestation ${field}=${attestation[field]}; current=${current[field]}`);
  for (const field of ['fileName', 'bytes', 'sha256', 'deterministicStatus', 'entryCount']) if (attestation.archive?.[field] !== current.archive?.[field]) failures.push(`Attestation archive.${field} mismatch.`);
  const evidenceById = new Map((attestation.evidence ?? []).map((item) => [item.id, item]));
  for (const item of current.evidence) {
    const stored = evidenceById.get(item.id);
    if (!stored) failures.push(`Attestation evidence missing=${item.id}`);
    else for (const field of ['path', 'bytes', 'sha256', 'reportedStatus', 'expectedStatus']) if (stored[field] !== item[field]) failures.push(`Attestation evidence ${item.id}.${field} mismatch.`);
  }
  const claimsByLabel = new Map((attestation.gateClaims ?? []).map((item) => [item.label, item]));
  for (const claim of current.gateClaims) {
    const stored = claimsByLabel.get(claim.label);
    if (!stored) failures.push(`Attestation gate claim missing=${claim.label}`);
    else for (const field of ['evidenceId', 'evidenceStatus', 'buildStatus', 'verificationReportStatus', 'status']) if (stored[field] !== claim[field]) failures.push(`Attestation gate ${claim.label}.${field} mismatch.`);
  }
  if (attestation.status !== 'PASS') failures.push(`Attestation recorded status=${attestation.status}`);
  return { ...current, failures, status: failures.length === 0 ? 'PASS' : 'FAIL' };
};
