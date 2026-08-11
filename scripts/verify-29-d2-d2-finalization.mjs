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
const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const paths = {
  matrix: 'artifacts/inventory/29-D2-D2_CLOSURE_VALIDATION_MATRIX.json',
  gaps: 'artifacts/inventory/29-D2-C_GAP_REGISTER.json',
  contradictions: 'artifacts/inventory/29-D2-D2_CONTRADICTION_REGISTER.json',
  receipt: 'artifacts/checkpoints/29-D2-D2_LIBRARY_RECEIPT.json',
  libraryReadback: 'artifacts/validation/29-D2-D2-library-readback-verification.json',
  receiptReadback: 'artifacts/validation/29-D2-D2-receipt-readback-verification.json',
  historicFailure: 'artifacts/checkpoints/29-D2-D2_FIRST_COMBINED_VALIDATION_FAILURE.json',
  finalizationFailure: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_FIRST_ATTEMPT_FAILURE.json',
  preflightWindowsFailure: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_GOVERNED_PREFLIGHT_WINDOWS_FAILURE.json',
  d1Completion: 'artifacts/checkpoints/29-D2-D1_COMPLETION_RECORD.json',
  plan: 'config/work-segmentation-plan.json',
  finalReceipt: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_LIBRARY_RECEIPT.json',
  finalLibraryReadback: 'artifacts/validation/29-D2-D2_FINALIZATION_LIBRARY_READBACK_VERIFICATION.json',
  finalReceiptReadback: 'artifacts/validation/29-D2-D2_FINALIZATION_RECEIPT_READBACK_VERIFICATION.json',
  completion: 'artifacts/checkpoints/29-D2-D2_COMPLETION_RECORD.json',
  firstReadbackDiagnostic: 'artifacts/checkpoints/29-D2-D2_FINALIZATION_READBACK_FIRST_ATTEMPT_DIAGNOSTIC.json'
};

const [
  matrix,
  gapRegister,
  contradictionRegister,
  receipt,
  libraryReadback,
  receiptReadback,
  historicFailure,
  finalizationFailure,
  preflightWindowsFailure,
  d1Completion,
  plan,
  finalReceipt,
  finalLibraryReadback,
  finalReceiptReadback,
  completion,
  firstReadbackDiagnostic
] = await Promise.all(Object.values(paths).map(readJson));

for (const path of Object.values(paths)) {
  check(await exists(path), `${path} missing`);
}

check(matrix.release === 'Bronze 04.08.2026.29', 'matrix release mismatch');
check(matrix.workStep === '29-D2-D2', 'matrix step mismatch');
check(matrix.status === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS', 'main checkpoint state mismatch');
check(matrix.validationStatus === 'PASS', 'main validation state mismatch');
check(matrix.persistentReceiptStatus === 'PASS', 'main receipt state mismatch');
check(matrix.persistentReceiptPath === paths.receipt, 'main receipt path mismatch');
check(matrix.libraryReadbackVerificationPath === paths.libraryReadback, 'library readback path mismatch');
check(matrix.receiptReadbackVerificationPath === paths.receiptReadback, 'receipt readback path mismatch');
check(matrix.finalizationStatus === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS', 'finalization official state mismatch');
check(matrix.finalizationValidationStatus === 'PASS', 'finalization validation state mismatch');
check(matrix.finalizationReceiptStatus === 'PASS', 'finalization receipt state mismatch');
check(matrix.finalizationReceiptPath === paths.finalReceipt, 'finalization receipt path mismatch');
check(matrix.finalizationLibraryReadbackPath === paths.finalLibraryReadback, 'finalization Library readback path mismatch');
check(matrix.finalizationReceiptReadbackPath === paths.finalReceiptReadback, 'finalization receipt readback path mismatch');
check(matrix.completionRecordPath === paths.completion, 'completion record path mismatch');
check(matrix.officialSubstepStatus === 'COMPLETED', 'official substep state mismatch');
check(matrix.nextSubstepStatus === 'IN_PROGRESS', 'matrix next substep state mismatch');
check(matrix.parentCompletionClaimed === false, 'matrix completes parent');
check(matrix.parentStepStatus === 'IN_PROGRESS', 'matrix parent state mismatch');

const receiptBytes = await readFile(paths.receipt);
check(sha256(receiptBytes) === '2c841270472ce5d36e8ef70ad4dca8028ed088221b8bd3d619730afccc822d6d', 'main receipt SHA mismatch');
check(receipt.status === 'PASS', 'main receipt not PASS');
check(receipt.validationStatus === 'PASS', 'main receipt validation not PASS');
check(receipt.persistentReceiptStatus === 'PASS', 'main receipt persistence not PASS');
check(receipt.officialStepStatus === 'IN_PROGRESS_MAIN_CHECKPOINT_PERSISTED', 'main receipt official state mismatch');
check(receipt.roundTripVerification.executed === 16, 'main receipt roundtrip executed mismatch');
check(receipt.roundTripVerification.matched === 16, 'main receipt roundtrip matched mismatch');
check(receipt.roundTripVerification.failed === 0, 'main receipt roundtrip failures');
check(receipt.roundTripVerification.status === 'PASS', 'main receipt roundtrip status mismatch');
check(receipt.closureTruth.openGapCount === 12, 'receipt open gap count mismatch');
check(receipt.closureTruth.openGapsCountedAsPass === 0, 'receipt counts gaps as PASS');
check(receipt.closureTruth.openContradictionCount === 3, 'receipt open contradiction count mismatch');
check(receipt.closureTruth.contradictionsCountedAsPass === 0, 'receipt counts contradictions as PASS');
check(receipt.closureTruth.parentStepStatus === 'IN_PROGRESS', 'receipt parent state mismatch');
check(receipt.closureTruth.parentStepCompleted === false, 'receipt completes parent');
check(receipt.closureTruth.nextPhase === '29-D2-D2_FINALIZATION', 'receipt next phase mismatch');
check(receipt.firstCombinedAttempt.status === 'FAIL', 'receipt hides first combined failure');
check(receipt.firstCombinedAttempt.executed === 10, 'receipt first attempt executed mismatch');
check(receipt.firstCombinedAttempt.pass === 8, 'receipt first attempt PASS count mismatch');
check(receipt.firstCombinedAttempt.fail === 2, 'receipt first attempt FAIL count mismatch');
check(receipt.firstCombinedAttempt.countedAsPass === false, 'receipt counts first attempt as PASS');
check(receipt.finalCleanValidation.status === 'PASS', 'main final clean validation not PASS');
check(receipt.finalCleanValidation.executed === 12, 'main final validation executed mismatch');
check(receipt.finalCleanValidation.pass === 12, 'main final validation PASS mismatch');
check(receipt.finalCleanValidation.fail === 0, 'main final validation failure');

const finalReceiptBytes = await readFile(paths.finalReceipt);
check(sha256(finalReceiptBytes) === 'b9ef607facf2d3ace49478fd94a4446535b29f5cc87fdb4910736457c0aa1552', 'finalization receipt SHA mismatch');
check(finalReceipt.status === 'PASS', 'finalization receipt not PASS');
check(finalReceipt.validationStatus === 'PASS', 'finalization receipt validation not PASS');
check(finalReceipt.persistentReceiptStatus === 'PASS', 'finalization receipt persistence not PASS');
check(finalReceipt.finalizationReceiptStatus === 'PASS', 'finalization receipt state not PASS');
check(finalReceipt.officialSubstepStatus === 'COMPLETED', 'finalization receipt substep state mismatch');
check(finalReceipt.roundTripVerification.executed === 16, 'finalization roundtrip executed mismatch');
check(finalReceipt.roundTripVerification.matched === 16, 'finalization roundtrip matched mismatch');
check(finalReceipt.roundTripVerification.failed === 0, 'finalization roundtrip failures');
check(finalReceipt.roundTripVerification.status === 'PASS', 'finalization roundtrip status mismatch');
check(finalReceipt.closureTruth.openGapCount === 12, 'finalization receipt open gap count mismatch');
check(finalReceipt.closureTruth.openGapsCountedAsPass === 0, 'finalization receipt counts gaps as PASS');
check(finalReceipt.closureTruth.openContradictionCount === 3, 'finalization receipt open contradiction count mismatch');
check(finalReceipt.closureTruth.contradictionsCountedAsPass === 0, 'finalization receipt counts contradictions as PASS');
check(finalReceipt.closureTruth.parentStepStatus === 'IN_PROGRESS', 'finalization receipt parent state mismatch');
check(finalReceipt.closureTruth.parentStepCompleted === false, 'finalization receipt completes parent');
check(finalReceipt.closureTruth.nextPhase === '29-D2-D3', 'finalization receipt next phase mismatch');
check(finalReceipt.officialParentCompletionClaimed === false, 'finalization receipt claims parent completion');
check(finalReceipt.nextSubstepAuthorizedAfterReceiptReadback === true, 'D3 authorization missing');

check(finalLibraryReadback.status === 'PASS', 'finalization Library readback not PASS');
check(finalLibraryReadback.expectedFileCount === 16, 'finalization Library readback expected count mismatch');
check(finalLibraryReadback.executed === 16, 'finalization Library readback executed mismatch');
check(finalLibraryReadback.matched === 16, 'finalization Library readback matched mismatch');
check(finalLibraryReadback.failed === 0, 'finalization Library readback failures');
check(finalLibraryReadback.files.length === 16, 'finalization Library readback file count mismatch');
for (const file of finalLibraryReadback.files) {
  check(file.readbackExists === true, `${file.name} finalization readback missing`);
  check(file.sizeMatch === true, `${file.name} finalization size mismatch`);
  check(file.shaMatch === true, `${file.name} finalization SHA mismatch`);
  check(file.status === 'PASS', `${file.name} finalization readback not PASS`);
}

check(finalReceiptReadback.status === 'PASS', 'finalization receipt readback not PASS');
check(finalReceiptReadback.expectedFileCount === 4, 'finalization receipt readback expected count mismatch');
check(finalReceiptReadback.executed === 4, 'finalization receipt readback executed mismatch');
check(finalReceiptReadback.matched === 4, 'finalization receipt readback matched mismatch');
check(finalReceiptReadback.failed === 0, 'finalization receipt readback failures');
check(finalReceiptReadback.receiptSha256 === sha256(finalReceiptBytes), 'finalization receipt readback SHA binding mismatch');
check(finalReceiptReadback.libraryReadbackSha256 === '14b865c27a5b83dcd2120f8ebb0d6e43b9ee4a4a074a6aefffb704e33cb5ec4f', 'finalization Library readback SHA binding mismatch');
check(finalReceiptReadback.files.length === 4, 'finalization receipt readback file count mismatch');
for (const file of finalReceiptReadback.files) {
  check(file.readbackExists === true, `${file.name} final receipt-chain file missing`);
  check(file.sizeMatch === true, `${file.name} final receipt-chain size mismatch`);
  check(file.shaMatch === true, `${file.name} final receipt-chain SHA mismatch`);
  check(file.status === 'PASS', `${file.name} final receipt-chain file not PASS`);
}
for (const [name, value] of Object.entries(finalReceiptReadback.fieldChecks)) {
  check(value === true, `final receipt readback field check failed: ${name}`);
}

check(completion.status === 'PASS', 'completion record not PASS');
check(completion.officialSubstepStatus === 'COMPLETED', 'completion record substep state mismatch');
check(completion.finalizationReceiptStatus === 'PASS', 'completion record receipt state mismatch');
check(completion.finalization.libraryReceiptSha256 === sha256(finalReceiptBytes), 'completion record final receipt SHA mismatch');
check(completion.finalization.libraryReadbackSha256 === '14b865c27a5b83dcd2120f8ebb0d6e43b9ee4a4a074a6aefffb704e33cb5ec4f', 'completion record Library readback SHA mismatch');
check(completion.finalization.receiptReadbackSha256 === 'ccf37700fdc18082ff8ead426dcbe235bf362ff462d63ab4835a3d4bead94565', 'completion record receipt readback SHA mismatch');
check(completion.parentCompletionClaimed === false, 'completion record claims parent completion');
check(completion.parentStepStatus === 'IN_PROGRESS', 'completion record parent state mismatch');
check(completion.nextSubstep === '29-D2-D3', 'completion record next substep mismatch');
check(completion.nextSubstepStatus === 'IN_PROGRESS', 'completion record next state mismatch');
check(completion.nextSubstepAuthorized === true, 'completion record D3 authorization missing');
check(completion.bronzeCompletedPercent === 25.0, 'completion record Bronze percentage changed');
check(firstReadbackDiagnostic.status === 'DIAGNOSTIC_INVALID_NOT_PASS', 'first Library readback diagnostic state mismatch');
check(firstReadbackDiagnostic.countedAsPass === false, 'first Library readback diagnostic counted as PASS');
check(firstReadbackDiagnostic.invalidSummary.reportedMatched === 0, 'first Library readback invalid matched count mismatch');
check(firstReadbackDiagnostic.invalidSummary.reportedFailed === 0, 'first Library readback invalid failed count mismatch');
check(firstReadbackDiagnostic.correctedAttempt.status === 'PASS', 'corrected Library readback state mismatch');

check(libraryReadback.status === 'PASS', 'library readback not PASS');
check(libraryReadback.expectedFileCount === 16, 'library readback expected count mismatch');
check(libraryReadback.executed === 16, 'library readback executed mismatch');
check(libraryReadback.matched === 16, 'library readback matched mismatch');
check(libraryReadback.failed === 0, 'library readback failures');
check(libraryReadback.files.length === 16, 'library readback file count mismatch');
for (const file of libraryReadback.files) {
  check(file.readbackExists === true, `${file.name} readback missing`);
  check(file.sizeMatch === true, `${file.name} size mismatch`);
  check(file.shaMatch === true, `${file.name} SHA mismatch`);
  check(file.status === 'PASS', `${file.name} readback not PASS`);
}

check(receiptReadback.status === 'PASS', 'receipt readback not PASS');
check(receiptReadback.receiptSha256 === sha256(receiptBytes), 'receipt readback SHA binding mismatch');
check(receiptReadback.fileChecks.length === 4, 'receipt readback file count mismatch');
for (const file of receiptReadback.fileChecks) {
  check(file.exists === true, `${file.name} receipt-chain file missing`);
  check(file.sizeMatch === true, `${file.name} receipt-chain size mismatch`);
  check(file.shaMatch === true, `${file.name} receipt-chain SHA mismatch`);
}
for (const [name, value] of Object.entries(receiptReadback.fieldChecks)) {
  check(value === true, `receipt readback field check failed: ${name}`);
}

check(historicFailure.status === 'FAIL', 'historic first combined attempt must remain FAIL');
check(historicFailure.overallExitCode === 1, 'historic first combined exit mismatch');
check(historicFailure.executed === 10, 'historic first combined executed mismatch');
check(historicFailure.pass === 8, 'historic first combined PASS mismatch');
check(historicFailure.fail === 2, 'historic first combined FAIL mismatch');
check(historicFailure.countedAsPass === false, 'historic first combined attempt counted as PASS');

check(finalizationFailure.status === 'FAIL', 'finalization first attempt must remain FAIL');
check(finalizationFailure.exitCode === 1, 'finalization first attempt exit mismatch');
check(finalizationFailure.checks === 245, 'finalization first attempt check count mismatch');
check(finalizationFailure.failures.length === 2, 'finalization first attempt failure count mismatch');
check(finalizationFailure.countedAsPass === false, 'finalization first attempt counted as PASS');
check(finalizationFailure.correctionScope === 'RECEIPT_SCHEMA_COMPATIBILITY_ONLY', 'finalization correction scope mismatch');
check(preflightWindowsFailure.status === 'FAIL_PRESERVED_THEN_CORRECTED', 'preflight Windows failure record mismatch');
check(preflightWindowsFailure.attempts.length === 2, 'preflight Windows attempt count mismatch');
check(preflightWindowsFailure.attempts.every((attempt) => attempt.exitCode === 1), 'preflight Windows failure exit mismatch');
check(preflightWindowsFailure.attempts.every((attempt) => attempt.countedAsPass === false), 'preflight Windows failure counted as PASS');
check(preflightWindowsFailure.correctionScope === 'RUNTIME_VERIFIER_PLATFORM_PORTABILITY_ONLY', 'preflight Windows correction scope mismatch');
check(preflightWindowsFailure.correctedDirectRuntimeExitCodes.desktopCoreServiceStartup === 0, 'corrected desktop runtime exit mismatch');
check(preflightWindowsFailure.correctedDirectRuntimeExitCodes.systemHealthCoreServiceIpc === 0, 'corrected health runtime exit mismatch');
check(preflightWindowsFailure.correctedGovernedPreflightExitCode === 0, 'corrected governed preflight exit mismatch');

check(gapRegister.gapCount === 12, 'gap register count mismatch');
check(gapRegister.unresolvedGapCount === 12, 'unresolved gap count mismatch');
check(gapRegister.gaps.length === 12, 'gap array count mismatch');
check(gapRegister.gaps.filter((gap) => gap.countedAsPass).length === 0, 'open gap counted as PASS');
check(contradictionRegister.openContradictionCount === 3, 'open contradiction count mismatch');
check(contradictionRegister.resolvedWithEvidenceCount === 1, 'resolved contradiction count mismatch');
check(contradictionRegister.countedAsPass === 0, 'contradiction counted as PASS');
check(contradictionRegister.contradictions.filter((item) => item.status === 'OPEN_EXPLICIT').length === 3, 'open contradiction array mismatch');
check(contradictionRegister.contradictions.filter((item) => item.countedAsPass).length === 0, 'contradiction item counted as PASS');

const parent = plan.steps.find((step) => step.id === '29-D2-D');
const d2 = parent?.substeps?.find((step) => step.id === '29-D2-D2');
const d3 = parent?.substeps?.find((step) => step.id === '29-D2-D3');
check(['IN_PROGRESS', 'COMPLETED'].includes(parent?.status), '29-D2-D parent state invalid');
if (parent?.status === 'IN_PROGRESS') {
  check(plan.currentStep === '29-D2-D', 'plan current step mismatch before parent completion');
  check(['PENDING', 'PASS'].includes(parent.validationStatus), '29-D2-D parent validation state invalid');
  check(parent.persistentReceiptStatus === 'PENDING', '29-D2-D parent receipt must remain PENDING before completion');
}
if (parent?.status === 'COMPLETED') {
  check(['29-D3', '29-D4', '29-D5', '29-D6'].includes(plan.currentStep), 'plan did not reach or advance beyond 29-D3');
  check(parent.validationStatus === 'PASS' && parent.persistentReceiptStatus === 'PASS', 'completed parent lacks PASS receipt');
  check(parent.persistentReceiptPath === 'artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_LIBRARY_RECEIPT.json', 'completed parent receipt path mismatch');
}
check(d2?.status === 'COMPLETED', '29-D2-D2 must be COMPLETED');
check(d2?.validationStatus === 'PASS', '29-D2-D2 main validation mismatch');
check(d2?.persistentReceiptStatus === 'PASS', '29-D2-D2 main receipt mismatch');
check(d2?.persistentReceiptPath === paths.receipt, '29-D2-D2 main receipt path mismatch');
check(d2?.finalizationStatus === 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS', '29-D2-D2 finalization state mismatch');
check(d2?.finalizationValidationStatus === 'PASS', '29-D2-D2 finalization validation mismatch');
check(d2?.finalizationReceiptStatus === 'PASS', '29-D2-D2 finalization receipt mismatch');
check(d2?.finalizationReceiptPath === paths.finalReceipt, '29-D2-D2 finalization receipt path mismatch');
check(d2?.finalizationLibraryReadbackPath === paths.finalLibraryReadback, '29-D2-D2 finalization Library readback path mismatch');
check(d2?.finalizationReceiptReadbackPath === paths.finalReceiptReadback, '29-D2-D2 finalization receipt readback path mismatch');
check(d2?.completionRecordPath === paths.completion, '29-D2-D2 completion record path mismatch');
check(['IN_PROGRESS', 'COMPLETED'].includes(d3?.status), '29-D2-D3 state invalid');
check(d3?.validationStatus === 'PASS', '29-D2-D3 validation state invalid');
check(d3?.validationStatus === parent?.validationStatus, '29-D2-D3 and parent validation states differ');
if (d3?.status === 'IN_PROGRESS') check(d3.persistentReceiptStatus === 'PENDING', '29-D2-D3 receipt must remain PENDING before completion');
if (d3?.status === 'COMPLETED') {
  check(d3.persistentReceiptStatus === 'PASS', 'completed 29-D2-D3 receipt not PASS');
  check(d3.persistentReceiptPath === 'artifacts/checkpoints/29-D2-D3_PARENT_FINALIZATION_LIBRARY_RECEIPT.json', 'completed 29-D2-D3 receipt path mismatch');
}

check(d1Completion.bronzeCompletedPercent === 25.0, 'Bronze verified percentage changed');
check(d1Completion.bronzeRemainingPercent === 75.0, 'Bronze remaining percentage changed');
check(d1Completion.silverStatus === 'BLOCKED_NOT_READY', 'Silver was authorized');
check(d1Completion.goldStatus === 'BLOCKED_NOT_READY', 'Gold was authorized');
check(d1Completion.conversationCapacity === 'UNAVAILABLE', 'conversation capacity must remain UNAVAILABLE');
check(matrix.mandatoryTruthSentence === TRUTH, 'matrix truth sentence mismatch');
check(receipt.mandatoryTruthSentence === TRUTH, 'receipt truth sentence mismatch');
check(libraryReadback.mandatoryTruthSentence === TRUTH, 'library readback truth sentence mismatch');
check(receiptReadback.mandatoryTruthSentence === TRUTH, 'receipt readback truth sentence mismatch');
check(historicFailure.mandatoryTruthSentence === TRUTH, 'historic failure truth sentence mismatch');
check(finalizationFailure.mandatoryTruthSentence === TRUTH, 'finalization failure truth sentence mismatch');
check(preflightWindowsFailure.mandatoryTruthSentence === TRUTH, 'preflight Windows failure truth sentence mismatch');
check(finalReceipt.mandatoryTruthSentence === TRUTH, 'finalization receipt truth sentence mismatch');
check(finalLibraryReadback.mandatoryTruthSentence === TRUTH, 'finalization Library readback truth sentence mismatch');
check(finalReceiptReadback.mandatoryTruthSentence === TRUTH, 'finalization receipt readback truth sentence mismatch');
check(completion.mandatoryTruthSentence === TRUTH, 'completion record truth sentence mismatch');
check(firstReadbackDiagnostic.mandatoryTruthSentence === TRUTH, 'first Library readback diagnostic truth sentence mismatch');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '29-D2-D2',
  phase: 'POST_FINALIZATION_LIBRARY_RECEIPT',
  checks,
  failures,
  mainCheckpointStatus: 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS',
  finalizationStatus: failures.length ? 'FAIL' : 'COMPLETED_PASS_LIBRARY_RECEIPT_PASS',
  finalizationReceiptStatus: failures.length ? 'FAIL' : 'PASS',
  openGapCount: 12,
  openGapsCountedAsPass: 0,
  openContradictionCount: 3,
  contradictionsCountedAsPass: 0,
  firstCombinedAttemptStatus: 'FAIL',
  firstCombinedAttemptCountedAsPass: false,
  finalizationFirstAttemptStatus: 'FAIL',
  finalizationFirstAttemptCountedAsPass: false,
  parentStepStatus: parent?.status,
  nextSubstep: '29-D2-D3',
  nextSubstepStatus: parent?.status === 'COMPLETED' ? 'COMPLETED_PARENT_ADVANCED_TO_29-D3' : 'IN_PROGRESS',
  bronzeCompletedPercent: 25.0,
  silverStatus: 'BLOCKED_NOT_READY',
  goldStatus: 'BLOCKED_NOT_READY',
  conversationCapacity: 'UNAVAILABLE',
  status: failures.length ? 'FAIL' : 'PASS',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/29-D2-D2-finalization.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`29-D2-D2 Finalization: OFFICIAL PASS (${checks} checks / Library receipt PASS / D3 IN_PROGRESS).`);
