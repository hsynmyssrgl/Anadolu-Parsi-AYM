import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const verifyBinding = async (binding, expectedPath) => {
  if (binding?.path !== expectedPath || !Number.isInteger(binding?.sizeBytes) || !/^[0-9a-f]{64}$/.test(binding?.sha256 ?? '')) return false;
  const value = await readFile(expectedPath);
  return value.byteLength === binding.sizeBytes && sha256(value) === binding.sha256;
};

const successorRegression = process.argv.includes('--successor-regression');
if (successorRegression) {
  const REGRESSION_REPORT = 'artifacts/validation/30-P-30-O-execution-record-regression.json';
  const AUTHORITY_PATH = 'artifacts/authority/30-P_AUTO_PRIORITY_SELECTION_AUTHORITY.json';
  const SCOPE_PATH = 'config/30-p-durable-policy-transaction-scope.json';
  const RECEIPT_PATH = 'artifacts/checkpoints/30-O_LIBRARY_RECEIPT.json';
  const CANONICAL_REPORT_PATH = 'artifacts/validation/30-O-execution-record-contract.json';
  const CANONICAL_REPORT_SHA256 = 'c5e2ea5ea64981f1aa4e48ea73e423d9646db63e1f5a40365f74d73374eb3dd6';
  const EXECUTION_RECORD_PATH = 'artifacts/checkpoints/30-O_EXECUTION_RECORD.json';
  const EXECUTION_RECORD_SHA256 = '63c43dcb6e7349f543ab019538fdcad714bedee0f170a3f63068d2bf8fdba2b1';
  const regressionChecks = [];
  const regressionFailures = [];
  const regressionCheck = (condition, label) => {
    regressionChecks.push(label);
    if (!condition) regressionFailures.push(label);
  };

  const [historicalRecord, canonicalReport, diagnostic30O, completion30O, receipt30O, plan30P, governance30P, policy30P, authority30P, scope30P, registry30P] = await Promise.all([
    readJson(EXECUTION_RECORD_PATH),
    readJson(CANONICAL_REPORT_PATH),
    readJson('artifacts/validation/30-O_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json'),
    readJson('artifacts/checkpoints/30-O_COMPLETION_RECORD.json'),
    readJson(RECEIPT_PATH),
    readJson('config/work-segmentation-plan.json'),
    readJson('config/active-governance-ledger.json'),
    readJson('config/bronze-backlog-priority-policy.json'),
    readJson(AUTHORITY_PATH),
    readJson(SCOPE_PATH),
    readJson('config/accepted-scope-registry.json')
  ]);

  const predecessor = plan30P.steps.find((item) => item.id === '30-O');
  const successor = plan30P.steps.find((item) => item.id === '30-P');
  const activeSteps = plan30P.steps.filter((item) => item.status === 'IN_PROGRESS');
  const ppk002 = registry30P.requirements.find((item) => item.id === 'PPK-002');
  const historicalSelection = policy30P.selectionHistory?.find((item) => item.step === '30-O');
  const expectedSuccessorEvidence = [
    AUTHORITY_PATH,
    SCOPE_PATH,
    'artifacts/validation/30-P-30-O-archive-production-priority-selection-regression.json',
    REGRESSION_REPORT
  ];

  regressionCheck(historicalRecord.step === '30-O' && historicalRecord.requirement === 'PPK-002', 'historical execution record remains bound to 30-O/PPK-002');
  regressionCheck(historicalRecord.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'historical execution record preserves its bounded local-PASS state');
  regressionCheck(historicalRecord.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', 'historical execution record preserves its pre-receipt official lifecycle');
  regressionCheck(historicalRecord.persistentReceiptStatus === 'PENDING' && historicalRecord.persistentReceiptPath === null, 'historical execution record preserves its pre-receipt PENDING boundary');
  regressionCheck(historicalRecord.officialCompletionClaimed === false, 'historical execution record does not retroactively claim official completion');
  regressionCheck(historicalRecord.evidenceBoundary?.PPK002 === 'PARTIAL' && historicalRecord.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'historical execution record preserves the PPK-002 partial boundary');
  regressionCheck(historicalRecord.evidenceBoundary?.requirementCompletionClaimed === false, 'historical execution record does not claim PPK-002 completion');
  regressionCheck(historicalRecord.preservedFailedAttempts === 44 && historicalRecord.failedAttemptsCountedAsPass === 0, 'historical execution record preserves 44 failures and credits none as PASS');
  regressionCheck(historicalRecord.mandatoryTruthSentence === TRUTH, 'historical execution record preserves the mandatory truth sentence');
  regressionCheck(await verifyBinding(historicalRecord.evidence?.failedAttemptDiagnosticBinding, 'artifacts/validation/30-O_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json'), 'historical execution record still binds the exact failed-attempt aggregate');

  regressionCheck(canonicalReport.step === '30-O' && canonicalReport.status === 'PASS' && canonicalReport.checkCount === 79 && canonicalReport.failed === 0, 'historical 30-O execution-record report remains PASS 79 of 79');
  regressionCheck(canonicalReport.scopeStatus === 'PARTIAL' && canonicalReport.officialCompletionClaimed === false, 'historical execution-record report preserves its bounded partial pre-receipt claim');
  regressionCheck(sha256(await readFile(CANONICAL_REPORT_PATH)) === CANONICAL_REPORT_SHA256, 'historical 30-O canonical execution-record report SHA-256 is unchanged');
  regressionCheck(sha256(await readFile(EXECUTION_RECORD_PATH)) === EXECUTION_RECORD_SHA256, 'historical 30-O execution record SHA-256 is unchanged');

  regressionCheck(diagnostic30O.status === 'DIAGNOSTIC_ONLY_NOT_PASS', '30-O failed-attempt aggregate remains diagnostic-only NOT_PASS');
  regressionCheck(diagnostic30O.attemptCount === 44 && diagnostic30O.preservedFailedAttempts === 44 && diagnostic30O.attempts?.length === 44, '30-O diagnostic aggregate preserves exactly 44 failures');
  regressionCheck(diagnostic30O.failedAttemptsCountedAsPass === 0, '30-O diagnostic aggregate credits no failure as PASS');
  regressionCheck(diagnostic30O.attempts?.every((attempt, index) => attempt.sequence === index + 1 && attempt.exitCode !== 0 && attempt.countedAsPass === false), 'every 30-O diagnostic attempt remains nonzero and not PASS');
  regressionCheck(diagnostic30O.attempts?.every((attempt) => {
    const counterpart = attempt.finalCleanCounterpart;
    if (counterpart !== null && counterpart !== undefined) return counterpart.exitCode === 0 && counterpart.status === 'PASS';
    return attempt.openContradictionPreserved === true || attempt.productFinding === false;
  }), 'every 30-O failure retains a clean counterpart or explicit open/non-product classification');

  regressionCheck(completion30O.step === '30-O' && completion30O.requirement === 'PPK-002', '30-O completion record identity is exact');
  regressionCheck(completion30O.status === 'PASS' && completion30O.officialStepStatus === 'COMPLETED' && completion30O.validationStatus === 'PASS', '30-O completion record is PASS/COMPLETED/PASS');
  regressionCheck(completion30O.persistentReceiptStatus === 'PASS', '30-O completion persistent receipt is PASS');
  regressionCheck(completion30O.libraryReceipt?.path === RECEIPT_PATH && completion30O.libraryReceipt?.status === 'PASS', '30-O completion binds its PASS Library receipt');
  regressionCheck(await verifyBinding(completion30O.libraryReceipt, RECEIPT_PATH), '30-O completion receipt size and SHA-256 binding are exact');
  regressionCheck(completion30O.totalPreservedFailedAttempts === 44 && completion30O.failedAttemptsCountedAsPass === 0, '30-O completion credits none of 44 preserved failures as PASS');
  regressionCheck(completion30O.evidenceBoundary?.PPK002 === 'PARTIAL' && completion30O.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-O completion preserves PPK-002 PARTIAL and universal NOT_COMPLETE');
  regressionCheck(completion30O.evidenceBoundary?.requirementCompletionClaimed === false, '30-O completion does not claim PPK-002 completion');

  regressionCheck(receipt30O.step === '30-O' && receipt30O.status === 'PASS' && receipt30O.validationStatus === 'PASS' && receipt30O.persistentReceiptStatus === 'PASS', '30-O Library receipt is validated persistent PASS');
  regressionCheck(receipt30O.preservedFailedAttempts === 44 && receipt30O.failedAttemptsCountedAsPass === 0, '30-O Library receipt credits none of the 44 failures as PASS');
  regressionCheck(receipt30O.evidenceBoundary?.PPK002 === 'PARTIAL' && receipt30O.evidenceBoundary?.requirementCompletionClaimed === false, '30-O Library receipt preserves the PPK-002 partial boundary');

  regressionCheck(plan30P.currentStep === '30-P', 'work plan current step is 30-P');
  regressionCheck(predecessor?.status === 'COMPLETED' && predecessor?.validationStatus === 'PASS', '30-O predecessor work step is COMPLETED with validation PASS');
  regressionCheck(predecessor?.persistentReceiptStatus === 'PASS' && predecessor?.persistentReceiptPath === RECEIPT_PATH, '30-O predecessor work step binds its PASS receipt');
  regressionCheck(Boolean(successor) && successor?.scopeRequirement === 'PPK-002', '30-P successor work step exists and binds PPK-002');
  regressionCheck(successor?.status === 'IN_PROGRESS' && successor?.validationStatus === 'PENDING', '30-P successor is IN_PROGRESS with validation PENDING');
  regressionCheck(successor?.persistentReceiptStatus === 'PENDING' && successor?.persistentReceiptPath === null, '30-P successor persistent receipt begins PENDING without a path');
  regressionCheck(activeSteps.length === 1 && activeSteps[0]?.id === '30-P', '30-P is the sole active successor work step');
  regressionCheck(expectedSuccessorEvidence.every((path) => successor?.localEvidence?.includes(path)), '30-P work step binds its authority, scope and predecessor regressions');

  regressionCheck(policy30P.currentSelection?.step === '30-P' && policy30P.currentSelection?.requirementId === 'PPK-002', 'priority policy selects 30-P/PPK-002');
  regressionCheck(policy30P.currentSelection?.selectionClass === 'CONTINUING_STARTED_P0_DURABLE_TRANSACTION_AND_REPLAY_INTEGRITY_SLICE', '30-P selection class matches the durable-transaction slice');
  regressionCheck(policy30P.currentSelection?.authority === AUTHORITY_PATH, '30-P selection binds the canonical authority path');
  regressionCheck(historicalSelection?.stepOutcome === 'COMPLETED_PASS_PERSISTENT_RECEIPT_PASS_REQUIREMENT_REMAINS_PARTIAL' && historicalSelection?.evidence === 'artifacts/checkpoints/30-O_COMPLETION_RECORD.json', 'priority history durably binds the completed 30-O outcome');

  regressionCheck(authority30P.decision === 'DEC-137', '30-P authority derives from DEC-137');
  regressionCheck(authority30P.prerequisite?.step === '30-O' && authority30P.prerequisite?.completionRecord === 'artifacts/checkpoints/30-O_COMPLETION_RECORD.json', '30-P authority binds the 30-O completion prerequisite');
  regressionCheck(authority30P.prerequisite?.status === 'COMPLETED' && authority30P.prerequisite?.validationStatus === 'PASS' && authority30P.prerequisite?.persistentReceiptStatus === 'PASS', '30-P authority predecessor lifecycle is COMPLETED/PASS/receipt PASS');
  regressionCheck(authority30P.selection?.step === '30-P' && authority30P.selection?.requirementId === 'PPK-002', '30-P authority selection identity is exact');
  regressionCheck(authority30P.selection?.selectionClass === 'CONTINUING_STARTED_P0_DURABLE_TRANSACTION_AND_REPLAY_INTEGRITY_SLICE' && authority30P.selection?.status === 'AUTHORIZED_IN_PROGRESS', '30-P authority selection class and lifecycle are exact');
  regressionCheck(authority30P.scopeBoundary?.PPK002 === 'PARTIAL' && authority30P.scopeBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P authority preserves the PPK-002 partial boundary');
  regressionCheck(authority30P.scopeBoundary?.requirementCompletionClaimed === false, '30-P authority does not claim PPK-002 completion');
  regressionCheck(authority30P.mandatoryTruthSentence === TRUTH, '30-P authority preserves the mandatory truth sentence');

  regressionCheck(scope30P.step === '30-P' && scope30P.requirement === 'PPK-002', '30-P scope identity is exact');
  regressionCheck(scope30P.evidenceBoundary?.PPK002 === 'PARTIAL' && scope30P.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', '30-P scope preserves the PPK-002 partial boundary');
  regressionCheck(scope30P.evidenceBoundary?.requirementCompletionClaimed === false, '30-P scope does not claim PPK-002 completion');
  regressionCheck(Boolean(ppk002) && ppk002?.status === 'PARTIAL' && ppk002?.priority === 'P0', 'accepted PPK-002 remains P0/PARTIAL');
  regressionCheck(ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false, 'universal PPK-002 use-case/repository chain remains open');

  regressionCheck(governance30P.libraryUploadStatus === '30-O_RECEIPT_CHAIN_PASS_30-P_IN_PROGRESS', '30-P governance Library lifecycle is exact');
  regressionCheck(governance30P.activeMicroStep === '30-P', '30-P is the active governance work step');
  regressionCheck(governance30P.nextOfficialTask?.startsWith('30-P'), 'next official task binds 30-P');
  regressionCheck(governance30P.supersessions?.some((item) => item.id === 'GOV-SUP-30-P-001' && item.previousValue === 'AUTO_PRIORITY_SELECTION_AFTER_30-O_PERSISTENT_RECEIPT' && item.evidence === AUTHORITY_PATH), '30-P governance supersession binds the automatic-selection authority');

  const regressionReport = {
    schemaVersion: 1,
    release: historicalRecord.release,
    step: '30-P',
    predecessorStep: '30-O',
    requirement: 'PPK-002',
    phase: '30-O_PREDECESSOR_EXECUTION_RECORD_REGRESSION',
    status: regressionFailures.length === 0 ? 'PASS' : 'FAIL',
    checkCount: regressionChecks.length,
    passed: regressionChecks.length - regressionFailures.length,
    failed: regressionFailures.length,
    checks: regressionChecks,
    failures: regressionFailures,
    scopeStatus: 'PARTIAL',
    localExecutionStatus: historicalRecord.status,
    persistentReceiptStatus: completion30O.persistentReceiptStatus ?? null,
    officialCompletionClaimed: true,
    evidenceBoundary: {
      historical30OReportMutated: false,
      historicalExecutionRecordPreserved: true,
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
  console.log(`30-O predecessor execution-record regression: PASS (${regressionChecks.length} checks; Library receipt PASS; PPK-002 PARTIAL).`);
  process.exit(0);
}

const record = await readJson('artifacts/checkpoints/30-O_EXECUTION_RECORD.json');
const diagnostic = await readJson('artifacts/validation/30-O_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json');
const priority = await readJson('artifacts/validation/30-O-archive-production-priority-selection-contract.json');
const contract = await readJson('artifacts/validation/30-O-ppk-002-archive-production-composition-contract.json');
const runtime = await readJson('artifacts/validation/30-O-ppk-002-archive-production-composition-runtime.json');
const provider = await readJson('artifacts/validation/30-O-core-service-policy-provider-runtime.json');
const entrypoint = await readJson('artifacts/validation/30-O-core-service-entrypoint-runtime.json');
const journal = await readJson('artifacts/validation/30-O-protected-receipt-journal-runtime.json');
const vitest = await readJson('artifacts/validation/30-O-archive-production-composition-vitest.json');
const scope = await readJson('config/30-o-archive-production-composition-scope.json');
const registry = await readJson('config/accepted-scope-registry.json');
const plan = await readJson('config/work-segmentation-plan.json');
const securityFirstAttempt = await readJson('artifacts/validation/30-O_SECURITY_REAUDIT_FIRST_ATTEMPT_FAILURE.json');
const securityCorrection = await readJson('artifacts/validation/30-O_SECURITY_REAUDIT_CORRECTION.json');
const legacySourcePreflight = await readJson('artifacts/validation/30-O_DIAGNOSTIC_SOURCE_PREFLIGHT_VERSION_LEDGER_MISMATCH_FAILURE.json');

const checks = [];
const failures = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failures.push(label);
};
const gate = (report, expected, label) => {
  const actual = report.checkCount ?? report.checks ?? report.passed;
  check(report.status === 'PASS' && actual === expected && report.failed === 0, `${label} is PASS ${expected} of ${expected}`);
};

check(record.step === '30-O' && record.requirement === 'PPK-002', 'record binds 30-O to PPK-002');
check(record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'post-reaudit record is bounded local PASS awaiting Library receipt');
check(record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', 'post-reaudit official step remains in progress awaiting Library receipt');
check(record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null, 'persistent receipt is PENDING without a claimed path');
check(record.officialCompletionClaimed === false, 'official completion is not claimed');
check(record.mandatoryTruthSentence === TRUTH, 'execution record preserves the mandatory truth sentence');

for (const [field, label] of [
  ['productionStartupPepComposition', 'production startup PEP composition'],
  ['realCoreServiceLocalAdminEntrypoint', 'real Core Service local-admin entrypoint'],
  ['verifiedFreshAdminTrustedDeviceAndExplicitArchiveGrants', 'verified fresh-admin authority bootstrap'],
  ['protectedReceiptJournalWiring', 'protected receipt journal wiring'],
  ['realSQLiteArchiveRepositoryRuntime', 'real SQLite archive repository runtime'],
  ['sameTransactionAuthorityAndResourceRevalidation', 'same-transaction authority/resource revalidation'],
  ['localPreCommitFenceValidation', 'local pre-commit fence validation'],
  ['restartBitTamperAndPartialRecordTruncationFailClosed', 'restart/tamper/truncation fail-closed runtime']
]) check(record.implemented?.[field] === true, `record declares ${label}`);
for (const field of [
  'universalRepositoryEnforcement',
  'installedCoreServiceRegistrationAndScmLifecycle',
  'protectedCoreServiceAuthorityProvisioningRotationAndAcl',
  'durableMultiProcessReplayProtection',
  'completeTailJournalRollbackDetection',
  'receiptAndBusinessCommitAtomicity',
  'crossProcessFenceAndSQLiteCommitAtomicity'
]) check(record.implemented?.[field] === false, `record does not claim ${field}`);

const expectedPriority = record.validation?.archiveProductionPriorityChecks;
const expectedContract = record.validation?.archiveProductionContractChecks;
const expectedRuntime = record.validation?.archiveProductionRuntimeChecks;
const expectedProvider = record.validation?.coreServicePolicyProviderChecks;
const expectedEntrypoint = record.validation?.coreServiceEntrypointChecks;
const expectedJournal = record.validation?.protectedReceiptJournalChecks;
const expectedSqliteVitest = record.validation?.archiveProductionSQLiteVitestChecks;
check(expectedPriority === 77, 'record binds the exact 77-check priority count');
check(expectedContract === 173, 'record binds the exact 173-check post-reaudit contract count');
check(expectedRuntime === 111, 'record binds the exact 111-check post-reaudit runtime count');
gate(priority, expectedPriority, 'priority selection');
gate(contract, expectedContract, 'production composition contract');
check(runtime.status === 'PASS' && runtime.controlledChecks?.actual === expectedRuntime && runtime.controlledChecks?.expected === expectedRuntime && runtime.controlledChecks?.status === 'PASS', `combined runtime is PASS ${expectedRuntime} of ${expectedRuntime}`);
check(provider.status === 'PASS' && provider.assertionCount === expectedProvider && provider.passed === expectedProvider && provider.failed === 0, `provider runtime is PASS ${expectedProvider} of ${expectedProvider}`);
check(entrypoint.status === 'PASS' && entrypoint.assertionCount === expectedEntrypoint && entrypoint.assertions?.every((item) => item.status === 'PASS'), `Core Service entrypoint runtime is PASS ${expectedEntrypoint} of ${expectedEntrypoint}`);
gate(journal, expectedJournal, 'protected receipt journal runtime');
check(vitest.success === true && vitest.numTotalTests === expectedSqliteVitest && vitest.numPassedTests === expectedSqliteVitest && vitest.numFailedTests === 0, `real SQLite targeted Vitest is PASS ${expectedSqliteVitest} of ${expectedSqliteVitest}`);

check(record.validation?.archiveProductionPriorityPass === expectedPriority, 'record binds all priority checks as passing');
check(record.validation?.archiveProductionContractPass === expectedContract, 'record binds all contract checks as passing');
check(record.validation?.archiveProductionRuntimePass === expectedRuntime, 'record binds all combined runtime checks as passing');
check(expectedProvider === 29 && expectedEntrypoint === 24 && expectedJournal === 14 && expectedSqliteVitest === 44, 'record binds the exact four post-reaudit runtime component counts');
check(record.validation?.workspaceDependencyAssertions >= 450 && record.validation?.dependencySupplyAssertions >= 380 && record.validation?.lockfileIntegrityAssertions >= 482, 'record binds dependency gates at or above their pre-reaudit baselines');
check(record.validation?.fullVitestTests === 67 && record.validation?.fullVitestMinimum === 67 && record.validation?.fullVitestStatus === 'PASS', 'record binds the current full Vitest result at 67 of 67 PASS');
check(record.validation?.localTargetedValidation === 'PASS', 'post-reaudit targeted local validation is PASS');
check(record.validation?.securityReauditFirstAttempt === 'FAIL_PRESERVED_NOT_PASS' && record.validation?.securityReauditCorrection === 'PASS', 'record preserves the first security re-audit failure and binds the clean correction');
check(record.validation?.legacySourcePreflight === 'DIAGNOSTIC_NOT_PASS_OPEN_CONTRADICTION', 'record keeps the legacy source-preflight mismatch open and NOT_PASS');
check(['PASS', 'PENDING_NOT_PASS'].includes(record.validation?.governedFullFinalValidation), 'governed full-final status uses an allowed truthful state');
if (record.validation?.governedFullFinalValidation === 'PENDING_NOT_PASS') {
  check(record.finalValidationEvidence?.status === 'PENDING_NOT_PASS' && record.finalValidationEvidence?.path === null, 'pending full-final validation has no claimed evidence path');
  check(record.evidenceBoundary?.governedFullFinalProcess === 'PENDING_NOT_PASS', 'pending full-final process is an explicit evidence boundary');
} else {
  check(record.finalValidationEvidence?.status === 'PASS' && record.finalValidationEvidence?.path, 'full-final PASS binds a concrete evidence path');
  check(record.finalValidationEvidence?.expected > 0 && record.finalValidationEvidence?.executed === record.finalValidationEvidence?.expected && record.finalValidationEvidence?.passed === record.finalValidationEvidence?.expected && record.finalValidationEvidence?.failed === 0 && record.finalValidationEvidence?.notRun === 0, 'full-final PASS binds all clean process exits');
}

check(scope.step === '30-O' && scope.requirement === 'PPK-002' && scope.targets?.length === 7, 'scope binds the exact seven 30-O production targets');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL' && scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope preserves PPK-002 PARTIAL');
for (const [field, expected] of [
  ['PPK002', 'PARTIAL'],
  ['universalRepositoryEnforcement', 'NOT_COMPLETE'],
  ['installedCoreServiceRegistrationAndScmLifecycle', 'NOT_RUN_NOT_PASS'],
  ['protectedCoreServiceAuthorityProvisioningRotationAndAcl', 'NOT_IMPLEMENTED'],
  ['durableMultiProcessReplayProtection', 'NOT_RUN_NOT_PASS'],
  ['completeTailJournalRollbackDetection', 'NOT_IMPLEMENTED'],
  ['receiptAndBusinessCommitAtomicity', 'NOT_IMPLEMENTED'],
  ['crossProcessFenceAndSQLiteCommitAtomicity', 'NOT_IMPLEMENTED']
]) check(record.evidenceBoundary?.[field] === expected, `record preserves ${field}=${expected}`);
check(record.evidenceBoundary?.requirementCompletionClaimed === false, 'record does not claim PPK-002 completion');
check(record.evidenceBoundary?.productionArchiveCompositionSlice === 'LOCAL_PASS', 'bounded production archive composition slice is local PASS only');
check(record.evidenceBoundary?.securityReauditFirstAttempt === 'FAIL_PRESERVED_NOT_PASS' && record.evidenceBoundary?.securityReauditCorrection === 'PASS', 'security re-audit failure and correction boundaries are explicit');
check(record.evidenceBoundary?.legacySourcePreflight === 'DIAGNOSTIC_NOT_PASS_OPEN_CONTRADICTION', 'legacy source-preflight remains an explicit NOT_PASS contradiction boundary');

check(securityFirstAttempt.status === 'FAIL' && securityFirstAttempt.countedAsPass === false && securityFirstAttempt.findings?.length === 3, 'first independent security re-audit failure remains preserved and not PASS');
check(securityCorrection.status === 'PASS' && securityCorrection.scopeStatus === 'PARTIAL' && securityCorrection.officialCompletionClaimed === false, 'security correction is bounded PASS without official completion');
check(securityCorrection.independentReaudit?.newP0Findings === 0 && securityCorrection.independentReaudit?.newP1Findings === 0 && securityCorrection.independentReaudit?.newP2Findings === 0, 'clean independent re-audit found no new P0/P1/P2 within scope');
check(securityCorrection.firstAttemptFailure?.sha256 === record.evidence?.securityReauditFirstAttemptFailure?.sha256 && securityCorrection.firstAttemptFailure?.countedAsPass === false, 'security correction cryptographically binds the first failed re-audit');
check(await verifyBinding(record.evidence?.securityReauditFirstAttemptFailure, 'artifacts/validation/30-O_SECURITY_REAUDIT_FIRST_ATTEMPT_FAILURE.json'), 'execution record SHA/size binds the first security re-audit failure');
check(await verifyBinding(record.evidence?.securityReauditCorrection, 'artifacts/validation/30-O_SECURITY_REAUDIT_CORRECTION.json'), 'execution record SHA/size binds the security re-audit correction');
check(await verifyBinding(record.evidence?.legacySourcePreflightDiagnostic, 'artifacts/validation/30-O_DIAGNOSTIC_SOURCE_PREFLIGHT_VERSION_LEDGER_MISMATCH_FAILURE.json'), 'execution record SHA/size binds the legacy source-preflight diagnostic');
check(await verifyBinding(record.evidence?.failedAttemptDiagnosticBinding, 'artifacts/validation/30-O_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json'), 'execution record SHA/size binds the failed-attempt aggregate');
check(legacySourcePreflight.status === 'DIAGNOSTIC_NOT_PASS' && legacySourcePreflight.exitCode === 1 && legacySourcePreflight.passClaimed === false && legacySourcePreflight.openContradictionPreserved === true, 'legacy source-preflight exit 1 remains open, diagnostic and not PASS');

const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.priority === 'P0', 'accepted-scope PPK-002 remains P0 PARTIAL');
check(ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false, 'universal use-case/repository chain remains open');
const step = plan.steps.find((item) => item.id === '30-O');
const active = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
check(plan.currentStep === '30-O' && step?.status === 'IN_PROGRESS' && active.length === 1 && active[0]?.id === '30-O', '30-O remains the sole active step');
check(step?.validationStatus === 'PENDING' && step?.persistentReceiptStatus === 'PENDING' && step?.persistentReceiptPath === null, 'work plan validation and receipt remain PENDING');

check(diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS', 'failed-attempt aggregate is diagnostic only');
check(Number.isInteger(diagnostic.attemptCount) && diagnostic.attemptCount >= 18 && diagnostic.preservedFailedAttempts === diagnostic.attemptCount, 'all current failed attempts are preserved');
check(diagnostic.failedAttemptsCountedAsPass === 0, 'no failed attempt is counted as PASS');
check(Array.isArray(diagnostic.attempts) && diagnostic.attempts.length === diagnostic.attemptCount, 'diagnostic entry count matches the aggregate');
check(diagnostic.attempts.every((attempt, index) => attempt.sequence === index + 1 && attempt.exitCode !== 0 && attempt.countedAsPass === false), 'every diagnostic attempt has a nonzero exit and countedAsPass false');
check(diagnostic.attempts.every((attempt) => {
  const counterpart = attempt.finalCleanCounterpart;
  if (counterpart !== null && counterpart !== undefined) return counterpart.exitCode === 0 && counterpart.status === 'PASS';
  return attempt.openContradictionPreserved === true || attempt.productFinding === false;
}), 'each failed attempt has a clean exit-zero counterpart or an explicit open-contradiction/non-product NOT_PASS classification');
check(record.preservedFailedAttempts === diagnostic.attemptCount && record.failedAttemptsCountedAsPass === 0, 'execution record binds the current diagnostic aggregate');
check(record.bronzeCompletedPercent === 25 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY', 'official progress and tier locks remain unchanged');
check(record.installerBuild === 'NOT_RUN_NOT_PASS' && record.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS', 'installer and native Windows Hello remain NOT_RUN_NOT_PASS');

const report = {
  schemaVersion: 1,
  release: record.release,
  step: '30-O',
  requirement: 'PPK-002',
  phase: 'EXECUTION_RECORD_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  scopeStatus: 'PARTIAL',
  localExecutionStatus: record.status,
  governedFullFinalValidation: record.validation?.governedFullFinalValidation,
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/30-O-execution-record-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`30-O execution record contract: PASS (${checks.length} checks; Library receipt PENDING; PPK-002 PARTIAL).`);
