import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const plan = await readJson('config/work-segmentation-plan.json');
const step30N = plan.steps.find((item) => item.id === '30-N');
const successorRegression = process.argv.includes('--successor-regression') || plan.currentStep !== '30-N' || step30N?.status === 'COMPLETED';
const reportPath = successorRegression
  ? 'artifacts/validation/30-O-30-N-execution-record-regression.json'
  : 'artifacts/validation/30-N-execution-record-contract.json';
const record = await readJson('artifacts/checkpoints/30-N_EXECUTION_RECORD.json');
const diagnostic = await readJson('artifacts/validation/30-N_DIAGNOSTIC_IMPLEMENTATION_ATTEMPTS.json');
const contract = await readJson('artifacts/validation/30-N-ppk-002-archive-policy-enforcement-contract.json');
const runtime = await readJson('artifacts/validation/30-N-ppk-002-archive-policy-enforcement-runtime.json');
const platformPolicy = await readJson('artifacts/validation/platform-policy-gate.json');
const predecessorContract = await readJson('artifacts/validation/30-N-30-M-policy-enforcement-contract-regression.json');
const predecessorRuntime = await readJson('artifacts/validation/30-N-30-M-policy-enforcement-runtime-regression.json');
const scope = await readJson('config/30-n-archive-policy-migration-scope.json');
const registry = await readJson('config/accepted-scope-registry.json');
const governance = successorRegression ? await readJson('config/active-governance-ledger.json') : null;
const completion30N = successorRegression ? await readJson('artifacts/checkpoints/30-N_COMPLETION_RECORD.json') : null;

const checks = [];
const failures = [];
const check = (condition, label) => {
  checks.push(label);
  if (!condition) failures.push(label);
};

check(record.step === '30-N' && record.requirement === 'PPK-002', 'record binds 30-N to PPK-002');
check(record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'record is local PASS awaiting Library receipt');
check(record.officialStepStatus === 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT', 'official step remains in progress awaiting Library receipt');
check(record.scopeStatus === 'PARTIAL_GOVERNED_ARCHIVE_VERTICAL_SLICE_UNIVERSAL_MIGRATION_PENDING', 'record preserves the bounded partial scope');
check(record.persistentReceiptStatus === 'PENDING' && record.persistentReceiptPath === null, 'persistent Library receipt remains PENDING without a claimed path');
check(record.officialCompletionClaimed === false, 'official completion is not claimed');

check(record.implemented?.exactEightArchivePolicyIntents === true, 'record declares the exact eight governed archive intents');
check(record.implemented?.receiptPersistenceBeforeBusinessTransaction === true, 'record preserves receipt before transaction');
check(record.implemented?.activePolicyContextBeforeRepositoryMutation === true, 'record preserves active policy context before repository mutation');
check(record.implemented?.archiveDirectRolePredicatesRemoved === 5, 'record declares exactly five removed archive role predicates');
check(record.implemented?.universalRepositoryMigration === false, 'record does not claim universal repository migration');
check(record.implemented?.productionStartupPepWiring === false, 'record does not claim production startup PEP wiring');

check(record.validation?.archivePolicyContractChecks === 123 && record.validation?.archivePolicyContractPass === 123, 'record binds the 123 of 123 contract result');
check(record.validation?.archivePolicyRuntimeChecks === 26 && record.validation?.archivePolicyRuntimePass === 26, 'record binds the 26 of 26 controlled runtime result');
check(record.validation?.archiveUseCaseRuntimeChecks === 16 && record.validation?.archiveUseCaseRuntimePass === 16, 'record binds the 16-check archive runtime result');
check(record.validation?.build77ArchiveOpenChecks === 10, 'record binds the 10-check Build77 archive-open regression');
check(record.validation?.build78ArchiveSearchChecks === 10, 'record binds the 10-check Build78 archive-search regression');
check(record.validation?.mvp70ArchiveRetentionChecks === 10, 'record binds the 10-check MVP70 retention regression');
check(record.validation?.archiveClassificationChecks === 10, 'record binds the 10-check archive-classification regression');
check(record.validation?.build90ArchiveVaultChecks === 10, 'record binds the 10-check Build90 archive-vault regression');
check(record.validation?.predecessor30MContractChecks === 34 && record.validation?.predecessor30MRuntimeChecks === 43, 'record binds both clean 30-M predecessor regressions');
check(record.validation?.legacyDirectRoleDebt === 29 && record.validation?.removedDirectRoleFindings === 5 && record.validation?.newDirectRoleBypasses === 0, 'record preserves 29 legacy findings after five removals with zero new bypass');
check(record.validation?.workspaceDependencyAssertions === 447 && record.validation?.workspaceCount === 18 && record.validation?.workspaceProductionGraph === 'ACYCLIC', 'record binds the clean workspace dependency result');
check(record.validation?.fullVitestFiles === 8 && record.validation?.fullVitestTests === 61, 'record binds the clean full Vitest result of 8 files and 61 tests');
check(record.validation?.rootTypecheck === 'PASS', 'record binds the clean full root typecheck');
check(record.validation?.governedFullFinalValidation === 'PASS' && record.validation?.governedFinalProcessChecks === 25 && record.validation?.governedFinalProcessPass === 25, 'full governed final validation is clean PASS 25 of 25');
check(record.finalValidationEvidence?.status === 'PASS' && record.finalValidationEvidence?.expected === 25 && record.finalValidationEvidence?.executed === 25 && record.finalValidationEvidence?.passed === 25 && record.finalValidationEvidence?.failed === 0 && record.finalValidationEvidence?.notRun === 0, 'final validation evidence binds all 25 clean process exits');

check(record.evidenceBoundary?.archiveVerticalSlice === 'LOCAL_PASS', 'bounded archive vertical slice is local PASS only');
check(record.evidenceBoundary?.PPK002 === 'PARTIAL', 'PPK-002 remains PARTIAL');
check(record.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'universal repository enforcement remains incomplete');
check(record.evidenceBoundary?.productionStartupPepWired === false, 'production PEP composition remains open');
check(record.evidenceBoundary?.productionDeviceSecretProtection === 'NOT_RUN_NOT_PASS', 'production device-secret protection is not PASS');
check(record.evidenceBoundary?.sqliteRepositoryRuntime === 'NOT_RUN_NOT_PASS', 'SQLite repository runtime is not PASS');
check(record.evidenceBoundary?.durableMultiProcessReplayProtection === 'NOT_RUN_NOT_PASS', 'durable multi-process replay protection is not PASS');
check(record.evidenceBoundary?.receiptAndBusinessCommitAtomicity === 'NOT_IMPLEMENTED', 'receipt and business-commit atomicity is not implemented');
check(record.evidenceBoundary?.obligationExecution === 'NOT_RUN_NOT_PASS', 'obligation execution is not PASS');
check(record.evidenceBoundary?.auditAndOutboxRepositoryEnforcement === 'NOT_COMPLETE', 'audit and outbox repository enforcement remains open');
check(record.evidenceBoundary?.eventAttachmentCrossAggregateReceiptBinding === 'NOT_COMPLETE', 'cross-aggregate event attachment binding remains open');
check(record.evidenceBoundary?.secureFileDeletionAndDatabaseCommitAtomicity === 'NOT_IMPLEMENTED', 'secure deletion and database-commit atomicity is not implemented');
check(record.evidenceBoundary?.requirementCompletionClaimed === false, 'PPK-002 completion is not claimed');

check(contract.status === 'PASS' && contract.checkCount === 123 && contract.failed === 0, 'current 30-N contract artifact is PASS 123');
check(runtime.status === 'PASS' && runtime.checkCount === 26 && runtime.failed === 0, 'current 30-N runtime artifact is PASS 26');
check(contract.evidenceBoundary?.PPK002 === 'PARTIAL' && contract.evidenceBoundary?.requirementCompletionClaimed === false, 'contract preserves the PPK-002 partial boundary');
check(runtime.evidenceBoundary?.scopeStatus === 'PARTIAL' && runtime.evidenceBoundary?.requirementCompletionClaimed === false, 'runtime preserves the PPK-002 partial boundary');
check(platformPolicy.status === 'PASS' && platformPolicy.legacyBypassCount === 29 && platformPolicy.newBypassCount === 0, 'platform policy gate preserves 29 legacy findings and zero new bypass');
check(predecessorContract.status === 'PASS' && predecessorContract.checkCount === 34 && predecessorContract.evidenceBoundary?.historical30MReportMutated === false, '30-M contract successor regression is PASS without historical mutation');
check(predecessorRuntime.status === 'PASS' && predecessorRuntime.checkCount === 43 && predecessorRuntime.evidenceBoundary?.historical30MReportMutated === false, '30-M runtime successor regression is PASS without historical mutation');

check(scope.step === '30-N' && scope.requirement === 'PPK-002' && scope.intentMappings?.length === 8, 'scope binds 30-N to PPK-002 and exactly eight intents');
check(scope.directRoleMigration?.preStepObservedFindings === 34 && scope.directRoleMigration?.removedFindings === 5 && scope.directRoleMigration?.expectedRemainingFindings === 29, 'scope binds the exact 34 to 29 migration');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL' && scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope preserves the partial requirement boundary');

const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.priority === 'P0', 'accepted-scope PPK-002 remains P0 PARTIAL');
check(ppk002?.chain?.useCase === false && ppk002?.chain?.repository === false, 'accepted-scope registry does not claim universal use-case or repository completion');

const step = step30N;
if (successorRegression) {
  const successor = plan.steps.find((item) => item.id === '30-O');
  const activeSteps = plan.steps.filter((item) => item.status === 'IN_PROGRESS');
  const closureBoundary = plan.currentStep === '30-N' && step?.status === 'COMPLETED';
  const successorActive = plan.currentStep === '30-O';
  check(step?.status === 'COMPLETED' && step?.validationStatus === 'PASS', '30-N predecessor is not COMPLETED with validation PASS');
  check(step?.persistentReceiptStatus === 'PASS' && step?.persistentReceiptPath === 'artifacts/checkpoints/30-N_LIBRARY_RECEIPT.json', '30-N predecessor persistent receipt binding mismatch');
  check(Boolean(completion30N), '30-N completion record missing');
  if (completion30N) {
    check(completion30N.officialStepStatus === 'COMPLETED' && completion30N.persistentReceiptStatus === 'PASS', '30-N completion record does not authorize successor work');
    check(completion30N.libraryReceipt?.path === 'artifacts/checkpoints/30-N_LIBRARY_RECEIPT.json', '30-N completion receipt path mismatch');
    check(completion30N.evidenceBoundary?.PPK002 === 'PARTIAL', '30-N completion falsely completed PPK-002');
  }
  check(closureBoundary || successorActive, 'work plan is neither the 30-N closure boundary nor active 30-O');
  if (closureBoundary) {
    check(activeSteps.length === 0, '30-N closure boundary must have no active work step');
    check(governance?.libraryUploadStatus === '30-N_RECEIPT_CHAIN_PASS' && governance?.activeMicroStep === null, '30-N closure governance state mismatch');
    check(governance?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_30-N_PERSISTENT_RECEIPT', '30-N closure automatic-selection handoff mismatch');
  } else if (successorActive) {
    check(successor?.status === 'IN_PROGRESS' && activeSteps.length === 1 && activeSteps[0]?.id === '30-O', '30-O must be the only active successor work step');
    check(governance?.libraryUploadStatus === '30-N_RECEIPT_CHAIN_PASS_30-O_IN_PROGRESS' && governance?.activeMicroStep === '30-O', '30-O governance state mismatch');
    check(governance?.nextOfficialTask?.startsWith('30-O'), '30-O next official task binding mismatch');
  }
} else {
  check(plan.currentStep === '30-N' && step?.status === 'IN_PROGRESS', '30-N remains the sole active work step');
  check(step?.validationStatus === 'PENDING' && step?.persistentReceiptStatus === 'PENDING' && step?.persistentReceiptPath === null, 'work plan validation and receipt remain PENDING');
}

check(diagnostic.status === 'DIAGNOSTIC_ONLY_NOT_PASS', 'failed-attempt artifact is diagnostic only');
check(diagnostic.attemptCount === 16 && diagnostic.preservedFailedAttempts === 16, 'all sixteen failed attempts are recorded');
check(diagnostic.failedAttemptsCountedAsPass === 0, 'no failed attempt is counted as PASS');
check(Array.isArray(diagnostic.attempts) && diagnostic.attempts.length === 16, 'diagnostic contains exactly sixteen attempt entries');
check(diagnostic.attempts.every((attempt, index) => attempt.sequence === index + 1 && attempt.exitCode === 1 && attempt.countedAsPass === false), 'every failed attempt has exit code 1 and countedAsPass false');
check(diagnostic.attempts.every((attempt) => attempt.finalCleanCounterpart?.exitCode === 0 && attempt.finalCleanCounterpart?.status === 'PASS'), 'every failed attempt references a clean exit-code-zero counterpart');
check(diagnostic.evidenceBoundary?.diagnosticArtifactIsPassEvidence === false && diagnostic.evidenceBoundary?.requirementCompletionClaimed === false, 'diagnostic does not become PASS or requirement completion evidence');
check(record.preservedFailedAttempts === 16 && record.failedAttemptsCountedAsPass === 0, 'execution record preserves sixteen failures and counts none as PASS');
check(record.bronzeCompletedPercent === 25 && record.silverStatus === 'FORBIDDEN_NOT_READY' && record.goldStatus === 'FORBIDDEN_NOT_READY', 'official Bronze progress and tier locks remain unchanged');
check(record.installerBuild === 'NOT_RUN_NOT_PASS', 'installer remains NOT_RUN_NOT_PASS');

const report = {
  schemaVersion: 1,
  release: record.release,
  step: successorRegression ? '30-O' : '30-N',
  ...(successorRegression ? { predecessorStep: '30-N', phase: '30-N_PREDECESSOR_REGRESSION' } : {}),
  requirement: 'PPK-002',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  scopeStatus: 'PARTIAL',
  localExecutionStatus: 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT',
  persistentReceiptStatus: successorRegression ? 'PASS' : 'PENDING',
  officialCompletionClaimed: successorRegression,
  ...(successorRegression ? {
    evidenceBoundary: {
      historical30NReportMutated: false,
      historicalExecutionRecordPreserved: true,
      PPK002: 'PARTIAL'
    }
  } : {}),
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`${successorRegression ? '30-N predecessor execution-record regression' : '30-N execution record contract'}: PASS (${checks.length} checks; Library receipt ${successorRegression ? 'PASS' : 'PENDING'}; PPK-002 PARTIAL).`);
