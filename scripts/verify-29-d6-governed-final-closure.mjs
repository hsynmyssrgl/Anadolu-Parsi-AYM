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

const closurePath = 'artifacts/checkpoints/29-D6_29-D_GOVERNED_FINAL_CLOSURE.json';
const closure = await readJson(closurePath);
const officialCompletion = closure.status === 'PASS' && closure.persistentReceiptStatus === 'PASS';
for (const binding of closure.sourceBindings ?? []) {
  try {
    const bytes = await readFile(binding.path);
    check(bytes.length === binding.sizeBytes, `${binding.id} size mismatch`);
    check(sha256(bytes) === binding.sha256, `${binding.id} SHA mismatch`);
  } catch { check(false, `${binding.id} source missing`); }
}
check(closure.release === 'Bronze 04.08.2026.29' && closure.step === '29-D6', 'release/step mismatch');
check(closure.validationStatus === 'PASS', 'closure validation state invalid');
if (officialCompletion) {
  check(closure.phase === 'OFFICIAL_29-D_CLOSURE_COMPLETE', 'official closure phase mismatch');
  check(closure.persistentReceiptPath === 'artifacts/checkpoints/29-D6_LIBRARY_RECEIPT.json', 'official receipt binding mismatch');
  check(closure.libraryReadbackVerificationPath === 'artifacts/validation/29-D6_LIBRARY_READBACK_VERIFICATION.json', 'Library readback binding mismatch');
  check(closure.receiptReadbackVerificationPath === 'artifacts/validation/29-D6_RECEIPT_READBACK_VERIFICATION.json', 'receipt readback binding mismatch');
  check(closure.completionRecordPath === 'artifacts/checkpoints/29-D6_COMPLETION_RECORD.json', 'completion binding mismatch');
} else {
  check(closure.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT' && closure.phase === 'LOCAL_CLOSURE_AWAITING_LIBRARY_RECEIPT', 'closure lifecycle mismatch');
  check(closure.persistentReceiptStatus === 'PENDING' && closure.persistentReceiptPath === null, '29-D6 receipt claimed early');
}
check(closure.closureScope.phase === '29-D' && closure.closureScope.productCompletionClaimed === false && closure.closureScope.releasePromotionClaimed === false, 'closure scope overclaim');
check(closure.closureScope.historicalCheckpointRewritten === false, 'historical checkpoint rewrite claimed');
check(closure.priorStepClosures.length === 8 && closure.priorStepClosures.every((item) => item.durableClosure === true), 'prior durable closure mismatch');
check(closure.eligibility.allPriorStepsDurablyClosed === true && closure.eligibility.durablePriorStepCount === 8, 'closure eligibility mismatch');

const plan = await readJson('config/work-segmentation-plan.json');
const priorIds = ['29-D1', '29-D2-A', '29-D2-B', '29-D2-C', '29-D2-D', '29-D3', '29-D4', '29-D5'];
for (const id of priorIds) {
  const step = plan.steps.find((item) => item.id === id);
  check(step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS', `${id} durable state mismatch`);
}
const d6 = plan.steps.find((item) => item.id === '29-D6');
const e = plan.steps.find((item) => item.id === '29-E');
const f = plan.steps.find((item) => item.id === '29-F');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === (plan.workflowStatus === 'COMPLETED' ? 0 : 1), 'active step count mismatch');
if (officialCompletion) {
  check(['29-E', '29-F'].includes(plan.currentStep), '29-E or its durably authorized forward step must be current after durable 29-D6 completion');
  check(d6?.status === 'COMPLETED' && d6.validationStatus === 'PASS' && d6.persistentReceiptStatus === 'PASS', '29-D6 durable lifecycle mismatch');
  check(d6.persistentReceiptPath === closure.persistentReceiptPath && d6.receiptReadbackVerificationPath === closure.receiptReadbackVerificationPath, '29-D6 plan receipt binding mismatch');
  if (plan.currentStep === '29-E') {
    check(e?.status === 'IN_PROGRESS' && e.validationStatus === 'PENDING' && e.persistentReceiptStatus === 'PENDING', '29-E active state mismatch');
    check(f?.status === 'PENDING' && f.validationStatus === 'PENDING' && f.persistentReceiptStatus === 'PENDING', '29-F started prematurely');
  } else {
    check(e?.status === 'COMPLETED' && e.validationStatus === 'PASS' && e.persistentReceiptStatus === 'PASS', '29-E durable forward state mismatch');
    check((f?.status === 'IN_PROGRESS' && f.validationStatus === 'PENDING' && f.persistentReceiptStatus === 'PENDING') || (plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS'), '29-F forward state mismatch');
  }
} else {
  check(plan.currentStep === '29-D6', '29-D6 active state mismatch');
  check(d6?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(d6.validationStatus) && d6.persistentReceiptStatus === 'PENDING', '29-D6 lifecycle mismatch');
  check(e?.status === 'PENDING' && e.validationStatus === 'PENDING' && e.persistentReceiptStatus === 'PENDING', '29-E started prematurely');
  check(f?.status === 'PENDING' && f.validationStatus === 'PENDING' && f.persistentReceiptStatus === 'PENDING', '29-F started prematurely');
}
check(closure.eligibility.localClosureEligible === true && closure.eligibility.exactlyOneInProgress === true, 'local closure not eligible');

check(closure.executionEvidence.governedPreflight.status === 'PASS' && closure.executionEvidence.governedPreflight.failed === 0, 'governed preflight mismatch');
for (const key of ['dependencyBackedTypecheck', 'unitAndIntegrationTests', 'productionBuild', 'installerBuild']) check(closure.executionEvidence[key] === 'NOT_RUN_NOT_PASS', `${key} incorrectly promoted`);
check(closure.unresolvedTruth.governanceGaps.open === 9 && closure.unresolvedTruth.governanceGaps.countedAsPass === 0, 'open gap truth mismatch');
check(closure.unresolvedTruth.governanceContradictions.open === 0 && closure.unresolvedTruth.governanceContradictions.countedAsPass === 0, 'contradiction truth mismatch');
check(closure.unresolvedTruth.technicalFindings.open === 8 && closure.unresolvedTruth.technicalFindings.countedAsPass === 0, 'technical finding truth mismatch');
check(closure.unresolvedTruth.acceptedScope.total === 350 && closure.unresolvedTruth.acceptedScope.complete === 4 && closure.unresolvedTruth.acceptedScope.incomplete === 346 && closure.unresolvedTruth.acceptedScope.promotionRequiredIncomplete === 341, 'accepted scope truth mismatch');
check(closure.unresolvedTruth.dependencyBackedExecution.countedAsPass === false, 'unrun execution counted as PASS');
check(closure.progressTruth.officialBronzeCompletedPercent === 25 && closure.progressTruth.officialBronzeRemainingPercent === 75, 'official Bronze progress changed');
check(closure.progressTruth.strictAcceptedScopeComplete === 4 && closure.progressTruth.strictAcceptedScopeTotal === 350, 'strict scope metric changed');
check(closure.progressTruth.historicalEstimateCountedAsCurrent === false && closure.progressTruth.currentEta === 'UNAVAILABLE_NO_CURRENT_EVIDENCE_BACKED_VELOCITY', 'unsupported progress/ETA claim');
check(closure.readiness.bronzeCompletion === 'NOT_COMPLETE' && closure.readiness.silver === 'FORBIDDEN_NOT_READY' && closure.readiness.gold === 'FORBIDDEN_NOT_READY' && closure.readiness.releasePromotionAuthorized === false, 'release readiness overclaim');

const deliveryContract = await readJson('config/delivery-report-contract.json');
for (const field of deliveryContract.requiredFields) check(Object.hasOwn(closure.deliveryReport, field), `delivery field missing=${field}`);
check(closure.deliveryReport.completedRequirementIds.length === 0 && closure.deliveryReport.completedDecisionIds.length === 0, '29-D6 invented product completion');
check(closure.deliveryReport.persistentLibraryUploadStatus === (officialCompletion ? 'PASS' : 'PENDING'), 'Library upload lifecycle mismatch');
if (officialCompletion) {
  check(closure.deliveryReport.validationResults.libraryPayloadRoundTrip === 'PASS', 'Library payload validation missing');
  check(closure.deliveryReport.validationResults.libraryReceiptReadback === 'PASS', 'Library receipt validation missing');
  check(closure.deliveryReport.validationResults.receiptReadbackPersistence === 'PASS', 'receipt-readback persistence missing');
}
check(closure.deliveryReport.estimatedBronzeCompletion === 'UNAVAILABLE_NO_CURRENT_EVIDENCE_BACKED_VELOCITY' && closure.deliveryReport.estimateConfidence === 'UNAVAILABLE_FAIL_CLOSED', 'unsupported ETA claimed');
check(closure.deliveryReport.conversationCapacity === 'UNAVAILABLE' && closure.conversationCapacity === 'UNAVAILABLE', 'conversation capacity invented');
const governance = await readJson('config/active-governance-ledger.json');
const durableForwardLibraryStatus = [
  '29-D6_COMPLETED_RECEIPT_PASS',
  '29-E1_COMPLETED_RECEIPT_PASS',
  '29-E2_COMPLETED_RECEIPT_PASS',
  '29-E3_COMPLETED_RECEIPT_PASS',
  '29-E4_COMPLETED_RECEIPT_PASS',
  '29-F_COMPLETED_RECEIPT_PASS',
].includes(governance.libraryUploadStatus);
check(
  governance.nextOfficialTask === (officialCompletion ? (plan.workflowStatus === 'COMPLETED' ? 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' : plan.currentStep === '29-F' ? '29-F documents, deterministic package, exact-source and Library closure' : '29-E targeted tests and security gates') : '29-D6 governed final closure of 29-D')
    && (officialCompletion ? durableForwardLibraryStatus : governance.libraryUploadStatus === '29-D5_COMPLETED_RECEIPT_PASS'),
  'active governance state mismatch',
);
if (officialCompletion) {
  const supersession = governance.supersessions.find((item) => item.id === 'GOV-SUP-29-E-001');
  check(supersession?.previousValue === '29-D6 governed final closure of 29-D' && supersession.effectiveValue === '29-E targeted tests and security gates', '29-E governance supersession mismatch');
}

const basis = {
  sourceBindings: closure.sourceBindings,
  priorStepClosures: closure.priorStepClosures,
  allPriorDurable: closure.eligibility.allPriorStepsDurablyClosed,
  unresolvedTruth: closure.unresolvedTruth,
  officialProgress: { completedPercent: closure.progressTruth.officialBronzeCompletedPercent, remainingPercent: closure.progressTruth.officialBronzeRemainingPercent, source: 'artifacts/authority/29-D5_OFFICIAL_PROGRESS_BASELINE.json', method: 'AUTHORITY_LOCKED_VALIDATED_PROGRESS_NOT_RECALCULATED', status: 'CURRENT_OFFICIAL' },
  currentStep: closure.eligibility.currentStep,
  nextCandidateStep: '29-E',
  governanceNextTask: closure.deliveryReport.nextOfficialTask
};
check(closure.closureFingerprintSha256 === sha256(Buffer.from(stableStringify(basis))), 'closure fingerprint mismatch');
check(
  closure.nextOfficialStep === '29-E'
    && closure.nextOfficialStepStatus === (officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-D6_RECEIPT')
    && closure.nextOfficialStepAuthorized === officialCompletion,
  '29-E authorization lifecycle mismatch',
);
check(closure.mandatoryTruthSentence === TRUTH && closure.deliveryReport.mandatoryTruthSentence === TRUTH, 'truth sentence mismatch');
for (const path of [closurePath, 'docs/audit/29-D6_29-D_GOVERNED_FINAL_KAPANIS.md']) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}

if (officialCompletion) {
  const receiptPath = 'artifacts/checkpoints/29-D6_LIBRARY_RECEIPT.json';
  const libraryReadbackPath = 'artifacts/validation/29-D6_LIBRARY_READBACK_VERIFICATION.json';
  const receiptReadbackPath = 'artifacts/validation/29-D6_RECEIPT_READBACK_VERIFICATION.json';
  const completionPath = 'artifacts/checkpoints/29-D6_COMPLETION_RECORD.json';
  const [receipt, libraryReadback, receiptReadback, completion] = await Promise.all([
    readJson(receiptPath), readJson(libraryReadbackPath), readJson(receiptReadbackPath), readJson(completionPath),
  ]);
  const [receiptBytes, libraryBytes, receiptReadbackBytes] = await Promise.all([
    readFile(receiptPath), readFile(libraryReadbackPath), readFile(receiptReadbackPath),
  ]);
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS', 'receipt semantic state mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, 'receipt payload roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, 'receipt ZIP readback mismatch');
  check(receipt.preservedFailures.length === 2 && receipt.preservedFailures.every((item) => item.countedAsPass === false), 'receipt failures not preserved');
  check(libraryReadback.status === 'PASS' && libraryReadback.executed === 20 && libraryReadback.matched === 20 && libraryReadback.failed === 0, 'Library readback mismatch');
  check(libraryReadback.zipExecuted === 3 && libraryReadback.zipPassed === 3 && libraryReadback.zipFailed === 0, 'Library ZIP readback mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'receipt readback mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.nextOfficialStep === '29-E' && completion.nextOfficialStepStatus === 'IN_PROGRESS', 'completion lifecycle mismatch');
  check(completion.receipt.sizeBytes === receiptBytes.length && completion.receipt.sha256 === sha256(receiptBytes), 'completion receipt binding mismatch');
  check(completion.libraryReadback.sizeBytes === libraryBytes.length && completion.libraryReadback.sha256 === sha256(libraryBytes), 'completion Library readback binding mismatch');
  check(completion.receiptReadback.sizeBytes === receiptReadbackBytes.length && completion.receiptReadback.sha256 === sha256(receiptReadbackBytes), 'completion receipt readback binding mismatch');
  check(completion.receiptReadback.persistenceExecuted === 2 && completion.receiptReadback.persistenceMatched === 2 && completion.receiptReadback.persistenceFailed === 0 && completion.receiptReadback.persistenceStatus === 'PASS', 'receipt-readback persistence mismatch');
  check(completion.closure.postReceiptFingerprintSha256 === closure.closureFingerprintSha256, 'completion post-receipt fingerprint mismatch');
  check(completion.preservedFailureCount === 3 && completion.failuresCountedAsPass === 0, 'completion failure truth mismatch');
  check(receipt.mandatoryTruthSentence === TRUTH && libraryReadback.mandatoryTruthSentence === TRUTH && receiptReadback.mandatoryTruthSentence === TRUTH && completion.mandatoryTruthSentence === TRUTH, 'official truth sentence mismatch');
}

const validation = {
  schemaVersion: 1, release: closure.release, step: '29-D6', phase: officialCompletion ? 'GOVERNED_29-D_FINAL_CLOSURE_OFFICIAL_VALIDATION' : 'GOVERNED_29-D_FINAL_CLOSURE_LOCAL_VALIDATION',
  checks, failures, priorDurableSteps: 8, governanceGapsOpen: 9, technicalFindingsOpen: 8,
  strictAcceptedScopeComplete: 4, strictAcceptedScopeTotal: 350,
  dependencyBackedExecution: 'NOT_RUN_NOT_PASS', persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  nextOfficialStep: '29-E', nextOfficialStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-D6_RECEIPT',
  bronzeCompletedPercent: 25, silverStatus: 'FORBIDDEN_NOT_READY', goldStatus: 'FORBIDDEN_NOT_READY',
  conversationCapacity: 'UNAVAILABLE', status: failures.length ? 'FAIL' : 'PASS', generatedAt: new Date().toISOString(), mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D6-governed-final-closure.json', JSON.stringify(validation, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-D6 Governed Final Closure: ${officialCompletion ? 'OFFICIAL' : 'LOCAL'} PASS (${checks} checks / 8 prior durable steps / 9 gaps open / dependency execution NOT_RUN).`);
