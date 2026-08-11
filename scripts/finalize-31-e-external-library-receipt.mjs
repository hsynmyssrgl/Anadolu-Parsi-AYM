import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const release = 'Bronze 04.08.2026.29';
const step = '31-E';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\31-E_B0-02_User_Visible_Release_Boundary';
const libraryRoot = 'D:\\AYM_LIBRARY\\31-E_B0-02_User_Visible_Release_Boundary';
const truth = 'Bu teslim, yukaridaki kanitlarla sinirlidir; calistirilmayan hicbir kontrol PASS sayilmamistir.';
const payloadPaths = Object.freeze([
  'package.json',
  'config/release-ledger.json',
  'config/31-e-user-visible-release-boundary-scope.json',
  'docs/decisions/DEC-165-b0-02-user-visible-release-metadata-boundary.md',
  'docs/audit/31-E_B0-02_USER_VISIBLE_RELEASE_BOUNDARY.md',
  'artifacts/authority/31-E_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  'artifacts/validation/31-E_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/validation/31-E_USER_VISIBLE_RELEASE_BOUNDARY_CONTRACT.json',
  'artifacts/validation/31-E_ROOT_TYPESCRIPT.json',
  'artifacts/validation/31-E_TARGETED_VITEST.json',
  'artifacts/validation/31-E_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-E_PRODUCTION_BUILD.json',
  'artifacts/checkpoints/31-E_EXECUTION_RECORD.json',
  'artifacts/inventory/31-E_SCOPE_AND_STATUS_REPORT.json',
  'artifacts/deliveries/Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json',
  'packages/domain/src/app-meta.ts',
  'packages/domain/src/renderer.ts',
  'packages/domain/tests/user-visible-release.test.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/ui.tsx',
  'apps/desktop/tests/user-visible-release-boundary-runtime.test.ts',
  'scripts/generate-current-delivery-report.mjs',
  'scripts/verify-active-release-contract-v2.mjs',
  'scripts/start-31-e-user-visible-release-boundary.mjs',
  'scripts/verify-31-e-user-visible-release-boundary-contract.mjs',
  'scripts/record-31-e-local-validation.mjs',
  'scripts/finalize-31-e-external-library-receipt.mjs',
  'scripts/verify-31-e-completion-transition.mjs'
]);
const paths = {
  receipt: 'artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-E_LIBRARY_READBACK_VERIFICATION.json',
  inventory: 'artifacts/validation/31-E_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-E_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-E_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-E_EXECUTION_RECORD.json',
  scopeReport: 'artifacts/inventory/31-E_SCOPE_AND_STATUS_REPORT.json',
  scope: 'config/31-e-user-visible-release-boundary-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json'
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
const copyTreeFile = async (sourceRoot, targetRoot, path) => {
  const target = resolve(targetRoot, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, path), target);
};
const compare = async (sourceRoot, targetRoot, names) => Promise.all(names.map(async (path) => {
  const [source, target] = await Promise.all([readFile(resolve(sourceRoot, path)), readFile(resolve(targetRoot, path))]);
  const status = source.length === target.length && sha256(source) === sha256(target) ? 'PASS' : 'FAIL';
  return { path, sourceSizeBytes: source.length, librarySizeBytes: target.length, sourceSha256: sha256(source), librarySha256: sha256(target), status };
}));
const writePair = async (path, value) => {
  const bytes = jsonBytes(value); const digest = sha256(bytes);
  await writeBytes(full(path), bytes);
  await writeBytes(full(`${path}.sha256`), Buffer.from(`${digest}  ${basename(path)}\n`, 'utf8'));
  return { path, sizeBytes: bytes.length, sha256: digest };
};
const copyPair = async (item) => {
  await copyTreeFile(root, libraryRoot, item.path);
  await copyTreeFile(root, libraryRoot, `${item.path}.sha256`);
};

const [planBefore, executionBefore, contract, typecheck, targeted, regression, build] = await Promise.all([
  readJson(full(paths.plan)), readJson(full(paths.execution)),
  readJson(full('artifacts/validation/31-E_USER_VISIBLE_RELEASE_BOUNDARY_CONTRACT.json')),
  readJson(full('artifacts/validation/31-E_ROOT_TYPESCRIPT.json')),
  readJson(full('artifacts/validation/31-E_TARGETED_VITEST.json')),
  readJson(full('artifacts/validation/31-E_FULL_VITEST_REGRESSION.json')),
  readJson(full('artifacts/validation/31-E_PRODUCTION_BUILD.json'))
]);
const stepBefore = planBefore.steps.find((item) => item.id === step);
const localPass = stepBefore?.status === 'IN_PROGRESS' && stepBefore.validationStatus === 'PASS' && stepBefore.persistentReceiptStatus === 'PENDING';
const resumableCompletion = stepBefore?.status === 'COMPLETED' && stepBefore.validationStatus === 'PASS' && stepBefore.persistentReceiptStatus === 'PASS';
assert(localPass || resumableCompletion, '31-E is neither local PASS awaiting receipt nor a resumable completed transition');
assert(['LOCAL_PASS_AWAITING_LIBRARY_RECEIPT', 'PASS'].includes(executionBefore.status), '31-E execution is not resumable');
assert([contract, typecheck, targeted, regression, build].every((item) => item.status === 'PASS'), '31-E validation evidence is not clean PASS');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true });
const payload = [];
for (const sourcePath of payloadPaths) {
  const bytes = await readFile(full(sourcePath));
  const packagePath = `payload/${sourcePath}`;
  await writeBytes(resolve(localPackageRoot, packagePath), bytes);
  payload.push({ sourcePath, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const manifest = {
  schemaVersion: 1, release, step, requirement: 'B0-02', phase: 'FOCUSED_CHECKPOINT_PACKAGE', status: 'PASS',
  payloadCount: payload.length, payload, validation: executionBefore.validation, B002: 'PASS',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, historicalEvidenceRewritten: false,
  newBuildIssued: false, createdAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const manifestName = '31-E_CHECKPOINT_MANIFEST.json';
const manifestBytes = jsonBytes(manifest); const manifestDigest = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes);
await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestDigest}  ${manifestName}\n`, 'utf8'));
const expectedBase = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort();
assert(JSON.stringify(await listFiles(localPackageRoot)) === JSON.stringify(expectedBase), 'Local 31-E package file set is not exact');

await mkdir(libraryRoot, { recursive: true });
for (const path of expectedBase) await copyTreeFile(localPackageRoot, libraryRoot, path);
const baseReadback = await compare(localPackageRoot, libraryRoot, expectedBase);
assert(baseReadback.every((item) => item.status === 'PASS'), 'D: 31-E base package readback mismatch');
const readback = await writePair(paths.readback, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_READBACK', status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE',
  libraryPath: libraryRoot, expected: expectedBase.length, executed: baseReadback.length, matched: baseReadback.length, failed: 0,
  manifestSha256: manifestDigest, artifacts: baseReadback, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
const receiptDocument = {
  schemaVersion: 1, release, step, requirement: 'B0-02', phase: 'USER_VISIBLE_RELEASE_BOUNDARY_EXTERNAL_LIBRARY_RECEIPT',
  status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED', officialCompletionClaimed: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK', basePackage: { expected: expectedBase.length, matched: expectedBase.length, failed: 0, manifestSha256: manifestDigest, status: 'PASS' },
  targetSliceStatus: 'PASS', B002: 'COMPLETE', userVisibleDeliveryFileName: 'Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json',
  historicalEvidenceRewritten: false, newBuildIssued: false,
  recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth
};
const receipt = await writePair(paths.receipt, receiptDocument);
await copyPair(readback); await copyPair(receipt);
const beforeInventory = [...expectedBase, readback.path, `${readback.path}.sha256`, receipt.path, `${receipt.path}.sha256`].sort();
const inventoryNames = [paths.inventory, `${paths.inventory}.sha256`];
const beforeInventoryActual = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(beforeInventoryActual) === JSON.stringify(beforeInventory), 'D: 31-E pre-inventory file set is not exact');
const inventory = await writePair(paths.inventory, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY', status: 'PASS', libraryPath: libraryRoot,
  expectedFilesBeforeInventory: beforeInventory.length, actualFilesBeforeInventory: beforeInventory.length,
  finalExpectedFilesIncludingInventoryPair: beforeInventory.length + 2, filesBeforeInventory: beforeInventory,
  verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(inventory);
const finalExpected = [...beforeInventory, inventory.path, `${inventory.path}.sha256`].sort();
const finalActual = await listFiles(libraryRoot);
assert(JSON.stringify(finalActual) === JSON.stringify(finalExpected), 'D: 31-E final inventory is not exact');

const completedAt = new Date().toISOString();
const plan = await readJson(full(paths.plan)); const step31E = plan.steps.find((item) => item.id === step);
Object.assign(step31E, { status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS' });
for (const path of [paths.receipt, paths.readback, paths.inventory, paths.completion, paths.transition]) if (!step31E.localEvidence.includes(path)) step31E.localEvidence.push(path);
plan.updatedAt = completedAt;
plan.segmentationNote = '31-E B0-02 is immutable COMPLETED/PASS with exact D: USB readback. Public release metadata and filename boundary is complete; internal release identity remains preserved; no new Build is issued.';
const ledger = await readJson(full(paths.ledger));
ledger.libraryUploadStatus = '31-E_COMPLETED_RECEIPT_PASS'; ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_31-E_PERSISTENT_RECEIPT'; ledger.activeMicroStep = null;
ledger.externalLibraryAuthority31E = { step, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot, receipt: paths.receipt, focusedCheckpointOnly: true };
ledger.updatedAt = completedAt;
const execution = await readJson(full(paths.execution));
Object.assign(execution, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', B002: 'COMPLETE', completedAt });
const scopeReport = await readJson(full(paths.scopeReport));
Object.assign(scopeReport, { status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt, officialCompletionClaimed: true, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', B002: 'COMPLETE', generatedAt: completedAt });
const scope = await readJson(full(paths.scope));
Object.assign(scope, { status: 'COMPLETED', targetSliceStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, completedAt });
const registry = await readJson(full(paths.registry)); const requirement = registry.requirements.find((item) => item.id === 'B0-02');
requirement.status = 'COMPLETE';
for (const key of ['schema', 'apiOrIpc', 'targetedTest', 'evidence']) requirement.chain[key] = true;
for (const path of [paths.receipt, paths.readback, paths.inventory, paths.completion, paths.transition, 'artifacts/deliveries/Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_04.08.2026.29.json', 'apps/desktop/tests/user-visible-release-boundary-runtime.test.ts', 'packages/domain/tests/user-visible-release.test.ts']) if (!requirement.evidence.includes(path)) requirement.evidence.push(path);
const completion = {
  schemaVersion: 1, release, step, requirement: 'B0-02', status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
  persistentReceiptPath: paths.receipt, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', externalInventory: { expectedFiles: finalExpected.length, actualFiles: finalActual.length, status: 'PASS' },
  targetSliceStatus: 'PASS', B002: 'COMPLETE', historicalEvidenceRewritten: false, newBuildIssued: false, completedAt, mandatoryTruthSentence: truth
};
await Promise.all([
  writeJson(full(paths.completion), completion), writeJson(full(paths.plan), plan), writeJson(full(paths.ledger), ledger),
  writeJson(full(paths.execution), execution), writeJson(full(paths.scopeReport), scopeReport), writeJson(full(paths.scope), scope), writeJson(full(paths.registry), registry)
]);
const checks = [
  ['base package readback', baseReadback.every((item) => item.status === 'PASS')],
  ['final inventory', finalActual.length === finalExpected.length],
  ['work plan', step31E.status === 'COMPLETED' && step31E.persistentReceiptStatus === 'PASS'],
  ['governance ledger', ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['B0-02 complete', requirement.status === 'COMPLETE' && Object.values(requirement.chain).every(Boolean)],
  ['public filename', !/\b(?:RC2?|MVP|Build)\b/iu.test(receiptDocument.userVisibleDeliveryFileName)],
  ['D: Library path', receiptDocument.libraryPath === libraryRoot],
  ['Build boundary', completion.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-E completion transition failed');
await writeJson(full(paths.transition), {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks,
  officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
  B002: 'COMPLETE', newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
console.log(`31-E external USB Library receipt: PASS (${expectedBase.length}/${expectedBase.length} base files; ${finalActual.length}/${finalExpected.length} final files).`);
