import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const failures = [];
let checks = 0;
const check = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/u, ''));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const closurePath = 'artifacts/checkpoints/29-F_FINAL_DELIVERY_CLOSURE.json';
const closure = await readJson(closurePath);
let officialCompletion = false;
try { await stat('artifacts/checkpoints/29-F_COMPLETION_RECORD.json'); officialCompletion = true; } catch {}

check(closure.release === 'Bronze 04.08.2026.29' && closure.step === '29-F', '29-F identity mismatch');
check(closure.status === 'LOCAL_PASS_AWAITING_DETERMINISTIC_PACKAGE_AND_LIBRARY_RECEIPT' && closure.validationStatus === 'PASS' && closure.officialStepCompletionClaimed === false, '29-F local lifecycle mismatch');
check(closure.persistentReceiptStatus === 'PENDING', '29-F immutable local receipt state mismatch');
check(closure.priorDurableClosure.topLevelSteps === 13 && closure.priorDurableClosure.allStatus === 'COMPLETED_PASS_RECEIPT_PASS', 'prior durable summary mismatch');
for (const binding of [closure.priorDurableClosure.lastStepCompletionRecord, closure.priorDurableClosure.lastStepReceipt, closure.priorDurableClosure.lastStepLibraryReadback, closure.priorDurableClosure.lastStepReceiptReadback, closure.priorDurableClosure.lastStepReceiptReadbackPersistence]) {
  const bytes = await readFile(binding.path);
  check(bytes.length === binding.sizeBytes && sha256(bytes) === binding.sha256, `29-E4 binding mismatch=${binding.path}`);
}
const e4Completion = await readJson(closure.priorDurableClosure.lastStepCompletionRecord.path);
const e4Receipt = await readJson(closure.priorDurableClosure.lastStepReceipt.path);
const e4Library = await readJson(closure.priorDurableClosure.lastStepLibraryReadback.path);
const e4ReceiptReadback = await readJson(closure.priorDurableClosure.lastStepReceiptReadback.path);
const e4Persistence = await readJson(closure.priorDurableClosure.lastStepReceiptReadbackPersistence.path);
check(e4Completion.status === 'PASS' && e4Completion.officialStepStatus === 'COMPLETED' && e4Completion.parent29EStatus === 'COMPLETED', '29-E4 completion mismatch');
check(e4Receipt.status === 'PASS' && e4Receipt.persistentReceiptStatus === 'PASS', '29-E4 receipt mismatch');
check(e4Library.status === 'PASS' && e4Library.executed === 20 && e4Library.matched === 20 && e4Library.failed === 0 && e4Library.zipPassed === 3, '29-E4 Library readback mismatch');
check(e4ReceiptReadback.status === 'PASS' && e4ReceiptReadback.executed === 4 && e4ReceiptReadback.matched === 4 && e4ReceiptReadback.failed === 0, '29-E4 receipt readback mismatch');
check(e4Persistence.status === 'PASS' && e4Persistence.executed === 2 && e4Persistence.matched === 2 && e4Persistence.failed === 0, '29-E4 persistence mismatch');

const plan = await readJson('config/work-segmentation-plan.json');
const f = plan.steps.find((item) => item.id === '29-F');
const prior = plan.steps.filter((item) => item.id !== '29-F');
check(prior.length === 13 && prior.every((item) => item.status === 'COMPLETED' && item.validationStatus === 'PASS' && item.persistentReceiptStatus === 'PASS'), 'prior plan closure mismatch');
if (officialCompletion) {
  check(plan.currentStep === '29-F' && plan.workflowStatus === 'COMPLETED' && f?.status === 'COMPLETED' && f.validationStatus === 'PASS' && f.persistentReceiptStatus === 'PASS', '29-F final plan lifecycle mismatch');
  check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0, 'completed plan retains active step');
} else {
  check(plan.currentStep === '29-F' && f?.status === 'IN_PROGRESS' && f.validationStatus === 'PENDING' && f.persistentReceiptStatus === 'PENDING', '29-F active lifecycle mismatch');
  check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1, '29-F is not the single active step');
}
const governance = await readJson('config/active-governance-ledger.json');
if (officialCompletion) {
  check(governance.nextOfficialTask === 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' && governance.activeMicroStep === null, 'final governance lifecycle mismatch');
  check(governance.libraryUploadStatus === '29-F_COMPLETED_RECEIPT_PASS', 'final Library status mismatch');
} else {
  check(governance.nextOfficialTask === '29-F documents, deterministic package, exact-source and Library closure' && governance.activeMicroStep === governance.nextOfficialTask, '29-F active governance mismatch');
}

const index = await readJson(closure.documentClosure.indexValidation);
check(index.status === 'PASS' && index.totalFiles >= closure.documentClosure.indexedFilesAtActivation && index.totalDocuments >= closure.documentClosure.indexedDocumentsAtActivation, 'document/artifact index mismatch');
for (const path of [closure.documentClosure.projectArtifactIndex, closure.documentClosure.allDocumentsIndex, closure.documentClosure.finalAuditDocument]) {
  try { await stat(path); check(true, `${path} exists`); } catch { check(false, `${path} missing`); }
}
check(closure.exactSourceClosure.officialBaseArchiveSha256 === 'd52a4ad2f1ff700dd260a1bb77f4145febf0ccbec85ca3f479aa85c016d57701' && closure.exactSourceClosure.officialBaseFileCount === 2577, 'official exact-source authority mismatch');
check(closure.exactSourceClosure.deterministicCheckpointRequired === true && closure.exactSourceClosure.exactOverlayReconstructionRequired === true && closure.exactSourceClosure.deletedGovernedFilesAllowed === false, 'exact-source gate mismatch');
check(closure.libraryClosure.payloadRoundTripRequired === '20/20' && closure.libraryClosure.zipReadbackRequired === '3/3' && closure.libraryClosure.receiptRoundTripRequired === '4/4' && closure.libraryClosure.receiptReadbackPersistenceRequired === '2/2', 'Library closure requirement mismatch');
check(closure.openTruth.governanceGaps === 9 && closure.openTruth.governanceContradictions === 0 && closure.openTruth.technicalFindings === 8, 'open governance/technical truth mismatch');
check(closure.openTruth.acceptedScopeIncomplete === 346 && closure.openTruth.promotionRequiredIncomplete === 341 && closure.openTruth.countedAsPass === 0, 'open scope truth mismatch');
check(closure.installerBuild === 'NOT_RUN_NOT_PASS' && closure.bronzeCompletedPercent === 25 && closure.bronzeRemainingPercent === 75, 'build/progress overclaim');
check(closure.silverStatus === 'FORBIDDEN_NOT_READY' && closure.goldStatus === 'FORBIDDEN_NOT_READY' && closure.conversationCapacity === 'UNAVAILABLE', 'promotion/capacity overclaim');
check(closure.nextOfficialStep === 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F' && closure.mandatoryTruthSentence === TRUTH, 'next authority or truth mismatch');

if (officialCompletion) {
  const receipt = await readJson('artifacts/checkpoints/29-F_LIBRARY_RECEIPT.json');
  const library = await readJson('artifacts/validation/29-F_LIBRARY_READBACK_VERIFICATION.json');
  const receiptReadback = await readJson('artifacts/validation/29-F_RECEIPT_READBACK_VERIFICATION.json');
  const persistence = await readJson('artifacts/validation/29-F_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json');
  const completion = await readJson('artifacts/checkpoints/29-F_COMPLETION_RECORD.json');
  check(receipt.status === 'PASS' && receipt.validationStatus === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '29-F receipt mismatch');
  check(receipt.roundTripVerification.executed === 20 && receipt.roundTripVerification.matched === 20 && receipt.roundTripVerification.failed === 0, '29-F payload roundtrip mismatch');
  check(receipt.zipReadbackVerification.executed === 3 && receipt.zipReadbackVerification.pass === 3 && receipt.zipReadbackVerification.fail === 0, '29-F ZIP readback mismatch');
  check(library.status === 'PASS' && library.executed === 20 && library.matched === 20 && library.failed === 0 && library.zipPassed === 3, '29-F Library readback mismatch');
  check(receiptReadback.status === 'PASS' && receiptReadback.executed === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, '29-F receipt readback mismatch');
  check(persistence.status === 'PASS' && persistence.executed === 2 && persistence.matched === 2 && persistence.failed === 0, '29-F receipt persistence mismatch');
  check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.nextOfficialStep === 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F', '29-F completion record mismatch');
  check([receipt, library, receiptReadback, persistence, completion].every((item) => item.mandatoryTruthSentence === TRUTH), '29-F official truth mismatch');
}

const report = {
  schemaVersion: 1, release: closure.release, step: '29-F', phase: 'FINAL_DELIVERY_EXACT_SOURCE_LIBRARY_CLOSURE_VALIDATION',
  checks, failures, priorDurableTopLevelSteps: 13, documentIndexStatus: index.status,
  exactSourceAuthoritySha256: closure.exactSourceClosure.officialBaseArchiveSha256,
  persistentReceiptStatus: officialCompletion ? 'PASS' : 'PENDING',
  officialStepStatus: officialCompletion ? 'COMPLETED' : 'IN_PROGRESS_AWAITING_DETERMINISTIC_PACKAGE_AND_LIBRARY_RECEIPT',
  bronzeCompletedPercent: 25, silverStatus: 'FORBIDDEN_NOT_READY', goldStatus: 'FORBIDDEN_NOT_READY', conversationCapacity: 'UNAVAILABLE',
  nextOfficialStep: 'UNAVAILABLE_REQUIRES_NEW_OFFICIAL_AUTHORITY_AFTER_29-F', status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: closure.recordedAt, mandatoryTruthSentence: TRUTH,
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(officialCompletion ? 'artifacts/validation/29-F-official-completion-regression.json' : 'artifacts/validation/29-F-final-delivery-closure.json', JSON.stringify(report, null, 2) + '\n');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`29-F final delivery closure: PASS (${checks} checks / 13 durable prior steps / exact-source ${closure.exactSourceClosure.officialBaseFileCount} files).`);
