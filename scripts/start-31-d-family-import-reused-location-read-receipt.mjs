import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  completion31C: 'artifacts/checkpoints/31-C_COMPLETION_RECORD.json',
  receipt31C: 'artifacts/checkpoints/31-C_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-163-ppk-002-family-import-reused-location-read-receipt.md',
  scope: 'config/31-d-family-import-reused-location-read-receipt-scope.json',
  authority: 'artifacts/authority/31-D_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-D_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-D_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [completion, receipt, plan, ledger, registry, scope] = await Promise.all([
  readJson(paths.completion31C), readJson(paths.receipt31C), readJson(paths.plan),
  readJson(paths.ledger), readJson(paths.registry), readJson(paths.scope)
]);
await readFile(full(paths.decision), 'utf8');
const predecessor = plan.steps.find((item) => item.id === '31-C');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.persistentReceiptStatus === 'PASS', '31-C predecessor is not completed PASS');
assert(receipt.status === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '31-C receipt is not PASS');
assert(predecessor?.status === 'COMPLETED' && predecessor.persistentReceiptStatus === 'PASS', '31-C plan predecessor is not complete');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not P0 PARTIAL');
assert(scope.step === '31-D' && scope.status === 'IN_PROGRESS', '31-D scope is invalid');
const checks = [
  ['31-C completion', completion.officialStepStatus === 'COMPLETED'],
  ['31-C receipt', completion.persistentReceiptStatus === 'PASS'],
  ['no active predecessor work', plan.steps.every((item) => item.status !== 'IN_PROGRESS') || plan.currentStep === '31-D'],
  ['started P0 requirement', ppk002.priority === 'P0' && ppk002.status === 'PARTIAL'],
  ['31-C selected next slice', receipt.openBoundaries?.importedEventLocationReadReceiptChain === 'NEXT_SEPARATE_SLICE_FAIL_CLOSED'],
  ['new-location-linked event remains fail-closed', scope.openBoundaries.newlyCreatedLocationLinkedEventImport === 'NOT_COMPLETE_FAIL_CLOSED'],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-D priority selection failed');

const generatedAt = new Date().toISOString();
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-D', requirement: 'PPK-002', status: 'PASS',
  selectionClass: 'CONTINUING_STARTED_P0_FAMILY_IMPORT_REUSED_LOCATION_READ_RECEIPT',
  predecessor: { step: '31-C', status: 'COMPLETED', persistentReceiptStatus: 'PASS', receipt: paths.receipt31C },
  selectedOpenFinding: 'IMPORTED_EVENT_LOCATION_READ_RECEIPT_CHAIN', decision: 'DEC-163', scope: paths.scope,
  supportedBoundary: 'REUSED_EXISTING_LOCATIONS_ONLY', nextSeparateSlice: 'NEWLY_CREATED_LOCATION_LINKED_EVENT_IMPORT',
  PPK002: 'PARTIAL', newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-D', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
let step = plan.steps.find((item) => item.id === '31-D');
if (!step) {
  step = {
    id: '31-D', title: scope.title, scopeRequirement: 'PPK-002', status: 'IN_PROGRESS', validationStatus: 'PENDING',
    localEvidence: [paths.completion31C, paths.receipt31C, paths.authority, paths.validation, paths.decision, paths.scope, paths.execution],
    persistentReceiptStatus: 'PENDING'
  };
  plan.steps.push(step);
} else Object.assign(step, { status: 'IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING' });
plan.currentStep = '31-D';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-C remains immutable COMPLETED/PASS. 31-D is the sole IN_PROGRESS reused-location exact read receipt checkpoint. Newly-created-location-linked events and governed rollback remain fail-closed/open; PPK-002 stays PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);

ledger.libraryUploadStatus = '31-D_IN_PROGRESS_PREDECESSOR_31-C_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-D PPK-002 family import reused-location exact read receipt chain';
ledger.activeMicroStep = '31-D';
ledger.updatedAt = generatedAt;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-D-001')) ledger.supersessions.push({
  id: 'GOV-SUP-31-D-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-C_PERSISTENT_RECEIPT',
  effectiveValue: ledger.nextOfficialTask, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EVIDENCE'
});
await writeJson(paths.ledger, ledger);
for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence);
await writeJson(paths.registry, registry);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-D', requirement: 'PPK-002', title: step.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-C_COMPLETED_RECEIPT_PASS',
  targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, PPK002: 'PARTIAL', newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-D official start: PASS (${checks.length}/${checks.length}); reused-location exact read receipt chain selected.`);
