import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const stableStringify = (value) => JSON.stringify(stable(value));

const paths = {
  record: 'artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_RECORD.json',
  d0Receipt: 'artifacts/checkpoints/29-D2-D0_LIBRARY_RECEIPT.json',
  d0Readback: 'artifacts/checkpoints/29-D2-D0_RECEIPT_READBACK_VERIFICATION.json',
  d1Receipt: 'artifacts/checkpoints/29-D2-D1_FINALIZATION_LIBRARY_RECEIPT.json',
  d1Readback: 'artifacts/validation/29-D2-D1-finalization-receipt-readback-verification.json',
  d2Receipt: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_LIBRARY_RECEIPT.json',
  d2Readback: 'artifacts/validation/29-D2-D2_FINALIZATION_RECEIPT_READBACK_VERIFICATION.json',
  d2Completion: 'artifacts/checkpoints/29-D2-D2_COMPLETION_RECORD.json',
  gaps: 'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  contradictions: 'artifacts/inventory/29-D2-D2_CONTRADICTION_REGISTER.json',
  firstCombinedFailure: 'artifacts/checkpoints/29-D2-D2_FIRST_COMBINED_VALIDATION_FAILURE.json',
  d1FirstFailure: 'artifacts/checkpoints/29-D2-D1_FINALIZATION_FIRST_ATTEMPT_FAILURE.json',
  d2FirstFailure: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_FIRST_ATTEMPT_FAILURE.json',
  windowsFailure: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_GOVERNED_PREFLIGHT_WINDOWS_FAILURE.json',
  readbackDiagnostic: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_READBACK_FIRST_ATTEMPT_DIAGNOSTIC.json',
  stateSyncFailure: 'artifacts/checkpoints/29-D2-D3_LOCAL_REVALIDATION_STATE_SYNC_FAILURE.json',
  parentReceipt: 'artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_LIBRARY_RECEIPT.json',
  parentLibraryReadback: 'artifacts/validation/29-D2-D3_PARENT_FINALIZATION_LIBRARY_READBACK_VERIFICATION.json',
  parentReceiptReadback: 'artifacts/validation/29-D2-D3_PARENT_FINALIZATION_RECEIPT_READBACK_VERIFICATION.json',
  parentCompletion: 'artifacts/checkpoints/29-D2-D_PARENT_COMPLETION_RECORD.json',
  plan: 'config/work-segmentation-plan.json'
};

for (const path of Object.values(paths)) {
  try {
    await stat(path);
    check(true, `${path} exists`);
  } catch {
    check(false, `${path} missing`);
  }
}
const [record, d0Receipt, d0Readback, d1Receipt, d1Readback, d2Receipt, d2Readback, d2Completion, gaps, contradictions, firstCombinedFailure, d1FirstFailure, d2FirstFailure, windowsFailure, readbackDiagnostic, stateSyncFailure, parentReceipt, parentLibraryReadback, parentReceiptReadback, parentCompletion, plan] = await Promise.all(Object.values(paths).map(readJson));

if (record.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS') {
  check(record.release === 'Bronze 04.08.2026.29', 'record release mismatch');
  check(record.step === '29-D2-D3' && record.parentStep === '29-D2-D', 'record step binding mismatch');
  check(record.validationStatus === 'PASS', 'record validation not PASS');
  check(record.persistentReceiptStatus === 'PASS', 'record receipt not PASS');
  check(record.persistentReceiptPath === paths.parentReceipt, 'record receipt path mismatch');
  check(record.libraryReadbackVerificationPath === paths.parentLibraryReadback, 'record Library readback path mismatch');
  check(record.receiptReadbackVerificationPath === paths.parentReceiptReadback, 'record receipt readback path mismatch');
  check(record.completionRecordPath === paths.parentCompletion, 'record completion path mismatch');
  check(record.parentCompletionClaimed === true && record.parentStepStatus === 'COMPLETED', 'record parent completion mismatch');
  check(record.nextOfficialStep === '29-D3' && record.nextOfficialStepStatus === 'IN_PROGRESS' && record.nextOfficialStepAuthorized === true, 'record 29-D3 authorization mismatch');
  check(record.openTruth.openGapCount === 12 && record.openTruth.openGapsCountedAsPass === 0, 'record gap truth mismatch');
  check(record.openTruth.openContradictionCount === 3 && record.openTruth.contradictionsCountedAsPass === 0, 'record contradiction truth mismatch');
  const fingerprintBasis = { release: record.release, step: record.step, receiptChain: record.receiptChain, openTruth: record.openTruth, preservedFailures: record.preservedFailures, nextOfficialStep: record.nextOfficialStep };
  check(record.recordFingerprintSha256 === sha256(Buffer.from(stableStringify(fingerprintBasis))), 'record fingerprint mismatch');

  const parentReceiptBytes = await readFile(paths.parentReceipt);
  check(sha256(parentReceiptBytes) === '087190b87a5c0dc14b849d8bb78c013618fc86537d8c3b18aac6c9a7fde32b5e', 'parent receipt SHA mismatch');
  check(parentReceipt.status === 'PASS' && parentReceipt.validationStatus === 'PASS' && parentReceipt.persistentReceiptStatus === 'PASS', 'parent receipt state mismatch');
  check(parentReceipt.roundTripVerification.executed === 22 && parentReceipt.roundTripVerification.matched === 22 && parentReceipt.roundTripVerification.failed === 0, 'parent receipt roundtrip mismatch');
  check(parentReceipt.zipReadbackVerification.executed === 3 && parentReceipt.zipReadbackVerification.pass === 3 && parentReceipt.zipReadbackVerification.fail === 0, 'parent receipt ZIP readback mismatch');
  check(parentReceipt.officialParentCompletionClaimed === false && parentReceipt.officialParentStepStatus === 'IN_PROGRESS', 'historical parent receipt state mismatch');
  check(parentReceipt.closureTruth.openGapCount === 12 && parentReceipt.closureTruth.openGapsCountedAsPass === 0, 'parent receipt gap truth mismatch');
  check(parentReceipt.closureTruth.openContradictionCount === 3 && parentReceipt.closureTruth.contradictionsCountedAsPass === 0, 'parent receipt contradiction truth mismatch');
  check(parentReceipt.nextOfficialStepAuthorizedAfterReceiptReadback === true, 'parent receipt next-step authorization missing');

  check(sha256(await readFile(paths.parentLibraryReadback)) === '7ce63da91e6da0ce79f70ae3438a37dfa0e8379c92106758d31ad6bf1d1a0bd0', 'parent Library readback SHA mismatch');
  check(parentLibraryReadback.status === 'PASS', 'parent Library readback not PASS');
  check(parentLibraryReadback.expectedFileCount === 22 && parentLibraryReadback.executed === 22 && parentLibraryReadback.matched === 22 && parentLibraryReadback.failed === 0, 'parent Library readback count mismatch');
  check(parentLibraryReadback.files.length === 22 && parentLibraryReadback.files.every((item) => item.status === 'PASS' && item.sizeMatch === true && item.shaMatch === true), 'parent Library readback file failure');
  check(parentLibraryReadback.zipChecks.length === 3 && parentLibraryReadback.zipChecks.every((item) => item.status === 'PASS'), 'parent Library ZIP readback failure');

  check(sha256(await readFile(paths.parentReceiptReadback)) === '8ff87a335e1aaa0be099326d2364f1806f19773012ec2fd51255fc40e13784c7', 'parent receipt readback SHA mismatch');
  check(parentReceiptReadback.status === 'PASS', 'parent receipt readback not PASS');
  check(parentReceiptReadback.expectedFileCount === 4 && parentReceiptReadback.executed === 4 && parentReceiptReadback.matched === 4 && parentReceiptReadback.failed === 0, 'parent receipt readback count mismatch');
  check(parentReceiptReadback.receiptSha256 === sha256(parentReceiptBytes), 'parent receipt readback receipt binding mismatch');
  check(parentReceiptReadback.libraryReadbackSha256 === '7ce63da91e6da0ce79f70ae3438a37dfa0e8379c92106758d31ad6bf1d1a0bd0', 'parent receipt readback Library binding mismatch');
  check(Object.values(parentReceiptReadback.fieldChecks).every(Boolean), 'parent receipt readback field failure');

  check(parentCompletion.status === 'PASS' && parentCompletion.officialStepStatus === 'COMPLETED', 'parent completion record mismatch');
  check(parentCompletion.validationStatus === 'PASS' && parentCompletion.persistentReceiptStatus === 'PASS', 'parent completion validation/receipt mismatch');
  check(parentCompletion.receipt.sha256 === sha256(parentReceiptBytes), 'parent completion receipt SHA mismatch');
  check(parentCompletion.libraryReadback.sha256 === '7ce63da91e6da0ce79f70ae3438a37dfa0e8379c92106758d31ad6bf1d1a0bd0', 'parent completion Library readback SHA mismatch');
  check(parentCompletion.receiptReadback.sha256 === '8ff87a335e1aaa0be099326d2364f1806f19773012ec2fd51255fc40e13784c7', 'parent completion receipt readback SHA mismatch');
  check(parentCompletion.receiptReadback.persistenceExecuted === 2 && parentCompletion.receiptReadback.persistenceMatched === 2 && parentCompletion.receiptReadback.persistenceFailed === 0 && parentCompletion.receiptReadback.persistenceStatus === 'PASS', 'receipt readback persistence mismatch');
  check(parentCompletion.nextOfficialStep === '29-D3' && parentCompletion.nextOfficialStepStatus === 'IN_PROGRESS' && parentCompletion.nextOfficialStepAuthorized === true, 'completion record 29-D3 authorization mismatch');

  check(firstCombinedFailure.status === 'FAIL' && firstCombinedFailure.pass === 8 && firstCombinedFailure.fail === 2 && firstCombinedFailure.countedAsPass === false, 'first 8/10 failure not preserved');
  check(stateSyncFailure.status === 'FAIL' && stateSyncFailure.processExitCode === 1 && stateSyncFailure.countedAsPass === false, 'state sync failure not preserved');
  check(gaps.unresolvedGapCount === 12 && gaps.gaps.filter((item) => item.countedAsPass).length === 0, 'open gaps changed');
  check(contradictions.openContradictionCount === 3 && contradictions.countedAsPass === 0, 'open contradictions changed');

  const parent = plan.steps.find((step) => step.id === '29-D2-D');
  const officialD3 = plan.steps.find((step) => step.id === '29-D3');
  const officialD4 = plan.steps.find((step) => step.id === '29-D4');
  const officialD5 = plan.steps.find((step) => step.id === '29-D5');
  const officialD6 = plan.steps.find((step) => step.id === '29-D6');
  const officialE = plan.steps.find((step) => step.id === '29-E');
  const officialF = plan.steps.find((step) => step.id === '29-F');
  const parentD3 = parent?.substeps?.find((step) => step.id === '29-D2-D3');
  const d3ActiveState = plan.currentStep === '29-D3'
    && officialD3?.status === 'IN_PROGRESS'
    && ['PENDING', 'PASS'].includes(officialD3?.validationStatus)
    && officialD3?.persistentReceiptStatus === 'PENDING';
  const d3CompletedForwardState = plan.currentStep === '29-D4'
    && officialD3?.status === 'COMPLETED'
    && officialD3?.validationStatus === 'PASS'
    && officialD3?.persistentReceiptStatus === 'PASS'
    && officialD4?.status === 'IN_PROGRESS';
  const d4CompletedForwardState = plan.currentStep === '29-D5'
    && officialD3?.status === 'COMPLETED'
    && officialD3?.validationStatus === 'PASS'
    && officialD3?.persistentReceiptStatus === 'PASS'
    && officialD4?.status === 'COMPLETED'
    && officialD4?.validationStatus === 'PASS'
    && officialD4?.persistentReceiptStatus === 'PASS'
    && officialD5?.status === 'IN_PROGRESS';
  const d5CompletedForwardState = plan.currentStep === '29-D6'
    && officialD3?.status === 'COMPLETED'
    && officialD3?.validationStatus === 'PASS'
    && officialD3?.persistentReceiptStatus === 'PASS'
    && officialD4?.status === 'COMPLETED'
    && officialD4?.validationStatus === 'PASS'
    && officialD4?.persistentReceiptStatus === 'PASS'
    && officialD5?.status === 'COMPLETED'
    && officialD5?.validationStatus === 'PASS'
    && officialD5?.persistentReceiptStatus === 'PASS'
    && officialD6?.status === 'IN_PROGRESS';
  const d6CompletedForwardState = plan.currentStep === '29-E'
    && officialD3?.status === 'COMPLETED' && officialD3?.validationStatus === 'PASS' && officialD3?.persistentReceiptStatus === 'PASS'
    && officialD4?.status === 'COMPLETED' && officialD4?.validationStatus === 'PASS' && officialD4?.persistentReceiptStatus === 'PASS'
    && officialD5?.status === 'COMPLETED' && officialD5?.validationStatus === 'PASS' && officialD5?.persistentReceiptStatus === 'PASS'
    && officialD6?.status === 'COMPLETED' && officialD6?.validationStatus === 'PASS' && officialD6?.persistentReceiptStatus === 'PASS'
    && officialE?.status === 'IN_PROGRESS';
  const eCompletedForwardState = plan.currentStep === '29-F'
    && officialD3?.status === 'COMPLETED' && officialD3?.validationStatus === 'PASS' && officialD3?.persistentReceiptStatus === 'PASS'
    && officialD4?.status === 'COMPLETED' && officialD4?.validationStatus === 'PASS' && officialD4?.persistentReceiptStatus === 'PASS'
    && officialD5?.status === 'COMPLETED' && officialD5?.validationStatus === 'PASS' && officialD5?.persistentReceiptStatus === 'PASS'
    && officialD6?.status === 'COMPLETED' && officialD6?.validationStatus === 'PASS' && officialD6?.persistentReceiptStatus === 'PASS'
    && officialE?.status === 'COMPLETED' && officialE?.validationStatus === 'PASS' && officialE?.persistentReceiptStatus === 'PASS'
    && (officialF?.status === 'IN_PROGRESS' || (plan.workflowStatus === 'COMPLETED' && officialF?.status === 'COMPLETED' && officialF?.validationStatus === 'PASS' && officialF?.persistentReceiptStatus === 'PASS'));
  check(d3ActiveState || d3CompletedForwardState || d4CompletedForwardState || d5CompletedForwardState || d6CompletedForwardState || eCompletedForwardState, 'official 29-D3 forward state mismatch');
  check(parent?.status === 'COMPLETED' && parent.validationStatus === 'PASS' && parent.persistentReceiptStatus === 'PASS', 'parent plan completion mismatch');
  check(parent?.persistentReceiptPath === paths.parentReceipt && parent.readbackVerificationPath === paths.parentReceiptReadback, 'parent plan receipt binding mismatch');
  check(parentD3?.status === 'COMPLETED' && parentD3.validationStatus === 'PASS' && parentD3.persistentReceiptStatus === 'PASS', 'D3 substep completion mismatch');
  check(parentD3?.persistentReceiptPath === paths.parentReceipt && parentD3.receiptReadbackVerificationPath === paths.parentReceiptReadback, 'D3 substep receipt binding mismatch');
  if (d3CompletedForwardState || d4CompletedForwardState || d5CompletedForwardState || d6CompletedForwardState || eCompletedForwardState) {
    check(officialD3?.persistentReceiptPath === 'artifacts/checkpoints/29-D3_LIBRARY_RECEIPT.json', 'official 29-D3 forward receipt path mismatch');
    check(officialD3?.receiptReadbackVerificationPath === 'artifacts/validation/29-D3_RECEIPT_READBACK_VERIFICATION.json', 'official 29-D3 forward receipt readback mismatch');
    check(d3CompletedForwardState ? ['PENDING', 'PASS'].includes(officialD4?.validationStatus) && officialD4?.persistentReceiptStatus === 'PENDING' : officialD4?.validationStatus === 'PASS' && officialD4?.persistentReceiptStatus === 'PASS', 'official 29-D4 forward state mismatch');
  }
  check(record.bronzeCompletedPercent === 25.0 && parentCompletion.bronzeCompletedPercent === 25.0, 'Bronze percentage changed');
  check(record.silverStatus === 'BLOCKED_NOT_READY' && record.goldStatus === 'BLOCKED_NOT_READY', 'Silver or Gold authorized');
  check(record.conversationCapacity === 'UNAVAILABLE', 'conversation capacity changed');
  check([record, parentReceipt, parentLibraryReadback, parentReceiptReadback, parentCompletion].every((value) => value.mandatoryTruthSentence === TRUTH), 'post-receipt truth sentence mismatch');

  const report = {
    schemaVersion: 1,
    release: 'Bronze 04.08.2026.29',
    step: '29-D2-D3',
    phase: 'POST_LIBRARY_RECEIPT_PARENT_COMPLETION',
    checks,
    failures,
    persistentReceiptStatus: failures.length ? 'FAIL' : 'PASS',
    parentStepStatus: failures.length ? 'FAIL' : 'COMPLETED',
    nextOfficialStep: '29-D3',
    nextOfficialStepStatus: failures.length ? 'BLOCKED' : 'IN_PROGRESS',
    openGapCount: 12,
    openGapsCountedAsPass: 0,
    openContradictionCount: 3,
    contradictionsCountedAsPass: 0,
    bronzeCompletedPercent: 25.0,
    silverStatus: 'BLOCKED_NOT_READY',
    goldStatus: 'BLOCKED_NOT_READY',
    conversationCapacity: 'UNAVAILABLE',
    status: failures.length ? 'FAIL' : 'PASS',
    generatedAt: new Date().toISOString(),
    mandatoryTruthSentence: TRUTH
  };
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/29-D2-D3-parent-finalization.json', JSON.stringify(report, null, 2) + '\n');
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log(`29-D2-D3 Parent Finalization: OFFICIAL PASS (${checks} checks / parent COMPLETED / current ${plan.currentStep}).`);
  process.exit(0);
}

check(record.release === 'Bronze 04.08.2026.29', 'record release mismatch');
check(record.step === '29-D2-D3', 'record step mismatch');
check(record.parentStep === '29-D2-D', 'record parent mismatch');
check(record.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'record local state mismatch');
check(['PENDING', 'PASS'].includes(record.validationStatus), 'record validation state invalid');
check(record.persistentReceiptStatus === 'PENDING', 'record receipt must remain PENDING before Library receipt');
check(record.persistentReceiptPath === null, 'record receipt path must remain null before Library receipt');
check(record.parentCompletionClaimed === false, 'record claims parent completion');
check(record.parentStepStatus === 'IN_PROGRESS', 'record parent state mismatch');
check(record.nextOfficialStep === '29-D3', 'record next official step mismatch');
check(record.nextOfficialStepStatus === 'PENDING_AWAITING_29-D2-D_RECEIPT', 'record next official state mismatch');
check(record.nextOfficialStepAuthorized === false, 'record authorizes 29-D3 prematurely');

check(d0Receipt.status === 'PASS', 'D0 receipt not PASS');
check(d0Receipt.persistentWriteStatus === 'PASS', 'D0 persistence not PASS');
check(d0Receipt.roundTripVerification.executed === 14 && d0Receipt.roundTripVerification.matched === 14 && d0Receipt.roundTripVerification.failed === 0, 'D0 roundtrip mismatch');
check(d0Readback.status === 'PASS', 'D0 receipt readback not PASS');
check(Object.values(d0Readback.fieldChecks).every(Boolean), 'D0 readback field failure');
for (const [id, receipt, readback, expectedRoundTrip] of [
  ['29-D2-D1', d1Receipt, d1Readback, 18],
  ['29-D2-D2', d2Receipt, d2Readback, 16]
]) {
  check(receipt.status === 'PASS', `${id} receipt not PASS`);
  check(receipt.officialSubstepStatus === 'COMPLETED', `${id} substep not completed`);
  check(receipt.validationStatus === 'PASS', `${id} validation not PASS`);
  check(receipt.persistentReceiptStatus === 'PASS', `${id} persistence not PASS`);
  check(receipt.roundTripVerification.executed === expectedRoundTrip, `${id} roundtrip executed mismatch`);
  check(receipt.roundTripVerification.matched === expectedRoundTrip, `${id} roundtrip matched mismatch`);
  check(receipt.roundTripVerification.failed === 0, `${id} roundtrip failures`);
  check(readback.status === 'PASS', `${id} receipt readback not PASS`);
  check(Object.values(readback.fieldChecks).every(Boolean), `${id} receipt readback field failure`);
}
check(d2Completion.status === 'PASS', 'D2 completion not PASS');
check(d2Completion.officialSubstepStatus === 'COMPLETED', 'D2 completion substep state mismatch');
check(d2Completion.nextSubstep === '29-D2-D3', 'D2 completion next substep mismatch');
check(d2Completion.nextSubstepStatus === 'IN_PROGRESS', 'D2 completion next state mismatch');

check(gaps.gapCount === 12 && gaps.unresolvedGapCount === 12 && gaps.gaps.length === 12, 'gap count mismatch');
check(gaps.gaps.filter((gap) => gap.countedAsPass).length === 0, 'open gap counted as PASS');
check(contradictions.openContradictionCount === 3, 'open contradiction count mismatch');
check(contradictions.countedAsPass === 0, 'contradiction counted as PASS');
check(contradictions.contradictions.filter((item) => item.status === 'OPEN_EXPLICIT').length === 3, 'open contradiction array mismatch');
check(contradictions.contradictions.filter((item) => item.countedAsPass).length === 0, 'contradiction item counted as PASS');
check(record.openTruth.openGapCount === 12 && record.openTruth.openGapsCountedAsPass === 0, 'record gap truth mismatch');
check(record.openTruth.openContradictionCount === 3 && record.openTruth.contradictionsCountedAsPass === 0, 'record contradiction truth mismatch');
check(record.openTruth.routedTo29D3 === 6, '29-D3 route count mismatch');
check(record.openTruth.externalOrPlatformUnavailable === 4, 'external unavailable route count mismatch');
check(record.openTruth.historicalEvidenceRemediation === 2, 'historical remediation route count mismatch');

check(firstCombinedFailure.status === 'FAIL' && firstCombinedFailure.executed === 10 && firstCombinedFailure.pass === 8 && firstCombinedFailure.fail === 2, 'first 8/10 failure not preserved');
check(firstCombinedFailure.countedAsPass === false, 'first 8/10 failure counted as PASS');
check(d1FirstFailure.status === 'FAIL' && d1FirstFailure.countedAsPass === false, 'D1 first failure not preserved');
check(d2FirstFailure.status === 'FAIL' && d2FirstFailure.countedAsPass === false, 'D2 first failure not preserved');
check(windowsFailure.status === 'FAIL_PRESERVED_THEN_CORRECTED', 'Windows failure record mismatch');
check(windowsFailure.attempts.every((attempt) => attempt.countedAsPass === false), 'Windows failure counted as PASS');
check(readbackDiagnostic.status === 'DIAGNOSTIC_INVALID_NOT_PASS' && readbackDiagnostic.countedAsPass === false, 'readback diagnostic not preserved');
check(stateSyncFailure.status === 'FAIL' && stateSyncFailure.processExitCode === 1, 'state sync failure not preserved');
check(stateSyncFailure.countedAsPass === false, 'state sync failure counted as PASS');
check(stateSyncFailure.correctionScope === 'WORK_SEGMENTATION_PARENT_VALIDATION_STATE_ALIGNMENT_ONLY', 'state sync correction scope mismatch');

check(record.receiptChain.length === 3, 'record receipt chain length mismatch');
for (const entry of record.receiptChain) {
  check(entry.status === 'PASS', `${entry.id} record receipt-chain state mismatch`);
  check(entry.receiptSha256 === sha256(await readFile(entry.receiptPath)), `${entry.id} record receipt SHA mismatch`);
  check(entry.readbackSha256 === sha256(await readFile(entry.readbackPath)), `${entry.id} record readback SHA mismatch`);
  if (entry.completionPath) check(entry.completionSha256 === sha256(await readFile(entry.completionPath)), `${entry.id} record completion SHA mismatch`);
}
const fingerprintBasis = {
  release: record.release,
  step: record.step,
  receiptChain: record.receiptChain,
  openTruth: record.openTruth,
  preservedFailures: record.preservedFailures,
  nextOfficialStep: record.nextOfficialStep
};
check(record.recordFingerprintSha256 === sha256(Buffer.from(stableStringify(fingerprintBasis))), 'record fingerprint mismatch');

check(plan.currentStep === '29-D2-D', 'current work step must remain 29-D2-D before parent receipt');
const parent = plan.steps.find((step) => step.id === '29-D2-D');
const officialD3 = plan.steps.find((step) => step.id === '29-D3');
const d0 = parent?.substeps?.find((step) => step.id === '29-D2-D0');
const d1 = parent?.substeps?.find((step) => step.id === '29-D2-D1');
const d2 = parent?.substeps?.find((step) => step.id === '29-D2-D2');
const d3 = parent?.substeps?.find((step) => step.id === '29-D2-D3');
check(parent?.status === 'IN_PROGRESS', 'parent must remain IN_PROGRESS before receipt');
check(['PENDING', 'PASS'].includes(parent?.validationStatus), 'parent validation state invalid before receipt');
check(parent?.validationStatus === record.validationStatus, 'parent and record validation states differ');
check(parent?.persistentReceiptStatus === 'PENDING', 'parent receipt must remain PENDING before receipt');
check([d0, d1, d2].every((step) => step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS'), 'prior substep chain incomplete');
check(d1?.finalizationReceiptStatus === 'PASS', 'D1 finalization receipt mismatch');
check(d2?.finalizationReceiptStatus === 'PASS', 'D2 finalization receipt mismatch');
check(d3?.status === 'IN_PROGRESS', 'D3 substep must be IN_PROGRESS');
check(['PENDING', 'PASS'].includes(d3?.validationStatus), 'D3 substep validation state invalid');
check(d3?.validationStatus === record.validationStatus, 'D3 substep and record validation states differ');
check(d3?.persistentReceiptStatus === 'PENDING', 'D3 substep receipt must remain PENDING');
check(officialD3?.status === 'PENDING', 'official 29-D3 started before parent receipt');
check(officialD3?.validationStatus === 'PENDING' && officialD3?.persistentReceiptStatus === 'PENDING', 'official 29-D3 state mismatch');

check(record.bronzeCompletedPercent === 25.0 && record.bronzeRemainingPercent === 75.0, 'Bronze percentage changed');
check(record.silverStatus === 'BLOCKED_NOT_READY', 'Silver authorized');
check(record.goldStatus === 'BLOCKED_NOT_READY', 'Gold authorized');
check(record.conversationCapacity === 'UNAVAILABLE', 'conversation capacity must remain UNAVAILABLE');
check(record.mandatoryTruthSentence === TRUTH, 'record truth sentence mismatch');
check([d0Receipt, d0Readback, d1Receipt, d1Readback, d2Receipt, d2Readback, d2Completion, gaps, contradictions, firstCombinedFailure, d1FirstFailure, d2FirstFailure, windowsFailure, readbackDiagnostic, stateSyncFailure].every((value) => value.mandatoryTruthSentence === TRUTH), 'source truth sentence mismatch');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-D2-D3',
  phase: 'PARENT_FINALIZATION_LOCAL_VALIDATION',
  checks,
  failures,
  localValidationStatus: failures.length ? 'FAIL' : 'PASS',
  persistentReceiptStatus: 'PENDING',
  parentStepStatus: 'IN_PROGRESS',
  nextOfficialStep: '29-D3',
  nextOfficialStepStatus: 'PENDING_AWAITING_29-D2-D_RECEIPT',
  openGapCount: 12,
  openGapsCountedAsPass: 0,
  openContradictionCount: 3,
  contradictionsCountedAsPass: 0,
  bronzeCompletedPercent: 25.0,
  silverStatus: 'BLOCKED_NOT_READY',
  goldStatus: 'BLOCKED_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-D3-parent-finalization.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`29-D2-D3 Parent Finalization: LOCAL PASS (${checks} checks / Library receipt PENDING / official 29-D3 PENDING).`);
