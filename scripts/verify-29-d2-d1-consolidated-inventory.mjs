import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));
const deepEqual = (a, b) => stableStringify(a) === stableStringify(b);
const bindingMap = (bindings) => new Map((bindings ?? []).map((entry) => [entry.id, entry]));

const paths = {
  d2aRegistry: 'artifacts/inventory/29-D2-A_INPUT_REGISTRY.json',
  d2bInventory: 'artifacts/inventory/29-D2-B_DOCUMENT_INVENTORY.json',
  d2cCrosswalk: 'artifacts/inventory/29-D2-C_CROSSWALK.json',
  d2cGaps: 'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  d2aReceipt: 'artifacts/checkpoints/29-D2-A_FINALIZATION_LIBRARY_RECEIPT.json',
  d2bReceipt: 'artifacts/checkpoints/29-D2-B_FINALIZATION_LIBRARY_RECEIPT.json',
  d2cReceipt: 'artifacts/checkpoints/29-D2-C_FINALIZATION_LIBRARY_RECEIPT.json',
  d2d0Receipt: 'artifacts/checkpoints/29-D2-D0_LIBRARY_RECEIPT.json',
  d2d0Readback: 'artifacts/checkpoints/29-D2-D0_RECEIPT_READBACK_VERIFICATION.json',
  workPlan: 'artifacts/inventory/snapshots/29-D2-D1_WORK_PLAN_AT_GENERATION.json'
};
const livePlanPath = 'config/work-segmentation-plan.json';
const artifactPath = 'artifacts/inventory/29-D2-D1_CONSOLIDATED_INVENTORY.json';
const [artifact, d2a, d2b, d2c, gaps, aReceipt, bReceipt, cReceipt, d0Receipt, d0Readback, plan] = await Promise.all([
  readJson(artifactPath), readJson(paths.d2aRegistry), readJson(paths.d2bInventory), readJson(paths.d2cCrosswalk), readJson(paths.d2cGaps),
  readJson(paths.d2aReceipt), readJson(paths.d2bReceipt), readJson(paths.d2cReceipt), readJson(paths.d2d0Receipt), readJson(paths.d2d0Readback), readJson(livePlanPath)
]);

check(artifact.release === 'Bronze 04.08.2026.29', 'release mismatch');
check(artifact.workStep === '29-D2-D1', 'workStep mismatch');
check(artifact.parentStep === '29-D2-D', 'parentStep mismatch');
check(artifact.parentCompletionClaimed === false, 'parent completion must not be claimed');
check(artifact.parentStepStatus === 'IN_PROGRESS', 'parent step must remain IN_PROGRESS');
check(artifact.nextSubstepOnPass === '29-D2-D2', 'next substep mismatch');
check(artifact.authorityPolicy.failed29DAttemptOverlayApplied === false, 'failed 29-D overlay must remain excluded');
check(artifact.authorityPolicy.unavailableContentInvented === false, 'unavailable content must not be invented');
check(artifact.authorityPolicy.openGapsCountedAsPass === false, 'open gaps must not count as PASS');
check(artifact.mandatoryTruthSentence === TRUTH, 'mandatory truth sentence mismatch');
const parent = (plan.steps ?? []).find((entry) => entry.id === '29-D2-D');
check(Boolean(parent), '29-D2-D missing from work plan');
check(['IN_PROGRESS', 'COMPLETED'].includes(parent?.status), '29-D2-D live state invalid');
if (parent?.status === 'IN_PROGRESS') check(plan.currentStep === '29-D2-D', 'work plan current step mismatch before parent completion');
if (parent?.status === 'COMPLETED') {
  check(['29-D3', '29-D4', '29-D5', '29-D6'].includes(plan.currentStep), 'work plan did not reach or advance beyond 29-D3');
  check(parent.validationStatus === 'PASS' && parent.persistentReceiptStatus === 'PASS', 'completed parent lacks PASS receipt');
  check(parent.persistentReceiptPath === 'artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_LIBRARY_RECEIPT.json', 'completed parent receipt path mismatch');
}

for (const receipt of [aReceipt, bReceipt, cReceipt]) {
  check(receipt.status === 'PASS', `${receipt.step} receipt status mismatch`);
  check(receipt.officialStepStatus === 'COMPLETED', `${receipt.step} not COMPLETED`);
  check(receipt.validationStatus === 'PASS', `${receipt.step} validation not PASS`);
  check(receipt.persistentReceiptStatus === 'PASS', `${receipt.step} persistent receipt not PASS`);
}
check(d0Receipt.status === 'PASS', 'D0 receipt not PASS');
check(d0Receipt.parentStepStatus === 'IN_PROGRESS', 'D0 receipt parent state mismatch');
check(d0Readback.status === 'PASS', 'D0 readback not PASS');

const bindings = bindingMap(artifact.sourceBindings);
for (const [id, path] of Object.entries(paths)) {
  const bytes = await readFile(path);
  const binding = bindings.get(id);
  check(Boolean(binding), `missing source binding ${id}`);
  check(binding?.path === path, `${id} binding path mismatch`);
  check(binding?.sizeBytes === bytes.length, `${id} binding size mismatch`);
  check(binding?.sha256 === sha256(bytes), `${id} binding SHA mismatch`);
}

check(deepEqual(artifact.consolidatedSummary.authoritativeInputs.availabilityCounts, d2a.summary.availabilityCounts), 'D2-A availability summary mismatch');
check(artifact.consolidatedSummary.authoritativeInputs.inputCount === 36, 'D2-A input count mismatch');
check(artifact.consolidatedSummary.authoritativeInputs.activeAuthorityPathCount === 22, 'D2-A active authority count mismatch');
check(artifact.consolidatedSummary.authoritativeInputs.inputSetFingerprintSha256 === d2a.inputSetFingerprintSha256, 'D2-A fingerprint mismatch');
check(artifact.consolidatedSummary.documents.documentCount === 1437, 'D2-B document count mismatch');
check(artifact.consolidatedSummary.documents.activeAuthorityCount === 22, 'D2-B active authority mismatch');
check(artifact.consolidatedSummary.documents.historicalDocumentCount === 1018, 'D2-B historical document count mismatch');
check(artifact.consolidatedSummary.documents.inventoryFingerprintSha256 === d2b.inventoryFingerprintSha256, 'D2-B fingerprint mismatch');
for (const [key, value] of Object.entries(d2c.summary)) check(deepEqual(artifact.consolidatedSummary.crosswalk[key], value), `D2-C summary mismatch: ${key}`);
check(artifact.consolidatedSummary.crosswalk.crosswalkFingerprintSha256 === d2c.crosswalkFingerprintSha256, 'D2-C crosswalk fingerprint mismatch');
check(artifact.consolidatedSummary.crosswalk.relationFingerprintSha256 === d2c.relationFingerprintSha256, 'D2-C relation fingerprint mismatch');
check(artifact.consolidatedSummary.crosswalk.gapFingerprintSha256 === d2c.gapFingerprintSha256, 'D2-C gap fingerprint mismatch');

check((artifact.gaps ?? []).length === 12, 'consolidated gap count mismatch');
check((gaps.gaps ?? []).length === 12, 'source gap count mismatch');
for (let index = 0; index < 12; index += 1) {
  const source = gaps.gaps[index];
  const consolidated = artifact.gaps[index];
  check(Boolean(consolidated), `missing consolidated gap ${index}`);
  for (const [key, value] of Object.entries(source)) check(deepEqual(consolidated?.[key], value), `${source.id} field mismatch: ${key}`);
  check(consolidated?.countedAsPass === false, `${source.id} countedAsPass must be false`);
  check(!['PASS','DIAGNOSTIC_PASS','NOT_RUN','BLOCKED','PENDING'].includes(source.status), `${source.id} invalid source status ${source.status}`);
}
check(artifact.consolidatedSummary.gaps.total === 12, 'gap total summary mismatch');
check(artifact.consolidatedSummary.gaps.unresolved === 12, 'unresolved gap summary mismatch');
check(artifact.consolidatedSummary.gaps.countedAsPass === 0, 'open gaps counted as PASS');
check(artifact.consolidatedSummary.gaps.fingerprintSha256 === gaps.gapFingerprintSha256, 'gap register fingerprint binding mismatch');

const fingerprintBasis = {
  release: artifact.release,
  sourceBindings: Object.fromEntries((artifact.sourceBindings ?? []).map((entry) => [entry.id, entry.sha256])),
  consolidatedSummary: artifact.consolidatedSummary,
  gaps: artifact.gaps
};
check(artifact.consolidatedFingerprintSha256 === sha256(Buffer.from(stableStringify(fingerprintBasis))), 'consolidated fingerprint mismatch');

const completed = artifact.completedSubsteps ?? [];
check(deepEqual(completed.map((entry) => entry.id), ['29-D2-A','29-D2-B','29-D2-C']), 'completed substep ordering mismatch');
for (const entry of completed) {
  check(entry.status === 'COMPLETED', `${entry.id} completed status mismatch`);
  check(entry.validationStatus === 'PASS', `${entry.id} validation mismatch`);
  check(entry.persistentReceiptStatus === 'PASS', `${entry.id} receipt mismatch`);
}

const validState = artifact.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
  ? artifact.validationStatus === 'PENDING' && artifact.persistentReceiptStatus === 'PENDING'
  : artifact.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS'
    && artifact.validationStatus === 'PASS' && artifact.persistentReceiptStatus === 'PASS';
check(validState, `invalid D1 state ${artifact.status}/${artifact.validationStatus}/${artifact.persistentReceiptStatus}`);
if (artifact.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS') {
  const receipt = await readJson('artifacts/checkpoints/29-D2-D1_LIBRARY_RECEIPT.json');
  check(receipt.status === 'PASS', 'D1 Library receipt not PASS');
  check(receipt.parentStepStatus === 'IN_PROGRESS', 'D1 receipt parent must remain IN_PROGRESS');
  check(receipt.officialParentCompletionClaimed === false, 'D1 receipt must not complete parent');
  const parentStep = (plan.steps ?? []).find((entry) => entry.id === '29-D2-D');
  const d1Substep = parentStep?.substeps?.find((entry) => entry.id === '29-D2-D1');
  const d2Substep = parentStep?.substeps?.find((entry) => entry.id === '29-D2-D2');
  check(d1Substep?.status === 'COMPLETED', 'D1 substep not COMPLETED in work plan');
  check(d1Substep?.validationStatus === 'PASS', 'D1 substep validation not PASS');
  check(d1Substep?.persistentReceiptStatus === 'PASS', 'D1 substep receipt not PASS');
  check(['PENDING','IN_PROGRESS','BLOCKED','COMPLETED'].includes(d2Substep?.status), 'D2 substep has invalid downstream state');
  if (d2Substep?.status === 'COMPLETED') {
    check(d2Substep.validationStatus === 'PASS', 'completed D2 substep validation not PASS');
    check(d2Substep.persistentReceiptStatus === 'PASS', 'completed D2 substep receipt not PASS');
  }
}

for (const path of ['artifacts/inventory/29-D2-D1_GAP_REGISTER.csv','docs/audit/29-D2-D1_BIRLESIK_ENVANTER_TASLAGI.md']) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}

const report = {
  schemaVersion: 1,
  release: artifact.release,
  workStep: artifact.workStep,
  checks,
  failures,
  parentCompletionClaimed: false,
  openGapCount: 12,
  openGapsCountedAsPass: 0,
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-D1-consolidated-inventory.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`29-D2-D1 Consolidated Inventory: PASS (${checks} checks / 12 gaps preserved / parent IN_PROGRESS).`);
