import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableStringify = (value) => JSON.stringify(stable(value));

const analysisPath = 'artifacts/inventory/29-D3_RULE_GAP_AND_CONFLICT_ANALYSIS.json';
const analysis = await readJson(analysisPath);
const officialCompletion = analysis.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS';
for (const binding of analysis.sourceBindings) {
  if (officialCompletion && binding.id === 'governanceLedger') {
    check(binding.sizeBytes === 2546 && binding.sha256 === '5d5d2e7d0049ea65189d602f61c76fbfda0196f0fe640834a79f251259ad6034', 'pre-receipt governance binding changed');
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
check(analysis.release === 'Bronze 04.08.2026.29' && analysis.step === '29-D3', 'analysis release/step mismatch');
check(officialCompletion || analysis.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'analysis lifecycle state mismatch');
check(['PENDING', 'PASS'].includes(analysis.validationStatus), 'analysis validation state invalid');
if (officialCompletion) {
  check(analysis.phase === 'POST_RECEIPT_COMPLETION' && analysis.validationStatus === 'PASS', 'analysis official completion phase mismatch');
  check(analysis.persistentReceiptStatus === 'PASS' && analysis.persistentReceiptPath === 'artifacts/checkpoints/29-D3_LIBRARY_RECEIPT.json', 'analysis receipt completion mismatch');
  check(analysis.libraryReadbackVerificationPath === 'artifacts/validation/29-D3_LIBRARY_READBACK_VERIFICATION.json', 'analysis Library readback path mismatch');
  check(analysis.receiptReadbackVerificationPath === 'artifacts/validation/29-D3_RECEIPT_READBACK_VERIFICATION.json', 'analysis receipt readback path mismatch');
  check(analysis.completionRecordPath === 'artifacts/checkpoints/29-D3_COMPLETION_RECORD.json', 'analysis completion path mismatch');
  check(analysis.preReceiptAnalysisFingerprintSha256 === '68e584500007038778b0eecb0b92b3d69bbad686dd6af21937dadebe4d9d924d', 'pre-receipt fingerprint binding mismatch');
} else {
  check(analysis.persistentReceiptStatus === 'PENDING' && analysis.persistentReceiptPath === null, 'analysis receipt must remain PENDING');
}
check(analysis.gapAnalyses.length === 12, 'gap analysis count mismatch');
check(analysis.gapAnalyses.filter((item) => item.resolutionStatus === 'RESOLVED_WITH_EVIDENCE_NOT_PASS').length === 3, 'resolved gap count mismatch');
check(analysis.gapAnalyses.filter((item) => item.resolutionStatus === 'OPEN_EXPLICIT_NOT_PASS').length === 9, 'open gap count mismatch');
check(analysis.gapAnalyses.filter((item) => item.countedAsPass).length === 0, 'gap counted as PASS');
check(analysis.gapAnalyses.every((item) => item.sourceRecordPreserved === true), 'source gap record not preserved');
for (const id of ['D2C-GAP-009', 'D2C-GAP-010', 'D2C-GAP-011']) check(analysis.gapAnalyses.find((item) => item.id === id)?.resolutionStatus === 'RESOLVED_WITH_EVIDENCE_NOT_PASS', `${id} not resolved with evidence`);
for (const id of ['D2C-GAP-001', 'D2C-GAP-002', 'D2C-GAP-003', 'D2C-GAP-004', 'D2C-GAP-005', 'D2C-GAP-006', 'D2C-GAP-007', 'D2C-GAP-008', 'D2C-GAP-012']) check(analysis.gapAnalyses.find((item) => item.id === id)?.resolutionStatus === 'OPEN_EXPLICIT_NOT_PASS', `${id} open state mismatch`);
check(analysis.contradictionAnalyses.length === 4, 'contradiction analysis count mismatch');
check(analysis.contradictionAnalyses.filter((item) => item.d3Status === 'RESOLVED_WITH_EVIDENCE_NOT_PASS').length === 3, 'D3 contradiction resolution count mismatch');
check(analysis.contradictionAnalyses.filter((item) => item.d3Status === 'OPEN_EXPLICIT_NOT_PASS').length === 0, 'D3 open contradiction remains');
check(analysis.contradictionAnalyses.filter((item) => item.countedAsPass).length === 0, 'contradiction counted as PASS');
check(analysis.requirementDecisionLineage.length === 106, 'requirement lineage count mismatch');
check(analysis.requirementDecisionLineage.every((item) => item.requirementExists === true && item.explicitDecisionId === null && item.status === 'UNAVAILABLE_NO_EXPLICIT_IDENTIFIER_NO_INFERENCE' && item.countedAsPass === false), 'requirement lineage inference detected');
check(analysis.ruleDecisionLineage.length === 7, 'rule decision lineage count mismatch');
check(analysis.ruleDecisionLineage.every((item) => item.ruleExists === true && item.explicitDecisionId === null && item.status === 'UNAVAILABLE_NO_EXPLICIT_IDENTIFIER_NO_INFERENCE' && item.countedAsPass === false), 'rule decision lineage inference detected');
check(analysis.ruleSourceProvenance.length === 172, 'rule provenance count mismatch');
check(analysis.ruleSourceProvenance.every((item) => item.ruleExists === true && item.standaloneV6Source === 'NOT_FOUND_AS_STANDALONE_INPUT' && item.countedAsPass === false), 'rule provenance truth mismatch');
check(analysis.summary.originalGapCount === 12 && analysis.summary.resolvedGapCount === 3 && analysis.summary.openGapCount === 9 && analysis.summary.gapsCountedAsPass === 0, 'gap summary mismatch');
check(analysis.summary.originalOpenContradictionCount === 3 && analysis.summary.resolvedIn29D3ContradictionCount === 3 && analysis.summary.openContradictionCount === 0 && analysis.summary.contradictionsCountedAsPass === 0, 'contradiction summary mismatch');
check(analysis.preservedFailures?.length === 1, 'preserved failure count mismatch');
check(analysis.preservedFailures?.[0]?.status === 'FAIL' && analysis.preservedFailures[0].processExitCode === 1 && analysis.preservedFailures[0].countedAsPass === false, 'parent regression failure not preserved');
const parentRegressionFailure = await readJson('artifacts/checkpoints/29-D3_PARENT_REGRESSION_FORWARD_STATE_FAILURE.json');
check(parentRegressionFailure.status === 'FAIL' && parentRegressionFailure.processExitCode === 1 && parentRegressionFailure.countedAsPass === false, 'parent regression failure evidence mismatch');
check(parentRegressionFailure.correctionScope === 'FORWARD_STATE_COMPATIBILITY_ONLY', 'parent regression correction scope mismatch');

const releaseLedger = await readJson('config/release-ledger.json');
const r28 = releaseLedger.entries.find((entry) => entry.releaseId === 'bronze-2026-08-04-r28');
check(r28?.status === 'COMPLETED_SOURCE_CLOSURE_PASS', 'release 28 supersession status mismatch');
check(r28?.supersession?.id === 'REL-SUP-29-D3-001' && r28.supersession.previousStatus === 'IN_PROGRESS' && r28.supersession.status === 'RESOLVED_WITH_EVIDENCE', 'release supersession record mismatch');
check(r28?.supersession?.historicalSourceFilesRewritten === false, 'release supersession rewrites historical source');
const governance = await readJson('config/active-governance-ledger.json');
check(officialCompletion ? ['29-D4 pro-level technical assessment of the latest code', '29-D5 scope and real progress report', '29-D6 governed final closure of 29-D', '29-E targeted tests and security gates', '29-F documents, deterministic package, exact-source and Library closure', 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F'].includes(governance.nextOfficialTask) : governance.nextOfficialTask === '29-D3 rule gap and conflict analysis', 'active governance next task mismatch');
check(governance.conversationCapacity?.status === 'UNAVAILABLE' && governance.conversationCapacity.actualUsedPercent === null && governance.conversationCapacity.actualRemainingPercent === null, 'stale conversation telemetry remains active');
check(officialCompletion ? governance.supersessions?.length >= 3 : governance.supersessions?.length === 2, 'governance supersession count mismatch');
check(governance.supersessions.every((item) => item.status === 'RESOLVED_WITH_EVIDENCE' && item.historicalSourceFilesRewritten === false), 'governance supersession invalid');
if (officialCompletion) {
  check(['29-D3_COMPLETED_RECEIPT_PASS', '29-D4_COMPLETED_RECEIPT_PASS', '29-D5_COMPLETED_RECEIPT_PASS', '29-D6_COMPLETED_RECEIPT_PASS', '29-E1_COMPLETED_RECEIPT_PASS', '29-E2_COMPLETED_RECEIPT_PASS', '29-E3_COMPLETED_RECEIPT_PASS', '29-E4_COMPLETED_RECEIPT_PASS', '29-F_COMPLETED_RECEIPT_PASS'].includes(governance.libraryUploadStatus), 'active governance Library state mismatch');
  const d4Supersession = governance.supersessions.find((item) => item.id === 'GOV-SUP-29-D4-001');
  check(d4Supersession?.previousValue === '29-D3 rule gap and conflict analysis' && d4Supersession.effectiveValue === '29-D4 pro-level technical assessment of the latest code', '29-D4 task supersession mismatch');
}
const authority = await readJson('artifacts/authority/29-D3_RECOVERY_AUTHORITY_SNAPSHOT.json');
check(authority.sourceFileSha256 === 'a50cb31a6a906eabea888720a29782e8436d7054a16109acca885cd282ecc4d3', 'recovery authority source SHA mismatch');
check(authority.boundFields.lastFullClosedSourceRelease === 'Bronze 04.08.2026.28', 'recovery authority release mismatch');
check(authority.boundFields.conversationCapacity === 'UNAVAILABLE', 'recovery authority conversation state mismatch');
check(authority.unavailableContentInvented === false, 'recovery authority content invented');

const plan = await readJson('config/work-segmentation-plan.json');
const d2d = plan.steps.find((step) => step.id === '29-D2-D');
const d3 = plan.steps.find((step) => step.id === '29-D3');
const d4 = plan.steps.find((step) => step.id === '29-D4');
const d5 = plan.steps.find((step) => step.id === '29-D5');
const d6 = plan.steps.find((step) => step.id === '29-D6');
const e = plan.steps.find((step) => step.id === '29-E');
const f = plan.steps.find((step) => step.id === '29-F');
check(d2d?.status === 'COMPLETED' && d2d.validationStatus === 'PASS' && d2d.persistentReceiptStatus === 'PASS', '29-D2-D durable completion mismatch');
if (officialCompletion) {
  check(d3?.status === 'COMPLETED' && d3.validationStatus === 'PASS' && d3.persistentReceiptStatus === 'PASS', '29-D3 durable completion mismatch');
  check(d3?.persistentReceiptPath === analysis.persistentReceiptPath && d3.receiptReadbackVerificationPath === analysis.receiptReadbackVerificationPath, '29-D3 plan receipt binding mismatch');
  const d4Active = plan.currentStep === '29-D4' && d4?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(d4.validationStatus) && d4.persistentReceiptStatus === 'PENDING';
  const d4CompletedForward = plan.currentStep === '29-D5' && d4?.status === 'COMPLETED' && d4.validationStatus === 'PASS' && d4.persistentReceiptStatus === 'PASS' && d5?.status === 'IN_PROGRESS';
  const d5CompletedForward = plan.currentStep === '29-D6' && d4?.status === 'COMPLETED' && d4.validationStatus === 'PASS' && d4.persistentReceiptStatus === 'PASS' && d5?.status === 'COMPLETED' && d5.validationStatus === 'PASS' && d5.persistentReceiptStatus === 'PASS' && d6?.status === 'IN_PROGRESS';
  const d6CompletedForward = plan.currentStep === '29-E' && d4?.status === 'COMPLETED' && d4.validationStatus === 'PASS' && d4.persistentReceiptStatus === 'PASS' && d5?.status === 'COMPLETED' && d5.validationStatus === 'PASS' && d5.persistentReceiptStatus === 'PASS' && d6?.status === 'COMPLETED' && d6.validationStatus === 'PASS' && d6.persistentReceiptStatus === 'PASS' && e?.status === 'IN_PROGRESS';
  const eCompletedForward = plan.currentStep === '29-F' && d4?.status === 'COMPLETED' && d4.validationStatus === 'PASS' && d4.persistentReceiptStatus === 'PASS' && d5?.status === 'COMPLETED' && d5.validationStatus === 'PASS' && d5.persistentReceiptStatus === 'PASS' && d6?.status === 'COMPLETED' && d6.validationStatus === 'PASS' && d6.persistentReceiptStatus === 'PASS' && e?.status === 'COMPLETED' && e.validationStatus === 'PASS' && e.persistentReceiptStatus === 'PASS' && (f?.status === 'IN_PROGRESS' || (plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS'));
  check(d4Active || d4CompletedForward || d5CompletedForward || d6CompletedForward || eCompletedForward, '29-D4 forward state mismatch');
} else {
  check(plan.currentStep === '29-D3', 'current step mismatch');
  check(d3?.status === 'IN_PROGRESS', '29-D3 not IN_PROGRESS');
  check(['PENDING', 'PASS'].includes(d3?.validationStatus), '29-D3 validation state invalid');
  check(d3?.validationStatus === analysis.validationStatus, '29-D3 plan/analysis validation mismatch');
  check(d3?.persistentReceiptStatus === 'PENDING' && d3.persistentReceiptPath === null, '29-D3 receipt must remain PENDING');
  check(d4?.status === 'PENDING' && d4.validationStatus === 'PENDING' && d4.persistentReceiptStatus === 'PENDING', '29-D4 started prematurely');
}

const fingerprintBasis = { release: analysis.release, sourceBindings: analysis.sourceBindings, gapAnalyses: analysis.gapAnalyses, contradictionAnalyses: analysis.contradictionAnalyses, requirementDecisionLineage: analysis.requirementDecisionLineage, ruleDecisionLineage: analysis.ruleDecisionLineage, ruleSourceProvenance: analysis.ruleSourceProvenance, summary: analysis.summary };
check(analysis.analysisFingerprintSha256 === sha256(Buffer.from(stableStringify(fingerprintBasis))), 'analysis fingerprint mismatch');
check(analysis.nextOfficialStep === '29-D4' && analysis.nextOfficialStepStatus === (officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-D3_RECEIPT') && analysis.nextOfficialStepAuthorized === officialCompletion, '29-D4 authorization state mismatch');
check(analysis.bronzeCompletedPercent === 25.0 && analysis.bronzeRemainingPercent === 75.0, 'Bronze percentage changed');
check(analysis.silverStatus === 'BLOCKED_NOT_READY' && analysis.goldStatus === 'BLOCKED_NOT_READY', 'Silver or Gold authorized');
check(analysis.conversationCapacity === 'UNAVAILABLE', 'conversation capacity changed');
check(analysis.mandatoryTruthSentence === TRUTH, 'analysis truth sentence mismatch');
for (const path of [analysisPath, 'docs/audit/29-D3_KURAL_BOSLUGU_VE_CELISKI_ANALIZI.md', ...(officialCompletion ? ['artifacts/checkpoints/29-D3_COMPLETION_RECORD.json'] : [])]) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}
if (officialCompletion) {
  const receiptPath = 'artifacts/checkpoints/29-D3_LIBRARY_RECEIPT.json';
  const libraryReadbackPath = 'artifacts/validation/29-D3_LIBRARY_READBACK_VERIFICATION.json';
  const receiptReadbackPath = 'artifacts/validation/29-D3_RECEIPT_READBACK_VERIFICATION.json';
  const completionPath = 'artifacts/checkpoints/29-D3_COMPLETION_RECORD.json';
  const [receiptBytes, libraryBytes, receiptReadbackBytes, receipt, libraryReadback, receiptReadback, completion] = await Promise.all([
    readFile(receiptPath), readFile(libraryReadbackPath), readFile(receiptReadbackPath),
    readJson(receiptPath), readJson(libraryReadbackPath), readJson(receiptReadbackPath), readJson(completionPath)
  ]);
  check(sha256(receiptBytes) === '2e135a781289fdb2522bfd1dd657668e2377d63687a0e4bdd10f98312dc3fb54', '29-D3 receipt SHA mismatch');
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '29-D3 receipt state mismatch');
  check(receipt.officialStepCompletionClaimed === false, 'historical receipt completion claim changed');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, '29-D3 receipt roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, '29-D3 receipt ZIP readback mismatch');
  check(receipt.analysis.fingerprintSha256 === analysis.preReceiptAnalysisFingerprintSha256, 'receipt/analysis fingerprint binding mismatch');
  check(sha256(libraryBytes) === 'ae26f880ce24ada788e85b53e93b711e3c96f5d2d8a1bcfb05ae84af4cc62223', '29-D3 Library readback SHA mismatch');
  check(libraryReadback.status === 'PASS' && libraryReadback.executed === 20 && libraryReadback.matched === 20 && libraryReadback.failed === 0, '29-D3 Library readback mismatch');
  check(libraryReadback.zipChecks.length === 3 && libraryReadback.zipChecks.every((item) => item.status === 'PASS'), '29-D3 Library ZIP readback mismatch');
  check(sha256(receiptReadbackBytes) === '423124fc813203735f57782a4b831c963b48478b7458b4a76dceecf1d69dd34d', '29-D3 receipt readback SHA mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, '29-D3 receipt readback mismatch');
  check(Object.values(receiptReadback.fieldChecks).every(Boolean), '29-D3 receipt readback field failure');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.validationStatus === 'PASS' && completion.persistentReceiptStatus === 'PASS', '29-D3 completion record state mismatch');
  check(completion.receipt.sha256 === sha256(receiptBytes) && completion.libraryReadback.sha256 === sha256(libraryBytes) && completion.receiptReadback.sha256 === sha256(receiptReadbackBytes), '29-D3 completion hash binding mismatch');
  check(completion.receiptReadback.persistenceExecuted === 2 && completion.receiptReadback.persistenceMatched === 2 && completion.receiptReadback.persistenceFailed === 0 && completion.receiptReadback.persistenceStatus === 'PASS', '29-D3 receipt readback persistence mismatch');
  check(completion.nextOfficialStep === '29-D4' && completion.nextOfficialStepStatus === 'IN_PROGRESS' && completion.nextOfficialStepAuthorized === true, '29-D3 completion next-step authorization mismatch');
  check(completion.mandatoryTruthSentence === TRUTH, '29-D3 completion truth sentence mismatch');
}
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-D3',
  phase: officialCompletion ? 'POST_LIBRARY_RECEIPT_COMPLETION_VALIDATION' : 'RULE_GAP_AND_CONFLICT_ANALYSIS_LOCAL_VALIDATION',
  checks,
  failures,
  originalGapCount: 12,
  resolvedGapCount: 3,
  openGapCount: 9,
  gapsCountedAsPass: 0,
  originalOpenContradictionCount: 3,
  resolvedContradictionCount: 3,
  openContradictionCount: 0,
  contradictionsCountedAsPass: 0,
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  nextOfficialStep: '29-D4',
  nextOfficialStepStatus: officialCompletion ? 'IN_PROGRESS' : 'PENDING_AWAITING_29-D3_RECEIPT',
  bronzeCompletedPercent: 25.0,
  silverStatus: 'BLOCKED_NOT_READY',
  goldStatus: 'BLOCKED_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D3-rule-gap-conflict-analysis.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-D3 Rule Gap and Conflict Analysis: ${officialCompletion ? 'OFFICIAL PASS' : 'LOCAL PASS'} (${checks} checks / 9 open gaps / 0 open contradictions / Library receipt ${officialCompletion ? 'PASS' : 'PENDING'}).`);
