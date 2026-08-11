import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const release = 'Bronze 04.08.2026.29'; const step = '31-T';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\31-T_PPK-002_Family_Import_Governed_Rollback_Receipt_Fence';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\31-T_PPK-002_Family_Import_Governed_Rollback_Receipt_Fence';
const truth = 'Bu makbuz yalnız 31-T family import governed rollback exact delete receipt fence dilimini kapatır; PPK-002, universal repository enforcement, obligation execution ve external monotonic rollback authority tamamlanmış değildir.';
const payloadPaths = Object.freeze([
  'package.json',
  'config/work-segmentation-plan.json', 'config/active-governance-ledger.json', 'config/accepted-scope-registry.json',
  'config/user-decision-ledger.json', 'config/31-t-family-import-governed-rollback-receipt-fence-scope.json',
  'config/31-g-family-import-governed-rollback-receipt-fence-scope.json',
  'docs/decisions/DEC-167-ppk-002-family-import-governed-rollback-receipt-fence.md',
  'docs/decisions/DEC-181-ppk-002-family-import-governed-rollback-receipt-fence.md',
  'docs/audit/31-T_PPK-002_FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE.md',
  'artifacts/authority/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_AUTHORITY.json',
  'artifacts/validation/31-T_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/checkpoints/31-T_EXECUTION_RECORD.json', 'artifacts/checkpoints/31-T_INITIAL_VALIDATION_FAILURES.json',
  'artifacts/inventory/31-T_SCOPE_AND_STATUS_REPORT.json',
  'artifacts/validation/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE_CONTRACT.json',
  'artifacts/validation/31-T_ROOT_TYPESCRIPT.json', 'artifacts/validation/31-T_TARGETED_VITEST.json',
  'artifacts/validation/31-T_DATABASE_MIGRATION_68.json', 'artifacts/validation/31-T_PLATFORM_POLICY.json',
  'artifacts/validation/31-T_USER_DECISION_LEDGER.json', 'artifacts/validation/31-T_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-T_PRODUCTION_BUILD.json', 'artifacts/validation/platform-policy-gate.json',
  'packages/application/src/location-use-cases.ts', 'packages/application/src/timeline-use-cases.ts',
  'packages/repository-contracts/src/family-data-import-repository.ts',
  'packages/repositories/src/family-data-import-repository.ts', 'packages/database/src/family-database-migrations.ts',
  'apps/desktop/src/main/family-data-import-service.ts', 'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/location-production-policy-runtime.ts', 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  'apps/desktop/tests/family-data-import-governed-rollback-runtime.test.ts',
  'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts',
  'scripts/start-31-t-family-import-governed-rollback-receipt-fence.mjs',
  'scripts/verify-31-t-family-import-governed-rollback-receipt-fence-contract.mjs',
  'scripts/run-31-t-family-import-governed-rollback-local-validation.mjs',
  'scripts/finalize-31-t-family-import-governed-rollback-external-library-receipt.mjs',
  'scripts/verify-31-t-family-import-governed-rollback-completion-transition.mjs'
]);
const paths = {
  receipt: 'artifacts/checkpoints/31-T_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-T_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-T_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/31-T_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-T_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-T_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-T_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-T_EXECUTION_RECORD.json', scopeReport: 'artifacts/inventory/31-T_SCOPE_AND_STATUS_REPORT.json',
  scopeConfig: 'config/31-t-family-import-governed-rollback-receipt-fence-scope.json',
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json'
};
const validationPaths = [
  'artifacts/validation/31-T_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/validation/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE_CONTRACT.json',
  'artifacts/validation/31-T_ROOT_TYPESCRIPT.json', 'artifacts/validation/31-T_TARGETED_VITEST.json',
  'artifacts/validation/31-T_DATABASE_MIGRATION_68.json', 'artifacts/validation/31-T_PLATFORM_POLICY.json',
  'artifacts/validation/31-T_USER_DECISION_LEDGER.json', 'artifacts/validation/31-T_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-T_PRODUCTION_BUILD.json'
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const writeJson = async (path, value) => writeBytes(path, jsonBytes(value));
const posix = (path) => path.split(sep).join('/');
const listFiles = async (directory) => {
  const files = []; const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name); if (entry.isSymbolicLink()) throw new Error(`Symbolic link forbidden: ${path}`);
      if (entry.isDirectory()) await visit(path); else if (entry.isFile()) files.push(posix(relative(directory, path)));
    }
  }; await visit(directory); return files.sort();
};
const copy = async (sourceRoot, targetRoot, path) => { const target = resolve(targetRoot, path); await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(sourceRoot, path), target); };
const compare = async (sourceRoot, targetRoot, names) => Promise.all(names.map(async (path) => {
  const [source, target] = await Promise.all([readFile(resolve(sourceRoot, path)), readFile(resolve(targetRoot, path))]);
  const match = source.length === target.length && sha256(source) === sha256(target);
  return { path, sourceSizeBytes: source.length, librarySizeBytes: target.length, sourceSha256: sha256(source), librarySha256: sha256(target), status: match ? 'PASS' : 'FAIL' };
}));
const bind = async (base, path) => { const bytes = await readFile(resolve(base, path)); return { path, sizeBytes: bytes.length, sha256: sha256(bytes) }; };
const writePair = async (path, value) => { const bytes = jsonBytes(value); const digest = sha256(bytes); await writeBytes(full(path), bytes); await writeBytes(full(`${path}.sha256`), Buffer.from(`${digest}  ${basename(path)}\n`, 'ascii')); return { path, sizeBytes: bytes.length, sha256: digest }; };
const copyPair = async (item) => { await copy(root, libraryRoot, item.path); await copy(root, libraryRoot, `${item.path}.sha256`); };

const [planBefore, executionBefore, scopeBefore, ...validations] = await Promise.all([
  readJson(full(paths.plan)), readJson(full(paths.execution)), readJson(full(paths.scopeConfig)), ...validationPaths.map((path) => readJson(full(path)))
]);
const stepBefore = planBefore.steps.find((item) => item.id === step);
const localPass = stepBefore?.status === 'IN_PROGRESS' && stepBefore.validationStatus === 'PASS' && stepBefore.persistentReceiptStatus === 'PENDING' && executionBefore.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
const recoverable = stepBefore?.status === 'COMPLETED' && stepBefore.validationStatus === 'PASS' && stepBefore.persistentReceiptStatus === 'PASS' && executionBefore.status === 'PASS';
assert(localPass || recoverable, '31-T is not ready for finalization');
assert(validations.every((item) => item.status === 'PASS'), '31-T validation is not clean PASS');
assert(scopeBefore.openBoundaries.PPK002 === 'PARTIAL_AFTER_THIS_SLICE', 'PPK-002 truth boundary changed');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true }); const payload = [];
for (const sourcePath of payloadPaths) {
  const bytes = await readFile(full(sourcePath)); const packagePath = `payload/${sourcePath}`;
  await writeBytes(resolve(localPackageRoot, packagePath), bytes); payload.push({ sourcePath, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const manifest = { schemaVersion: 1, release, step, primaryRequirement: 'PPK-002', phase: 'GOVERNED_ROLLBACK_RECEIPT_FENCE_CHECKPOINT_PACKAGE', status: 'PASS', payloadCount: payload.length, payload, validation: executionBefore.validation, requirementStatuses: { 'PPK-002': 'PARTIAL' }, requirementCompletionClaimed: false, persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, newBuildIssued: false, createdAt: new Date().toISOString(), mandatoryTruthSentence: truth };
const manifestName = '31-T_CHECKPOINT_MANIFEST.json'; const manifestBytes = jsonBytes(manifest); const manifestDigest = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes); await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestDigest}  ${manifestName}\n`, 'ascii'));
const expectedBase = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort();
assert(JSON.stringify(await listFiles(localPackageRoot)) === JSON.stringify(expectedBase), 'Local package set is not exact');
await mkdir(libraryRoot, { recursive: true }); for (const path of expectedBase) await copy(localPackageRoot, libraryRoot, path);
const base = await compare(localPackageRoot, libraryRoot, expectedBase); assert(base.every((item) => item.status === 'PASS'), 'D: base readback mismatch');

const readback = await writePair(paths.readback, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_BASE_PACKAGE_READBACK', status: 'PASS', countsAsPass: true, storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot, expected: expectedBase.length, executed: base.length, matched: base.length, failed: 0, manifestSha256: manifestDigest, artifacts: base, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth });
const receipt = await writePair(paths.receipt, { schemaVersion: 1, release, step, primaryRequirement: 'PPK-002', phase: 'GOVERNED_ROLLBACK_RECEIPT_FENCE_EXTERNAL_LIBRARY_RECEIPT', status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED', officialCompletionClaimed: true, storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, physicalLibraryPath: libraryRoot, localCheckpointPath: localPackageRoot, verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK', basePackage: { expected: expectedBase.length, matched: expectedBase.length, failed: 0, manifestSha256: manifestDigest, status: 'PASS' }, libraryReadbackVerification: readback, targetSliceStatus: 'PASS', PPK002: 'PARTIAL', requirementCompletionClaimed: false, openBoundaries: scopeBefore.openBoundaries, nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-T', currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE', newBuildIssued: false, recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth });
await copyPair(readback); await copyPair(receipt);
const stageOnePaths = [paths.readback, `${paths.readback}.sha256`, paths.receipt, `${paths.receipt}.sha256`];
const stageOne = await compare(root, libraryRoot, stageOnePaths); assert(stageOne.every((item) => item.status === 'PASS'), 'D: receipt readback mismatch');
const receiptReadback = await writePair(paths.receiptReadback, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK', status: 'PASS', expected: 4, executed: 4, matched: 4, failed: 0, artifacts: stageOne, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth }); await copyPair(receiptReadback);
const stageTwoPaths = [paths.receiptReadback, `${paths.receiptReadback}.sha256`]; const stageTwo = await compare(root, libraryRoot, stageTwoPaths); assert(stageTwo.every((item) => item.status === 'PASS'), 'D: receipt persistence mismatch');
const persistence = await writePair(paths.persistence, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK_PERSISTENCE', status: 'PASS', expected: 2, executed: 2, matched: 2, failed: 0, artifacts: stageTwo, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth }); await copyPair(persistence);
const supplement = [readback, receipt, receiptReadback, persistence];
const beforeExpected = [...expectedBase, ...supplement.flatMap((item) => [item.path, `${item.path}.sha256`])].sort();
const inventoryNames = [paths.inventory, `${paths.inventory}.sha256`]; const beforeActual = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(beforeActual) === JSON.stringify(beforeExpected), 'D: pre-inventory set is not exact');
const inventory = await writePair(paths.inventory, { schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY', status: 'PASS', countsAsPass: true, libraryPath: libraryRoot, expectedFilesBeforeInventory: beforeExpected.length, actualFilesBeforeInventory: beforeActual.length, finalExpectedFilesIncludingInventoryPair: beforeExpected.length + 2, filesBeforeInventory: await Promise.all(beforeActual.map((path) => bind(libraryRoot, path))), PPK002: 'PARTIAL', requirementCompletionClaimed: false, officialCompletionClaimed: true, newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth }); await copyPair(inventory);
const finalExpected = [...beforeExpected, paths.inventory, `${paths.inventory}.sha256`].sort(); const finalActual = await listFiles(libraryRoot);
assert(JSON.stringify(finalActual) === JSON.stringify(finalExpected), 'D: final inventory is not exact');

const completedAt = new Date().toISOString();
const completion = { schemaVersion: 1, release, step, primaryRequirement: 'PPK-002', requirements: ['PPK-002'], status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, persistentReceiptPath: paths.receipt, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', externalInventory: { expectedFiles: finalExpected.length, actualFiles: finalActual.length, status: 'PASS' }, evidence: [...supplement, inventory], targetSliceStatus: 'PASS', PPK002: 'PARTIAL', requirementCompletionClaimed: false, nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-T', currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE', newBuildIssued: false, completedAt, mandatoryTruthSentence: truth };
await writeJson(full(paths.completion), completion);
const plan = await readJson(full(paths.plan)); const step31T = plan.steps.find((item) => item.id === step);
Object.assign(step31T, { status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS' });
for (const path of [paths.receipt, paths.readback, paths.receiptReadback, paths.persistence, paths.inventory, paths.completion, paths.transition]) if (!step31T.localEvidence.includes(path)) step31T.localEvidence.push(path);
plan.updatedAt = completedAt; plan.segmentationNote = '31-T governed rollback exact delete receipt fence is immutable COMPLETED/PASS with exact D: USB readback. PPK-002 remains PARTIAL; universal repository enforcement, obligation execution and external monotonic rollback authority remain open.'; await writeJson(full(paths.plan), plan);
const ledger = await readJson(full(paths.ledger)); ledger.libraryUploadStatus = '31-T_COMPLETED_RECEIPT_PASS'; ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_31-T_PERSISTENT_RECEIPT'; ledger.activeMicroStep = null; ledger.externalLibraryAuthority31T = { step, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot, receipt: paths.receipt, focusedCheckpointOnly: true }; ledger.updatedAt = completedAt; await writeJson(full(paths.ledger), ledger);
const execution = await readJson(full(paths.execution)); Object.assign(execution, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, PPK002: 'PARTIAL', requirementCompletionClaimed: false, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt }); await writeJson(full(paths.execution), execution);
const scopeReport = await readJson(full(paths.scopeReport)); Object.assign(scopeReport, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, PPK002: 'PARTIAL', requirementCompletionClaimed: false, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', generatedAt: completedAt }); await writeJson(full(paths.scopeReport), scopeReport);
const scopeConfig = await readJson(full(paths.scopeConfig)); Object.assign(scopeConfig, { status: 'COMPLETED', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, requirementCompletionClaimed: false, completedAt }); await writeJson(full(paths.scopeConfig), scopeConfig);
const registry = await readJson(full(paths.registry)); const requirement = registry.requirements.find((item) => item.id === 'PPK-002'); assert(requirement?.status === 'PARTIAL', 'PPK-002 status changed'); for (const evidence of [paths.receipt, paths.completion, paths.transition]) if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence); await writeJson(full(paths.registry), registry);
const transitionChecks = [
  ['base package', base.every((item) => item.status === 'PASS')], ['receipt readback', stageOne.every((item) => item.status === 'PASS')],
  ['receipt persistence', stageTwo.every((item) => item.status === 'PASS')], ['final inventory', finalActual.length === finalExpected.length],
  ['work plan', step31T.status === 'COMPLETED' && step31T.persistentReceiptStatus === 'PASS'],
  ['governance', ledger.libraryUploadStatus === '31-T_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['migration boundary', scopeConfig.targets.migration === 68], ['PPK-002 partial', requirement.status === 'PARTIAL'],
  ['open boundaries', scopeConfig.openBoundaries.universalRepositoryEnforcement === 'NOT_COMPLETE' && scopeConfig.openBoundaries.obligationExecution === 'NOT_RUN_NOT_PASS'],
  ['Build boundary', completion.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '31-T transition failed');
await writeJson(full(paths.transition), { schemaVersion: 1, release, step, phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION', status: 'PASS', expected: transitionChecks.length, executed: transitionChecks.length, passed: transitionChecks.length, failed: 0, checks: transitionChecks, officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, PPK002: 'PARTIAL', requirementCompletionClaimed: false, newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth });
console.log(`31-T external USB Library receipt: PASS (${expectedBase.length}/${expectedBase.length} base files; ${finalActual.length}/${finalExpected.length} final files).`);
console.log(`Library: ${libraryRoot}`);
console.log('31-T official step status: COMPLETED; PPK-002: PARTIAL; new Build: false.');
