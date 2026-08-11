import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const APP_ROOT = resolve(process.cwd());
const SOURCE_PACKAGE_ROOT = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\30-Z_PPK-002_Location_Policy_Enforcement';
const LIBRARY_ROOT = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\30-Z_PPK-002_Location_Policy_Enforcement';
const RELEASE = 'Bronze 04.08.2026.29';
const STEP = '30-Z';
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const EXPECTED_BASE_FILES = 20;
const EXPECTED_FINAL_FILES = 30;
const UPLOAD_BUNDLE = 'Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29_30-Z_Library_Yukleme_Paketi.zip';
const EXPECTED_UPLOAD_BUNDLE_SHA256 = '1daa9c35949ba78c81c03736809d253940fa114706cfdfbd274d96717219eb54';
const EXPECTED_UPLOAD_BUNDLE_SIZE = 1_863_520;

const localPaths = Object.freeze({
  receipt: 'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json',
  libraryReadback: 'artifacts/validation/30-Z_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/30-Z_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/30-Z_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory: 'artifacts/validation/30-Z_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/30-Z_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/30-Z_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/30-Z_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/30-Z_SCOPE_AND_STATUS_REPORT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json'
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const fullLocalPath = (relativePath) => resolve(APP_ROOT, relativePath);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readJson = async (path) => JSON.parse((await readFile(path)).toString('utf8'));

const fileBinding = async (path, name = basename(path)) => {
  const bytes = await readFile(path);
  return { name, sizeBytes: bytes.length, sha256: sha256(bytes) };
};

const writeBytes = async (path, bytes) => {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
};

const writeJsonWithSidecar = async (relativePath, value) => {
  const path = fullLocalPath(relativePath);
  const bytes = jsonBytes(value);
  const digest = sha256(bytes);
  await writeBytes(path, bytes);
  await writeBytes(`${path}.sha256`, Buffer.from(`${digest}  ${basename(path)}\n`, 'utf8'));
  return { path: relativePath, name: basename(path), sizeBytes: bytes.length, sha256: digest };
};

const copyLocalPairToLibrary = async (binding) => {
  const source = fullLocalPath(binding.path);
  await copyFile(source, join(LIBRARY_ROOT, binding.name));
  await copyFile(`${source}.sha256`, join(LIBRARY_ROOT, `${binding.name}.sha256`));
};

const compareLocalToLibrary = async (relativePath) => {
  const name = basename(relativePath);
  const sourceBytes = await readFile(fullLocalPath(relativePath));
  const targetBytes = await readFile(join(LIBRARY_ROOT, name));
  return {
    name,
    sourceSizeBytes: sourceBytes.length,
    librarySizeBytes: targetBytes.length,
    sourceSha256: sha256(sourceBytes),
    librarySha256: sha256(targetBytes),
    sizeMatch: sourceBytes.length === targetBytes.length,
    sha256Match: sha256(sourceBytes) === sha256(targetBytes),
    status: sourceBytes.length === targetBytes.length && sha256(sourceBytes) === sha256(targetBytes) ? 'PASS' : 'FAIL'
  };
};

const verifySidecars = async (root, names) => {
  const sidecars = names.filter((name) => name.endsWith('.sha256')).sort();
  const results = [];
  for (const name of sidecars) {
    const sidecarText = (await readFile(join(root, name), 'utf8')).trim();
    const declared = sidecarText.split(/\s+/u)[0]?.toLowerCase();
    const subject = name.slice(0, -'.sha256'.length);
    const actual = sha256(await readFile(join(root, subject)));
    results.push({ name, subject, declaredSha256: declared, actualSha256: actual, status: declared === actual ? 'PASS' : 'FAIL' });
  }
  return results;
};

assert(APP_ROOT.toLowerCase().endsWith('\\06_kod\\app'), `Run from the authoritative app root; received ${APP_ROOT}`);
assert((await stat(SOURCE_PACKAGE_ROOT)).isDirectory(), `Frozen 30-Z source package is unavailable: ${SOURCE_PACKAGE_ROOT}`);
assert((await stat(LIBRARY_ROOT)).isDirectory(), `D: external Library target is unavailable: ${LIBRARY_ROOT}`);

const baseNames = (await readdir(SOURCE_PACKAGE_ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
assert(baseNames.length === EXPECTED_BASE_FILES, `Expected ${EXPECTED_BASE_FILES} frozen package files; found ${baseNames.length}`);

const baseComparisons = [];
for (const name of baseNames) {
  const sourceBytes = await readFile(join(SOURCE_PACKAGE_ROOT, name));
  const libraryBytes = await readFile(join(LIBRARY_ROOT, name));
  const sourceDigest = sha256(sourceBytes);
  const libraryDigest = sha256(libraryBytes);
  baseComparisons.push({
    name,
    sourceSizeBytes: sourceBytes.length,
    librarySizeBytes: libraryBytes.length,
    sourceSha256: sourceDigest,
    librarySha256: libraryDigest,
    sizeMatch: sourceBytes.length === libraryBytes.length,
    sha256Match: sourceDigest === libraryDigest,
    status: sourceBytes.length === libraryBytes.length && sourceDigest === libraryDigest ? 'PASS' : 'FAIL'
  });
}
assert(baseComparisons.every((item) => item.status === 'PASS'), 'D: base package readback mismatch');

const sourceSidecars = await verifySidecars(SOURCE_PACKAGE_ROOT, baseNames);
const librarySidecars = await verifySidecars(LIBRARY_ROOT, baseNames);
assert(sourceSidecars.length === 10 && sourceSidecars.every((item) => item.status === 'PASS'), 'Frozen source sidecar verification failed');
assert(librarySidecars.length === 10 && librarySidecars.every((item) => item.status === 'PASS'), 'D: sidecar verification failed');

const packageVerification = await readJson(join(SOURCE_PACKAGE_ROOT, '30-Z_PACKAGE_VERIFICATION.json'));
const finalValidation = await readJson(join(SOURCE_PACKAGE_ROOT, '30-Z_VALIDATION_FINAL.json'));
const uploadBundle = baseComparisons.find((item) => item.name === UPLOAD_BUNDLE);
assert(packageVerification.step === STEP && packageVerification.status === 'PASS', 'Frozen package verification is not PASS');
assert(
  finalValidation.step === STEP
    && finalValidation.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
    && finalValidation.finalGovernedProcesses?.status === 'PASS'
    && finalValidation.finalGovernedProcesses?.failed === 0
    && finalValidation.postExecutionRecordGovernance?.status === 'PASS'
    && finalValidation.postExecutionRecordGovernance?.failed === 0
    && finalValidation.targetedValidation?.status === 'PASS'
    && finalValidation.persistentReceiptStatus === 'PENDING'
    && finalValidation.officialStepCompletionClaimed === false,
  'Frozen final validation does not expose a clean local PASS awaiting only the Library receipt'
);
assert(uploadBundle?.sourceSha256 === EXPECTED_UPLOAD_BUNDLE_SHA256, 'Frozen upload bundle SHA-256 changed');
assert(uploadBundle?.sourceSizeBytes === EXPECTED_UPLOAD_BUNDLE_SIZE, 'Frozen upload bundle size changed');

const generatedAt = now();
const libraryReadback = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  phase: 'EXTERNAL_USB_LIBRARY_BASE_PACKAGE_READBACK',
  status: 'PASS',
  countsAsPass: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  volume: { drive: 'D:', description: 'EXTERNAL_USB' },
  sourceCheckpointPath: SOURCE_PACKAGE_ROOT,
  libraryPath: LIBRARY_ROOT,
  expected: EXPECTED_BASE_FILES,
  executed: baseComparisons.length,
  matched: baseComparisons.filter((item) => item.status === 'PASS').length,
  failed: baseComparisons.filter((item) => item.status !== 'PASS').length,
  sidecarExpected: 10,
  sidecarExecuted: librarySidecars.length,
  sidecarFailed: librarySidecars.filter((item) => item.status !== 'PASS').length,
  artifacts: baseComparisons,
  sidecars: librarySidecars,
  singleUploadBundle: {
    name: UPLOAD_BUNDLE,
    sizeBytes: uploadBundle.sourceSizeBytes,
    sha256: uploadBundle.sourceSha256,
    readbackStatus: uploadBundle.status
  },
  frozenCheckpointBoundary: 'OFFICIAL_30_Z_PACKAGE_ONLY',
  currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FROZEN_30_Z_RECEIPT',
  verifiedAt: generatedAt,
  mandatoryTruthSentence: TRUTH
};
const libraryReadbackBinding = await writeJsonWithSidecar(localPaths.libraryReadback, libraryReadback);

const receipt = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  requirement: 'PPK-002',
  phase: 'PPK_002_LOCATION_POLICY_ENFORCEMENT_EXTERNAL_LIBRARY_RECEIPT',
  status: 'PASS',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS',
  officialStepStatus: 'COMPLETED',
  officialCompletionClaimed: true,
  scopeStatus: 'PARTIAL_LOCATION_POLICY_ENFORCEMENT_TARGET_PASS_EXTERNAL_LIBRARY_RECEIPT_PASS_UNIVERSAL_AUTHORITY_OPEN',
  libraryPath: LIBRARY_ROOT,
  physicalLibraryPath: LIBRARY_ROOT,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  volume: { drive: 'D:', description: 'EXTERNAL_USB' },
  verificationBasis: 'FULL_FILE_SHA256_AND_SIZE_ROUNDTRIP_PLUS_SIDECAR_READBACK',
  roundTripVerification: {
    expected: EXPECTED_BASE_FILES,
    executed: baseComparisons.length,
    matched: baseComparisons.filter((item) => item.status === 'PASS').length,
    failed: 0,
    status: 'PASS'
  },
  libraryReadbackVerification: { ...libraryReadbackBinding, status: 'PASS' },
  checkpointArchive: packageVerification.checkpointArchive,
  singleUploadBundle: libraryReadback.singleUploadBundle,
  artifacts: baseComparisons.map(({ name, sourceSizeBytes, sourceSha256, librarySizeBytes, librarySha256, status }) => ({
    name,
    sizeBytes: sourceSizeBytes,
    sha256: sourceSha256,
    readbackSizeBytes: librarySizeBytes,
    readbackSha256: librarySha256,
    roundTripMatch: status
  })),
  evidenceBoundary: {
    ...packageVerification.evidenceBoundary,
    locationPolicyEnforcementVerticalSlice: 'TARGETED_PASS',
    PPK002: 'PARTIAL',
    timelineEventPolicyEnforcementVerticalSlice: 'NOT_COMPLETE',
    universalRepositoryEnforcement: 'NOT_COMPLETE',
    requirementCompletionClaimed: false
  },
  currentAuthoritativeSource: {
    path: 'C:\\PPT\\AYM\\06_KOD\\app',
    authority: 'ACTIVE_EDITABLE_SOURCE',
    externalProtectionStatus: 'PENDING_SEPARATE_FROM_FROZEN_30_Z_RECEIPT'
  },
  historicalGoogleDriveReceipts: 'IMMUTABLE_HISTORICAL_EVIDENCE_NOT_USED_AS_30_Z_TARGET',
  nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_30-Z_PERSISTENT_RECEIPT',
  PPK002: 'PARTIAL',
  newBuildIssued: false,
  recordedAt: generatedAt,
  mandatoryTruthSentence: TRUTH
};
const receiptBinding = await writeJsonWithSidecar(localPaths.receipt, receipt);

await copyLocalPairToLibrary(libraryReadbackBinding);
await copyLocalPairToLibrary(receiptBinding);
const firstStagePaths = [localPaths.libraryReadback, `${localPaths.libraryReadback}.sha256`, localPaths.receipt, `${localPaths.receipt}.sha256`];
const firstStageComparisons = await Promise.all(firstStagePaths.map(compareLocalToLibrary));
assert(firstStageComparisons.every((item) => item.status === 'PASS'), 'D: receipt first-stage readback mismatch');

const receiptReadback = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  phase: 'EXTERNAL_USB_LIBRARY_RECEIPT_READBACK',
  status: 'PASS',
  countsAsPass: true,
  libraryPath: LIBRARY_ROOT,
  expected: firstStageComparisons.length,
  executed: firstStageComparisons.length,
  matched: firstStageComparisons.filter((item) => item.status === 'PASS').length,
  failed: 0,
  artifacts: firstStageComparisons,
  verifiedAt: now(),
  mandatoryTruthSentence: TRUTH
};
const receiptReadbackBinding = await writeJsonWithSidecar(localPaths.receiptReadback, receiptReadback);
await copyLocalPairToLibrary(receiptReadbackBinding);
const secondStagePaths = [localPaths.receiptReadback, `${localPaths.receiptReadback}.sha256`];
const secondStageComparisons = await Promise.all(secondStagePaths.map(compareLocalToLibrary));
assert(secondStageComparisons.every((item) => item.status === 'PASS'), 'D: receipt readback persistence mismatch');

const persistence = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  phase: 'EXTERNAL_USB_RECEIPT_READBACK_PERSISTENCE',
  status: 'PASS',
  countsAsPass: true,
  libraryPath: LIBRARY_ROOT,
  expected: secondStageComparisons.length,
  executed: secondStageComparisons.length,
  matched: secondStageComparisons.filter((item) => item.status === 'PASS').length,
  failed: 0,
  artifacts: secondStageComparisons,
  verifiedAt: now(),
  mandatoryTruthSentence: TRUTH
};
const persistenceBinding = await writeJsonWithSidecar(localPaths.persistence, persistence);
await copyLocalPairToLibrary(persistenceBinding);

const supplementalBindings = [libraryReadbackBinding, receiptBinding, receiptReadbackBinding, persistenceBinding];
const expectedPreInventoryNames = [
  ...baseNames,
  ...supplementalBindings.flatMap((binding) => [binding.name, `${binding.name}.sha256`])
].sort();
const actualPreInventoryNames = (await readdir(LIBRARY_ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== basename(localPaths.finalInventory) && entry.name !== `${basename(localPaths.finalInventory)}.sha256`)
  .map((entry) => entry.name)
  .sort();
assert(JSON.stringify(actualPreInventoryNames) === JSON.stringify(expectedPreInventoryNames), 'D: pre-inventory file set is not exact');

const preInventoryBindings = await Promise.all(actualPreInventoryNames.map((name) => fileBinding(join(LIBRARY_ROOT, name))));
const finalInventory = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY_VERIFICATION',
  status: 'PASS',
  countsAsPass: true,
  libraryPath: LIBRARY_ROOT,
  basePackageFiles: EXPECTED_BASE_FILES,
  supplementalFilesBeforeInventory: supplementalBindings.length * 2,
  expectedFilesBeforeInventory: EXPECTED_FINAL_FILES - 2,
  actualFilesBeforeInventory: preInventoryBindings.length,
  finalExpectedFilesIncludingInventoryPair: EXPECTED_FINAL_FILES,
  fileSetExact: true,
  filesBeforeInventory: preInventoryBindings,
  PPK002: 'PARTIAL',
  officialCompletionClaimed: true,
  currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FROZEN_30_Z_RECEIPT',
  verifiedAt: now(),
  mandatoryTruthSentence: TRUTH
};
const finalInventoryBinding = await writeJsonWithSidecar(localPaths.finalInventory, finalInventory);
await copyLocalPairToLibrary(finalInventoryBinding);

const finalNames = (await readdir(LIBRARY_ROOT, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
const expectedFinalNames = [...expectedPreInventoryNames, finalInventoryBinding.name, `${finalInventoryBinding.name}.sha256`].sort();
assert(finalNames.length === EXPECTED_FINAL_FILES, `D: final inventory expected ${EXPECTED_FINAL_FILES} files; found ${finalNames.length}`);
assert(JSON.stringify(finalNames) === JSON.stringify(expectedFinalNames), 'D: final inventory file set is not exact');
const finalSidecars = await verifySidecars(LIBRARY_ROOT, finalNames);
assert(finalSidecars.length === 15 && finalSidecars.every((item) => item.status === 'PASS'), 'D: final sidecar inventory verification failed');

const externalEvidenceBindings = [libraryReadbackBinding, receiptBinding, receiptReadbackBinding, persistenceBinding, finalInventoryBinding];
const completion = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  requirement: 'PPK-002',
  status: 'PASS',
  officialStepStatus: 'COMPLETED',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true,
  persistentReceiptPath: localPaths.receipt,
  libraryPath: LIBRARY_ROOT,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  externalInventory: { expectedFiles: EXPECTED_FINAL_FILES, actualFiles: finalNames.length, sidecars: finalSidecars.length, status: 'PASS' },
  evidence: externalEvidenceBindings,
  targetSliceStatus: 'PASS',
  PPK002: 'PARTIAL',
  requirementCompletionClaimed: false,
  currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FROZEN_30_Z_RECEIPT',
  nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_30-Z_PERSISTENT_RECEIPT',
  newBuildIssued: false,
  completedAt: now(),
  mandatoryTruthSentence: TRUTH
};
const completionPath = fullLocalPath(localPaths.completion);
await writeBytes(completionPath, jsonBytes(completion));

const execution = await readJson(fullLocalPath(localPaths.execution));
Object.assign(execution, {
  status: 'PASS',
  officialStepStatus: 'COMPLETED',
  scopeStatus: completion.scopeStatus ?? receipt.scopeStatus,
  persistentReceiptStatus: 'PASS',
  persistentReceiptPath: localPaths.receipt,
  officialCompletionClaimed: true,
  libraryPath: LIBRARY_ROOT,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  currentAuthoritativeSourceExternalProtectionStatus: completion.currentAuthoritativeSourceExternalProtectionStatus,
  completedAt: completion.completedAt
});
await writeBytes(fullLocalPath(localPaths.execution), jsonBytes(execution));

const scopeReport = await readJson(fullLocalPath(localPaths.scope));
Object.assign(scopeReport, {
  status: 'PASS',
  officialStepStatus: 'COMPLETED',
  scopeStatus: receipt.scopeStatus,
  officialCompletionClaimed: true,
  persistentReceiptStatus: 'PASS',
  persistentReceiptPath: localPaths.receipt,
  libraryPath: LIBRARY_ROOT,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  currentAuthoritativeSourceExternalProtectionStatus: completion.currentAuthoritativeSourceExternalProtectionStatus,
  generatedAt: now()
});
await writeBytes(fullLocalPath(localPaths.scope), jsonBytes(scopeReport));

const plan = await readJson(fullLocalPath(localPaths.plan));
const step30Z = plan.steps?.find((step) => step.id === STEP);
assert(step30Z, '30-Z work-plan entry is missing');
Object.assign(step30Z, {
  status: 'COMPLETED',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS',
  persistentReceiptPath: localPaths.receipt,
  completionTransitionStatus: 'PASS'
});
for (const evidencePath of [
  localPaths.receipt,
  localPaths.libraryReadback,
  localPaths.receiptReadback,
  localPaths.persistence,
  localPaths.finalInventory,
  localPaths.completion,
  localPaths.transition,
  'docs/decisions/DEC-158-30-z-external-usb-library-receipt.md',
  'docs/audit/30-Z_EXTERNAL_USB_LIBRARY_RECEIPT.md'
]) {
  if (!step30Z.localEvidence.includes(evidencePath)) step30Z.localEvidence.push(evidencePath);
}
plan.updatedAt = now();
plan.segmentationNote = 'The completed 29 workflow and 30-A through 30-Z receipt chains remain immutable. The frozen official 30-Z package has a verified external USB D: Library receipt and 30-Z is COMPLETED. PPK-002 remains PARTIAL; timeline-event and universal repository enforcement remain NOT_COMPLETE. The current editable C: source tree has separate local protection and still awaits a distinct external protection receipt. No new Build is issued.';
await writeBytes(fullLocalPath(localPaths.plan), jsonBytes(plan));

const ledger = await readJson(fullLocalPath(localPaths.ledger));
ledger.libraryUploadStatus = '30-Z_COMPLETED_RECEIPT_PASS';
ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_30-Z_PERSISTENT_RECEIPT';
ledger.activeMicroStep = null;
ledger.updatedAt = now();
ledger.externalLibraryAuthority = {
  step: STEP,
  status: 'PASS',
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  path: LIBRARY_ROOT,
  receipt: localPaths.receipt,
  frozenCheckpointOnly: true,
  currentAuthoritativeSourceExternalProtectionStatus: completion.currentAuthoritativeSourceExternalProtectionStatus
};
await writeBytes(fullLocalPath(localPaths.ledger), jsonBytes(ledger));

const transitionChecks = [
  ['receipt status', receipt.status === 'PASS'],
  ['base readback', libraryReadback.failed === 0 && libraryReadback.matched === EXPECTED_BASE_FILES],
  ['receipt readback', receiptReadback.failed === 0],
  ['receipt persistence', persistence.failed === 0],
  ['final external inventory', finalNames.length === EXPECTED_FINAL_FILES],
  ['final sidecars', finalSidecars.length === 15 && finalSidecars.every((item) => item.status === 'PASS')],
  ['work plan transition', step30Z.status === 'COMPLETED' && step30Z.persistentReceiptStatus === 'PASS'],
  ['governance transition', ledger.libraryUploadStatus === '30-Z_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['PPK-002 boundary', completion.PPK002 === 'PARTIAL' && completion.requirementCompletionClaimed === false],
  ['current source boundary', completion.currentAuthoritativeSourceExternalProtectionStatus.startsWith('PENDING_')],
  ['Build boundary', completion.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '30-Z completion transition check failed');
const transition = {
  schemaVersion: 1,
  release: RELEASE,
  step: STEP,
  phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION',
  status: 'PASS',
  countsAsPass: true,
  expected: transitionChecks.length,
  executed: transitionChecks.length,
  passed: transitionChecks.length,
  failed: 0,
  checks: transitionChecks,
  receipt: await fileBinding(fullLocalPath(localPaths.receipt), localPaths.receipt),
  completion: await fileBinding(completionPath, localPaths.completion),
  officialStepStatus: 'COMPLETED',
  persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true,
  PPK002: 'PARTIAL',
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  completedAt: completion.completedAt,
  verifiedAt: now(),
  mandatoryTruthSentence: TRUTH
};
await writeBytes(fullLocalPath(localPaths.transition), jsonBytes(transition));

console.log(`30-Z external USB Library receipt: PASS (${baseComparisons.length}/${EXPECTED_BASE_FILES} base files; ${finalNames.length}/${EXPECTED_FINAL_FILES} final files).`);
console.log(`Library: ${LIBRARY_ROOT}`);
console.log(`Upload bundle SHA-256: ${uploadBundle.sourceSha256}`);
console.log('30-Z official step status: COMPLETED; PPK-002: PARTIAL; new Build: false.');
console.log(TRUTH);
