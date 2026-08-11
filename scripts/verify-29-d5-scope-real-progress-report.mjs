import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));
const percent = (part, whole) => whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(4));
const groupCounts = (items, key) => Object.fromEntries(
  [...new Set(items.map((item) => item[key]))].sort().map((value) => [value, items.filter((item) => item[key] === value).length])
);

const reportPath = 'artifacts/inventory/29-D5_SCOPE_AND_REAL_PROGRESS_REPORT.json';
const report = await readJson(reportPath);
const officialCompletion = report.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS';
for (const binding of report.sourceBindings ?? []) {
  try {
    const bytes = await readFile(binding.path);
    check(bytes.length === binding.sizeBytes, `${binding.id} size mismatch`);
    check(sha256(bytes) === binding.sha256, `${binding.id} SHA mismatch`);
  } catch {
    check(false, `${binding.id} source missing`);
  }
}

const baseline = await readJson('artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json');
const registry = await readJson('config/accepted-scope-registry.json');
const progressModel = await readJson('config/project-progress-model.json');
const deliveryContract = await readJson('config/delivery-report-contract.json');
const masterLedger = await readJson('config/master-build-ledger.json');
const d3 = await readJson('artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json');
const d4 = await readJson('artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json');
const plan = await readJson('config/work-segmentation-plan.json');
const featureReality = await readJson('artifacts/inventory/snapshots/29-D5_FEATURE_REALITY_AT_GENERATION.json');
const conversation = await readJson('artifacts/inventory/snapshots/29-D5_CONVERSATION_CAPACITY_AT_GENERATION.json');
const requirements = registry.requirements ?? [];
const complete = requirements.filter((item) => item.status === 'COMPLETE' && Object.values(item.chain ?? {}).every((value) => value === true));
const promotionRequired = requirements.filter((item) => ['P0', 'P1'].includes(item.priority));
const promotionComplete = promotionRequired.filter((item) => complete.includes(item));
const chainEntries = requirements.flatMap((item) => Object.entries(item.chain ?? {}));
const chainTrue = chainEntries.filter(([, value]) => value === true).length;
const latestHistorical = [...(masterLedger.builds ?? [])].reverse().find((item) => item.projectProgressAssessment);
const prepackageFailure = await readJson('artifacts/checkpoints/29-D5_PREPACKAGE_EXECUTION_POLICY_FAILURE.json');
const startProcessFailure = await readJson('artifacts/checkpoints/29-D5_PREPACKAGE_START_PROCESS_ENVIRONMENT_FAILURE.json');
const libraryUtf8Diagnostic = await readJson('artifacts/checkpoints/29-D5_LIBRARY_READBACK_UTF8_DIAGNOSTIC.json');

check(report.release === 'Bronze 04.08.2026.29' && report.step === '29-D5', 'release/step mismatch');
check(officialCompletion || report.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', '29-D5 lifecycle mismatch');
check(['PENDING', 'PASS'].includes(report.validationStatus), '29-D5 validation state invalid');
if (officialCompletion) {
  check(report.phase === 'POST_RECEIPT_COMPLETION' && report.validationStatus === 'PASS', '29-D5 completion phase mismatch');
  check(report.persistentReceiptStatus === 'PASS' && report.persistentReceiptPath === 'artifacts/checkpoints/29-D5_LIBRARY_RECEIPT.json', '29-D5 receipt completion mismatch');
  check(report.libraryReadbackVerificationPath === 'artifacts/validation/29-D5_LIBRARY_READBACK_VERIFICATION.json', '29-D5 Library readback path mismatch');
  check(report.receiptReadbackVerificationPath === 'artifacts/validation/29-D5_RECEIPT_READBACK_VERIFICATION.json', '29-D5 receipt readback path mismatch');
  check(report.completionRecordPath === 'artifacts/checkpoints/29-D5_COMPLETION_RECORD.json', '29-D5 completion record path mismatch');
  check(report.preReceiptReportFingerprintSha256 === 'b2a6b2ddeb57f3295d4742f348e36457f4a6ce491eb60310c9c3fa742e24ad1b', '29-D5 pre-receipt fingerprint mismatch');
} else {
  check(report.persistentReceiptStatus === 'PENDING' && report.persistentReceiptPath === null, '29-D5 receipt claimed before Library receipt');
}
check(baseline.sourceFileSha256 === 'a50cb31a6a906eabea888720a29782e8436d7054a16109acca885cd282ecc4d3', 'official status baseline SHA mismatch');
check(baseline.sourceAuthorityArchiveSha256 === 'd52a4ad2f1ff700dd260a1bb77f4145febf0ccbec85ca3f479aa85c016d57701', 'official source archive SHA mismatch');
check(baseline.officialFields.bronzeCompletedPercent === 25 && baseline.officialFields.bronzeRemainingPercent === 75, 'official Bronze baseline mismatch');
check(report.authorityVerdict.officialProgressSourceStatus === 'BOUND', 'official progress not bound');
check(report.authorityVerdict.historicalEstimateSupersedesCurrentAuthority === false && report.authorityVerdict.strictScopeMetricSupersedesCurrentAuthority === false, 'non-authoritative metric supersedes official progress');
check(report.authorityVerdict.evidenceBackedRecalculationAvailable === false, 'unsupported progress recalculation claimed');

const scope = report.scopeMetrics;
check(registry.requirementCount === requirements.length && requirements.length === 350, 'accepted requirement count mismatch');
check(complete.length === 4 && scope.strictCompleteCount === complete.length, 'strict complete count mismatch');
check(scope.strictIncompleteCount === requirements.length - complete.length && scope.strictIncompleteCount === 346, 'strict incomplete count mismatch');
check(scope.strictOverallCompletionPercent === percent(complete.length, requirements.length), 'strict completion percent mismatch');
check(scope.strictOverallRemainingPercent === percent(requirements.length - complete.length, requirements.length), 'strict remaining percent mismatch');
check(stableStringify(scope.statusCounts) === stableStringify(groupCounts(requirements, 'status')), 'scope status counts mismatch');
check(stableStringify(scope.priorityCounts) === stableStringify(groupCounts(requirements, 'priority')), 'scope priority counts mismatch');
check(stableStringify(scope.sourceCounts) === stableStringify(groupCounts(requirements, 'source')), 'scope source counts mismatch');
check(stableStringify(scope.completeRequirementIds) === stableStringify(complete.map((item) => item.id).sort()), 'complete requirement IDs mismatch');
check(scope.promotionRequired.total === 345 && scope.promotionRequired.complete === 4 && scope.promotionRequired.incomplete === 341, 'promotion scope counts mismatch');
check(scope.promotionRequired.completionPercent === percent(promotionComplete.length, promotionRequired.length), 'promotion completion percent mismatch');
check(scope.p2AcceptedButNotPromotionGate.total === 5 && scope.p2AcceptedButNotPromotionGate.incomplete === 5 && scope.p2AcceptedButNotPromotionGate.countedAsComplete === false, 'P2 truth mismatch');
check(scope.chainEvidenceCoverage.totalBooleanFields === chainEntries.length && scope.chainEvidenceCoverage.trueFields === chainTrue, 'chain evidence coverage mismatch');
check(scope.chainEvidenceCoverage.classification === 'EVIDENCE_DENSITY_NOT_REQUIREMENT_COMPLETION', 'chain evidence misclassified');

const truth = report.progressTruth;
check(truth.officialValidatedProgress.completedPercent === 25 && truth.officialValidatedProgress.remainingPercent === 75, 'official progress changed');
check(truth.officialValidatedProgress.status === 'CURRENT_OFFICIAL' && truth.officialValidatedProgress.method === 'AUTHORITY_LOCKED_VALIDATED_PROGRESS_NOT_RECALCULATED', 'official progress classification mismatch');
check(truth.strictAcceptedScopeCompletion.completedPercent === percent(4, 350) && truth.strictAcceptedScopeCompletion.status.includes('NOT_OFFICIAL_BRONZE_PERCENT'), 'strict scope metric classification mismatch');
check(truth.promotionGateCompletion.completedPercent === percent(4, 345) && truth.promotionGateCompletion.incomplete === 341, 'promotion metric mismatch');
check(latestHistorical?.build === 228 && latestHistorical.projectProgressAssessment.codingCompletionPercent === 97.6, 'historical progress source mismatch');
check(truth.historicalEstimate.build === 228 && truth.historicalEstimate.completedPercent === 97.6 && truth.historicalEstimate.countedAsCurrentProgress === false, 'historical estimate incorrectly used');
check(truth.historicalEstimate.classification === 'HISTORICAL_WEIGHTED_ESTIMATE_NOT_CURRENT_OFFICIAL_PROGRESS', 'historical estimate classification mismatch');
check(Object.values(progressModel.codingScope).reduce((sum, value) => sum + value, 0) === 100, 'progress model weights do not total 100');
check(truth.weightedModel.weightTotal === 100 && truth.weightedModel.acceptedScopeToWeightMappingStatus === 'UNAVAILABLE_NOT_DEFINED', 'unsupported weight mapping claimed');
check(truth.weightedModel.currentRecalculationStatus === 'NOT_CALCULATED_NOT_PASS', 'unsupported weighted progress calculated');
check(truth.reconciliationVerdict === 'METRICS_ARE_NOT_INTERCHANGEABLE_AND_MUST_NOT_BE_AVERAGED_OR_SUBSTITUTED', 'metric reconciliation mismatch');

check(featureReality.status === 'PASS' && featureReality.requirements === 350 && featureReality.incompleteRequired === 341 && featureReality.silverReady === false, 'feature reality snapshot mismatch');
check(report.featureRealityGate.classification === 'HONESTY_GATE_PASS_NOT_SCOPE_COMPLETION_PASS' && report.featureRealityGate.countedAsScopePass === false, 'honesty gate counted as scope PASS');
check(d3.summary.openGapCount === 9 && d3.summary.gapsCountedAsPass === 0, 'D3 open gap truth mismatch');
check(d3.summary.openContradictionCount === 0 && d3.summary.contradictionsCountedAsPass === 0, 'D3 contradiction truth mismatch');
check(d4.findingSummary.open === 8 && d4.findingSummary.countedAsPass === 0, 'D4 open finding truth mismatch');
for (const key of ['dependencyBackedTypecheck', 'unitAndIntegrationTests', 'productionBuild', 'installerBuild']) check(d4.executionEvidence[key].status === 'NOT_RUN_NOT_PASS', `${key} was incorrectly promoted`);
check(report.unresolvedTruth.dependencyBackedExecution.countedAsPass === false, 'unrun execution counted as PASS');
check(prepackageFailure.status === 'FAIL' && prepackageFailure.processExitCode === 1 && prepackageFailure.executedValidationCommands === 0 && prepackageFailure.countedAsPass === false, 'prepackage execution-policy failure mismatch');
check(prepackageFailure.correctionScope === 'PROCESS_SCOPED_EXECUTION_POLICY_BYPASS_FOR_SIGNED_LOCAL_WORKFLOW_SCRIPT_ONLY' && prepackageFailure.validationRulesBypassed === false, 'prepackage correction scope mismatch');
check(startProcessFailure.status === 'FAIL' && startProcessFailure.processExitCode === 1 && startProcessFailure.executedValidationCommands === 0 && startProcessFailure.countedAsPass === false, 'Start-Process environment failure mismatch');
check(startProcessFailure.correctionScope === 'REPLACE_START_PROCESS_WITH_DIRECT_NODE_INVOCATION_AND_PRESERVE_EXIT_CODE_LOGGING' && startProcessFailure.validationRulesBypassed === false, 'Start-Process correction scope mismatch');
check(libraryUtf8Diagnostic.status === 'DIAGNOSTIC_INVALID_NOT_PASS' && libraryUtf8Diagnostic.processExitCode === 0 && libraryUtf8Diagnostic.countedAsPass === false, 'Library UTF-8 diagnostic mismatch');
check(libraryUtf8Diagnostic.reportArtifact.mandatoryTruthSentenceUtf8Valid === false && libraryUtf8Diagnostic.payloadOrLibraryFilesChanged === false, 'Library UTF-8 diagnostic scope mismatch');
check(report.preservedFailures?.length === (officialCompletion ? 3 : 2) && report.preservedFailures.every((item) => item.countedAsPass === false), '29-D5 failures not preserved in report');
check(report.readiness.bronzeCompletion === 'NOT_COMPLETE' && report.readiness.releasePromotionAuthorized === false, 'release promotion authorized');
check(report.readiness.silver === 'FORBIDDEN_NOT_READY' && report.readiness.gold === 'FORBIDDEN_NOT_READY', 'Silver/Gold state mismatch');

const d4Step = plan.steps.find((item) => item.id === '29-D4');
const d5Step = plan.steps.find((item) => item.id === '29-D5');
const d6Step = plan.steps.find((item) => item.id === '29-D6');
const eStep = plan.steps.find((item) => item.id === '29-E');
const fStep = plan.steps.find((item) => item.id === '29-F');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === (plan.workflowStatus === 'COMPLETED' ? 0 : 1), 'active top-level step count mismatch');
check(d4Step?.status === 'COMPLETED' && d4Step.validationStatus === 'PASS' && d4Step.persistentReceiptStatus === 'PASS', '29-D4 durable completion mismatch');
if (officialCompletion) {
  check(['29-D6', '29-E', '29-F'].includes(plan.currentStep), 'current step must be 29-D6 or a durably authorized forward step after receipt completion');
  check(d5Step?.status === 'COMPLETED' && d5Step.validationStatus === 'PASS' && d5Step.persistentReceiptStatus === 'PASS', '29-D5 durable completion mismatch');
  check(d5Step?.persistentReceiptPath === report.persistentReceiptPath && d5Step.receiptReadbackVerificationPath === report.receiptReadbackVerificationPath, '29-D5 plan receipt binding mismatch');
  const d6Active = plan.currentStep === '29-D6' && d6Step?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(d6Step.validationStatus) && d6Step.persistentReceiptStatus === 'PENDING';
  const d6CompletedForward = plan.currentStep === '29-E' && d6Step?.status === 'COMPLETED' && d6Step.validationStatus === 'PASS' && d6Step.persistentReceiptStatus === 'PASS' && eStep?.status === 'IN_PROGRESS';
  const eCompletedForward = plan.currentStep === '29-F' && d6Step?.status === 'COMPLETED' && d6Step.validationStatus === 'PASS' && d6Step.persistentReceiptStatus === 'PASS' && eStep?.status === 'COMPLETED' && eStep.validationStatus === 'PASS' && eStep.persistentReceiptStatus === 'PASS' && (fStep?.status === 'IN_PROGRESS' || (plan.workflowStatus === 'COMPLETED' && fStep?.status === 'COMPLETED' && fStep.validationStatus === 'PASS' && fStep.persistentReceiptStatus === 'PASS'));
  check(d6Active || d6CompletedForward || eCompletedForward, '29-D6 active state mismatch');
} else {
  check(plan.currentStep === '29-D5', 'current step must remain 29-D5');
  check(d5Step?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(d5Step.validationStatus) && d5Step.persistentReceiptStatus === 'PENDING', '29-D5 active state mismatch');
  check(d6Step?.status === 'PENDING' && d6Step.validationStatus === 'PENDING' && d6Step.persistentReceiptStatus === 'PENDING', '29-D6 started prematurely');
}
check(report.workSegmentation.currentStep === '29-D5' && report.workSegmentation.activeSteps.length === 1 && report.workSegmentation.activeSteps[0] === '29-D5', 'work segmentation report mismatch');
check(report.workSegmentation.classification === 'WORKFLOW_PROGRESS_NOT_PRODUCT_COMPLETION_PERCENT', 'workflow progress misclassified');

for (const field of deliveryContract.requiredFields) check(Object.hasOwn(report.deliveryReport, field), `delivery field missing=${field}`);
check(report.deliveryReport.completedRequirementIds.length === 0 && report.deliveryReport.completedDecisionIds.length === 0, '29-D5 invented product completion');
check(report.deliveryReport.bronzeCompletionPercent === 25 && report.deliveryReport.bronzeRemainingPercent === 75, 'delivery progress mismatch');
check(report.deliveryReport.estimatedBronzeCompletion === 'UNAVAILABLE_NO_CURRENT_EVIDENCE_BACKED_VELOCITY', 'unsupported Bronze ETA claimed');
check(report.deliveryReport.estimatedSilverTransition === 'UNAVAILABLE_NOT_READY' && report.deliveryReport.estimatedGoldTransition === 'UNAVAILABLE_NOT_READY', 'unsupported promotion ETA claimed');
check(report.deliveryReport.estimateConfidence === 'UNAVAILABLE_FAIL_CLOSED', 'unsupported estimate confidence claimed');
check(report.deliveryReport.persistentLibraryUploadStatus === (officialCompletion ? 'PASS' : 'PENDING'), 'Library upload lifecycle mismatch');
check(report.deliveryReport.nextOfficialTask === (officialCompletion ? '29-D6 governed final closure of 29-D' : '29-D5 scope and real progress report Library finalization'), 'delivery next task mismatch');
if (officialCompletion) {
  check(report.deliveryReport.validationResults.libraryPayloadRoundTrip === 'PASS' && report.deliveryReport.validationResults.libraryReceiptReadback === 'PASS', 'Library validation results missing');
}
check(report.deliveryReport.sourceSha256 === baseline.sourceAuthorityArchiveSha256, 'delivery source SHA mismatch');
check(conversation.status === 'UNAVAILABLE' && conversation.actualUsedPercent === null && conversation.handoff === 'NOT_REQUIRED_WITHOUT_ACTUAL_HARD_STOP', 'conversation snapshot mismatch');
check(report.conversationCapacity === 'UNAVAILABLE' && report.deliveryReport.conversationCapacity === 'UNAVAILABLE', 'conversation capacity invented');
check(report.deliveryReport.handoffPromptStatus === 'NOT_REQUIRED_WITHOUT_ACTUAL_HARD_STOP', 'handoff incorrectly required');

const fingerprintBasis = {
  sourceBindings: report.sourceBindings,
  scopeMetrics: report.scopeMetrics,
  progressTruth: report.progressTruth,
  planCounts: {
    totalTopLevelSteps: report.workSegmentation.totalTopLevelSteps,
    completedTopLevelSteps: report.workSegmentation.completedTopLevelSteps,
    inProgressTopLevelSteps: report.workSegmentation.inProgressTopLevelSteps,
    pendingTopLevelSteps: report.workSegmentation.pendingTopLevelSteps
  },
  deliveryReport: report.deliveryReport,
  preservedFailures: report.preservedFailures,
  ...(officialCompletion ? { postReceiptEvidence: report.postReceiptEvidence } : {})
};
check(report.reportFingerprintSha256 === sha256(Buffer.from(stableStringify(fingerprintBasis))), 'report fingerprint mismatch');
check(report.nextOfficialStep === (officialCompletion ? '29-D6' : '29-D5') && report.nextOfficialStepStatus === (officialCompletion ? 'IN_PROGRESS' : 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT') && report.nextOfficialStepAuthorized === officialCompletion, '29-D6 authorization lifecycle mismatch');
check(report.mandatoryTruthSentence === TRUTH && report.deliveryReport.mandatoryTruthSentence === TRUTH, 'mandatory truth sentence mismatch');
const governance = await readJson('config/active-governance-ledger.json');
check(governance.nextOfficialTask === (officialCompletion ? (plan.workflowStatus === 'COMPLETED' ? 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' : plan.currentStep === '29-F' ? '29-F documents, deterministic package, exact-source and Library closure' : plan.currentStep === '29-E' ? '29-E targeted tests and security gates' : '29-D6 governed final closure of 29-D') : '29-D5 scope and real progress report'), 'active governance next task mismatch');
if (officialCompletion) {
  check(['29-D5_COMPLETED_RECEIPT_PASS', '29-D6_COMPLETED_RECEIPT_PASS', '29-E1_COMPLETED_RECEIPT_PASS', '29-E2_COMPLETED_RECEIPT_PASS', '29-E3_COMPLETED_RECEIPT_PASS', '29-E4_COMPLETED_RECEIPT_PASS', '29-F_COMPLETED_RECEIPT_PASS'].includes(governance.libraryUploadStatus), '29-D5 governance Library state mismatch');
  const d6Supersession = governance.supersessions.find((item) => item.id === 'GOV-SUP-29-D6-001');
  check(d6Supersession?.previousValue === '29-D5 scope and real progress report' && d6Supersession.effectiveValue === '29-D6 governed final closure of 29-D', '29-D6 governance supersession mismatch');
}
for (const path of [reportPath, 'docs/audit/29-D5_KAPSAM_VE_GERCEK_ILERLEME_RAPORU.md', 'artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json', 'artifacts/checkpoints/29-D5_PREPACKAGE_EXECUTION_POLICY_FAILURE.json', 'artifacts/checkpoints/29-D5_PREPACKAGE_START_PROCESS_ENVIRONMENT_FAILURE.json', 'artifacts/checkpoints/29-D5_LIBRARY_READBACK_UTF8_DIAGNOSTIC.json', ...(officialCompletion ? ['artifacts/checkpoints/29-D5_COMPLETION_RECORD.json'] : [])]) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}
if (officialCompletion) {
  const receiptPath = 'artifacts/checkpoints/29-D5_LIBRARY_RECEIPT.json';
  const libraryPath = 'artifacts/validation/29-D5_LIBRARY_READBACK_VERIFICATION.json';
  const receiptReadbackPath = 'artifacts/validation/29-D5_RECEIPT_READBACK_VERIFICATION.json';
  const completionPath = 'artifacts/checkpoints/29-D5_COMPLETION_RECORD.json';
  const [receiptBytes, libraryBytes, readbackBytes, receipt, libraryReadback, receiptReadback, completion] = await Promise.all([
    readFile(receiptPath), readFile(libraryPath), readFile(receiptReadbackPath),
    readJson(receiptPath), readJson(libraryPath), readJson(receiptReadbackPath), readJson(completionPath)
  ]);
  check(sha256(receiptBytes) === '3129bbb9857d45ece9244ced4e84d77a4def55880a35b8709ee78118a7a6a600', '29-D5 receipt SHA mismatch');
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS' && receipt.officialStepCompletionClaimed === false, '29-D5 receipt state mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, '29-D5 receipt roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, '29-D5 receipt ZIP mismatch');
  check(receipt.scopeAndProgressReport.fingerprintSha256 === report.preReceiptReportFingerprintSha256 && receipt.scopeAndProgressReport.officialBronzeCompletedPercent === 25, 'receipt report binding mismatch');
  check(receipt.preservedFailures.length === 3 && receipt.preservedFailures.every((item) => item.countedAsPass === false), 'receipt preserved failures mismatch');
  check(sha256(libraryBytes) === 'ed0a24305282ec5cb5393a126f45ec7c3b1d8d95c61bd562b43d687f2237ad3f', '29-D5 Library readback SHA mismatch');
  check(libraryReadback.status === 'PASS' && libraryReadback.executed === 20 && libraryReadback.matched === 20 && libraryReadback.failed === 0, '29-D5 Library readback mismatch');
  check(libraryReadback.zipExecuted === 3 && libraryReadback.zipPassed === 3 && libraryReadback.zipFailed === 0 && libraryReadback.mandatoryTruthSentence === TRUTH, '29-D5 Library ZIP/truth mismatch');
  check(sha256(readbackBytes) === 'ade75c6f36c2bb07695e418111fc47e08647bbd86f2b765001934c3b5ac6b203', '29-D5 receipt readback SHA mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0 && Object.values(receiptReadback.fieldChecks).every(Boolean), '29-D5 receipt readback mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.validationStatus === 'PASS' && completion.persistentReceiptStatus === 'PASS', '29-D5 completion state mismatch');
  check(completion.receipt.sha256 === sha256(receiptBytes) && completion.libraryReadback.sha256 === sha256(libraryBytes) && completion.receiptReadback.sha256 === sha256(readbackBytes), '29-D5 completion hash binding mismatch');
  check(completion.receiptReadback.persistenceExecuted === 2 && completion.receiptReadback.persistenceMatched === 2 && completion.receiptReadback.persistenceFailed === 0 && completion.receiptReadback.persistenceStatus === 'PASS', '29-D5 receipt readback persistence mismatch');
  check(completion.nextOfficialStep === '29-D6' && completion.nextOfficialStepStatus === 'IN_PROGRESS' && completion.nextOfficialStepAuthorized === true, '29-D5 completion next-step mismatch');
  check(report.postReceiptEvidence.receipt.sha256 === sha256(receiptBytes) && report.postReceiptEvidence.libraryReadback.sha256 === sha256(libraryBytes) && report.postReceiptEvidence.receiptReadback.sha256 === sha256(readbackBytes), 'post-receipt evidence binding mismatch');
}

const validation = {
  schemaVersion: 1,
  release: report.release,
  step: '29-D5',
  phase: officialCompletion ? 'POST_LIBRARY_RECEIPT_COMPLETION_VALIDATION' : 'SCOPE_AND_REAL_PROGRESS_LOCAL_VALIDATION',
  checks,
  failures,
  officialBronzeCompletedPercent: 25,
  strictAcceptedScopeComplete: complete.length,
  strictAcceptedScopeTotal: requirements.length,
  promotionRequiredIncomplete: promotionRequired.length - promotionComplete.length,
  historicalEstimateExcluded: true,
  currentEta: 'UNAVAILABLE',
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  nextOfficialStep: officialCompletion ? '29-D6' : '29-D5',
  nextOfficialStepStatus: officialCompletion ? 'IN_PROGRESS' : 'IN_PROGRESS_AWAITING_LIBRARY_RECEIPT',
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D5-scope-real-progress-report.json', JSON.stringify(validation, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-D5 Scope and Real Progress Report: ${officialCompletion ? 'OFFICIAL PASS' : 'LOCAL PASS'} (${checks} checks / official 25% / strict ${complete.length}/${requirements.length} / ETA UNAVAILABLE).`);
