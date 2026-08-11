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

const assessmentPath = 'artifacts/inventory/29-D4_PROFESSIONAL_TECHNICAL_ASSESSMENT.json';
const assessment = await readJson(assessmentPath);
const officialCompletion = assessment.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS';
const forwardMutableBindingIds = new Set([
  'packageManifest', 'packageLock', 'typescriptBase', 'desktopMain', 'desktopDataStore',
  'rendererApp', 'rendererSecurity', 'rendererHtml'
]);
for (const binding of assessment.sourceBindings) {
  if (officialCompletion && forwardMutableBindingIds.has(binding.id)) {
    check(Number.isInteger(binding.sizeBytes) && binding.sizeBytes > 0, `${binding.id} historical size invalid`);
    check(/^[a-f0-9]{64}$/u.test(binding.sha256), `${binding.id} historical SHA invalid`);
    continue;
  }
  try {
    const bytes = await readFile(binding.path);
    check(bytes.length === binding.sizeBytes, `${binding.id} size mismatch`);
    check(sha256(bytes) === binding.sha256, `${binding.id} SHA mismatch`);
  } catch {
    check(false, `${binding.id} source missing`);
  }
}
check(assessment.release === 'Bronze 04.08.2026.29' && assessment.step === '29-D4', 'release/step mismatch');
check(officialCompletion || assessment.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'assessment lifecycle mismatch');
check(['PENDING', 'PASS'].includes(assessment.validationStatus), 'assessment validation state invalid');
if (officialCompletion) {
  check(assessment.phase === 'POST_RECEIPT_COMPLETION' && assessment.validationStatus === 'PASS', 'assessment completion phase mismatch');
  check(assessment.persistentReceiptStatus === 'PASS' && assessment.persistentReceiptPath === 'artifacts/checkpoints/29-D4_LIBRARY_RECEIPT.json', 'assessment receipt completion mismatch');
  check(assessment.libraryReadbackVerificationPath === 'artifacts/validation/29-D4_LIBRARY_READBACK_VERIFICATION.json', 'assessment Library readback path mismatch');
  check(assessment.receiptReadbackVerificationPath === 'artifacts/validation/29-D4_RECEIPT_READBACK_VERIFICATION.json', 'assessment receipt readback path mismatch');
  check(assessment.completionRecordPath === 'artifacts/checkpoints/29-D4_COMPLETION_RECORD.json', 'assessment completion path mismatch');
  check(assessment.preReceiptAssessmentFingerprintSha256 === 'ca14bb286abca2a9b677b98555b9af6f1fac434b6550dd6563ebd26e17331c27', 'pre-receipt assessment fingerprint mismatch');
} else {
  check(assessment.persistentReceiptStatus === 'PENDING' && assessment.persistentReceiptPath === null, 'assessment receipt must remain PENDING');
}
check(assessment.executionEvidence.bundledNode.version === 'v24.14.0' && assessment.executionEvidence.bundledNode.engineRangeSatisfied === true, 'bundled Node evidence mismatch');
check(assessment.executionEvidence.governedPreflight.status === 'PASS' && assessment.executionEvidence.governedPreflight.failed === 0, 'governed preflight evidence mismatch');
for (const key of ['dependencyBackedTypecheck', 'unitAndIntegrationTests', 'productionBuild', 'installerBuild']) {
  check(assessment.executionEvidence[key].status === 'NOT_RUN_NOT_PASS' && assessment.executionEvidence[key].countedAsPass === false, `${key} truth state mismatch`);
}
check(assessment.architecture.workspaceCount === 18 && assessment.architecture.acyclicProductionGraph === true, 'workspace architecture mismatch');
check(assessment.architecture.strictTypeScript === true && assessment.architecture.noUncheckedIndexedAccess === true && assessment.architecture.exactOptionalPropertyTypes === true, 'strict TypeScript controls missing');
check(assessment.architecture.productSourceFileCount > 100 && assessment.architecture.productPhysicalLineCount > 10000, 'product source metrics implausible');
check(assessment.architecture.testSourceFileCount > 5 && assessment.architecture.testPhysicalLineCount > 1000, 'test source metrics implausible');
check(assessment.architecture.filesOver1000Lines >= 3 && assessment.architecture.filesOver100KiB >= 3, 'hotspot thresholds mismatch');
check(assessment.architecture.topHotspots.some((item) => item.path === 'apps/desktop/src/renderer/App.tsx'), 'renderer hotspot missing');
check(assessment.architecture.topHotspots.some((item) => item.path === 'apps/desktop/src/main/data-store.ts'), 'data-store hotspot missing');
check(assessment.staticScan.dynamicCodeExecution === 0, 'dynamic code execution found');
check(assessment.staticScan.insecureRendererPreference === 0, 'explicit insecure renderer preference found');
check(assessment.securitySignals.sharedSecureRendererPreferences === true && assessment.securitySignals.explicitSecurePreviewPreferences === true, 'positive renderer security signals missing');
check(assessment.securitySignals.pdfWindowOnlyDeclaresSandbox === true, 'PDF window consistency finding missing');
check(assessment.securitySignals.cspPresent === true && assessment.securitySignals.cspAllowsInlineStyle === true && assessment.securitySignals.cspAllowsLocalhostConnect === true, 'CSP assessment mismatch');
check(assessment.findings.length === 8, 'finding count mismatch');
check(assessment.findingSummary.total === 8 && assessment.findingSummary.high === 2 && assessment.findingSummary.medium === 4 && assessment.findingSummary.low === 1 && assessment.findingSummary.info === 1, 'finding severity summary mismatch');
check(assessment.findingSummary.open === 8 && assessment.findingSummary.countedAsPass === 0, 'open findings counted as PASS');
check(assessment.findings.every((item) => item.status === 'OPEN_NOT_PASS' && item.countedAsPass === false && item.evidence.length > 0), 'finding truth/evidence mismatch');
check(assessment.preservedFailures?.length === (officialCompletion ? 4 : 2), 'failed validation attempt count mismatch');
check(assessment.preservedFailures.every((item) => item.countedAsPass === false), 'failed validation attempt counted as PASS');
check(assessment.preservedFailures[0].status === 'FAIL' && assessment.preservedFailures[0].processExitCode === 1 && assessment.preservedFailures[0].result === '8/13', 'aggregate failure result mismatch');
check(assessment.preservedFailures[1].status === 'FAIL' && assessment.preservedFailures[1].processExitCode === 1 && assessment.preservedFailures[1].result === '4 binding mismatches', 'binding failure result mismatch');
if (officialCompletion) {
  check(assessment.preservedFailures[2].status === 'DIAGNOSTIC_INVALID_NOT_PASS' && assessment.preservedFailures[2].result === '3-byte invalid JSON report', 'Library diagnostic failure not preserved');
  check(assessment.preservedFailures[3].status === 'FAIL' && assessment.preservedFailures[3].processExitCode === 1 && assessment.preservedFailures[3].result === 'UTF-8 BOM JSON parse failure', 'post-receipt BOM failure not preserved');
}
const aggregateFailure = await readJson('artifacts/checkpoints/29-D4_LEGACY_REGRESSION_FORWARD_STATE_FAILURES.json');
check(aggregateFailure.status === 'FAIL' && aggregateFailure.processExitCode === 1 && aggregateFailure.executed === 13 && aggregateFailure.pass === 8 && aggregateFailure.fail === 5 && aggregateFailure.countedAsPass === false, 'aggregate regression failure evidence mismatch');
check(aggregateFailure.correctionScope === 'FORWARD_STATE_COMPATIBILITY_ONLY' && aggregateFailure.historicalEvidenceChanged === false, 'aggregate regression correction scope mismatch');
const bindingFailure = await readJson('artifacts/checkpoints/29-D4_ASSESSMENT_MUTABLE_BINDING_FAILURE.json');
check(bindingFailure.status === 'FAIL' && bindingFailure.processExitCode === 1 && bindingFailure.failures.length === 4 && bindingFailure.countedAsPass === false, 'mutable binding failure evidence mismatch');
check(bindingFailure.correctionScope === 'BIND_MUTABLE_VALIDATION_INPUTS_TO_IMMUTABLE_GENERATION_SNAPSHOTS' && bindingFailure.historicalEvidenceChanged === false, 'mutable binding correction scope mismatch');
if (officialCompletion) {
  const libraryDiagnostic = await readJson('artifacts/checkpoints/29-D4_LIBRARY_READBACK_FIRST_ATTEMPT_DIAGNOSTIC.json');
  check(libraryDiagnostic.status === 'DIAGNOSTIC_INVALID_NOT_PASS' && libraryDiagnostic.processExitCode === 0 && libraryDiagnostic.countedAsPass === false, 'Library first readback diagnostic mismatch');
  check(libraryDiagnostic.reportArtifact.sizeBytes === 3 && libraryDiagnostic.reportArtifact.jsonValid === false, 'invalid Library report not preserved');
  const bomFailure = await readJson('artifacts/checkpoints/29-D4_POST_RECEIPT_BOM_READ_FAILURE.json');
  check(bomFailure.status === 'FAIL' && bomFailure.processExitCode === 1 && bomFailure.countedAsPass === false, 'post-receipt BOM failure evidence mismatch');
  check(bomFailure.correctionScope === 'UTF8_BOM_TOLERANT_JSON_READER_ONLY' && bomFailure.receiptOrReadbackChanged === false, 'post-receipt BOM correction scope mismatch');
}
for (const id of Array.from({ length: 8 }, (_, index) => `29-D4-FIND-00${index + 1}`)) check(assessment.findings.some((item) => item.id === id), `${id} missing`);
check(assessment.readiness.bronzeContinuation === 'AUTHORIZED_WITH_OPEN_REMEDIATION', 'Bronze continuation verdict mismatch');
check(assessment.readiness.releasePromotion === 'NOT_AUTHORIZED' && assessment.readiness.silver === 'BLOCKED_NOT_READY' && assessment.readiness.gold === 'BLOCKED_NOT_READY', 'release promotion authorized');
const basis = {
  release: assessment.scope.version,
  sourceBindings: assessment.sourceBindings,
  architecture: assessment.architecture,
  scan: assessment.staticScan,
  securitySignals: assessment.securitySignals,
  findings: assessment.findings.map(({ id, severity, category, status, countedAsPass, title, evidence, detail, remediation }) => ({ id, severity, category, status, countedAsPass, title, evidence, detail, remediation })),
  readiness: { bronzeContinuation: assessment.readiness.bronzeContinuation, silver: assessment.readiness.silver, gold: assessment.readiness.gold }
};
check(assessment.assessmentFingerprintSha256 === sha256(Buffer.from(stableStringify(basis))), 'assessment fingerprint mismatch');
const plan = await readJson('config/work-segmentation-plan.json');
const d3 = plan.steps.find((step) => step.id === '29-D3');
const d4 = plan.steps.find((step) => step.id === '29-D4');
const d5 = plan.steps.find((step) => step.id === '29-D5');
const d6 = plan.steps.find((step) => step.id === '29-D6');
const e = plan.steps.find((step) => step.id === '29-E');
const f = plan.steps.find((step) => step.id === '29-F');
check(d3?.status === 'COMPLETED' && d3.validationStatus === 'PASS' && d3.persistentReceiptStatus === 'PASS', '29-D3 durable completion mismatch');
if (officialCompletion) {
  check(d4?.status === 'COMPLETED' && d4.validationStatus === 'PASS' && d4.persistentReceiptStatus === 'PASS', '29-D4 durable completion mismatch');
  check(d4?.persistentReceiptPath === assessment.persistentReceiptPath && d4.receiptReadbackVerificationPath === assessment.receiptReadbackVerificationPath, '29-D4 plan receipt binding mismatch');
  const d5Active = plan.currentStep === '29-D5' && d5?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(d5.validationStatus) && d5.persistentReceiptStatus === 'PENDING';
  const d5CompletedForward = plan.currentStep === '29-D6' && d5?.status === 'COMPLETED' && d5.validationStatus === 'PASS' && d5.persistentReceiptStatus === 'PASS' && d6?.status === 'IN_PROGRESS';
  const d6CompletedForward = plan.currentStep === '29-E' && d5?.status === 'COMPLETED' && d5.validationStatus === 'PASS' && d5.persistentReceiptStatus === 'PASS' && d6?.status === 'COMPLETED' && d6.validationStatus === 'PASS' && d6.persistentReceiptStatus === 'PASS' && e?.status === 'IN_PROGRESS';
  const eCompletedForward = plan.currentStep === '29-F' && d5?.status === 'COMPLETED' && d5.validationStatus === 'PASS' && d5.persistentReceiptStatus === 'PASS' && d6?.status === 'COMPLETED' && d6.validationStatus === 'PASS' && d6.persistentReceiptStatus === 'PASS' && e?.status === 'COMPLETED' && e.validationStatus === 'PASS' && e.persistentReceiptStatus === 'PASS' && (f?.status === 'IN_PROGRESS' || (plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS'));
  check(d5Active || d5CompletedForward || d6CompletedForward || eCompletedForward, '29-D5 forward state mismatch');
} else {
  check(plan.currentStep === '29-D4', 'current step mismatch');
  check(d4?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(d4.validationStatus) && d4.persistentReceiptStatus === 'PENDING', '29-D4 active state mismatch');
  check(d4?.validationStatus === assessment.validationStatus, '29-D4 plan/assessment validation mismatch');
  check(d5?.status === 'PENDING' && d5.validationStatus === 'PENDING' && d5.persistentReceiptStatus === 'PENDING', '29-D5 started prematurely');
}
check(assessment.nextOfficialStep === '29-D5' && assessment.nextOfficialStepStatus === (officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-D4_RECEIPT') && assessment.nextOfficialStepAuthorized === officialCompletion, '29-D5 authorization mismatch');
const governance = await readJson('config/active-governance-ledger.json');
check(governance.nextOfficialTask === (officialCompletion ? (plan.workflowStatus === 'COMPLETED' ? 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' : plan.currentStep === '29-F' ? '29-F documents, deterministic package, exact-source and Library closure' : plan.currentStep === '29-E' ? '29-E targeted tests and security gates' : plan.currentStep === '29-D6' ? '29-D6 governed final closure of 29-D' : '29-D5 scope and real progress report') : '29-D4 pro-level technical assessment of the latest code'), 'active governance next task mismatch');
if (officialCompletion) {
  check(['29-D4_COMPLETED_RECEIPT_PASS', '29-D5_COMPLETED_RECEIPT_PASS', '29-D6_COMPLETED_RECEIPT_PASS', '29-E1_COMPLETED_RECEIPT_PASS', '29-E2_COMPLETED_RECEIPT_PASS', '29-E3_COMPLETED_RECEIPT_PASS', '29-E4_COMPLETED_RECEIPT_PASS', '29-F_COMPLETED_RECEIPT_PASS'].includes(governance.libraryUploadStatus), 'active governance Library status mismatch');
  const d5Supersession = governance.supersessions.find((item) => item.id === 'GOV-SUP-29-D5-001');
  check(d5Supersession?.previousValue === '29-D4 pro-level technical assessment of the latest code' && d5Supersession.effectiveValue === '29-D5 scope and real progress report', '29-D5 governance supersession mismatch');
}
check(assessment.bronzeCompletedPercent === 25.0, 'Bronze percentage changed');
check(assessment.conversationCapacity === 'UNAVAILABLE', 'conversation capacity changed');
check(assessment.mandatoryTruthSentence === TRUTH, 'assessment truth sentence mismatch');
for (const path of [assessmentPath, 'docs/audit/29-D4_PROFESYONEL_TEKNIK_DEGERLENDIRME.md', 'artifacts/checkpoints/29-D4_TOOLCHAIN_EXECUTION_UNAVAILABLE.json', 'artifacts/checkpoints/29-D4_LEGACY_REGRESSION_FORWARD_STATE_FAILURES.json', 'artifacts/checkpoints/29-D4_ASSESSMENT_MUTABLE_BINDING_FAILURE.json', ...(officialCompletion ? ['artifacts/checkpoints/29-D4_LIBRARY_READBACK_FIRST_ATTEMPT_DIAGNOSTIC.json', 'artifacts/checkpoints/29-D4_POST_RECEIPT_BOM_READ_FAILURE.json', 'artifacts/checkpoints/29-D4_COMPLETION_RECORD.json'] : [])]) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}
if (officialCompletion) {
  const receiptPath = 'artifacts/checkpoints/29-D4_LIBRARY_RECEIPT.json';
  const libraryPath = 'artifacts/validation/29-D4_LIBRARY_READBACK_VERIFICATION.json';
  const receiptReadbackPath = 'artifacts/validation/29-D4_RECEIPT_READBACK_VERIFICATION.json';
  const completionPath = 'artifacts/checkpoints/29-D4_COMPLETION_RECORD.json';
  const [receiptBytes, libraryBytes, readbackBytes, receipt, libraryReadback, receiptReadback, completion] = await Promise.all([
    readFile(receiptPath), readFile(libraryPath), readFile(receiptReadbackPath),
    readJson(receiptPath), readJson(libraryPath), readJson(receiptReadbackPath), readJson(completionPath)
  ]);
  check(sha256(receiptBytes) === '18491fcb33197f882a98aab1a42d15a6f19d911c71aae66c490e88b307817838', '29-D4 receipt SHA mismatch');
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS' && receipt.officialStepCompletionClaimed === false, '29-D4 receipt state mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, '29-D4 receipt roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, '29-D4 receipt ZIP mismatch');
  check(receipt.assessment.fingerprintSha256 === assessment.preReceiptAssessmentFingerprintSha256 && receipt.assessment.findingSummary.open === 8 && receipt.assessment.findingSummary.countedAsPass === 0, 'receipt assessment binding mismatch');
  check(sha256(libraryBytes) === '01eeec6de81083b59d725595e6d838c1c3c4f702087bcfddb7e5501115bd513d', '29-D4 Library readback SHA mismatch');
  check(libraryReadback.status === 'PASS' && libraryReadback.executed === 20 && libraryReadback.matched === 20 && libraryReadback.failed === 0, '29-D4 Library readback mismatch');
  check(libraryReadback.zipChecks.length === 3 && libraryReadback.zipChecks.every((item) => item.status === 'PASS'), '29-D4 Library ZIP readback mismatch');
  check(sha256(readbackBytes) === '6cd917b98fd05d2ba719f0e958eaa6118c33c60f29a745ec245ba59e8ebbe39e', '29-D4 receipt readback SHA mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0 && Object.values(receiptReadback.fieldChecks).every(Boolean), '29-D4 receipt readback mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.validationStatus === 'PASS' && completion.persistentReceiptStatus === 'PASS', '29-D4 completion state mismatch');
  check(completion.receipt.sha256 === sha256(receiptBytes) && completion.libraryReadback.sha256 === sha256(libraryBytes) && completion.receiptReadback.sha256 === sha256(readbackBytes), '29-D4 completion hash binding mismatch');
  check(completion.receiptReadback.persistenceExecuted === 2 && completion.receiptReadback.persistenceMatched === 2 && completion.receiptReadback.persistenceFailed === 0 && completion.receiptReadback.persistenceStatus === 'PASS', '29-D4 receipt readback persistence mismatch');
  check(completion.nextOfficialStep === '29-D5' && completion.nextOfficialStepStatus === 'IN_PROGRESS' && completion.nextOfficialStepAuthorized === true, '29-D4 completion next-step mismatch');
  check(completion.mandatoryTruthSentence === TRUTH, '29-D4 completion truth sentence mismatch');
}
const report = {
  schemaVersion: 1,
  release: assessment.release,
  step: '29-D4',
  phase: officialCompletion ? 'POST_LIBRARY_RECEIPT_COMPLETION_VALIDATION' : 'PROFESSIONAL_TECHNICAL_ASSESSMENT_LOCAL_VALIDATION',
  checks,
  failures,
  findingSummary: assessment.findingSummary,
  dependencyBackedExecution: 'NOT_RUN_NOT_PASS',
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  nextOfficialStep: '29-D5',
  nextOfficialStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-D4_RECEIPT',
  bronzeCompletedPercent: 25.0,
  silverStatus: 'BLOCKED_NOT_READY',
  goldStatus: 'BLOCKED_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D4-professional-technical-assessment.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-D4 Professional Technical Assessment: ${officialCompletion ? 'OFFICIAL PASS' : 'LOCAL PASS'} (${checks} checks / 8 open findings / dependency-backed execution NOT_RUN).`);
