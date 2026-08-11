import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const release = 'Bronze 04.08.2026.29'; const step = '31-B';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\31-B_PPK-002_Family_Data_Import_Central_Authorization';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\31-B_PPK-002_Family_Data_Import_Central_Authorization';
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const payloadPaths = Object.freeze([
  'package.json',
  'docs/decisions/DEC-157-ppk-002-family-data-import-central-authorization-local-continuation.md',
  'docs/decisions/DEC-160-ppk-002-family-data-import-central-authorization-official-checkpoint.md',
  'docs/audit/31-B_PPK-002_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION.md',
  'config/31-b-family-data-import-central-authorization-scope.json',
  'artifacts/authority/31-B_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  'artifacts/validation/31-B_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/checkpoints/31-B_EXECUTION_RECORD.json',
  'artifacts/inventory/31-B_SCOPE_AND_STATUS_REPORT.json',
  'artifacts/validation/31-B_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION_CONTRACT.json',
  'artifacts/validation/PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json',
  'artifacts/validation/31-B_TARGETED_VITEST.json',
  'artifacts/validation/31-B_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/platform-policy-gate.json',
  'apps/desktop/src/main/family-data-import-service.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  'scripts/start-31-b-family-data-import-central-authorization.mjs',
  'scripts/verify-31-b-family-data-import-central-authorization-contract.mjs',
  'scripts/verify-ppk002-family-data-import-policy-local-continuation.mjs',
  'scripts/record-31-b-local-validation.mjs',
  'scripts/finalize-31-b-external-library-receipt.mjs',
  'scripts/verify-31-b-completion-transition.mjs'
]);
const paths = {
  receipt: 'artifacts/checkpoints/31-B_LIBRARY_RECEIPT.json', readback: 'artifacts/validation/31-B_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-B_RECEIPT_READBACK_VERIFICATION.json', persistence: 'artifacts/validation/31-B_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-B_LIBRARY_FINAL_INVENTORY_VERIFICATION.json', completion: 'artifacts/checkpoints/31-B_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-B_COMPLETION_TRANSITION_VALIDATION.json', execution: 'artifacts/checkpoints/31-B_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/31-B_SCOPE_AND_STATUS_REPORT.json', plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex'); const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'); const full = (path) => resolve(root, path);
const assert = (condition, message) => { if (!condition) throw new Error(message); }; const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); }; const writeJson = async (path, value) => writeBytes(path, jsonBytes(value));
const writeLocalPair = async (relativePath, value) => { const path = full(relativePath); const bytes = jsonBytes(value); const digest = sha256(bytes); await writeBytes(path, bytes); await writeBytes(`${path}.sha256`, Buffer.from(`${digest}  ${basename(path)}\n`, 'utf8')); return { path: relativePath, name: basename(path), sizeBytes: bytes.length, sha256: digest }; };
const posix = (path) => path.split(sep).join('/');
const listFiles = async (directory) => { const files = []; const visit = async (current) => { for (const entry of await readdir(current, { withFileTypes: true })) { const path = join(current, entry.name); if (entry.isDirectory()) await visit(path); else if (entry.isFile()) files.push(posix(relative(directory, path))); } }; await visit(directory); return files.sort(); };
const binding = async (rootPath, relativePath) => { const bytes = await readFile(resolve(rootPath, relativePath)); return { path: posix(relativePath), sizeBytes: bytes.length, sha256: sha256(bytes) }; };
const compareRoots = async (sourceRoot, targetRoot, names) => Promise.all(names.map(async (path) => { const sourceBytes = await readFile(resolve(sourceRoot, path)); const targetBytes = await readFile(resolve(targetRoot, path)); const match = sourceBytes.length === targetBytes.length && sha256(sourceBytes) === sha256(targetBytes); return { path: posix(path), sourceSizeBytes: sourceBytes.length, librarySizeBytes: targetBytes.length, sourceSha256: sha256(sourceBytes), librarySha256: sha256(targetBytes), status: match ? 'PASS' : 'FAIL' }; }));
const copyTreeFile = async (sourceRoot, targetRoot, path) => { const target = resolve(targetRoot, path); await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(sourceRoot, path), target); };
const copyLocalPair = async (item) => { await copyTreeFile(root, libraryRoot, item.path); await copyTreeFile(root, libraryRoot, `${item.path}.sha256`); };

const [planBefore, executionBefore, contract, runtime, targeted, regression, platform] = await Promise.all([
  readJson(full(paths.plan)), readJson(full(paths.execution)), readJson(full('artifacts/validation/31-B_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION_CONTRACT.json')),
  readJson(full('artifacts/validation/PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json')), readJson(full('artifacts/validation/31-B_TARGETED_VITEST.json')),
  readJson(full('artifacts/validation/31-B_FULL_VITEST_REGRESSION.json')), readJson(full('artifacts/validation/platform-policy-gate.json'))
]);
const stepBefore = planBefore.steps.find((item) => item.id === step);
assert(stepBefore?.status === 'IN_PROGRESS' && stepBefore.validationStatus === 'PASS' && stepBefore.persistentReceiptStatus === 'PENDING', '31-B is not local PASS awaiting receipt');
assert(executionBefore.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', '31-B execution is not local PASS');
assert([contract, runtime, targeted, regression, platform].every((item) => item.status === 'PASS'), '31-B validation evidence is not clean PASS');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true }); const payload = [];
for (const sourcePath of payloadPaths) { const sourceBytes = await readFile(full(sourcePath)); const packagePath = posix(join('payload', sourcePath)); await writeBytes(resolve(localPackageRoot, packagePath), sourceBytes); payload.push({ sourcePath, packagePath, sizeBytes: sourceBytes.length, sha256: sha256(sourceBytes) }); }
const manifest = { schemaVersion: 1, release, step, requirement: 'PPK-002', phase: 'FOCUSED_CHECKPOINT_PACKAGE', status: 'PASS', payloadCount: payload.length, payload, validation: executionBefore.validation, PPK002: 'PARTIAL', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, newBuildIssued: false, createdAt: new Date().toISOString(), mandatoryTruthSentence: truth };
const manifestName = '31-B_CHECKPOINT_MANIFEST.json'; const manifestBytes = jsonBytes(manifest); const manifestDigest = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes); await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestDigest}  ${manifestName}\n`, 'utf8'));
const expectedBase = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort(); const localActual = await listFiles(localPackageRoot); assert(JSON.stringify(localActual) === JSON.stringify(expectedBase), 'Local 31-B package file set is not exact');
await mkdir(libraryRoot, { recursive: true }); for (const path of expectedBase) await copyTreeFile(localPackageRoot, libraryRoot, path);
const baseReadback = await compareRoots(localPackageRoot, libraryRoot, expectedBase); assert(baseReadback.every((item) => item.status === 'PASS'), 'D: 31-B base package readback mismatch');
const readback = { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_BASE_PACKAGE_READBACK', status: 'PASS', countsAsPass: true, storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot, expected: expectedBase.length, executed: baseReadback.length, matched: baseReadback.length, failed: 0, manifestSha256: manifestDigest, artifacts: baseReadback, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth };
const readbackBinding = await writeLocalPair(paths.readback, readback);
const receipt = { schemaVersion: 1, release, step, requirement: 'PPK-002', phase: 'FAMILY_DATA_IMPORT_AUTHORIZATION_EXTERNAL_LIBRARY_RECEIPT', status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED', officialCompletionClaimed: true, storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, physicalLibraryPath: libraryRoot, localCheckpointPath: localPackageRoot, verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK', basePackage: { expected: expectedBase.length, matched: expectedBase.length, failed: 0, manifestSha256: manifestDigest, status: 'PASS' }, libraryReadbackVerification: readbackBinding, targetSliceStatus: 'PASS', PPK002: 'PARTIAL', requirementCompletionClaimed: false, openBoundaries: { familyDataImportMultiReceiptBatch: 'NEXT_SEPARATE_SLICE', governedImportRollbackReceiptFence: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE', obligationExecution: 'NOT_RUN_NOT_PASS' }, nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT', currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FOCUSED_31_B_CHECKPOINT', newBuildIssued: false, recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth };
const receiptBinding = await writeLocalPair(paths.receipt, receipt); await copyLocalPair(readbackBinding); await copyLocalPair(receiptBinding);
const stageOnePaths = [paths.readback, `${paths.readback}.sha256`, paths.receipt, `${paths.receipt}.sha256`]; const stageOne = await compareRoots(root, libraryRoot, stageOnePaths); assert(stageOne.every((item) => item.status === 'PASS'), 'D: 31-B receipt readback mismatch');
const receiptReadbackBinding = await writeLocalPair(paths.receiptReadback, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK', status: 'PASS', expected: 4, executed: 4, matched: 4, failed: 0, artifacts: stageOne, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth }); await copyLocalPair(receiptReadbackBinding);
const stageTwoPaths = [paths.receiptReadback, `${paths.receiptReadback}.sha256`]; const stageTwo = await compareRoots(root, libraryRoot, stageTwoPaths); assert(stageTwo.every((item) => item.status === 'PASS'), 'D: 31-B receipt persistence mismatch');
const persistenceBinding = await writeLocalPair(paths.persistence, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK_PERSISTENCE', status: 'PASS', expected: 2, executed: 2, matched: 2, failed: 0, artifacts: stageTwo, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth }); await copyLocalPair(persistenceBinding);
const supplement = [readbackBinding, receiptBinding, receiptReadbackBinding, persistenceBinding]; const beforeInventoryExpected = [...expectedBase, ...supplement.flatMap((item) => [item.path, `${item.path}.sha256`])].sort();
const inventoryNames = [basename(paths.inventory), `${basename(paths.inventory)}.sha256`]; const beforeInventoryActual = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort(); assert(JSON.stringify(beforeInventoryActual) === JSON.stringify(beforeInventoryExpected), 'D: 31-B pre-inventory file set is not exact');
const inventoryBinding = await writeLocalPair(paths.inventory, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY', status: 'PASS', countsAsPass: true, libraryPath: libraryRoot, expectedFilesBeforeInventory: beforeInventoryExpected.length, actualFilesBeforeInventory: beforeInventoryActual.length, finalExpectedFilesIncludingInventoryPair: beforeInventoryExpected.length + 2, filesBeforeInventory: await Promise.all(beforeInventoryActual.map((path) => binding(libraryRoot, path))), PPK002: 'PARTIAL', officialCompletionClaimed: true, newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth }); await copyLocalPair(inventoryBinding);
const finalExpected = [...beforeInventoryExpected, paths.inventory, `${paths.inventory}.sha256`].sort(); const finalActual = await listFiles(libraryRoot); assert(JSON.stringify(finalActual) === JSON.stringify(finalExpected), 'D: 31-B final inventory is not exact');
const completedAt = new Date().toISOString(); const completion = { schemaVersion: 1, release, step, requirement: 'PPK-002', status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, persistentReceiptPath: paths.receipt, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', externalInventory: { expectedFiles: finalExpected.length, actualFiles: finalActual.length, status: 'PASS' }, evidence: [...supplement, inventoryBinding], targetSliceStatus: 'PASS', PPK002: 'PARTIAL', requirementCompletionClaimed: false, nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT', currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FOCUSED_31_B_CHECKPOINT', newBuildIssued: false, completedAt, mandatoryTruthSentence: truth }; await writeJson(full(paths.completion), completion);
const plan = await readJson(full(paths.plan)); const step31B = plan.steps.find((item) => item.id === step); Object.assign(step31B, { status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS' }); for (const path of [paths.receipt, paths.readback, paths.receiptReadback, paths.persistence, paths.inventory, paths.completion, paths.transition]) if (!step31B.localEvidence.includes(path)) step31B.localEvidence.push(path); plan.updatedAt = completedAt; plan.segmentationNote = '31-A and 31-B are immutable COMPLETED/PASS receipt chains. 31-B family data import central authorization has an exact focused package and D: external USB readback. PPK-002 remains PARTIAL; multi-receipt import is the next separate slice; no new Build is issued.'; await writeJson(full(paths.plan), plan);
const ledger = await readJson(full(paths.ledger)); ledger.libraryUploadStatus = '31-B_COMPLETED_RECEIPT_PASS'; ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT'; ledger.activeMicroStep = null; ledger.externalLibraryAuthority31B = { step, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot, receipt: paths.receipt, focusedCheckpointOnly: true }; ledger.updatedAt = completedAt; await writeJson(full(paths.ledger), ledger);
const execution = await readJson(full(paths.execution)); Object.assign(execution, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt }); await writeJson(full(paths.execution), execution);
const scope = await readJson(full(paths.scope)); Object.assign(scope, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', generatedAt: completedAt }); await writeJson(full(paths.scope), scope);
const transitionChecks = [['base package', baseReadback.every((item) => item.status === 'PASS')], ['receipt readback', stageOne.every((item) => item.status === 'PASS')], ['receipt persistence', stageTwo.every((item) => item.status === 'PASS')], ['final inventory', finalActual.length === finalExpected.length], ['work plan', step31B.status === 'COMPLETED' && step31B.persistentReceiptStatus === 'PASS'], ['governance', ledger.libraryUploadStatus === '31-B_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null], ['scope boundary', completion.PPK002 === 'PARTIAL' && completion.requirementCompletionClaimed === false], ['Build boundary', completion.newBuildIssued === false]].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' })); assert(transitionChecks.every((item) => item.status === 'PASS'), '31-B completion transition failed');
await writeJson(full(paths.transition), { schemaVersion: 1, release, step, phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION', status: 'PASS', expected: transitionChecks.length, executed: transitionChecks.length, passed: transitionChecks.length, failed: 0, checks: transitionChecks, officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, PPK002: 'PARTIAL', newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth });
console.log(`31-B external USB Library receipt: PASS (${expectedBase.length}/${expectedBase.length} base files; ${finalActual.length}/${finalExpected.length} final files).`); console.log(`Library: ${libraryRoot}`); console.log('31-B official step status: COMPLETED; PPK-002: PARTIAL; new Build: false.');
