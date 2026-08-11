import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const release = 'Bronze 04.08.2026.29';
const step = '31-A';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\31-A_PPK-002_Timeline_Event_Policy_Enforcement';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\31-A_PPK-002_Timeline_Event_Policy_Enforcement';
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const payloadPaths = Object.freeze([
  'package.json',
  'docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md',
  'docs/decisions/DEC-159-ppk-002-timeline-event-policy-official-checkpoint.md',
  'docs/audit/31-A_PPK-002_TIMELINE_EVENT_POLICY_ENFORCEMENT.md',
  'config/31-a-timeline-event-policy-enforcement-scope.json',
  'artifacts/authority/31-A_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  'artifacts/validation/31-A_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/checkpoints/31-A_EXECUTION_RECORD.json',
  'artifacts/inventory/31-A_SCOPE_AND_STATUS_REPORT.json',
  'artifacts/validation/31-A_TIMELINE_EVENT_POLICY_ENFORCEMENT_CONTRACT.json',
  'artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json',
  'artifacts/manifests/TIMELINE_USE_CASE_VERIFICATION_MVP56.json',
  'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  'artifacts/validation/31-A_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/platform-policy-gate.json',
  'packages/database/src/family-database-migrations.ts',
  'packages/application/src/timeline-use-cases.ts',
  'packages/repository-contracts/src/timeline-repository.ts',
  'packages/repositories/src/timeline-repository.ts',
  'apps/desktop/src/main/timeline-application-adapter.ts',
  'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/family-data-import-service.ts',
  'packages/repositories/src/automation-repository.ts',
  'packages/repositories/src/ai-consent-repository.ts',
  'packages/repositories/src/dashboard-repository.ts',
  'packages/repositories/src/entity-catalog-repository.ts',
  'packages/repositories/src/genealogy-repository.ts',
  'packages/repositories/src/large-family-read-model-repository.ts',
  'packages/repositories/src/report-repository.ts',
  'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  'apps/desktop/tests/large-timeline-location-privacy-runtime.test.ts',
  'scripts/start-31-a-timeline-event-policy-enforcement.mjs',
  'scripts/verify-31-a-timeline-event-policy-enforcement-contract.mjs',
  'scripts/record-31-a-local-validation.mjs',
  'scripts/finalize-31-a-external-library-receipt.mjs',
  'scripts/verify-31-a-completion-transition.mjs'
]);
const localPaths = {
  receipt: 'artifacts/checkpoints/31-A_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-A_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-A_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/31-A_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-A_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-A_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-A_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-A_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/31-A_SCOPE_AND_STATUS_REPORT.json',
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
const writeLocalPair = async (relativePath, value) => {
  const path = full(relativePath); const bytes = jsonBytes(value); const digest = sha256(bytes);
  await writeBytes(path, bytes);
  await writeBytes(`${path}.sha256`, Buffer.from(`${digest}  ${basename(path)}\n`, 'utf8'));
  return { path: relativePath, name: basename(path), sizeBytes: bytes.length, sha256: digest };
};
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
  await visit(directory); return files.sort();
};
const binding = async (rootPath, relativePath) => {
  const bytes = await readFile(resolve(rootPath, relativePath));
  return { path: posix(relativePath), sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const compareRoots = async (sourceRoot, targetRoot, paths) => Promise.all(paths.map(async (path) => {
  const sourceBytes = await readFile(resolve(sourceRoot, path));
  const targetBytes = await readFile(resolve(targetRoot, path));
  const match = sourceBytes.length === targetBytes.length && sha256(sourceBytes) === sha256(targetBytes);
  return { path: posix(path), sourceSizeBytes: sourceBytes.length, librarySizeBytes: targetBytes.length, sourceSha256: sha256(sourceBytes), librarySha256: sha256(targetBytes), status: match ? 'PASS' : 'FAIL' };
}));
const copyTreeFile = async (sourceRoot, targetRoot, path) => {
  const target = resolve(targetRoot, path); await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(sourceRoot, path), target);
};
const copyLocalPair = async (item) => {
  await copyTreeFile(root, libraryRoot, item.path); await copyTreeFile(root, libraryRoot, `${item.path}.sha256`);
};

const [planBefore, executionBefore, contract, runtime, regression, platform] = await Promise.all([
  readJson(full(localPaths.plan)), readJson(full(localPaths.execution)),
  readJson(full('artifacts/validation/31-A_TIMELINE_EVENT_POLICY_ENFORCEMENT_CONTRACT.json')),
  readJson(full('artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json')),
  readJson(full('artifacts/validation/31-A_FULL_VITEST_REGRESSION.json')),
  readJson(full('artifacts/validation/platform-policy-gate.json'))
]);
const step31ABefore = planBefore.steps.find((item) => item.id === step);
assert(step31ABefore?.status === 'IN_PROGRESS' && step31ABefore.validationStatus === 'PASS' && step31ABefore.persistentReceiptStatus === 'PENDING', '31-A is not local PASS awaiting receipt');
assert(executionBefore.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', '31-A execution record is not local PASS');
assert(contract.status === 'PASS' && runtime.status === 'PASS' && regression.status === 'PASS' && platform.status === 'PASS', '31-A validation evidence is not clean PASS');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true });
const payload = [];
for (const sourcePath of payloadPaths) {
  const sourceBytes = await readFile(full(sourcePath));
  const packagePath = posix(join('payload', sourcePath));
  await writeBytes(resolve(localPackageRoot, packagePath), sourceBytes);
  payload.push({ sourcePath, packagePath, sizeBytes: sourceBytes.length, sha256: sha256(sourceBytes) });
}
const manifest = {
  schemaVersion: 1, release, step, requirement: 'PPK-002', phase: 'FOCUSED_CHECKPOINT_PACKAGE', status: 'PASS',
  payloadCount: payload.length, payload, validation: {
    prioritySelection: 'PASS_7_OF_7', controlledRuntime: 'PASS_14_OF_14', contract: 'PASS_38_OF_38',
    timelineUseCases: 'PASS_19_OF_19', databaseMigrations: 'PASS_9_OF_9_WITH_MIGRATION_67',
    fullVitest: 'PASS_158_OF_158', platformPolicy: 'PASS_NEW_BYPASS_0_RUNTIME_8'
  },
  PPK002: 'PARTIAL', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, newBuildIssued: false,
  createdAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const manifestName = '31-A_CHECKPOINT_MANIFEST.json';
const manifestBytes = jsonBytes(manifest); const manifestDigest = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes);
await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestDigest}  ${manifestName}\n`, 'utf8'));
const expectedBasePaths = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort();
const actualLocalPaths = await listFiles(localPackageRoot);
assert(JSON.stringify(actualLocalPaths) === JSON.stringify(expectedBasePaths), 'Local 31-A checkpoint package file set is not exact');

await mkdir(libraryRoot, { recursive: true });
for (const path of expectedBasePaths) await copyTreeFile(localPackageRoot, libraryRoot, path);
const baseReadback = await compareRoots(localPackageRoot, libraryRoot, expectedBasePaths);
assert(baseReadback.every((item) => item.status === 'PASS'), 'D: 31-A base package readback mismatch');

const readback = {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_BASE_PACKAGE_READBACK', status: 'PASS', countsAsPass: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  expected: expectedBasePaths.length, executed: baseReadback.length, matched: baseReadback.length, failed: 0,
  manifestSha256: manifestDigest, artifacts: baseReadback, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const readbackBinding = await writeLocalPair(localPaths.readback, readback);
const receipt = {
  schemaVersion: 1, release, step, requirement: 'PPK-002', phase: 'TIMELINE_EVENT_POLICY_EXTERNAL_LIBRARY_RECEIPT',
  status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED', officialCompletionClaimed: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, physicalLibraryPath: libraryRoot,
  localCheckpointPath: localPackageRoot, verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK',
  basePackage: { expected: expectedBasePaths.length, matched: expectedBasePaths.length, failed: 0, manifestSha256: manifestDigest, status: 'PASS' },
  libraryReadbackVerification: readbackBinding, targetSliceStatus: 'PASS', PPK002: 'PARTIAL', requirementCompletionClaimed: false,
  openBoundaries: { familyDataImportCentralAuthorizationOfficialCheckpoint: 'NEXT_SEPARATE_SLICE', timelineDeleteClaimRepairWorkflow: 'NOT_COMPLETE', universalRepositoryEnforcement: 'NOT_COMPLETE', obligationExecution: 'NOT_RUN_NOT_PASS' },
  nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT', currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FOCUSED_31_A_CHECKPOINT',
  newBuildIssued: false, recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const receiptBinding = await writeLocalPair(localPaths.receipt, receipt);
await copyLocalPair(readbackBinding); await copyLocalPair(receiptBinding);
const firstStagePaths = [localPaths.readback, `${localPaths.readback}.sha256`, localPaths.receipt, `${localPaths.receipt}.sha256`];
const firstStage = await compareRoots(root, libraryRoot, firstStagePaths);
assert(firstStage.every((item) => item.status === 'PASS'), 'D: 31-A receipt first-stage mismatch');
const receiptReadback = { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK', status: 'PASS', expected: 4, executed: 4, matched: 4, failed: 0, artifacts: firstStage, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth };
const receiptReadbackBinding = await writeLocalPair(localPaths.receiptReadback, receiptReadback);
await copyLocalPair(receiptReadbackBinding);
const secondStagePaths = [localPaths.receiptReadback, `${localPaths.receiptReadback}.sha256`];
const secondStage = await compareRoots(root, libraryRoot, secondStagePaths);
assert(secondStage.every((item) => item.status === 'PASS'), 'D: 31-A receipt persistence mismatch');
const persistence = { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK_PERSISTENCE', status: 'PASS', expected: 2, executed: 2, matched: 2, failed: 0, artifacts: secondStage, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth };
const persistenceBinding = await writeLocalPair(localPaths.persistence, persistence);
await copyLocalPair(persistenceBinding);

const supplementBindings = [readbackBinding, receiptBinding, receiptReadbackBinding, persistenceBinding];
const preInventoryExpected = [...expectedBasePaths, ...supplementBindings.flatMap((item) => [item.path, `${item.path}.sha256`])].sort();
const inventoryNames = [basename(localPaths.inventory), `${basename(localPaths.inventory)}.sha256`];
const currentBeforeInventory = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(currentBeforeInventory) === JSON.stringify(preInventoryExpected), 'D: 31-A pre-inventory file set is not exact');
const beforeInventoryBindings = await Promise.all(currentBeforeInventory.map((path) => binding(libraryRoot, path)));
const finalInventory = {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY', status: 'PASS', countsAsPass: true,
  libraryPath: libraryRoot, expectedFilesBeforeInventory: preInventoryExpected.length, actualFilesBeforeInventory: currentBeforeInventory.length,
  finalExpectedFilesIncludingInventoryPair: preInventoryExpected.length + 2, filesBeforeInventory: beforeInventoryBindings,
  PPK002: 'PARTIAL', officialCompletionClaimed: true, newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const inventoryBinding = await writeLocalPair(localPaths.inventory, finalInventory);
await copyLocalPair(inventoryBinding);
const finalExpected = [...preInventoryExpected, localPaths.inventory, `${localPaths.inventory}.sha256`].sort();
const finalActual = await listFiles(libraryRoot);
assert(JSON.stringify(finalActual) === JSON.stringify(finalExpected), 'D: 31-A final inventory file set is not exact');

const completion = {
  schemaVersion: 1, release, step, requirement: 'PPK-002', status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, persistentReceiptPath: localPaths.receipt,
  libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', externalInventory: { expectedFiles: finalExpected.length, actualFiles: finalActual.length, status: 'PASS' },
  evidence: [readbackBinding, receiptBinding, receiptReadbackBinding, persistenceBinding, inventoryBinding], targetSliceStatus: 'PASS',
  PPK002: 'PARTIAL', requirementCompletionClaimed: false, nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT',
  currentAuthoritativeSourceExternalProtectionStatus: 'PENDING_SEPARATE_FROM_FOCUSED_31_A_CHECKPOINT', newBuildIssued: false,
  completedAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
await writeJson(full(localPaths.completion), completion);

const plan = await readJson(full(localPaths.plan)); const step31A = plan.steps.find((item) => item.id === step);
Object.assign(step31A, { status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', persistentReceiptPath: localPaths.receipt, completionTransitionStatus: 'PASS' });
for (const path of [localPaths.receipt, localPaths.readback, localPaths.receiptReadback, localPaths.persistence, localPaths.inventory, localPaths.completion, localPaths.transition]) if (!step31A.localEvidence.includes(path)) step31A.localEvidence.push(path);
plan.updatedAt = new Date().toISOString();
plan.segmentationNote = '30-Z and 31-A are immutable COMPLETED/PASS receipt chains. 31-A timeline-event Policy Enforcement has an exact focused package and D: external USB readback. PPK-002 remains PARTIAL; family data import authorization is the next separate slice; no new Build is issued.';
await writeJson(full(localPaths.plan), plan);
const ledger = await readJson(full(localPaths.ledger));
ledger.libraryUploadStatus = '31-A_COMPLETED_RECEIPT_PASS'; ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT'; ledger.activeMicroStep = null; ledger.updatedAt = new Date().toISOString();
ledger.externalLibraryAuthority31A = { step, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot, receipt: localPaths.receipt, focusedCheckpointOnly: true };
await writeJson(full(localPaths.ledger), ledger);
const execution = await readJson(full(localPaths.execution));
Object.assign(execution, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: localPaths.receipt, officialCompletionClaimed: true, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt: completion.completedAt });
await writeJson(full(localPaths.execution), execution);
const scopeReport = await readJson(full(localPaths.scope));
Object.assign(scopeReport, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: localPaths.receipt, officialCompletionClaimed: true, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', generatedAt: new Date().toISOString() });
await writeJson(full(localPaths.scope), scopeReport);
const transitionChecks = [
  ['base package', baseReadback.length === expectedBasePaths.length && baseReadback.every((item) => item.status === 'PASS')],
  ['receipt readback', firstStage.every((item) => item.status === 'PASS')],
  ['receipt persistence', secondStage.every((item) => item.status === 'PASS')],
  ['final inventory', finalActual.length === finalExpected.length],
  ['work plan', step31A.status === 'COMPLETED' && step31A.persistentReceiptStatus === 'PASS'],
  ['governance', ledger.libraryUploadStatus === '31-A_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['scope boundary', completion.PPK002 === 'PARTIAL' && completion.requirementCompletionClaimed === false],
  ['Build boundary', completion.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '31-A completion transition failed');
await writeJson(full(localPaths.transition), { schemaVersion: 1, release, step, phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION', status: 'PASS', expected: transitionChecks.length, executed: transitionChecks.length, passed: transitionChecks.length, failed: 0, checks: transitionChecks, officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, PPK002: 'PARTIAL', newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth });

console.log(`31-A external USB Library receipt: PASS (${expectedBasePaths.length}/${expectedBasePaths.length} base files; ${finalActual.length}/${finalExpected.length} final files).`);
console.log(`Library: ${libraryRoot}`);
console.log(`31-A official step status: COMPLETED; PPK-002: PARTIAL; new Build: false.`);
