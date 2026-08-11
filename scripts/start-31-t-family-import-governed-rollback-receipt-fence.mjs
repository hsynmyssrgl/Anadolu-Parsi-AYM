import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json',
  scope: 'config/31-t-family-import-governed-rollback-receipt-fence-scope.json',
  deferredScope: 'config/31-g-family-import-governed-rollback-receipt-fence-scope.json',
  decision: 'docs/decisions/DEC-181-ppk-002-family-import-governed-rollback-receipt-fence.md',
  deferredDecision: 'docs/decisions/DEC-167-ppk-002-family-import-governed-rollback-receipt-fence.md',
  completion31S: 'artifacts/checkpoints/31-S_COMPLETION_RECORD.json',
  receipt31S: 'artifacts/checkpoints/31-S_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_AUTHORITY.json',
  validation: 'artifacts/validation/31-T_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-T_EXECUTION_RECORD.json',
  failures: 'artifacts/checkpoints/31-T_INITIAL_VALIDATION_FAILURES.json'
};
const queuePath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'CURRENT_QUEUE_STATE.json');
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [plan, ledger, registry, decisions, scope, deferredScope, completion, receipt, queue, decisionText, deferredDecisionText] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.deferredScope), readJson(paths.completion31S), readJson(paths.receipt31S),
  readFile(queuePath, 'utf8').then(JSON.parse), readFile(full(paths.decision), 'utf8'), readFile(full(paths.deferredDecision), 'utf8')
]);
const predecessor = plan.steps.find((item) => item.id === '31-S');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(plan.currentStep === '31-S' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-S is not completed PASS');
assert(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-S external receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-S_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-S ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-T'), '31-T already exists');
assert(plan.steps.every((item) => item.status !== 'IN_PROGRESS'), 'Another work step is active');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not open P0 PARTIAL');
assert(scope.status === 'NOT_STARTED' && scope.step === '31-T' && scope.decision === 'DEC-181', '31-T scope is not startable');
assert(deferredScope.status === 'SUPERSEDED_BY_DEC_168' && deferredScope.targetSliceStatus === 'IMPLEMENTATION_PENDING', 'Deferred DEC-167 boundary is not preserved');
assert(decisionText.includes('Status: ACTIVE') && deferredDecisionText.includes('31-G'), 'Decision documents are not present');
assert(queue.status === '31-S_APPLIED_COMPLETED_RECEIPT_PASS' && queue.next?.id === 'AUTO_PRIORITY_SELECTION_AFTER_31-S', 'Future queue does not authorize automatic priority selection');
assert(queue.authoritativeSourceSha256 === 'e9a01ad6e102bc2358c2e83f3e1717af2b10cf90e7a964107e65baf749764a96' && queue.authoritativeSourceFileCount === 4435, '31-T start source binding is stale');

const checks = [
  ['31-S predecessor completed receipt', true],
  ['single active step', true],
  ['PPK-002 P0 PARTIAL', true],
  ['DEC-167 deferred boundary preserved', true],
  ['DEC-181 continuation active', true],
  ['migration 68 selected', scope.targets.migration === 68],
  ['fresh exact delete receipt per governed row', scope.targets.policyIntents === 'ONE_FRESH_EXACT_DELETE_RECEIPT_PER_GOVERNED_ROW'],
  ['one SQLite transaction', scope.targets.transactionBoundary.endsWith('ONE_SQLITE_TRANSACTION')],
  ['immutable single-use tombstone', scope.targets.consumption === 'IMMUTABLE_SINGLE_USE_ROLLBACK_DELETION_TOMBSTONE'],
  ['completion fence', scope.targets.completionFence.includes('ALL_CREATED_ROWS_ABSENT')],
  ['legacy null receipt compatibility', scope.targets.legacyCompatibility.includes('NULL_RECEIPT')],
  ['no requirement or Build completion claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-T priority selection failed');

const generatedAt = new Date().toISOString();
Object.assign(scope, { status: 'IN_PROGRESS', targetSliceStatus: 'IMPLEMENTED_AWAITING_GOVERNED_VALIDATION', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', startedAt: generatedAt });
await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-T', requirement: 'PPK-002', status: 'PASS',
  authority: 'EXPLICIT_USER_FULL_AUTO_CONTINUATION_AFTER_31_S', decision: 'DEC-181', deferredBoundaryDecision: 'DEC-167',
  predecessor: { step: '31-S', completion: paths.completion31S, receipt: paths.receipt31S, status: 'PASS' },
  authoritativeSourceAtStart: { treeSha256: queue.authoritativeSourceSha256, fileCount: queue.authoritativeSourceFileCount },
  selectedBoundary: 'FAMILY_IMPORT_GOVERNED_ROLLBACK_EXACT_DELETE_RECEIPT_FENCE',
  PPK002: 'PARTIAL', requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-T', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
plan.steps.push({
  id: '31-T', title: scope.title, scopeRequirement: 'PPK-002', status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.completion31S, paths.receipt31S, paths.authority, paths.validation, paths.decision, paths.scope, paths.execution, paths.failures],
  persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-T';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-S remains immutable COMPLETED/PASS. 31-T is the sole IN_PROGRESS PPK-002 family-import governed rollback exact delete receipt fence. PPK-002 remains PARTIAL and no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-T_IN_PROGRESS_PREDECESSOR_31-S_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title;
ledger.activeMicroStep = '31-T';
ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-T-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-S_PERSISTENT_RECEIPT',
  effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_FULL_AUTO_CONTINUATION'
});
await writeJson(paths.ledger, ledger);
for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence);
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-181')) decisions.decisions.push({
  id: 'DEC-181', date: '2026-08-11', acceptedAt: '2026-08-11', title: scope.title, status: 'ACTIVE',
  source: 'Explicit user instruction: Full auto; continue PPK-002 in governed order', document: paths.decision,
  requirements: ['PPK-002'],
  codeAreas: [
    'packages/database/src/family-database-migrations.ts', 'packages/repository-contracts/src/family-data-import-repository.ts',
    'packages/repositories/src/family-data-import-repository.ts', 'apps/desktop/src/main/family-data-import-service.ts',
    'apps/desktop/src/main/family-data-import-policy-batch-runner.ts', 'apps/desktop/tests/family-data-import-governed-rollback-runtime.test.ts'
  ],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length;
await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-T', requirement: 'PPK-002', title: scope.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-S_COMPLETED_RECEIPT_PASS',
  targetSliceStatus: 'IMPLEMENTED_AWAITING_GOVERNED_VALIDATION', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, PPK002: 'PARTIAL', requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
await writeJson(paths.failures, {
  schemaVersion: 1, release: plan.release, step: '31-T', status: 'FAILED_ATTEMPTS_RETAINED_NOT_COUNTED_AS_PASS', countsAsPass: false,
  failures: [{
    name: 'Targeted governed rollback runtime first attempt',
    cause: 'Historical governed-location rollback blocker remained unconditional after migration 68',
    remediation: 'The blocker now applies only when the governed rollback receipt-fence table is absent',
    rerunStatus: 'PASS_1_OF_1',
    countsAsPass: false
  }], generatedAt
});
console.log(`31-T official start: PASS (${checks.length}/${checks.length}); governed rollback delete receipt fence selected.`);
