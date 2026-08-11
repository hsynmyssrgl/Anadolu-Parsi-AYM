import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  completion31F: 'artifacts/checkpoints/31-F_COMPLETION_RECORD.json',
  receipt31F: 'artifacts/checkpoints/31-F_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-167-ppk-002-family-import-governed-rollback-receipt-fence.md',
  scope: 'config/31-g-family-import-governed-rollback-receipt-fence-scope.json',
  authority: 'artifacts/authority/31-G_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-G_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-G_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [completion, receipt, plan, ledger, registry, scope] = await Promise.all([
  readJson(paths.completion31F), readJson(paths.receipt31F), readJson(paths.plan),
  readJson(paths.ledger), readJson(paths.registry), readJson(paths.scope)
]);
await readFile(full(paths.decision), 'utf8');
const predecessor = plan.steps.find((item) => item.id === '31-F');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.persistentReceiptStatus === 'PASS', '31-F predecessor is not completed PASS');
assert(receipt.status === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '31-F receipt is not PASS');
assert(receipt.openBoundaries?.governedImportRollbackReceiptFence === 'NEXT_SEPARATE_SLICE_FAIL_CLOSED', '31-F did not authorize the governed rollback slice');
assert(predecessor?.status === 'COMPLETED' && predecessor.persistentReceiptStatus === 'PASS', '31-F plan predecessor is not complete');
assert(plan.steps.every((item) => item.status !== 'IN_PROGRESS'), 'Another work step is already active');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not P0 PARTIAL');
assert(scope.step === '31-G' && scope.status === 'IN_PROGRESS', '31-G scope is invalid');
const checks = [
  ['31-F completion', completion.officialStepStatus === 'COMPLETED'],
  ['31-F receipt', completion.persistentReceiptStatus === 'PASS'],
  ['single active step', plan.steps.every((item) => item.status !== 'IN_PROGRESS')],
  ['started P0 requirement', ppk002.priority === 'P0' && ppk002.status === 'PARTIAL'],
  ['31-F open boundary selected', receipt.openBoundaries.governedImportRollbackReceiptFence === 'NEXT_SEPARATE_SLICE_FAIL_CLOSED'],
  ['atomic delete receipt fence required', scope.targets.transactionBoundary.includes('ONE_SQLITE_TRANSACTION')],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-G priority selection failed');

const generatedAt = new Date().toISOString();
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-G', requirement: 'PPK-002', status: 'PASS',
  selectionClass: 'CONTINUING_STARTED_P0_FAMILY_IMPORT_GOVERNED_ROLLBACK_DELETE_RECEIPT_FENCE',
  predecessor: { step: '31-F', status: 'COMPLETED', persistentReceiptStatus: 'PASS', receipt: paths.receipt31F },
  selectedOpenFinding: 'GOVERNED_IMPORT_ROLLBACK_RECEIPT_FENCE', sourceReceipt: paths.receipt31F,
  decision: 'DEC-167', scope: paths.scope, supportedBoundary: 'IMPORT_BATCH_CREATED_GOVERNED_EVENT_AND_LOCATION_DELETE_ONLY',
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-G', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
const step = {
  id: '31-G', title: scope.title, scopeRequirement: 'PPK-002', status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.completion31F, paths.receipt31F, paths.authority, paths.validation, paths.decision, paths.scope, paths.execution],
  persistentReceiptStatus: 'PENDING'
};
plan.steps.push(step);
plan.currentStep = '31-G';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-F remains immutable COMPLETED/PASS. 31-G is the sole IN_PROGRESS family-import governed rollback exact delete receipt checkpoint. PPK-002 stays PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-G_IN_PROGRESS_PREDECESSOR_31-F_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-G PPK-002 family import governed rollback exact delete receipt fence';
ledger.activeMicroStep = '31-G';
ledger.updatedAt = generatedAt;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-G-001')) ledger.supersessions.push({
  id: 'GOV-SUP-31-G-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-F_PERSISTENT_RECEIPT',
  effectiveValue: ledger.nextOfficialTask, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EVIDENCE'
});
await writeJson(paths.ledger, ledger);
for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence);
await writeJson(paths.registry, registry);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-G', requirement: 'PPK-002', title: step.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-F_COMPLETED_RECEIPT_PASS',
  targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, PPK002: 'PARTIAL', newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-G official start: PASS (${checks.length}/${checks.length}); governed rollback delete receipt fence selected.`);
