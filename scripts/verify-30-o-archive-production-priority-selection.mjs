import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT = 'artifacts/validation/30-O-archive-production-priority-selection-contract.json';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

const successorRegression = process.argv.includes('--successor-regression');
if (successorRegression) {
  const REGRESSION_REPORT = 'artifacts/validation/30-P-30-O-archive-production-priority-selection-regression.json';
  const AUTHORITY_PATH = 'artifacts/authority/30-P_AUTO_PRIORITY_SELECTION_AUTHORITY.json';
  const SCOPE_PATH = 'config/30-p-durable-policy-transaction-scope.json';
  const CANONICAL_REPORT_PATH = 'artifacts/validation/30-O-archive-production-priority-selection-contract.json';
  const CANONICAL_REPORT_SHA256 = '28900d4828cea7a189a5959928fc951f6eb8de5f366e7e23c3a473f80da200f2';
  const RECEIPT_PATH = 'artifacts/checkpoints/30-O_LIBRARY_RECEIPT.json';
  const regressionFailures = [];
  const regressionChecks = [];
  const regressionCheck = (condition, message) => {
    regressionChecks.push(message);
    if (!condition) regressionFailures.push(message);
  };

  const [policy, registry, plan, governance, authority, scope30P, completion30O, receipt30O, diagnostic30O, canonicalReport30O] = await Promise.all([
    readJson('config/bronze-backlog-priority-policy.json'),
    readJson('config/accepted-scope-registry.json'),
    readJson('config/work-segmentation-plan.json'),
    readJson('config/active-governance-ledger.json'),
    readJson(AUTHORITY_PATH),
    readJson(SCOPE_PATH),
    readJson('artifacts/checkpoints/30-O_COMPLETION_RECORD.json'),
    readJson(RECEIPT_PATH),
    readJson('artifacts/validation/30-O_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json'),
    readJson(CANONICAL_REPORT_PATH)
  ]);

  const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
  const predecessor = plan.steps.find((item) => item.id === '30-O');
  const successor = plan.steps.find((item) => item.id === '30-P');
  const activeSteps = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
  const historicalSelection = policy.selectionHistory?.find((item) => item.step === '30-O');
  const expectedSuccessorEvidence = [
    AUTHORITY_PATH,
    SCOPE_PATH,
    REGRESSION_REPORT,
    'artifacts/validation/30-P-30-O-execution-record-regression.json'
  ];

  regressionCheck(policy.authorityDecision === 'DEC-137', 'DEC-137 priority authority is preserved');
  regressionCheck(policy.mode === 'FULL_AUTO_INCOMPLETE_BRONZE_EXECUTION', 'full-auto priority mode is preserved');
  regressionCheck(policy.currentSelection?.step === '30-P', 'current priority selection is 30-P');
  regressionCheck(policy.currentSelection?.requirementId === 'PPK-002', '30-P priority selection remains bound to PPK-002');
  regressionCheck(policy.currentSelection?.selectionClass === 'CONTINUING_STARTED_P0_DURABLE_TRANSACTION_AND_REPLAY_INTEGRITY_SLICE', '30-P selection class matches the authorized durable-transaction slice');
  regressionCheck(policy.currentSelection?.authority === AUTHORITY_PATH, '30-P current selection binds the canonical authority path');
  regressionCheck(historicalSelection?.requirementId === 'PPK-002', 'historical 30-O selection remains bound to PPK-002');
  regressionCheck(historicalSelection?.selectionClass === 'CONTINUING_STARTED_P0_PRODUCTION_COMPOSITION_AND_RUNTIME_SLICE', 'historical 30-O selection class is preserved');
  regressionCheck(historicalSelection?.stepOutcome === 'COMPLETED_PASS_PERSISTENT_RECEIPT_PASS_REQUIREMENT_REMAINS_PARTIAL', 'historical 30-O completion outcome is durable');
  regressionCheck(historicalSelection?.evidence === 'artifacts/checkpoints/30-O_COMPLETION_RECORD.json', 'historical 30-O selection binds its completion record');

  regressionCheck(Boolean(predecessor), '30-O predecessor work step exists');
  regressionCheck(predecessor?.status === 'COMPLETED' && predecessor?.validationStatus === 'PASS', '30-O predecessor is COMPLETED with validation PASS');
  regressionCheck(predecessor?.persistentReceiptStatus === 'PASS' && predecessor?.persistentReceiptPath === RECEIPT_PATH, '30-O predecessor binds its PASS Library receipt');
  regressionCheck(plan.currentStep === '30-P', 'work plan current step is 30-P');
  regressionCheck(Boolean(successor), '30-P successor work step exists');
  regressionCheck(successor?.scopeRequirement === 'PPK-002', '30-P successor work step is bound to PPK-002');
  regressionCheck(successor?.status === 'IN_PROGRESS' && successor?.validationStatus === 'PENDING', '30-P successor is IN_PROGRESS with validation PENDING');
  regressionCheck(successor?.persistentReceiptStatus === 'PENDING' && successor?.persistentReceiptPath === null, '30-P successor receipt begins PENDING without a path');
  regressionCheck(activeSteps.length === 1 && activeSteps[0]?.id === '30-P', '30-P is the only active work step');
  regressionCheck(expectedSuccessorEvidence.every((path) => successor?.localEvidence?.includes(path)), '30-P work step binds its authority, scope and predecessor regressions');

  regressionCheck(completion30O.step === '30-O' && completion30O.requirement === 'PPK-002', '30-O completion identity is preserved');
  regressionCheck(completion30O.status === 'PASS' && completion30O.officialStepStatus === 'COMPLETED' && completion30O.validationStatus === 'PASS', '30-O completion lifecycle is PASS/COMPLETED/PASS');
  regressionCheck(completion30O.persistentReceiptStatus === 'PASS', '30-O completion persistent receipt is PASS');
  regressionCheck(completion30O.libraryReceipt?.path === RECEIPT_PATH && completion30O.libraryReceipt?.status === 'PASS', '30-O completion binds the PASS Library receipt');
  regressionCheck(completion30O.libraryReceipt?.sizeBytes === (await readFile(RECEIPT_PATH)).byteLength && completion30O.libraryReceipt?.sha256 === await sha256(RECEIPT_PATH), '30-O completion receipt size and SHA-256 binding are exact');
  regressionCheck(completion30O.evidenceBoundary?.PPK002 === 'PARTIAL' && completion30O.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-O completion preserves the PPK-002 partial boundary');
  regressionCheck(completion30O.evidenceBoundary?.requirementCompletionClaimed === false, '30-O completion does not claim PPK-002 completion');
  regressionCheck(completion30O.totalPreservedFailedAttempts === 44 && completion30O.failedAttemptsCountedAsPass === 0, '30-O completion preserves 44 failures and credits none as PASS');

  regressionCheck(receipt30O.step === '30-O' && receipt30O.status === 'PASS' && receipt30O.validationStatus === 'PASS' && receipt30O.persistentReceiptStatus === 'PASS', '30-O Library receipt is a validated persistent PASS');
  regressionCheck(receipt30O.evidenceBoundary?.PPK002 === 'PARTIAL' && receipt30O.evidenceBoundary?.requirementCompletionClaimed === false, '30-O Library receipt preserves the PPK-002 partial boundary');
  regressionCheck(receipt30O.preservedFailedAttempts === 44 && receipt30O.failedAttemptsCountedAsPass === 0, '30-O Library receipt credits none of the 44 failures as PASS');
  regressionCheck(diagnostic30O.status === 'DIAGNOSTIC_ONLY_NOT_PASS' && diagnostic30O.attemptCount === 44 && diagnostic30O.preservedFailedAttempts === 44, '30-O diagnostic aggregate preserves exactly 44 failed attempts as NOT_PASS');
  regressionCheck(diagnostic30O.failedAttemptsCountedAsPass === 0 && diagnostic30O.attempts?.every((attempt) => attempt.countedAsPass === false && attempt.exitCode !== 0), 'no 30-O failed diagnostic attempt is credited as PASS');

  regressionCheck(authority.decision === 'DEC-137', '30-P authority derives from DEC-137');
  regressionCheck(authority.prerequisite?.step === '30-O' && authority.prerequisite?.completionRecord === 'artifacts/checkpoints/30-O_COMPLETION_RECORD.json', '30-P authority binds the 30-O completion prerequisite');
  regressionCheck(authority.prerequisite?.status === 'COMPLETED' && authority.prerequisite?.validationStatus === 'PASS' && authority.prerequisite?.persistentReceiptStatus === 'PASS', '30-P authority prerequisite is COMPLETED/PASS/receipt PASS');
  regressionCheck(authority.selection?.step === '30-P' && authority.selection?.requirementId === 'PPK-002', '30-P authority selection identity is exact');
  regressionCheck(authority.selection?.selectionClass === 'CONTINUING_STARTED_P0_DURABLE_TRANSACTION_AND_REPLAY_INTEGRITY_SLICE' && authority.selection?.status === 'AUTHORIZED_IN_PROGRESS', '30-P authority selection class and lifecycle are exact');
  regressionCheck(authority.scopeBoundary?.PPK002 === 'PARTIAL' && authority.scopeBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P authority preserves the PPK-002 partial boundary');
  regressionCheck(authority.scopeBoundary?.requirementCompletionClaimed === false, '30-P authority does not claim PPK-002 completion');
  regressionCheck(authority.mandatoryTruthSentence === TRUTH, '30-P authority preserves the mandatory truth sentence');
  regressionCheck(scope30P.step === '30-P' && scope30P.requirement === 'PPK-002', '30-P scope identity is exact');
  regressionCheck(scope30P.evidenceBoundary?.PPK002 === 'PARTIAL' && scope30P.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P scope preserves the PPK-002 partial boundary');
  regressionCheck(scope30P.evidenceBoundary?.requirementCompletionClaimed === false, '30-P scope does not claim PPK-002 completion');

  regressionCheck(governance.libraryUploadStatus === '30-O_RECEIPT_CHAIN_PASS_30-P_IN_PROGRESS', '30-P governance Library lifecycle is exact');
  regressionCheck(governance.activeMicroStep === '30-P', '30-P is the active governance work step');
  regressionCheck(governance.nextOfficialTask?.startsWith('30-P'), 'next official task binds 30-P');
  regressionCheck(governance.supersessions?.some((item) => item.id === 'GOV-SUP-30-P-001' && item.previousValue === 'AUTO_PRIORITY_SELECTION_AFTER_30-O_PERSISTENT_RECEIPT' && item.evidence === AUTHORITY_PATH), '30-P governance supersession binds the automatic-selection authority');

  regressionCheck(Boolean(ppk002), 'PPK-002 remains in the accepted scope registry');
  regressionCheck(ppk002?.status === 'PARTIAL' && ppk002?.priority === 'P0', 'accepted PPK-002 remains P0/PARTIAL');
  regressionCheck(ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false, 'universal PPK-002 use-case/repository chain remains open');
  regressionCheck(canonicalReport30O.status === 'PASS' && canonicalReport30O.checks === 77 && canonicalReport30O.failed === 0, 'historical 30-O priority report remains PASS 77 of 77');
  regressionCheck(canonicalReport30O.PPK002 === 'PARTIAL' && canonicalReport30O.universalRepositoryEnforcement === 'NOT_COMPLETE', 'historical 30-O priority report preserves its partial boundary');
  regressionCheck(await sha256(CANONICAL_REPORT_PATH) === CANONICAL_REPORT_SHA256, 'historical 30-O canonical priority report SHA-256 is unchanged');

  const regressionReport = {
    schemaVersion: 1,
    release: registry.release,
    step: '30-P',
    predecessorStep: '30-O',
    requirement: 'PPK-002',
    phase: '30-O_PREDECESSOR_PRIORITY_SELECTION_REGRESSION',
    status: regressionFailures.length === 0 ? 'PASS' : 'FAIL',
    checkCount: regressionChecks.length,
    passed: regressionChecks.length - regressionFailures.length,
    failed: regressionFailures.length,
    checks: regressionChecks,
    failures: regressionFailures,
    selectionClass: policy.currentSelection?.selectionClass ?? null,
    scopeStatus: 'PARTIAL',
    persistentReceiptStatus: completion30O.persistentReceiptStatus ?? null,
    officialCompletionClaimed: true,
    evidenceBoundary: {
      historical30OReportMutated: false,
      historical30OCompletionPreserved: true,
      failedAttemptsCountedAsPass: 0,
      PPK002: 'PARTIAL',
      universalRepositoryEnforcement: 'NOT_COMPLETE'
    },
    generatedAt: new Date().toISOString(),
    mandatoryTruthSentence: TRUTH
  };

  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(REGRESSION_REPORT, `${JSON.stringify(regressionReport, null, 2)}\n`);
  if (regressionFailures.length > 0) {
    console.error(regressionFailures.join('\n'));
    process.exit(1);
  }
  console.log(`30-O predecessor archive production priority selection regression: PASS (${regressionChecks.length}/${regressionChecks.length}).`);
  process.exit(0);
}

const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const [policy, registry, plan, governance, authority, completion30N, scope, capacity, decision, priorityRegression, executionRegression, contractRegression, runtimeRegression] = await Promise.all([
  readJson('config/bronze-backlog-priority-policy.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('artifacts/authority/30-O_AUTO_PRIORITY_SELECTION_AUTHORITY.json'),
  readJson('artifacts/checkpoints/30-N_COMPLETION_RECORD.json'),
  readJson('config/30-o-archive-production-composition-scope.json'),
  readJson('config/conversation-capacity-policy.json'),
  readFile('docs/decisions/DEC-140-ppk-002-archive-production-composition-and-sqlite-runtime.md', 'utf8'),
  readJson('artifacts/validation/30-O-30-N-archive-priority-selection-regression.json'),
  readJson('artifacts/validation/30-O-30-N-execution-record-regression.json'),
  readJson('artifacts/validation/30-O-30-N-archive-policy-enforcement-contract-regression.json'),
  readJson('artifacts/validation/30-O-30-N-archive-policy-enforcement-runtime-regression.json')
]);

const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
const previous = plan.steps.find((item) => item.id === '30-N');
const current = plan.steps.find((item) => item.id === '30-O');
const activeSteps = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
const expectedEvidence = [
  'artifacts/authority/30-O_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  'docs/decisions/DEC-140-ppk-002-archive-production-composition-and-sqlite-runtime.md',
  'config/30-o-archive-production-composition-scope.json',
  'artifacts/validation/30-O-30-N-archive-priority-selection-regression.json',
  'artifacts/validation/30-O-30-N-execution-record-regression.json',
  'artifacts/validation/30-O-30-N-archive-policy-enforcement-contract-regression.json',
  'artifacts/validation/30-O-30-N-archive-policy-enforcement-runtime-regression.json'
];

check(policy.authorityDecision === 'DEC-137', 'DEC-137 priority authority missing');
check(policy.mode === 'FULL_AUTO_INCOMPLETE_BRONZE_EXECUTION', 'full-auto priority mode missing');
check(policy.currentSelection?.step === '30-O', 'current priority selection must be 30-O');
check(policy.currentSelection?.requirementId === 'PPK-002', '30-O priority requirement mismatch');
check(policy.currentSelection?.selectionClass === 'CONTINUING_STARTED_P0_PRODUCTION_COMPOSITION_AND_RUNTIME_SLICE', '30-O selection class mismatch');
check(policy.currentSelection?.authority === 'artifacts/authority/30-O_AUTO_PRIORITY_SELECTION_AUTHORITY.json', '30-O priority authority path mismatch');
check(policy.selectionHistory.some((item) => item.step === '30-N' && item.stepOutcome === 'COMPLETED_PASS_PERSISTENT_RECEIPT_PASS_REQUIREMENT_REMAINS_PARTIAL' && item.evidence === 'artifacts/checkpoints/30-N_COMPLETION_RECORD.json'), '30-N durable selection history missing');
check(policy.userConfiguredCreditStop?.status === 'CANCELLED_BY_USER', 'user 95 percent stop cancellation lost');
check(policy.preservedExternalBlockers.some((item) => item.requirementId === 'B2-01' && item.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'), 'B2-01 native blocker truth missing');

check(authority.decision === 'DEC-137', '30-O authority must derive from DEC-137');
check(authority.prerequisite?.step === '30-N' && authority.prerequisite?.status === 'COMPLETED', '30-O prerequisite identity or lifecycle mismatch');
check(authority.prerequisite?.validationStatus === 'PASS' && authority.prerequisite?.persistentReceiptStatus === 'PASS', '30-O prerequisite validation or receipt is not PASS');
check(authority.prerequisite?.completionTransition === 'PASS_33_SEMANTIC_AND_5_PROCESS_GATES', '30-N completion-transition evidence missing');
check(authority.selection?.step === '30-O' && authority.selection?.requirementId === 'PPK-002', '30-O authority selection mismatch');
check(authority.selection?.status === 'AUTHORIZED_IN_PROGRESS', '30-O authority lifecycle mismatch');
check(authority.priorityRationale?.startedWorkBeforeUnstartedWork === true && authority.priorityRationale?.priority === 'P0', '30-O priority class is not started P0 work');
check(authority.priorityRationale?.roadmapDependencyUnblocking === true && authority.priorityRationale?.securityPrivacyDataIntegrityImpact === true, '30-O dependency/security tie-breakers missing');
check(authority.scopeBoundary?.PPK002 === 'PARTIAL' && authority.scopeBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-O authority overclaims PPK-002');
check(authority.scopeBoundary?.requirementCompletionClaimed === false, '30-O authority claims requirement completion');
check(authority.preservedTruth?.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS', '30-O authority overclaims Windows Hello hardware');
check(authority.preservedTruth?.userConfiguredCreditStop95 === 'CANCELLED', '30-O authority lost credit-stop cancellation');
check(authority.mandatoryTruthSentence === TRUTH, '30-O authority truth sentence mismatch');

check(completion30N.officialStepStatus === 'COMPLETED' && completion30N.validationStatus === 'PASS' && completion30N.persistentReceiptStatus === 'PASS', '30-N completion does not authorize 30-O');
check(completion30N.libraryReceipt?.path === 'artifacts/checkpoints/30-N_LIBRARY_RECEIPT.json', '30-N completion receipt binding mismatch');
check(completion30N.evidenceBoundary?.PPK002 === 'PARTIAL' && completion30N.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-N completion falsely completed PPK-002');
check(completion30N.preReceiptPreservedFailedAttempts === 16 && completion30N.postReceiptPreservedFailedAttempts === 2 && completion30N.totalPreservedFailedAttempts === 18, '30-N preserved-failure totals are incomplete');
check(completion30N.failedAttemptsCountedAsPass === 0, '30-N failed attempts were counted as PASS');

check(Boolean(previous), '30-N prerequisite work step missing');
check(previous?.status === 'COMPLETED' && previous?.validationStatus === 'PASS', '30-N prerequisite work step is not completed PASS');
check(previous?.persistentReceiptStatus === 'PASS' && previous?.persistentReceiptPath === 'artifacts/checkpoints/30-N_LIBRARY_RECEIPT.json', '30-N prerequisite receipt path mismatch');
check(Boolean(current), '30-O work step missing');
check(current?.scopeRequirement === 'PPK-002', '30-O work-step requirement mismatch');
check(current?.status === 'IN_PROGRESS' && current?.validationStatus === 'PENDING', '30-O work step must begin IN_PROGRESS/PENDING');
check(current?.persistentReceiptStatus === 'PENDING' && current?.persistentReceiptPath === null, '30-O receipt must begin PENDING');
check(plan.currentStep === '30-O', 'work plan current step must be 30-O');
check(activeSteps.length === 1 && activeSteps[0]?.id === '30-O', '30-O must be the only active work step');
check(expectedEvidence.every((path) => current?.localEvidence?.includes(path)), '30-O work step does not bind all selection/regression evidence');

check(governance.libraryUploadStatus === '30-N_RECEIPT_CHAIN_PASS_30-O_IN_PROGRESS', '30-O governance Library lifecycle mismatch');
check(governance.activeMicroStep === '30-O', 'active governance work step must be 30-O');
check(governance.nextOfficialTask === '30-O PPK-002 production archive PEP composition, protected receipt journal wiring and real SQLite repository runtime slice', 'next official task does not exactly bind 30-O');
check(governance.supersessions.some((item) => item.id === 'GOV-SUP-30-O-001' && item.previousValue === 'AUTO_PRIORITY_SELECTION_AFTER_30-N_PERSISTENT_RECEIPT' && item.evidence === 'artifacts/authority/30-O_AUTO_PRIORITY_SELECTION_AUTHORITY.json'), '30-O governance supersession missing');

check(Boolean(ppk002), 'PPK-002 missing from accepted scope');
check(ppk002?.status === 'PARTIAL' && ppk002?.priority === 'P0', 'accepted PPK-002 must remain P0/PARTIAL');
check(ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false, 'universal PPK-002 use-case/repository chain must remain open');
check(expectedEvidence.every((path) => ppk002?.evidence?.includes(path)), 'accepted PPK-002 does not bind all 30-O selection/regression evidence');

check(scope.step === '30-O' && scope.requirement === 'PPK-002', '30-O scope identity mismatch');
check(scope.scope === 'ARCHIVE_PRODUCTION_PEP_COMPOSITION_PROTECTED_RECEIPT_JOURNAL_AND_SQLITE_RUNTIME_SLICE', '30-O canonical scope mismatch');
check(scope.predecessor?.step === '30-N' && scope.predecessor?.archiveVerticalSlice === 'PASS' && scope.predecessor?.persistentReceiptStatus === 'PASS', '30-O scope predecessor binding mismatch');
check(Array.isArray(scope.targets) && scope.targets.length === 7, '30-O scope must declare exactly seven production/runtime targets');
check(
  JSON.stringify(scope.targets?.map((item) => item.id)) === JSON.stringify([
    'production-startup-pep-composition',
    'core-service-local-admin-entrypoint-lifecycle',
    'verified-fresh-admin-archive-authority-bootstrap',
    'protected-receipt-journal-wiring',
    'real-sqlite-archive-repository-runtime',
    'same-transaction-authority-resource-revalidation',
    'restart-and-tamper-fail-closed-runtime'
  ]),
  '30-O target set mismatch'
);
check(
  JSON.stringify(scope.requiredOrder) === JSON.stringify([
    'production-composition',
    'trusted-authority-and-resource-resolution',
    'replay-reservation',
    'protected-receipt-persistence-and-readback',
    'active-policy-context-validation',
    'sqlite-business-transaction-begin',
    'same-transaction-authority-and-resource-revalidation',
    'repository-context-validation',
    'repository-operation',
    'local-pre-commit-fence-validation',
    'sqlite-business-transaction-commit'
  ]),
  '30-O enforcement order mismatch'
);
check(Object.values(scope.runtimeProofRequirements ?? {}).every((value) => value === true || value === false) && scope.runtimeProofRequirements?.legacyAuthorizationFallback === false, '30-O runtime proof requirements malformed');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL' && scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-O scope overclaims PPK-002');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, '30-O scope claims PPK-002 completion');
check(scope.mandatoryTruthSentence === TRUTH, '30-O scope truth sentence mismatch');

check(decision.includes('# DEC-140'), 'DEC-140 heading missing');
check(decision.includes('PPK-002 `PARTIAL`'), 'DEC-140 partial-scope truth missing');
check(decision.includes('evrensel repository enforcement `NOT_COMPLETE`'), 'DEC-140 universal boundary missing');
check(decision.includes('Native etkileşimli Windows Hello') && decision.includes('`NOT_RUN_NOT_PASS`'), 'DEC-140 hardware truth missing');
check(decision.includes(TRUTH), 'DEC-140 truth sentence mismatch');

for (const [name, report, minimumChecks] of [
  ['priority', priorityRegression, 46],
  ['execution', executionRegression, 72],
  ['contract', contractRegression, 123],
  ['runtime', runtimeRegression, 26]
]) {
  check(report.status === 'PASS', `30-N ${name} successor regression is not PASS`);
  const actualChecks = typeof report.checks === 'number' ? report.checks : report.checkCount;
  check(actualChecks >= minimumChecks, `30-N ${name} successor regression check count is incomplete`);
  check(report.evidenceBoundary?.historical30NReportMutated === false, `30-N ${name} canonical report mutation boundary missing`);
}

const canonicalHashes = {
  'artifacts/validation/30-N-archive-priority-selection-contract.json': 'cc77500e8ac8a7bef94c68d204adb7847fd7dc77e1a498994a6efd277c1932cc',
  'artifacts/validation/30-N-execution-record-contract.json': 'dec82111c7b9e30ea6d29949914c9a518aebe162c32bf8f279f4188d75a51e8f',
  'artifacts/validation/30-N-ppk-002-archive-policy-enforcement-contract.json': '1f66816bee2c26e04b8b466147fdd8e2ab95132f69af83f11c2a68d16486d186',
  'artifacts/validation/30-N-ppk-002-archive-policy-enforcement-runtime.json': 'd15b4227c41f75b3f379217e5f5a83868f45279eb4f3c035a2843131bf6c3aab'
};
for (const [path, expected] of Object.entries(canonicalHashes)) {
  check(await sha256(path) === expected, `historical 30-N canonical report changed: ${path}`);
}

check(capacity.actualMetricOnly === true && capacity.hardStopUsedPercent === 90, 'canonical PR-172 policy changed');

const report = {
  schemaVersion: 1,
  release: registry.release,
  step: '30-O',
  requirement: 'PPK-002',
  phase: 'FULL_AUTO_PRODUCTION_COMPOSITION_PRIORITY_SELECTION',
  checks,
  passed: checks - failures.length,
  failed: failures.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  selectionClass: policy.currentSelection?.selectionClass ?? null,
  PPK002: 'PARTIAL',
  universalRepositoryEnforcement: 'NOT_COMPLETE',
  nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
  historical30NCanonicalReportsMutated: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`30-O archive production priority selection: PASS (${checks}/${checks}).`);
