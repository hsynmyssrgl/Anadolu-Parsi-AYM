import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const release = 'Bronze 04.08.2026.29';
const step = '31-H';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\31-H_Core_Service_Family_Data_Session_Ownership_Control_Plane';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\31-H_Core_Service_Family_Data_Session_Ownership_Control_Plane';
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const payloadPaths = Object.freeze([
  'package.json',
  'docs/decisions/DEC-169-core-service-protected-family-data-session-ownership-control-plane.md',
  'docs/audit/31-H_CORE_SERVICE_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE.md',
  'docs/current/09_KULLANICI_KARARLARI_KAYDI.md',
  'config/user-decision-ledger.json',
  'config/31-h-core-service-family-data-session-ownership-control-plane-scope.json',
  'artifacts/authority/31-H_MAIN_STRUCTURE_PRIORITY_AUTHORITY.json',
  'artifacts/validation/31-H_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/checkpoints/31-H_EXECUTION_RECORD.json',
  'artifacts/inventory/31-H_SCOPE_AND_STATUS_REPORT.json',
  'artifacts/validation/31-H_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE_CONTRACT.json',
  'artifacts/validation/31-H_ROOT_TYPESCRIPT.json',
  'artifacts/validation/31-H_TARGETED_VITEST.json',
  'artifacts/validation/31-H_CORE_SERVICE_RUNTIME.json',
  'artifacts/validation/31-H_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-H_PRODUCTION_BUILD.json',
  'artifacts/validation/platform-policy-gate.json',
  'packages/core-service-contracts/src/index.ts',
  'packages/core-service-client/src/local-admin-client.ts',
  'apps/core-service/src/family-data-ownership-runtime.ts',
  'apps/core-service/src/core-service-runtime.ts',
  'apps/core-service/src/core-service-method-dispatcher.ts',
  'apps/core-service/src/local-admin-server.ts',
  'apps/core-service/src/main.ts',
  'apps/core-service/src/index.ts',
  'apps/core-service/tests/core-service-method-dispatcher.test.ts',
  'apps/core-service/tests/family-data-ownership-runtime.test.ts',
  'apps/desktop/src/main/core-service-application-adapter.ts',
  'apps/desktop/src/main/core-service-startup-connection.ts',
  'scripts/lib/authorized-successor-lifecycle.mjs',
  'scripts/verify-core-service-local-admin-contract.mjs',
  'scripts/verify-core-service-local-admin-runtime.mjs',
  'scripts/verify-desktop-core-service-startup-contract.mjs',
  'scripts/verify-desktop-core-service-startup-runtime.mjs',
  'scripts/start-31-h-core-service-family-data-session-ownership-control-plane.mjs',
  'scripts/verify-31-h-core-service-family-data-session-ownership-control-plane-contract.mjs',
  'scripts/run-31-h-family-data-ownership-control-plane-local-validation.mjs',
  'scripts/finalize-31-h-family-data-ownership-external-library-receipt.mjs',
  'scripts/verify-31-h-family-data-ownership-completion-transition.mjs'
]);
const paths = {
  receipt: 'artifacts/checkpoints/31-H_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-H_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-H_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/31-H_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-H_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-H_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-H_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-H_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/31-H_SCOPE_AND_STATUS_REPORT.json',
  scopeConfig: 'config/31-h-core-service-family-data-session-ownership-control-plane-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const writeJson = async (path, value) => writeBytes(path, jsonBytes(value));
const posix = (path) => path.split(sep).join('/');
const listFiles = async (directory) => {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(posix(relative(directory, path)));
    }
  };
  await visit(directory);
  return files.sort();
};
const binding = async (base, path) => {
  const bytes = await readFile(resolve(base, path));
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const compareRoots = async (sourceRoot, targetRoot, names) => Promise.all(names.map(async (path) => {
  const [sourceBytes, targetBytes] = await Promise.all([readFile(resolve(sourceRoot, path)), readFile(resolve(targetRoot, path))]);
  const match = sourceBytes.length === targetBytes.length && sha256(sourceBytes) === sha256(targetBytes);
  return { path, sourceSizeBytes: sourceBytes.length, librarySizeBytes: targetBytes.length, sourceSha256: sha256(sourceBytes), librarySha256: sha256(targetBytes), status: match ? 'PASS' : 'FAIL' };
}));
const copyTreeFile = async (sourceRoot, targetRoot, path) => {
  const target = resolve(targetRoot, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, path), target);
};
const writeLocalPair = async (path, value) => {
  const bytes = jsonBytes(value);
  const digest = sha256(bytes);
  await writeBytes(full(path), bytes);
  await writeBytes(full(`${path}.sha256`), Buffer.from(`${digest}  ${basename(path)}\n`, 'utf8'));
  return { path, sizeBytes: bytes.length, sha256: digest };
};
const copyLocalPair = async (item) => {
  await copyTreeFile(root, libraryRoot, item.path);
  await copyTreeFile(root, libraryRoot, `${item.path}.sha256`);
};

const validationPaths = [
  'artifacts/validation/31-H_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/validation/31-H_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE_CONTRACT.json',
  'artifacts/validation/31-H_ROOT_TYPESCRIPT.json',
  'artifacts/validation/31-H_TARGETED_VITEST.json',
  'artifacts/validation/31-H_CORE_SERVICE_RUNTIME.json',
  'artifacts/validation/31-H_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-H_PRODUCTION_BUILD.json',
  'artifacts/validation/platform-policy-gate.json'
];
const [planBefore, executionBefore, ...validations] = await Promise.all([
  readJson(full(paths.plan)), readJson(full(paths.execution)), ...validationPaths.map((path) => readJson(full(path)))
]);
const stepBefore = planBefore.steps.find((item) => item.id === step);
assert(stepBefore?.status === 'IN_PROGRESS' && stepBefore.validationStatus === 'PASS' && stepBefore.persistentReceiptStatus === 'PENDING', '31-H is not local PASS awaiting receipt');
assert(executionBefore.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', '31-H execution is not local PASS');
assert(validations.every((item) => item.status === 'PASS'), '31-H validation evidence is not clean PASS');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true });
const payload = [];
for (const sourcePath of payloadPaths) {
  const sourceBytes = await readFile(full(sourcePath));
  const packagePath = `payload/${sourcePath}`;
  await writeBytes(resolve(localPackageRoot, packagePath), sourceBytes);
  payload.push({ sourcePath, packagePath, sizeBytes: sourceBytes.length, sha256: sha256(sourceBytes) });
}
const manifest = {
  schemaVersion: 1, release, step, primaryRequirement: 'DHA-001', phase: 'FAMILY_DATA_OWNERSHIP_CONTROL_PLANE_CHECKPOINT_PACKAGE', status: 'PASS',
  payloadCount: payload.length, payload, validation: executionBefore.validation, requirements: executionBefore.requirements,
  requirementCompletionClaimed: false, persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, newBuildIssued: false,
  createdAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const manifestName = '31-H_CHECKPOINT_MANIFEST.json';
const manifestBytes = jsonBytes(manifest);
const manifestDigest = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes);
await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestDigest}  ${manifestName}\n`, 'utf8'));
const expectedBase = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort();
assert(JSON.stringify(await listFiles(localPackageRoot)) === JSON.stringify(expectedBase), 'Local 31-H package file set is not exact');

await mkdir(libraryRoot, { recursive: true });
for (const path of expectedBase) await copyTreeFile(localPackageRoot, libraryRoot, path);
const baseReadback = await compareRoots(localPackageRoot, libraryRoot, expectedBase);
assert(baseReadback.every((item) => item.status === 'PASS'), 'D: 31-H base package readback mismatch');
const readbackBinding = await writeLocalPair(paths.readback, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_BASE_PACKAGE_READBACK', status: 'PASS', countsAsPass: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  expected: expectedBase.length, executed: baseReadback.length, matched: baseReadback.length, failed: 0,
  manifestSha256: manifestDigest, artifacts: baseReadback, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
const receiptBinding = await writeLocalPair(paths.receipt, {
  schemaVersion: 1, release, step, primaryRequirement: 'DHA-001', phase: 'FAMILY_DATA_OWNERSHIP_CONTROL_PLANE_EXTERNAL_LIBRARY_RECEIPT',
  status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED', officialCompletionClaimed: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, physicalLibraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK',
  basePackage: { expected: expectedBase.length, matched: expectedBase.length, failed: 0, manifestSha256: manifestDigest, status: 'PASS' },
  libraryReadbackVerification: readbackBinding, targetSliceStatus: 'PASS', requirementCompletionClaimed: false,
  openBoundaries: executionBefore.openBoundaries ?? (await readJson(full(paths.scopeConfig))).openBoundaries,
  nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-H_PERSISTENT_RECEIPT',
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  newBuildIssued: false, recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyLocalPair(readbackBinding);
await copyLocalPair(receiptBinding);
const stageOnePaths = [paths.readback, `${paths.readback}.sha256`, paths.receipt, `${paths.receipt}.sha256`];
const stageOne = await compareRoots(root, libraryRoot, stageOnePaths);
assert(stageOne.every((item) => item.status === 'PASS'), 'D: 31-H receipt readback mismatch');
const receiptReadbackBinding = await writeLocalPair(paths.receiptReadback, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK', status: 'PASS', expected: 4, executed: 4, matched: 4, failed: 0,
  artifacts: stageOne, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyLocalPair(receiptReadbackBinding);
const stageTwoPaths = [paths.receiptReadback, `${paths.receiptReadback}.sha256`];
const stageTwo = await compareRoots(root, libraryRoot, stageTwoPaths);
assert(stageTwo.every((item) => item.status === 'PASS'), 'D: 31-H receipt persistence mismatch');
const persistenceBinding = await writeLocalPair(paths.persistence, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK_PERSISTENCE', status: 'PASS', expected: 2, executed: 2, matched: 2, failed: 0,
  artifacts: stageTwo, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyLocalPair(persistenceBinding);

const supplement = [readbackBinding, receiptBinding, receiptReadbackBinding, persistenceBinding];
const beforeInventoryExpected = [...expectedBase, ...supplement.flatMap((item) => [item.path, `${item.path}.sha256`])].sort();
const inventoryNames = [paths.inventory, `${paths.inventory}.sha256`];
const beforeInventoryActual = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(beforeInventoryActual) === JSON.stringify(beforeInventoryExpected), 'D: 31-H pre-inventory file set is not exact');
const inventoryBinding = await writeLocalPair(paths.inventory, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY', status: 'PASS', countsAsPass: true,
  libraryPath: libraryRoot, expectedFilesBeforeInventory: beforeInventoryExpected.length, actualFilesBeforeInventory: beforeInventoryActual.length,
  finalExpectedFilesIncludingInventoryPair: beforeInventoryExpected.length + 2,
  filesBeforeInventory: await Promise.all(beforeInventoryActual.map((path) => binding(libraryRoot, path))),
  requirementCompletionClaimed: false, officialCompletionClaimed: true, newBuildIssued: false,
  verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyLocalPair(inventoryBinding);
const finalExpected = [...beforeInventoryExpected, paths.inventory, `${paths.inventory}.sha256`].sort();
const finalActual = await listFiles(libraryRoot);
assert(JSON.stringify(finalActual) === JSON.stringify(finalExpected), 'D: 31-H final inventory is not exact');

const completedAt = new Date().toISOString();
const completion = {
  schemaVersion: 1, release, step, primaryRequirement: 'DHA-001', requirements: executionBefore.requirements,
  status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
  persistentReceiptPath: paths.receipt, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE',
  externalInventory: { expectedFiles: finalExpected.length, actualFiles: finalActual.length, status: 'PASS' }, evidence: [...supplement, inventoryBinding],
  targetSliceStatus: 'PASS', requirementCompletionClaimed: false,
  nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-H_PERSISTENT_RECEIPT',
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  newBuildIssued: false, completedAt, mandatoryTruthSentence: truth
};
await writeJson(full(paths.completion), completion);
const plan = await readJson(full(paths.plan));
const step31H = plan.steps.find((item) => item.id === step);
Object.assign(step31H, { status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS' });
for (const path of [paths.receipt, paths.readback, paths.receiptReadback, paths.persistence, paths.inventory, paths.completion, paths.transition]) if (!step31H.localEvidence.includes(path)) step31H.localEvidence.push(path);
plan.updatedAt = completedAt;
plan.segmentationNote = '31-H protected family-data session ownership control plane is immutable COMPLETED/PASS with exact D: USB readback. Protected vault handoff, SQLite ownership, family APIs, backup/sync and Windows service installation remain open; no requirement is COMPLETE and no new Build is issued.';
await writeJson(full(paths.plan), plan);
const ledger = await readJson(full(paths.ledger));
ledger.libraryUploadStatus = '31-H_COMPLETED_RECEIPT_PASS';
ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_31-H_PERSISTENT_RECEIPT';
ledger.activeMicroStep = null;
ledger.externalLibraryAuthority31H = { step, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot, receipt: paths.receipt, focusedCheckpointOnly: true };
ledger.updatedAt = completedAt;
await writeJson(full(paths.ledger), ledger);
const execution = await readJson(full(paths.execution));
Object.assign(execution, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, requirementCompletionClaimed: false, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt });
await writeJson(full(paths.execution), execution);
const scopeReport = await readJson(full(paths.scope));
Object.assign(scopeReport, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, requirementCompletionClaimed: false, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', generatedAt: completedAt });
await writeJson(full(paths.scope), scopeReport);
const scopeConfig = await readJson(full(paths.scopeConfig));
Object.assign(scopeConfig, { status: 'COMPLETED', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, requirementCompletionClaimed: false, completedAt });
await writeJson(full(paths.scopeConfig), scopeConfig);
const transitionChecks = [
  ['base package', baseReadback.every((item) => item.status === 'PASS')],
  ['receipt readback', stageOne.every((item) => item.status === 'PASS')],
  ['receipt persistence', stageTwo.every((item) => item.status === 'PASS')],
  ['final inventory', finalActual.length === finalExpected.length],
  ['work plan', step31H.status === 'COMPLETED' && step31H.persistentReceiptStatus === 'PASS'],
  ['governance', ledger.libraryUploadStatus === '31-H_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['requirement boundary', completion.requirementCompletionClaimed === false],
  ['Build boundary', completion.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '31-H completion transition failed');
await writeJson(full(paths.transition), {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION', status: 'PASS',
  expected: transitionChecks.length, executed: transitionChecks.length, passed: transitionChecks.length, failed: 0, checks: transitionChecks,
  officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, requirementCompletionClaimed: false,
  newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
console.log(`31-H external USB Library receipt: PASS (${expectedBase.length}/${expectedBase.length} base files; ${finalActual.length}/${finalExpected.length} final files).`);
console.log(`Library: ${libraryRoot}`);
console.log('31-H official step status: COMPLETED; requirements: OPEN; new Build: false.');
