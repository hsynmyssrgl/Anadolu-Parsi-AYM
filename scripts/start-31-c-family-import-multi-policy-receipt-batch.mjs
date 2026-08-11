import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  completion31B: 'artifacts/checkpoints/31-B_COMPLETION_RECORD.json',
  receipt31B: 'artifacts/checkpoints/31-B_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-161-ppk-002-family-import-multi-policy-receipt-batch.md',
  scope: 'config/31-c-family-import-multi-policy-receipt-batch-scope.json',
  authority: 'artifacts/authority/31-C_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-C_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-C_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [completion, receipt, plan, ledger, registry, scope] = await Promise.all([
  readJson(paths.completion31B), readJson(paths.receipt31B), readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.scope)
]);
await readFile(full(paths.decision), 'utf8');
assert(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.persistentReceiptStatus === 'PASS', '31-B predecessor is not completed PASS');
assert(receipt.status === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '31-B receipt is not PASS');
const step31B = plan.steps.find((item) => item.id === '31-B');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(step31B?.status === 'COMPLETED' && step31B.persistentReceiptStatus === 'PASS', '31-B plan predecessor is not complete');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not P0 PARTIAL');
assert(scope.step === '31-C' && scope.status === 'IN_PROGRESS', '31-C scope is invalid');
const checks = [
  ['31-B completion', completion.officialStepStatus === 'COMPLETED'],
  ['31-B receipt', completion.persistentReceiptStatus === 'PASS'],
  ['no active predecessor work', plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0 || plan.currentStep === '31-C'],
  ['started P0 requirement', ppk002.priority === 'P0' && ppk002.status === 'PARTIAL'],
  ['31-B selected next slice', receipt.openBoundaries?.familyDataImportMultiReceiptBatch === 'NEXT_SEPARATE_SLICE'],
  ['location-linked events remain fail-closed', scope.openBoundaries.importedEventLocationReadReceiptChain === 'NOT_COMPLETE_FAIL_CLOSED'],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-C priority selection failed');

const generatedAt = new Date().toISOString();
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-C', requirement: 'PPK-002', status: 'PASS',
  selectionClass: 'CONTINUING_STARTED_P0_FAMILY_IMPORT_MULTI_POLICY_RECEIPT_BATCH',
  predecessor: { step: '31-B', status: 'COMPLETED', persistentReceiptStatus: 'PASS', receipt: paths.receipt31B },
  selectedOpenFinding: 'FAMILY_DATA_IMPORT_MULTI_RECEIPT_BATCH', decision: 'DEC-161', scope: paths.scope,
  nextSeparateSlice: 'IMPORTED_EVENT_LOCATION_READ_RECEIPT_CHAIN', PPK002: 'PARTIAL', newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-C', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
let step31C = plan.steps.find((item) => item.id === '31-C');
if (!step31C) {
  step31C = {
    id: '31-C', title: scope.title, scopeRequirement: 'PPK-002', status: 'IN_PROGRESS', validationStatus: 'PENDING',
    localEvidence: [paths.completion31B, paths.receipt31B, paths.authority, paths.validation, paths.decision, paths.scope, paths.execution],
    persistentReceiptStatus: 'PENDING'
  };
  plan.steps.push(step31C);
} else Object.assign(step31C, { status: 'IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING' });
plan.currentStep = '31-C';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-B remains immutable COMPLETED/PASS. 31-C is the sole IN_PROGRESS family import multi-policy receipt atomic batch checkpoint. Location-linked event import and governed rollback remain fail-closed/open; PPK-002 stays PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);

ledger.libraryUploadStatus = '31-C_IN_PROGRESS_PREDECESSOR_31-B_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-C PPK-002 family import multi-policy receipt atomic batch';
ledger.activeMicroStep = '31-C';
ledger.updatedAt = generatedAt;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-C-001')) ledger.supersessions.push({
  id: 'GOV-SUP-31-C-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT',
  effectiveValue: ledger.nextOfficialTask, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EVIDENCE'
});
await writeJson(paths.ledger, ledger);
for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence);
await writeJson(paths.registry, registry);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-C', requirement: 'PPK-002', title: step31C.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-B_COMPLETED_RECEIPT_PASS',
  targetSliceStatus: 'IMPLEMENTED_LOCAL_EVIDENCE_PRESENT', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, PPK002: 'PARTIAL', newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-C official start: PASS (${checks.length}/${checks.length}); family import multi-policy receipt batch selected.`);
