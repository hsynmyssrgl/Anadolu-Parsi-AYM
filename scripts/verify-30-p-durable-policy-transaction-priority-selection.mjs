import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT = 'artifacts/validation/30-P-durable-policy-transaction-priority-selection-contract.json';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const [
  policy,
  registry,
  plan,
  governance,
  authority,
  completion30O,
  receipt30O,
  scope,
  capacity,
  decision,
  priorityRegression,
  executionRegression,
  contractRegression,
  runtimeRegression
] = await Promise.all([
  readJson('config/bronze-backlog-priority-policy.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('artifacts/authority/30-P_AUTO_PRIORITY_SELECTION_AUTHORITY.json'),
  readJson('artifacts/checkpoints/30-O_COMPLETION_RECORD.json'),
  readJson('artifacts/checkpoints/30-O_LIBRARY_RECEIPT.json'),
  readJson('config/30-p-durable-policy-transaction-scope.json'),
  readJson('config/conversation-capacity-policy.json'),
  readFile('docs/decisions/DEC-141-ppk-002-durable-policy-transaction-replay-and-fencing.md', 'utf8'),
  readJson('artifacts/validation/30-P-30-O-archive-production-priority-selection-regression.json'),
  readJson('artifacts/validation/30-P-30-O-execution-record-regression.json'),
  readJson('artifacts/validation/30-P-30-O-archive-production-composition-contract-regression-clean.json'),
  readJson('artifacts/validation/30-P-30-O-archive-production-composition-runtime-regression-clean.json')
]);

const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
const previous = plan.steps.find((item) => item.id === '30-O');
const current = plan.steps.find((item) => item.id === '30-P');
const activeSteps = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
const expectedEvidence = [
  'artifacts/authority/30-P_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  'docs/decisions/DEC-141-ppk-002-durable-policy-transaction-replay-and-fencing.md',
  'config/30-p-durable-policy-transaction-scope.json',
  'artifacts/validation/30-P-30-O-archive-production-priority-selection-regression.json',
  'artifacts/validation/30-P-30-O-execution-record-regression.json',
  'artifacts/validation/30-P-30-O-archive-production-composition-contract-regression.json',
  'artifacts/validation/30-P-30-O-archive-production-composition-runtime-regression.json',
  'artifacts/validation/30-P_30-O_CONTRACT_REGRESSION_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-P_30-O_RUNTIME_REGRESSION_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-P-30-O-archive-production-composition-contract-regression-clean.json',
  'artifacts/validation/30-P-30-O-archive-production-composition-runtime-regression-clean.json',
  'artifacts/validation/30-P-30-O-archive-production-composition-vitest-regression-clean.json',
  REPORT
];

check(policy.authorityDecision === 'DEC-137', 'DEC-137 priority authority missing');
check(policy.mode === 'FULL_AUTO_INCOMPLETE_BRONZE_EXECUTION', 'full-auto priority mode missing');
check(policy.currentSelection?.step === '30-P', 'current priority selection must be 30-P');
check(policy.currentSelection?.requirementId === 'PPK-002', '30-P priority requirement mismatch');
check(policy.currentSelection?.selectionClass === 'CONTINUING_STARTED_P0_DURABLE_TRANSACTION_AND_REPLAY_INTEGRITY_SLICE', '30-P selection class mismatch');
check(policy.currentSelection?.authority === 'artifacts/authority/30-P_AUTO_PRIORITY_SELECTION_AUTHORITY.json', '30-P priority authority path mismatch');
check(policy.selectionHistory.some((item) => item.step === '30-O' && item.stepOutcome === 'COMPLETED_PASS_PERSISTENT_RECEIPT_PASS_REQUIREMENT_REMAINS_PARTIAL' && item.evidence === 'artifacts/checkpoints/30-O_COMPLETION_RECORD.json'), '30-O durable selection history missing');
check(policy.userConfiguredCreditStop?.status === 'CANCELLED_BY_USER', 'user 95 percent stop cancellation lost');
check(policy.preservedExternalBlockers.some((item) => item.requirementId === 'B2-01' && item.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'), 'B2-01 native blocker truth missing');

check(authority.decision === 'DEC-137', '30-P authority must derive from DEC-137');
check(authority.prerequisite?.step === '30-O' && authority.prerequisite?.status === 'COMPLETED', '30-P prerequisite identity or lifecycle mismatch');
check(authority.prerequisite?.validationStatus === 'PASS' && authority.prerequisite?.persistentReceiptStatus === 'PASS', '30-P prerequisite validation or receipt is not PASS');
check(authority.prerequisite?.completionTransition === 'PASS_33_SEMANTIC_AND_5_PROCESS_GATES', '30-O completion-transition evidence missing');
check(authority.selection?.step === '30-P' && authority.selection?.requirementId === 'PPK-002', '30-P authority selection mismatch');
check(authority.selection?.selectionClass === 'CONTINUING_STARTED_P0_DURABLE_TRANSACTION_AND_REPLAY_INTEGRITY_SLICE', '30-P authority selection class mismatch');
check(authority.selection?.status === 'AUTHORIZED_IN_PROGRESS', '30-P authority lifecycle mismatch');
check(authority.priorityRationale?.startedWorkBeforeUnstartedWork === true && authority.priorityRationale?.priority === 'P0', '30-P priority class is not started P0 work');
check(authority.priorityRationale?.roadmapDependencyUnblocking === true && authority.priorityRationale?.securityPrivacyDataIntegrityImpact === true, '30-P dependency/security tie-breakers missing');
check(authority.priorityRationale?.boundedRunnableScope === true, '30-P bounded runnable scope missing');
check(authority.scopeBoundary?.PPK002 === 'PARTIAL' && authority.scopeBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P authority overclaims PPK-002');
check(authority.scopeBoundary?.durableMultiProcessReplayProtection === 'TARGETED_NOT_YET_PASS', '30-P durable replay target boundary missing');
check(authority.scopeBoundary?.receiptAndBusinessCommitAtomicity === 'TARGETED_NOT_YET_PASS', '30-P receipt/business atomicity target boundary missing');
check(authority.scopeBoundary?.crossProcessFenceAndSQLiteCommitAtomicity === 'TARGETED_NOT_YET_PASS', '30-P database fence target boundary missing');
check(authority.scopeBoundary?.completeTailJournalRollbackDetection === 'NOT_IMPLEMENTED', '30-P complete-tail rollback boundary overclaimed');
check(authority.scopeBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS', '30-P obligation execution boundary overclaimed');
check(authority.scopeBoundary?.requirementCompletionClaimed === false, '30-P authority claims requirement completion');
check(authority.preservedTruth?.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS', '30-P authority overclaims Windows Hello hardware');
check(authority.preservedTruth?.userConfiguredCreditStop95 === 'CANCELLED', '30-P authority lost credit-stop cancellation');
check(authority.mandatoryTruthSentence === TRUTH, '30-P authority truth sentence mismatch');

check(completion30O.officialStepStatus === 'COMPLETED' && completion30O.validationStatus === 'PASS' && completion30O.persistentReceiptStatus === 'PASS', '30-O completion does not authorize 30-P');
check(completion30O.libraryReceipt?.path === 'artifacts/checkpoints/30-O_LIBRARY_RECEIPT.json', '30-O completion receipt binding mismatch');
check(completion30O.libraryReceipt?.sha256 === '785313539be4e61e928eee244d20a9d48f623ff1513be46c813adc7628b69630', '30-O completion receipt SHA mismatch');
check(completion30O.finalLibraryInventory?.status === 'PASS' && completion30O.finalLibraryInventory?.matched === 26 && completion30O.finalLibraryInventory?.failed === 0, '30-O final Library inventory is incomplete');
check(completion30O.implementationValidation?.directProcessChecks === 27 && completion30O.implementationValidation?.directProcessPassed === 27, '30-O direct process evidence incomplete');
check(completion30O.evidenceBoundary?.PPK002 === 'PARTIAL' && completion30O.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-O completion falsely completed PPK-002');
check(completion30O.preReceiptPreservedFailedAttempts === 44 && completion30O.postReceiptPreservedFailedAttempts === 0 && completion30O.totalPreservedFailedAttempts === 44, '30-O preserved-failure totals are incomplete');
check(completion30O.failedAttemptsCountedAsPass === 0, '30-O failed attempts were counted as PASS');
check(completion30O.mandatoryTruthSentence === TRUTH, '30-O completion truth sentence mismatch');
check(receipt30O.status === 'PASS' && receipt30O.validationStatus === 'PASS' && receipt30O.persistentReceiptStatus === 'PASS', '30-O Library receipt is not PASS');
check(receipt30O.preservedFailedAttempts === 44 && receipt30O.failedAttemptsCountedAsPass === 0, '30-O receipt failure boundary mismatch');

check(Boolean(previous), '30-O prerequisite work step missing');
check(previous?.status === 'COMPLETED' && previous?.validationStatus === 'PASS', '30-O prerequisite work step is not completed PASS');
check(previous?.persistentReceiptStatus === 'PASS' && previous?.persistentReceiptPath === 'artifacts/checkpoints/30-O_LIBRARY_RECEIPT.json', '30-O prerequisite receipt path mismatch');
check(Boolean(current), '30-P work step missing');
check(current?.scopeRequirement === 'PPK-002', '30-P work-step requirement mismatch');
check(current?.status === 'IN_PROGRESS' && current?.validationStatus === 'PENDING', '30-P work step must begin IN_PROGRESS/PENDING');
check(current?.persistentReceiptStatus === 'PENDING' && current?.persistentReceiptPath === null, '30-P receipt must begin PENDING');
check(plan.currentStep === '30-P', 'work plan current step must be 30-P');
check(activeSteps.length === 1 && activeSteps[0]?.id === '30-P', '30-P must be the only active work step');
check(expectedEvidence.every((path) => current?.localEvidence?.includes(path)), '30-P work step does not bind all selection/regression evidence');

check(governance.libraryUploadStatus === '30-O_RECEIPT_CHAIN_PASS_30-P_IN_PROGRESS', '30-P governance Library lifecycle mismatch');
check(governance.activeMicroStep === '30-P', 'active governance work step must be 30-P');
check(governance.nextOfficialTask === '30-P PPK-002 durable archive policy transaction, multi-process replay, database-enforced fencing and receipt/business atomicity slice', 'next official task does not exactly bind 30-P');
check(governance.supersessions.some((item) => item.id === 'GOV-SUP-30-P-001' && item.previousValue === 'AUTO_PRIORITY_SELECTION_AFTER_30-O_PERSISTENT_RECEIPT' && item.evidence === 'artifacts/authority/30-P_AUTO_PRIORITY_SELECTION_AUTHORITY.json'), '30-P governance supersession missing');

check(Boolean(ppk002), 'PPK-002 missing from accepted scope');
check(ppk002?.status === 'PARTIAL' && ppk002?.priority === 'P0', 'accepted PPK-002 must remain P0/PARTIAL');
check(ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false, 'universal PPK-002 use-case/repository chain must remain open');
check(expectedEvidence.every((path) => ppk002?.evidence?.includes(path)), 'accepted PPK-002 does not bind all 30-P selection/regression evidence');

check(scope.step === '30-P' && scope.requirement === 'PPK-002', '30-P scope identity mismatch');
check(scope.scope === 'ARCHIVE_DURABLE_POLICY_TRANSACTION_REPLAY_FENCING_AND_ATOMIC_RECEIPT_SLICE', '30-P canonical scope mismatch');
check(scope.predecessor?.step === '30-O' && scope.predecessor?.productionArchiveCompositionSlice === 'PASS' && scope.predecessor?.persistentReceiptStatus === 'PASS', '30-P scope predecessor binding mismatch');
check(Array.isArray(scope.targets) && scope.targets.length === 7, '30-P scope must declare exactly seven integrity targets');
check(JSON.stringify(scope.targets?.map((item) => item.id)) === JSON.stringify([
  'durable-sqlite-replay-reservation',
  'database-enforced-write-fence',
  'atomic-policy-receipt-and-business-commit',
  'archive-audit-outbox-receipt-binding',
  'durable-protected-journal-projection',
  'crash-restart-recovery',
  'two-process-race-runtime'
]), '30-P target set mismatch');
check(Array.isArray(scope.requiredOrder) && scope.requiredOrder.length === 12, '30-P enforcement order is incomplete');
check(scope.requiredOrder?.[1] === 'durable-replay-reservation' && scope.requiredOrder?.[4] === 'database-fence-validation' && scope.requiredOrder?.[6] === 'atomic-policy-receipt-insert', '30-P critical enforcement order mismatch');
check(Object.values(scope.runtimeProofRequirements ?? {}).every((value) => value === true || value === false) && scope.runtimeProofRequirements?.legacyAuthorizationFallback === false, '30-P runtime proof requirements malformed');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL' && scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P scope overclaims PPK-002');
check(scope.evidenceBoundary?.completeTailJournalRollbackDetection === 'NOT_IMPLEMENTED', '30-P scope overclaims complete-tail rollback detection');
check(scope.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS', '30-P scope overclaims obligation execution');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, '30-P scope claims PPK-002 completion');
check(scope.mandatoryTruthSentence === TRUTH, '30-P scope truth sentence mismatch');

check(decision.includes('# DEC-141'), 'DEC-141 heading missing');
check(decision.includes('PPK-002 `PARTIAL`'), 'DEC-141 partial-scope truth missing');
check(decision.includes('evrensel repository enforcement'), 'DEC-141 universal boundary missing');
check(decision.includes('complete-tail rollback detection `NOT_IMPLEMENTED`'), 'DEC-141 complete-tail rollback boundary missing');
check(decision.includes('Native etkileşimli Windows Hello') && decision.includes('`NOT_RUN_NOT_PASS`'), 'DEC-141 hardware truth missing');
check(decision.includes(TRUTH), 'DEC-141 truth sentence mismatch');

for (const [name, report, minimumChecks] of [
  ['priority', priorityRegression, 54],
  ['execution', executionRegression, 59],
  ['contract', contractRegression, 173],
  ['runtime', runtimeRegression, 111]
]) {
  check(report.status === 'PASS', `30-O ${name} successor regression is not PASS`);
  const actualChecks = typeof report.checks === 'number'
    ? report.checks
    : (Number.isInteger(report.checkCount) ? report.checkCount : report.controlledChecks?.actual);
  check(actualChecks >= minimumChecks, `30-O ${name} successor regression check count is incomplete`);
  const failedChecks = Number.isInteger(report.failed)
    ? report.failed
    : (Array.isArray(report.gates) ? report.gates.filter((gate) => gate.status !== 'PASS').length : null);
  check(failedChecks === 0, `30-O ${name} successor regression reports failed checks`);
  check(report.evidenceBoundary?.historical30OReportMutated === false, `30-O ${name} canonical report mutation boundary missing`);
}

const canonicalHashes = {
  'artifacts/validation/30-O-archive-production-priority-selection-contract.json': '28900d4828cea7a189a5959928fc951f6eb8de5f366e7e23c3a473f80da200f2',
  'artifacts/validation/30-O-execution-record-contract.json': 'c5e2ea5ea64981f1aa4e48ea73e423d9646db63e1f5a40365f74d73374eb3dd6',
  'artifacts/validation/30-O-ppk-002-archive-production-composition-contract.json': 'a258fed97f30617e38c8118a5a76595a5a8ca31e93f7b6edbb0b591ad6fa4c15',
  'artifacts/validation/30-O-ppk-002-archive-production-composition-runtime.json': '71a30a765c8a588372d0fc6f0b97dde3baa5b9fdb8ec5ed9f4e44ab357f7e4cd',
  'artifacts/validation/30-O_SECURITY_REAUDIT_CORRECTION.json': '5a203f9a8bd6a3ed6ab8ae52db16756b115fd698a83cb3877b159e521809fb3f',
  'artifacts/checkpoints/30-O_EXECUTION_RECORD.json': '63c43dcb6e7349f543ab019538fdcad714bedee0f170a3f63068d2bf8fdba2b1',
  'artifacts/checkpoints/30-O_COMPLETION_RECORD.json': 'eb649005d011c65cc042602913e119cd80f2e427aee1699914eec9d9489d1daa'
};
for (const [path, expected] of Object.entries(canonicalHashes)) {
  check(await sha256(path) === expected, `historical 30-O canonical evidence changed: ${path}`);
}

check(capacity.actualMetricOnly === true && capacity.hardStopUsedPercent === 90, 'canonical PR-172 policy changed');

const report = {
  schemaVersion: 1,
  release: registry.release,
  step: '30-P',
  requirement: 'PPK-002',
  phase: 'FULL_AUTO_DURABLE_POLICY_TRANSACTION_PRIORITY_SELECTION',
  checks,
  passed: checks - failures.length,
  failed: failures.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  selectionClass: policy.currentSelection?.selectionClass ?? null,
  PPK002: 'PARTIAL',
  universalRepositoryEnforcement: 'NOT_COMPLETE',
  durableMultiProcessReplayProtection: 'TARGETED_NOT_YET_PASS',
  receiptAndBusinessCommitAtomicity: 'TARGETED_NOT_YET_PASS',
  crossProcessFenceAndSQLiteCommitAtomicity: 'TARGETED_NOT_YET_PASS',
  completeTailJournalRollbackDetection: 'NOT_IMPLEMENTED',
  obligationExecution: 'NOT_RUN_NOT_PASS',
  nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
  historical30OCanonicalEvidenceMutated: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`30-P durable policy transaction priority selection: PASS (${checks}/${checks}).`);
