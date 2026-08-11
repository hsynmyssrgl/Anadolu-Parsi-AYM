import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  completion31E: 'artifacts/checkpoints/31-E_COMPLETION_RECORD.json',
  receipt31E: 'artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json',
  receipt31D: 'artifacts/checkpoints/31-D_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-166-ppk-002-family-import-created-location-linked-event.md',
  scope: 'config/31-f-family-import-created-location-linked-event-scope.json',
  authority: 'artifacts/authority/31-F_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-F_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-F_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [completion, receipt, receipt31D, plan, ledger, registry, scope] = await Promise.all([
  readJson(paths.completion31E), readJson(paths.receipt31E), readJson(paths.receipt31D),
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.scope)
]);
await readFile(full(paths.decision), 'utf8');
const predecessor = plan.steps.find((item) => item.id === '31-E');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.persistentReceiptStatus === 'PASS', '31-E predecessor is not completed PASS');
assert(receipt.status === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '31-E receipt is not PASS');
assert(predecessor?.status === 'COMPLETED' && predecessor.persistentReceiptStatus === 'PASS', '31-E plan predecessor is not complete');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not P0 PARTIAL');
assert(scope.step === '31-F' && scope.status === 'IN_PROGRESS', '31-F scope is invalid');
const checks = [
  ['31-E completion', completion.officialStepStatus === 'COMPLETED'],
  ['31-E receipt', completion.persistentReceiptStatus === 'PASS'],
  ['no active predecessor work', plan.steps.every((item) => item.status !== 'IN_PROGRESS') || plan.currentStep === '31-F'],
  ['started P0 requirement', ppk002.priority === 'P0' && ppk002.status === 'PARTIAL'],
  ['31-D open boundary selected', receipt31D.openBoundaries?.newlyCreatedLocationLinkedEventImport === 'NEXT_SEPARATE_SLICE_FAIL_CLOSED'],
  ['dependent completion fence required', scope.targets.completionFence === 'CREATED_ROW_FAMILY_OWNER_AND_CREATE_RECEIPT_MATCH_BEFORE_COMMIT'],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-F priority selection failed');

const generatedAt = new Date().toISOString();
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-F', requirement: 'PPK-002', status: 'PASS',
  selectionClass: 'CONTINUING_STARTED_P0_FAMILY_IMPORT_CREATED_LOCATION_LINKED_EVENT',
  predecessor: { step: '31-E', status: 'COMPLETED', persistentReceiptStatus: 'PASS', receipt: paths.receipt31E },
  selectedOpenFinding: 'NEWLY_CREATED_LOCATION_LINKED_EVENT_IMPORT', sourceReceipt: paths.receipt31D,
  decision: 'DEC-166', scope: paths.scope, supportedBoundary: 'CREATED_LOCATION_LINKED_EVENT_ONLY',
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-F', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
let step = plan.steps.find((item) => item.id === '31-F');
if (!step) {
  step = {
    id: '31-F', title: scope.title, scopeRequirement: 'PPK-002', status: 'IN_PROGRESS', validationStatus: 'PENDING',
    localEvidence: [paths.completion31E, paths.receipt31E, paths.receipt31D, paths.authority, paths.validation, paths.decision, paths.scope, paths.execution],
    persistentReceiptStatus: 'PENDING'
  };
  plan.steps.push(step);
} else Object.assign(step, { status: 'IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING' });
plan.currentStep = '31-F';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-E remains immutable COMPLETED/PASS. 31-F is the sole IN_PROGRESS newly-created-location linked-event atomic policy checkpoint. PPK-002 stays PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);

ledger.libraryUploadStatus = '31-F_IN_PROGRESS_PREDECESSOR_31-E_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-F PPK-002 family import newly-created-location linked event atomic policy chain';
ledger.activeMicroStep = '31-F';
ledger.updatedAt = generatedAt;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-F-001')) ledger.supersessions.push({
  id: 'GOV-SUP-31-F-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-E_PERSISTENT_RECEIPT',
  effectiveValue: ledger.nextOfficialTask, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EVIDENCE'
});
await writeJson(paths.ledger, ledger);
for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence);
await writeJson(paths.registry, registry);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-F', requirement: 'PPK-002', title: step.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-E_COMPLETED_RECEIPT_PASS',
  targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, PPK002: 'PARTIAL', newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-F official start: PASS (${checks.length}/${checks.length}); created-location linked-event chain selected.`);
