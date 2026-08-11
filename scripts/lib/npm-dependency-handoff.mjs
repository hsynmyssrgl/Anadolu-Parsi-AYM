import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createDependencyAcquisitionPlan, verifyDependencyAcquisitionPlan } from './npm-dependency-acquisition.mjs';
import { inspectDeterministicZip, readStoredZipEntry, writeDeterministicZip } from './deterministic-zip.mjs';

export const DEPENDENCY_HANDOFF_KIND = 'PPT_NPM_DEPENDENCY_HANDOFF_REQUEST';
export const DEPENDENCY_HANDOFF_SCHEMA = 1;
export const DEPENDENCY_HANDOFF_MANIFEST = 'dependency-handoff-request.json';
export const DEPENDENCY_HANDOFF_PLAN = 'artifacts/validation/npm-dependency-acquisition-plan.json';
export const DEPENDENCY_HANDOFF_POLICY = 'config/npm-dependency-acquisition-policy.json';
export const DEPENDENCY_HANDOFF_LOCK = 'package-lock.json';
export const DEPENDENCY_HANDOFF_PACKAGE = 'package.json';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const requestCore = ({ packageName, packageVersion, packageLockSha256, basePlanSha256, policySha256, requiredTarballCount }) => ({
  schemaVersion: DEPENDENCY_HANDOFF_SCHEMA,
  kind: DEPENDENCY_HANDOFF_KIND,
  packageName,
  packageVersion,
  packageLockSha256,
  basePlanSha256,
  policySha256,
  requiredTarballCount
});
const requestIdFrom = (core) => sha256(Buffer.from(JSON.stringify(core)));

export const DEFAULT_HANDOFF_RUNTIME_PATHS = [
  'scripts/fetch-npm-dependency-acquisition-bundle.mjs',
  'scripts/verify-npm-cache-transfer-bundle.mjs',
  'scripts/create-file-sha256-sidecar.mjs',
  'scripts/lib/npm-dependency-acquisition.mjs',
  'scripts/lib/npm-cache-transfer.mjs',
  'scripts/lib/npm-offline-cache.mjs',
  'scripts/lib/deterministic-zip.mjs',
  'scripts/lib/source-manifest.mjs'
];

const helperBytes = ({ requestId }) => ({
  'FETCH_DEPENDENCIES.sh': Buffer.from(`#!/usr/bin/env bash\nset -euo pipefail\nROOT="$(cd "$(dirname "${'${BASH_SOURCE[0]}'}")" && pwd)"\ncd "$ROOT"\nmkdir -p response artifacts/npm-dependency-acquisition-staging\nOUT="response/npm-cache-transfer-response-${requestId}.zip"\nnode scripts/fetch-npm-dependency-acquisition-bundle.mjs --plan ${DEPENDENCY_HANDOFF_PLAN} --policy ${DEPENDENCY_HANDOFF_POLICY} --staging artifacts/npm-dependency-acquisition-staging --output "$OUT" --report response/acquisition-report.json\nnode scripts/verify-npm-cache-transfer-bundle.mjs --archive "$OUT" --report response/bundle-verification.json\nnode scripts/create-file-sha256-sidecar.mjs --file "$OUT"\necho "Response bundle: $OUT"\n`),
  'FETCH_DEPENDENCIES.ps1': Buffer.from(`$ErrorActionPreference = "Stop"\n$Root = Split-Path -Parent $MyInvocation.MyCommand.Path\nSet-Location $Root\nNew-Item -ItemType Directory -Force -Path "response" | Out-Null\nNew-Item -ItemType Directory -Force -Path "artifacts/npm-dependency-acquisition-staging" | Out-Null\n$Out = "response/npm-cache-transfer-response-${requestId}.zip"\nnode scripts/fetch-npm-dependency-acquisition-bundle.mjs --plan "${DEPENDENCY_HANDOFF_PLAN}" --policy "${DEPENDENCY_HANDOFF_POLICY}" --staging "artifacts/npm-dependency-acquisition-staging" --output $Out --report "response/acquisition-report.json"\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\nnode scripts/verify-npm-cache-transfer-bundle.mjs --archive $Out --report "response/bundle-verification.json"\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }\nnode scripts/create-file-sha256-sidecar.mjs --file $Out\nexit $LASTEXITCODE\n`),
  'README_TR.md': Buffer.from(`# Doğrulanmış npm bağımlılık talebi\n\nTalep kimliği: \`${requestId}\`\n\nBu klasör internet bağlantılı, Node.js 22 veya üzeri bir makinede çalıştırılır.\n\n- Linux/macOS: \`bash FETCH_DEPENDENCIES.sh\`\n- Windows PowerShell: \`.\\FETCH_DEPENDENCIES.ps1\`\n\nOluşan \`response/npm-cache-transfer-response-${requestId}.zip\` ve yanındaki \`.sha256\` dosyasını çevrimdışı geliştirme makinesine geri taşıyın. Paket yalnız resmi npm kayıt defterinden indirilir ve her tarball aktif lockfile SHA-512 değeriyle doğrulanır.\n`)
});

export const createDependencyHandoffRequest = async ({
  packageName,
  packageVersion,
  lockPath = DEPENDENCY_HANDOFF_LOCK,
  lockBytes,
  policyPath = DEPENDENCY_HANDOFF_POLICY,
  policyBytes,
  runtimeRoot = '.',
  runtimePaths = DEFAULT_HANDOFF_RUNTIME_PATHS,
  outputPath
}) => {
  if (!packageName || !packageVersion || !outputPath) throw new Error('packageName, packageVersion and outputPath are required.');
  const currentLockBytes = lockBytes ?? await readFile(resolve(lockPath));
  const currentPolicyBytes = policyBytes ?? await readFile(resolve(policyPath));
  const basePlan = await createDependencyAcquisitionPlan({ lockBytes: currentLockBytes, packageVersion });
  const basePlanBytes = jsonBytes(basePlan);
  const core = requestCore({
    packageName,
    packageVersion,
    packageLockSha256: sha256(currentLockBytes),
    basePlanSha256: sha256(basePlanBytes),
    policySha256: sha256(currentPolicyBytes),
    requiredTarballCount: basePlan.requiredTarballCount
  });
  const requestId = requestIdFrom(core);
  const plan = { ...basePlan, handoffRequestId: requestId };
  const packageBytes = jsonBytes({ name: packageName, version: packageVersion, private: true, type: 'module' });
  const staging = await mkdtemp(join(tmpdir(), 'ppt-npm-handoff-'));
  try {
    const payloads = new Map([
      [DEPENDENCY_HANDOFF_PLAN, jsonBytes(plan)],
      [DEPENDENCY_HANDOFF_POLICY, currentPolicyBytes],
      [DEPENDENCY_HANDOFF_LOCK, currentLockBytes],
      [DEPENDENCY_HANDOFF_PACKAGE, packageBytes]
    ]);
    for (const path of runtimePaths) payloads.set(path, await readFile(resolve(runtimeRoot, path)));
    for (const [path, bytes] of Object.entries(helperBytes({ requestId }))) payloads.set(path, bytes);
    const payloadEntries = [...payloads.entries()]
      .map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
      .sort((a, b) => a.path.localeCompare(b.path, 'en'));
    const manifest = {
      ...core,
      requestId,
      complete: true,
      officialRegistryOnly: true,
      responseBundleMustDeclareRequestId: true,
      payloadCount: payloadEntries.length,
      payloads: payloadEntries
    };
    for (const [path, bytes] of payloads) {
      const target = resolve(staging, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    await writeFile(resolve(staging, DEPENDENCY_HANDOFF_MANIFEST), jsonBytes(manifest));
    const paths = [DEPENDENCY_HANDOFF_MANIFEST, ...payloadEntries.map((entry) => entry.path)].sort((a, b) => a.localeCompare(b, 'en'));
    const archive = await writeDeterministicZip({ root: staging, paths, outputPath });
    return { schemaVersion: 1, status: 'PASS', requestId, packageVersion, packageLockSha256: core.packageLockSha256, requiredTarballCount: basePlan.requiredTarballCount, archivePath: resolve(outputPath), archiveFileName: basename(outputPath), archiveSha256: archive.archiveSha256, archiveBytes: archive.archiveBytes, archiveEntryCount: archive.entryCount, failures: [] };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};

export const verifyDependencyHandoffRequest = async ({ archivePath, archiveBytes, expectedPackageVersion, expectedLockBytes }) => {
  const bytes = archiveBytes ?? await readFile(resolve(archivePath));
  const inspection = inspectDeterministicZip(bytes);
  const failures = [...inspection.failures];
  let manifest = {};
  let plan = {};
  let lockBytes = Buffer.alloc(0);
  let policyBytes = Buffer.alloc(0);
  let packageMetadata = {};
  try { manifest = JSON.parse(readStoredZipEntry(bytes, DEPENDENCY_HANDOFF_MANIFEST).toString('utf8')); } catch (error) { failures.push(`Request manifest read failed: ${error.message}`); }
  try { plan = JSON.parse(readStoredZipEntry(bytes, DEPENDENCY_HANDOFF_PLAN).toString('utf8')); } catch (error) { failures.push(`Acquisition plan read failed: ${error.message}`); }
  try { lockBytes = readStoredZipEntry(bytes, DEPENDENCY_HANDOFF_LOCK); } catch (error) { failures.push(`Lockfile read failed: ${error.message}`); }
  try { policyBytes = readStoredZipEntry(bytes, DEPENDENCY_HANDOFF_POLICY); } catch (error) { failures.push(`Policy read failed: ${error.message}`); }
  try { packageMetadata = JSON.parse(readStoredZipEntry(bytes, DEPENDENCY_HANDOFF_PACKAGE).toString('utf8')); } catch (error) { failures.push(`Package metadata read failed: ${error.message}`); }
  if (manifest.schemaVersion !== DEPENDENCY_HANDOFF_SCHEMA || manifest.kind !== DEPENDENCY_HANDOFF_KIND) failures.push('Unsupported dependency handoff manifest.');
  if (manifest.complete !== true || manifest.officialRegistryOnly !== true || manifest.responseBundleMustDeclareRequestId !== true) failures.push('Handoff request completeness/registry policy is invalid.');
  if (!/^[a-f0-9]{64}$/.test(manifest.requestId ?? '')) failures.push(`Invalid requestId=${manifest.requestId}`);
  if (expectedPackageVersion && manifest.packageVersion !== expectedPackageVersion) failures.push(`Package version mismatch: request=${manifest.packageVersion}, expected=${expectedPackageVersion}`);
  if (expectedLockBytes && sha256(expectedLockBytes) !== manifest.packageLockSha256) failures.push('Request lockfile does not match the expected active lockfile.');
  if (sha256(lockBytes) !== manifest.packageLockSha256) failures.push('Embedded lockfile SHA-256 mismatch.');
  if (sha256(policyBytes) !== manifest.policySha256) failures.push('Embedded acquisition policy SHA-256 mismatch.');
  if (packageMetadata.version !== manifest.packageVersion || packageMetadata.name !== manifest.packageName) failures.push('Embedded package metadata mismatch.');
  const basePlan = { ...plan };
  delete basePlan.handoffRequestId;
  const basePlanBytes = jsonBytes(basePlan);
  if (sha256(basePlanBytes) !== manifest.basePlanSha256) failures.push('Base acquisition plan SHA-256 mismatch.');
  const recomputedId = requestIdFrom(requestCore({ packageName: manifest.packageName, packageVersion: manifest.packageVersion, packageLockSha256: manifest.packageLockSha256, basePlanSha256: manifest.basePlanSha256, policySha256: manifest.policySha256, requiredTarballCount: manifest.requiredTarballCount }));
  if (recomputedId !== manifest.requestId || plan.handoffRequestId !== manifest.requestId) failures.push('Handoff request identity binding mismatch.');
  const planVerification = await verifyDependencyAcquisitionPlan({ plan, lockBytes, packageVersion: manifest.packageVersion });
  if (planVerification.status !== 'PASS') failures.push(...planVerification.failures.map((failure) => `Plan: ${failure}`));
  const payloads = Array.isArray(manifest.payloads) ? manifest.payloads : [];
  if (manifest.payloadCount !== payloads.length) failures.push(`payloadCount=${manifest.payloadCount}; actual=${payloads.length}`);
  const expectedPaths = new Set([DEPENDENCY_HANDOFF_MANIFEST]);
  for (const entry of payloads) {
    if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || !Number.isSafeInteger(entry.bytes)) { failures.push('Invalid request payload entry.'); continue; }
    expectedPaths.add(entry.path);
    try {
      const payload = readStoredZipEntry(bytes, entry.path);
      if (payload.length !== entry.bytes) failures.push(`Payload byte mismatch: ${entry.path}`);
      if (sha256(payload) !== entry.sha256) failures.push(`Payload SHA-256 mismatch: ${entry.path}`);
    } catch (error) { failures.push(`Payload read failed ${entry.path}: ${error.message}`); }
  }
  for (const entry of inspection.entries) if (!expectedPaths.has(entry.path)) failures.push(`Unexpected request path=${entry.path}`);
  if (inspection.entries.length !== expectedPaths.size) failures.push(`Request archive entry count=${inspection.entries.length}; expected=${expectedPaths.size}`);
  return { schemaVersion: 1, kind: DEPENDENCY_HANDOFF_KIND, status: failures.length === 0 ? 'PASS' : 'FAIL', requestId: manifest.requestId ?? null, packageVersion: manifest.packageVersion ?? null, packageLockSha256: manifest.packageLockSha256 ?? null, requiredTarballCount: manifest.requiredTarballCount ?? 0, archiveSha256: inspection.archiveSha256, archiveBytes: inspection.archiveBytes, archiveEntryCount: inspection.entryCount, plan, lockBytes, failures };
};
