import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const [policy, registry, plan, governance, authority, completion30M, capacity] = await Promise.all([
  readJson('config/bronze-backlog-priority-policy.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('artifacts/authority/30-N_AUTO_PRIORITY_SELECTION_AUTHORITY.json'),
  readJson('artifacts/checkpoints/30-M_COMPLETION_RECORD.json'),
  readJson('config/conversation-capacity-policy.json')
]);

const selected = registry.requirements.find((item) => item.id === 'PPK-002');
const b002 = registry.requirements.find((item) => item.id === 'B0-02');
const previous = plan.steps.find((item) => item.id === '30-M');
const current = plan.steps.find((item) => item.id === '30-N');
const successor = plan.steps.find((item) => item.id === '30-O');
const activeSteps = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
const successorRegression = process.argv.includes('--successor-regression') || plan.currentStep !== '30-N' || current?.status === 'COMPLETED';
const reportPath = successorRegression
  ? 'artifacts/validation/30-O-30-N-archive-priority-selection-regression.json'
  : 'artifacts/validation/30-N-archive-priority-selection-contract.json';
const completion30N = successorRegression ? await readJson('artifacts/checkpoints/30-N_COMPLETION_RECORD.json') : null;
const selection30N = successorRegression
  ? policy.selectionHistory?.find((item) => item.step === '30-N') ?? (policy.currentSelection?.step === '30-N' ? policy.currentSelection : undefined)
  : policy.currentSelection;
const closureBoundary = successorRegression && plan.currentStep === '30-N' && current?.status === 'COMPLETED';
const successorActive = successorRegression && plan.currentStep === '30-O';

check(policy.authorityDecision === 'DEC-137', 'DEC-137 priority authority missing');
check(policy.mode === 'FULL_AUTO_INCOMPLETE_BRONZE_EXECUTION', 'full-auto priority mode missing');
check(selection30N?.step === '30-N', successorRegression ? '30-N historical selection is missing' : 'current selection step must be 30-N');
check(selection30N?.requirementId === 'PPK-002', '30-N selection requirement must be PPK-002');
check(selection30N?.selectionClass === 'CONTINUING_STARTED_P0_DEPENDENCY_AND_SECURITY_VERTICAL_SLICE', '30-N selection class mismatch');
if (successorRegression && policy.currentSelection?.step !== '30-N') {
  check(selection30N?.stepOutcome === 'COMPLETED_PASS_PERSISTENT_RECEIPT_PASS_REQUIREMENT_REMAINS_PARTIAL', '30-N durable selection history outcome missing');
  check(selection30N?.evidence === 'artifacts/checkpoints/30-N_COMPLETION_RECORD.json', '30-N durable selection history evidence mismatch');
}
check(policy.selectionHistory.some((item) => item.step === '30-M' && item.stepOutcome === 'COMPLETED_PASS_PERSISTENT_RECEIPT_PASS_REQUIREMENT_REMAINS_PARTIAL'), '30-M durable selection history missing');
check(Boolean(selected), 'PPK-002 missing from accepted scope');
if (selected) {
  check(selected.status === 'PARTIAL', 'PPK-002 must remain PARTIAL');
  check(selected.priority === 'P0', 'PPK-002 priority must remain P0');
  check(selected.chain.useCase === false && selected.chain.repository === false, 'universal PPK-002 use-case/repository chain must remain open at selection');
}
check(Boolean(b002), 'B0-02 comparison requirement missing');
if (b002) check(b002.status === 'PARTIAL' && b002.priority === 'P0', 'B0-02 comparison state changed');
check(Boolean(previous), '30-M prerequisite step missing');
if (previous) {
  check(previous.status === 'COMPLETED', '30-M prerequisite not completed');
  check(previous.validationStatus === 'PASS', '30-M prerequisite validation not PASS');
  check(previous.persistentReceiptStatus === 'PASS', '30-M prerequisite receipt not PASS');
  check(previous.persistentReceiptPath === 'artifacts/checkpoints/30-M_LIBRARY_RECEIPT.json', '30-M prerequisite receipt path mismatch');
}
check(completion30M.officialStepStatus === 'COMPLETED' && completion30M.persistentReceiptStatus === 'PASS', '30-M completion record does not authorize advancement');
check(completion30M.evidenceBoundary.PPK002 === 'PARTIAL', '30-M completion falsely completed PPK-002');
check(Boolean(current), '30-N work step missing');
if (current) {
  check(current.scopeRequirement === 'PPK-002', '30-N scope requirement mismatch');
  if (successorRegression) {
    check(current.status === 'COMPLETED', '30-N predecessor must be COMPLETED');
    check(current.validationStatus === 'PASS', 'completed 30-N validation must be PASS');
    check(current.persistentReceiptStatus === 'PASS' && current.persistentReceiptPath === 'artifacts/checkpoints/30-N_LIBRARY_RECEIPT.json', 'completed 30-N receipt binding mismatch');
  } else {
    check(current.status === 'IN_PROGRESS', '30-N must be IN_PROGRESS');
    check(current.validationStatus === 'PENDING', '30-N validation must begin PENDING');
    check(current.persistentReceiptStatus === 'PENDING' && current.persistentReceiptPath === null, '30-N receipt must begin PENDING');
  }
}
if (successorRegression) {
  check(Boolean(completion30N), '30-N completion record missing');
  if (completion30N) {
    check(completion30N.officialStepStatus === 'COMPLETED' && completion30N.persistentReceiptStatus === 'PASS', '30-N completion record does not authorize successor work');
    check(completion30N.libraryReceipt?.path === 'artifacts/checkpoints/30-N_LIBRARY_RECEIPT.json', '30-N completion receipt path mismatch');
    check(completion30N.evidenceBoundary?.PPK002 === 'PARTIAL', '30-N completion falsely completed PPK-002');
  }
  check(closureBoundary || successorActive, 'work plan is neither the 30-N closure boundary nor active 30-O');
  if (closureBoundary) {
    check(activeSteps.length === 0, '30-N closure boundary must have no active work step');
    check(governance.libraryUploadStatus === '30-N_RECEIPT_CHAIN_PASS', '30-N closure Library lifecycle mismatch');
    check(governance.activeMicroStep === null, '30-N closure must clear active governance work');
    check(governance.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_30-N_PERSISTENT_RECEIPT', '30-N closure must hand off to automatic priority selection');
  } else if (successorActive) {
    check(successor?.status === 'IN_PROGRESS' && activeSteps.length === 1 && activeSteps[0]?.id === '30-O', '30-O must be the only active successor work step');
    check(governance.libraryUploadStatus === '30-N_RECEIPT_CHAIN_PASS_30-O_IN_PROGRESS', '30-O governance Library lifecycle mismatch');
    check(governance.activeMicroStep === '30-O', 'active governance work step must be 30-O');
    check(governance.nextOfficialTask.startsWith('30-O'), 'next official task must bind 30-O');
  }
  check(governance.supersessions.some((item) => item.id === 'GOV-SUP-30-N-002' && item.evidence === 'artifacts/checkpoints/30-N_COMPLETION_RECORD.json'), '30-N completion governance supersession missing');
} else {
  check(plan.currentStep === '30-N', 'work plan current step must be 30-N');
  check(activeSteps.length === 1 && activeSteps[0]?.id === '30-N', '30-N must be the only active work step');
  check(governance.libraryUploadStatus === '30-M_RECEIPT_CHAIN_PASS_30-N_IN_PROGRESS', 'governance Library lifecycle mismatch');
  check(governance.activeMicroStep === '30-N', 'active governance work step must be 30-N');
  check(governance.nextOfficialTask.startsWith('30-N PPK-002'), 'next official task must bind 30-N PPK-002');
}
check(governance.supersessions.some((item) => item.id === 'GOV-SUP-30-N-001' && item.previousValue === 'AUTO_PRIORITY_SELECTION_AFTER_30-M_PERSISTENT_RECEIPT'), '30-N governance supersession missing');
check(authority.decision === 'DEC-137', '30-N authority must derive from DEC-137');
check(authority.selection.step === '30-N' && authority.selection.requirementId === 'PPK-002', '30-N authority selection mismatch');
check(authority.priorityRationale.roadmapDependencyUnblocking === true && authority.priorityRationale.securityPrivacyDataIntegrityImpact === true, 'priority tie-breaker evidence missing');
check(authority.priorityRationale.archiveDirectRoleFindingsAtSelection === 5, 'archive direct-role baseline must be five');
check(authority.scopeBoundary.PPK002 === 'PARTIAL' && authority.scopeBoundary.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-N authority scope boundary mismatch');
check(authority.mandatoryTruthSentence === TRUTH, '30-N authority truth sentence mismatch');
check(policy.userConfiguredCreditStop.status === 'CANCELLED_BY_USER', 'user 95 percent stop cancellation lost');
check(capacity.actualMetricOnly === true && capacity.hardStopUsedPercent === 90, 'canonical PR-172 policy changed');
check(policy.preservedExternalBlockers.some((item) => item.requirementId === 'B2-01' && item.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'), 'B2-01 native blocker truth missing');

const report = {
  schemaVersion: 1,
  release: registry.release,
  step: successorRegression ? '30-O' : '30-N',
  ...(successorRegression ? { predecessorStep: '30-N' } : {}),
  requirement: 'PPK-002',
  phase: successorRegression ? '30-N_PREDECESSOR_REGRESSION' : 'FULL_AUTO_PRIORITY_SELECTION',
  checks,
  passed: checks - failures.length,
  failed: failures.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  selectionClass: selection30N?.selectionClass ?? null,
  PPK002: 'PARTIAL',
  universalRepositoryEnforcement: 'NOT_COMPLETE',
  B0_02: 'PARTIAL_P0_DEFERRED_BY_DEPENDENCY_AND_SECURITY_TIE_BREAKERS',
  nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
  ...(successorRegression ? {
    evidenceBoundary: {
      historical30NReportMutated: false,
      PPK002: 'PARTIAL',
      universalRepositoryEnforcement: 'NOT_COMPLETE'
    }
  } : {}),
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${successorRegression ? '30-N predecessor archive priority selection regression' : '30-N archive priority selection'}: PASS (${checks}/${checks}).`);
