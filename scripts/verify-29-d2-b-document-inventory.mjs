import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';

const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256File = async (path) => sha256(await readFile(path));
const base = 'artifacts/inventory/29-D2-B_inputs';
const registry = await readJson('artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.json');
const snapshot = await readJson(`${base}/ALL_DOCUMENTS_INDEX_AT_START.json`);
const artifactSnapshot = await readJson(`${base}/PROJECT_ARTIFACT_INDEX_AT_START.json`);
const activeSet = await readJson(`${base}/ACTIVE_DOCUMENT_SET_AT_START.json`);
const policy = await readJson(`${base}/DOCUMENT_INVENTORY_POLICY_AT_START.json`);
const liveActiveSet = await readJson('config/active-document-set.json');
const liveDocumentIndex = await readJson('artifacts/manifests/ALL_DOCUMENTS_INDEX.json');
const liveArtifactIndex = await readJson('artifacts/manifests/PROJECT_ARTIFACT_INDEX.json');

check(registry.release === 'Bronze 04.08.2026.29', 'release mismatch');
check(registry.workStep === '29-D2-B', 'work step mismatch');
check(registry.authorityPolicy?.historicalCanOverrideActive === false, 'historical override must be prohibited');
check(registry.authorityPolicy?.generatedOrEvidenceCanOverrideActive === false, 'support records must not override active authority');
check(policy.unclassifiedFilesAllowed === false && policy.missingDocumentsAllowed === false, 'document inventory policy must be fail-closed');

for (const binding of Object.values(registry.sourceBindings ?? {})) {
  check(Boolean(binding.path), 'binding path missing');
  check(await sha256File(binding.path) === binding.sha256, `binding SHA mismatch ${binding.path}`);
}

const entries = registry.documents ?? [];
check(entries.length === snapshot.documentCount, `registry/snapshot count mismatch ${entries.length}/${snapshot.documentCount}`);
check(entries.length === snapshot.documents.length, 'snapshot documentCount inconsistent');
const ids = new Set();
const paths = new Set();
const byPath = new Map(entries.map((entry) => [entry.path, entry]));
const snapshotByPath = new Map(snapshot.documents.map((entry) => [entry.path, entry]));
const activeAuthority = new Set(activeSet.authorityOrder ?? []);
const liveActiveAuthority = new Set(liveActiveSet.authorityOrder ?? []);
check(activeAuthority.size === 22, `active authority count ${activeAuthority.size}/22`);
check([...activeAuthority].every((path) => liveActiveAuthority.has(path)) && [...liveActiveAuthority].every((path) => activeAuthority.has(path)), 'live active authority path set changed');

for (const entry of entries) {
  check(!ids.has(entry.id), `duplicate id ${entry.id}`); ids.add(entry.id);
  check(!paths.has(entry.path), `duplicate path ${entry.path}`); paths.add(entry.path);
  const source = snapshotByPath.get(entry.path);
  check(Boolean(source), `path absent from snapshot ${entry.path}`);
  if (!source) continue;
  check(entry.extension === source.extension, `${entry.path} extension mismatch`);
  check(entry.bytes === source.bytes, `${entry.path} bytes mismatch`);
  check(entry.sha256 === source.sha256, `${entry.path} SHA mismatch`);
  check(entry.sourceIndexClassification === source.classification, `${entry.path} source classification mismatch`);
  const expectedClass = activeAuthority.has(entry.path)
    ? 'ACTIVE_AUTHORITY'
    : source.classification === 'HISTORICAL' ? 'HISTORICAL_ONLY'
    : source.classification === 'EVIDENCE' ? 'EVIDENCE_ONLY'
    : source.classification === 'GENERATED' ? 'GENERATED_RECORD'
    : source.classification;
  check(entry.governedClassification === expectedClass, `${entry.path} governed classification mismatch`);
  check(entry.canOverrideActiveAuthority === (expectedClass === 'ACTIVE_AUTHORITY'), `${entry.path} override flag mismatch`);
  check(entry.historicalOverrideProhibited === (expectedClass === 'HISTORICAL_ONLY'), `${entry.path} historical prohibition mismatch`);
  check(entry.availability === 'AVAILABLE', `${entry.path} availability must be AVAILABLE`);
  try { check((await stat(entry.path)).isFile(), `${entry.path} is not a live file`); }
  catch { check(false, `${entry.path} live file missing`); }
  if (expectedClass === 'HISTORICAL_ONLY' && source.sha256 !== 'SELF_GENERATED_AFTER_INVENTORY') {
    check(await sha256File(entry.path) === source.sha256, `${entry.path} historical content changed after snapshot`);
  }
}
for (const source of snapshot.documents) check(byPath.has(source.path), `snapshot document omitted ${source.path}`);

const material = entries.map((entry) => [entry.id,entry.path,entry.sourceIndexClassification,entry.governedClassification,entry.authorityGroup,String(entry.authorityRank ?? ''),String(entry.bytes ?? ''),entry.sha256].join('|')).join('\n');
check(sha256(Buffer.from(material)) === registry.inventoryFingerprintSha256, 'inventory fingerprint mismatch');

const activeEntries = entries.filter((entry) => entry.governedClassification === 'ACTIVE_AUTHORITY');
check(activeEntries.length === 22, `governed active authority count ${activeEntries.length}/22`);
const activeSnapshotByPath = new Map((registry.activeAuthoritySnapshots ?? []).map((item) => [item.originalPath, item]));
check(activeSnapshotByPath.size === 22, `active authority snapshot count ${activeSnapshotByPath.size}/22`);
for (const path of activeAuthority) {
  const entry = byPath.get(path);
  check(Boolean(entry), `active authority omitted ${path}`);
  check(entry?.governedClassification === 'ACTIVE_AUTHORITY', `active authority misclassified ${path}`);
  const snap = activeSnapshotByPath.get(path);
  check(Boolean(snap), `active authority snapshot registry entry missing ${path}`);
  if (snap) {
    check(await sha256File(snap.snapshotPath) === snap.sha256, `active authority snapshot SHA mismatch ${path}`);
    check((await stat(snap.snapshotPath)).size === snap.sizeBytes, `active authority snapshot size mismatch ${path}`);
    const governedMutable = new Set(['docs/current/08_TUM_BELGELER_DIZINI.md','config/work-segmentation-plan.json']);
    if (!governedMutable.has(path)) {
      check(await sha256File(path) === snap.sha256, `active authority changed after snapshot ${path}`);
    }
    if (path === 'config/work-segmentation-plan.json') {
      const currentPlan = await readJson(path);
      const currentStep = (currentPlan.steps ?? []).find((step) => step.id === '29-D2-B');
      check(currentPlan.currentStep === '29-D2-B', '29-D2-B must remain current during finalization');
      check(currentStep?.status === 'COMPLETED', '29-D2-B controlled lifecycle did not reach COMPLETED');
      check(currentStep?.validationStatus === 'PASS', '29-D2-B controlled lifecycle validation is not PASS');
      check(currentStep?.persistentReceiptStatus === 'PASS', '29-D2-B controlled lifecycle receipt is not PASS');
      check(currentStep?.persistentReceiptPath === 'artifacts/checkpoints/29-D2-B_LIBRARY_RECEIPT.json', '29-D2-B controlled lifecycle receipt path mismatch');
    }
  }
}

const historical = entries.filter((entry) => entry.governedClassification === 'HISTORICAL_ONLY');
check(historical.length === registry.summary.historicalDocumentCount, 'historical count mismatch');
check(historical.every((entry) => entry.canOverrideActiveAuthority === false && entry.historicalOverrideProhibited === true), 'historical override policy breach');
check((registry.externalRecordLimitations ?? []).length === 4, 'external limitation count must be 4');
check((registry.externalRecordLimitations ?? []).every((item) => ['PARTIAL','UNAVAILABLE'].includes(item.availability) && Boolean(item.limitation)), 'external limitation truth fields invalid');
check((registry.sourceClassificationCorrections ?? []).length === 1, 'expected exactly one source classification correction');
const correction = registry.sourceClassificationCorrections?.[0];
check(correction?.path === 'docs/current/08_TUM_BELGELER_DIZINI.md', 'self-index authority correction path mismatch');
check(correction?.from === 'GENERATED' && correction?.to === 'ACTIVE_AUTHORITY', 'self-index authority correction values mismatch');

for (const output of registry.generatedOutputPaths ?? []) {
  try { check((await stat(output)).isFile(), `generated output not a file ${output}`); }
  catch { check(false, `generated output missing ${output}`); }
}

const liveArtifactByPath = new Map((liveArtifactIndex.files ?? []).map((entry) => [entry.path, entry]));
for (const path of liveActiveAuthority) check(liveArtifactByPath.get(path)?.classification === 'ACTIVE_AUTHORITY', `live artifact index active authority mismatch ${path}`);
check((liveArtifactIndex.files ?? []).filter((entry) => entry.classification === 'ACTIVE_AUTHORITY').length === 22, 'live artifact index active authority count must be 22');
check(liveDocumentIndex.documentCount === liveDocumentIndex.documents.length, 'live document index count mismatch');
check(liveArtifactIndex.summary.totalFiles === liveArtifactIndex.files.length, 'live artifact index count mismatch');
check(artifactSnapshot.summary.totalDocuments === snapshot.documentCount, 'start artifact/document snapshot cross-count mismatch');

const report = {
  schemaVersion: 1,
  release: registry.release,
  workStep: registry.workStep,
  checks,
  snapshotDocumentCount: snapshot.documentCount,
  activeAuthorityCount: activeEntries.length,
  historicalDocumentCount: historical.length,
  inventoryFingerprintSha256: registry.inventoryFingerprintSha256,
  sourceClassificationCorrectionCount: registry.sourceClassificationCorrections.length,
  externalRecordLimitationCount: registry.externalRecordLimitations.length,
  liveArtifactIndexFiles: liveArtifactIndex.summary.totalFiles,
  liveDocumentIndexDocuments: liveDocumentIndex.documentCount,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-B-document-inventory.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`29-D2-B Document Inventory: PASS (${checks} checks / ${entries.length} documents / ${activeEntries.length} active authority / ${historical.length} historical).`);
