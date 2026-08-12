import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);

const release = 'Bronze 04.08.2026.29';
const stepId = '33-E';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\33-E_B5_Category_Life_Home_Vehicle';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\33-E_B5_Category_Life_Home_Vehicle';
const truth = 'Bu makbuz yalnız 33-E B5-04, EXT-031 ve EXT-034 kapsamındaki manuel kategori yaşam, ev ve araç kayıt akışını kapatır; dış sicil sorgusu, sağlayıcı iletişimi, ödeme yürütme, belge içeriği gösterimi veya ağ çıkışı iddiası değildir.';

const supportingPayloadPaths = Object.freeze([
  'package.json',
  'config/work-segmentation-plan.json',
  'config/active-governance-ledger.json',
  'config/accepted-scope-registry.json',
  'config/user-decision-ledger.json',
  'config/bronze-current-audit-policy.json',
  'config/33-e-b5-category-life-home-vehicle-scope.json',
  'config/33-e-b5-category-life-home-vehicle-inventory.json',
  'config/32-q-ppk-021-platform-policy-ast-allowlist.json',
  'config/32-q-ppk-021-platform-policy-ast-gate-scope.json',
  'config/32-q-ppk-021-platform-policy-ast-gate-inventory.json',
  'docs/decisions/DEC-216-b5-category-life-home-vehicle.md',
  'docs/security/THREAT_MODEL_33_E_B5_CATEGORY_LIFE_HOME_VEHICLE.md',
  'docs/audit/33-E_B5_CATEGORY_LIFE_HOME_VEHICLE_UST_KAPANIS.md',
  'docs/10_MASTER_DECISION_REGISTER.md',
  'artifacts/validation/33-E-b5-category-life-home-vehicle-boundary.json',
  'artifacts/validation/33-E-b5-category-life-home-vehicle-contract.json',
  'artifacts/validation/33-E-b5-category-life-home-vehicle-runtime.json',
  'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  'artifacts/validation/platform-policy-ast-gate.json',
  'artifacts/validation/32-Q-ppk-021-platform-policy-ast-gate-contract.json',
  'packages/domain/src/app-data.ts',
  'packages/domain/src/platform-policy-ast-gate.ts',
  'packages/application/src/life-use-cases.ts',
  'packages/application/src/life-security.ts',
  'packages/repository-contracts/src/life-repository.ts',
  'packages/repositories/src/life-repository.ts',
  'packages/database/src/family-database-migrations.ts',
  'packages/platform-policy/src/platform-policy-ast-gate-policy.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/ipc-integration-policy.ts',
  'apps/desktop/src/main/life-application-adapter.ts',
  'apps/desktop/src/main/life-production-policy-runtime.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/ManagedLifePanel.tsx',
  'packages/application/tests/managed-life-assets.test.ts',
  'packages/repositories/managed-life-repository-policy.test.ts',
  'apps/desktop/tests/b5-managed-life-ipc-integration.test.ts',
  'apps/desktop/tests/life-policy-enforcement-runtime.test.ts',
  'apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts',
  'apps/desktop/tests/data-store.test.ts',
  'scripts/verify-b5-category-life-home-vehicle-boundary.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-contract.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-runtime.mjs',
  'scripts/verify-32-q-ppk-021-platform-policy-ast-gate-contract.mjs',
  'scripts/verify-32-q-ppk-021-platform-policy-ast-gate-runtime.mjs',
  'scripts/generate-current-delivery-report.mjs',
  'scripts/lib/authorized-successor-lifecycle.mjs',
  'scripts/finalize-33-e-b5-category-life-home-vehicle-external-receipt.mjs',
  'scripts/verify-33-e-b5-category-life-home-vehicle-completion.mjs'
]);

const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  scope: 'config/33-e-b5-category-life-home-vehicle-scope.json',
  inventory: 'config/33-e-b5-category-life-home-vehicle-inventory.json',
  boundary: 'artifacts/validation/33-E-b5-category-life-home-vehicle-boundary.json',
  contract: 'artifacts/validation/33-E-b5-category-life-home-vehicle-contract.json',
  runtime: 'artifacts/validation/33-E-b5-category-life-home-vehicle-runtime.json',
  receipt: 'artifacts/checkpoints/33-E_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-E_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-E_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-E_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory: 'artifacts/validation/33-E_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  closureInventory: 'artifacts/validation/33-E_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-E_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-E_COMPLETION_TRANSITION_VALIDATION.json'
});
const proofKeys = Object.freeze([
  'receipt', 'readback', 'receiptReadback', 'persistence',
  'finalInventory', 'completion', 'transition', 'closureInventory'
]);
const proofPairPaths = Object.freeze(proofKeys.flatMap((key) => [paths[key], `${paths[key]}.sha256`]));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const writeJson = async (path, value) => writeBytes(full(path), jsonBytes(value));
const writeGovernanceJsonAtomic = async (path, value) => {
  const target = full(path);
  const temporary = resolve(root, '.tmp', '33-e-governance-commit', `${basename(path)}.${process.pid}.tmp`);
  await writeBytes(temporary, jsonBytes(value));
  await rename(temporary, target);
};
const posix = (path) => path.split(sep).join('/');
const listFiles = async (directory) => {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link forbidden: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(posix(relative(directory, path)));
    }
  };
  await visit(directory);
  return files.sort();
};
const copy = async (sourceRoot, targetRoot, path) => {
  const target = resolve(targetRoot, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, path), target);
};
const compare = async (sourceRoot, targetRoot, names) => Promise.all(names.map(async (path) => {
  const [source, target] = await Promise.all([readFile(resolve(sourceRoot, path)), readFile(resolve(targetRoot, path))]);
  const sourceHash = sha256(source);
  const targetHash = sha256(target);
  return {
    path,
    sourceSizeBytes: source.length,
    librarySizeBytes: target.length,
    sourceSha256: sourceHash,
    librarySha256: targetHash,
    status: source.length === target.length && sourceHash === targetHash ? 'PASS' : 'FAIL'
  };
}));
const bind = async (base, path) => {
  const bytes = await readFile(resolve(base, path));
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const writePair = async (path, value) => {
  const bytes = jsonBytes(value);
  const digest = sha256(bytes);
  await writeBytes(full(path), bytes);
  await writeBytes(full(`${path}.sha256`), Buffer.from(`${digest}  ${basename(path)}\n`, 'ascii'));
  return { path, sizeBytes: bytes.length, sha256: digest };
};
const copyPair = async (item) => {
  for (const targetRoot of [localPackageRoot, libraryRoot]) {
    await copy(root, targetRoot, item.path);
    await copy(root, targetRoot, `${item.path}.sha256`);
  }
};

const [planBefore, ledgerBefore, registry, scope, inventory, boundary, contract, runtime] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.scope), readJson(paths.inventory),
  readJson(paths.boundary), readJson(paths.contract), readJson(paths.runtime)
]);
const stepBefore = planBefore.steps.find((item) => item.id === stepId);
const successorBefore = planBefore.steps.find((item) => item.id === '33-F');
if (stepBefore?.status === 'COMPLETED') {
  const verification = spawnSync(process.execPath, ['scripts/verify-33-e-b5-category-life-home-vehicle-completion.mjs', '--external'], {
    cwd: root, encoding: 'utf8', windowsHide: true
  });
  if (verification.stdout) process.stdout.write(verification.stdout);
  if (verification.stderr) process.stderr.write(verification.stderr);
  assert(verification.status === 0, '33-E is completed and verify-only readback failed');
  console.log('33-E is already completed; finalizer performed verify-only readback and made no changes.');
  process.exit(0);
}
const ledgerSealedPlanPending = planBefore.currentStep === stepId
  && stepBefore?.status === 'IN_PROGRESS'
  && stepBefore.validationStatus === 'PENDING'
  && stepBefore.persistentReceiptStatus === 'PENDING'
  && stepBefore.completionTransitionStatus === 'PENDING'
  && successorBefore?.status === 'PENDING'
  && planBefore.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1
  && ledgerBefore.libraryUploadStatus === '33-E_COMPLETED_RECEIPT_PASS'
  && ledgerBefore.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_33-E_PERSISTENT_RECEIPT'
  && ledgerBefore.activeMicroStep === null
  && ledgerBefore.externalLibraryAuthority33E?.status === 'PASS'
  && ledgerBefore.externalLibraryAuthority33E?.path === libraryRoot
  && ledgerBefore.externalLibraryAuthority33E?.localCheckpointPath === localPackageRoot
  && ledgerBefore.externalLibraryAuthority33E?.receipt === paths.receipt;
if (ledgerSealedPlanPending) {
  const head = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert(head.status === 0, 'Could not resolve source commit during 33-E governance recovery');
  const recoveryReceipt = await readJson(paths.receipt);
  assert(recoveryReceipt.sourceCommit === head.stdout.trim(), '33-E recovery receipt is not bound to current HEAD');
  const verification = spawnSync(process.execPath, ['scripts/verify-33-e-b5-category-life-home-vehicle-completion.mjs', '--external', '--allow-plan-pending'], {
    cwd: root, encoding: 'utf8', windowsHide: true
  });
  if (verification.stdout) process.stdout.write(verification.stdout);
  if (verification.stderr) process.stderr.write(verification.stderr);
  assert(verification.status === 0, '33-E ledger-sealed recovery verification failed');
  Object.assign(stepBefore, {
    status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
    persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS'
  });
  for (const evidence of [paths.receipt, paths.readback, paths.receiptReadback, paths.persistence, paths.finalInventory, paths.completion, paths.transition, paths.closureInventory]) {
    if (!stepBefore.localEvidence.includes(evidence)) stepBefore.localEvidence.push(evidence);
  }
  planBefore.updatedAt = (await readJson(paths.transition)).verifiedAt;
  planBefore.segmentationNote = '33-E is immutable COMPLETED/PASS with exact D: USB hash/size readback. 33-F remains PENDING until the next governed multi-requirement slice is selected.';
  await writeGovernanceJsonAtomic(paths.plan, planBefore);
  const completedVerification = spawnSync(process.execPath, ['scripts/verify-33-e-b5-category-life-home-vehicle-completion.mjs', '--external'], {
    cwd: root, encoding: 'utf8', windowsHide: true
  });
  if (completedVerification.stdout) process.stdout.write(completedVerification.stdout);
  if (completedVerification.stderr) process.stderr.write(completedVerification.stderr);
  assert(completedVerification.status === 0, '33-E recovered completion verification failed');
  console.log('33-E governance recovery: PASS (ledger-sealed plan transition completed).');
  process.exit(0);
}
const localReady = planBefore.currentStep === stepId
  && stepBefore?.status === 'IN_PROGRESS'
  && stepBefore.validationStatus === 'PENDING'
  && stepBefore.persistentReceiptStatus === 'PENDING'
  && stepBefore.completionTransitionStatus === 'PENDING'
  && successorBefore?.status === 'PENDING'
  && planBefore.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1
  && ledgerBefore.activeMicroStep === stepId
  && ledgerBefore.libraryUploadStatus === '33-E_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
  && ledgerBefore.nextOfficialTask === '33-E B5 category-specific life, home and vehicle renewal and document workflow';
assert(localReady, '33-E is not the sole active receipt-pending step; completed steps are verify-only');
assert(scope.status === 'COMPLETE' && inventory.status === 'COMPLETE', '33-E scope or inventory is not COMPLETE');
assert([boundary, contract, runtime].every((item) => item.status === 'PASS'), '33-E validation evidence is not clean PASS');
assert(boundary.checksFailed === 0 && contract.checksFailed === 0 && runtime.checksFailed === 0, '33-E validation contains failures');
assert(
  scope.truth?.dataSource === 'manual'
    && scope.truth.externalRegistryLookup === 'not_performed'
    && scope.truth.providerContact === 'not_performed'
    && scope.truth.paymentExecution === 'not_performed'
    && scope.truth.documentContentExposure === 'not_performed'
    && scope.truth.networkEgressAdded === false,
  '33-E manual-only truth changed'
);
const finalEvidence = scope.validation?.finalEvidence;
assert(
  finalEvidence?.boundaryChecksPassed === 51
    && finalEvidence.contractChecksPassed === 15
    && finalEvidence.runtimeChecksPassed === 11
    && finalEvidence.targetedTestsPassed === 25
    && finalEvidence.fullVitestTestsPassed === 956
    && finalEvidence.productionWorkspaceBuildsPassed === 18
    && finalEvidence.finalClosureEvidence === true,
  '33-E declared final evidence counts changed'
);
const registryRequirements = ['B5-04', 'EXT-031', 'EXT-034'].map((id) => registry.requirements.find((item) => item.id === id));
assert(registryRequirements.every((item) => item?.status === 'COMPLETE'), 'B5-04/EXT-031/EXT-034 registry status is not COMPLETE');
assert(registryRequirements.every((item) => Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every((value) => value === true)), 'B5-04/EXT-031/EXT-034 registry chain is not exact 13/13');

const git = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
assert(git.status === 0, 'Could not resolve source commit');
const sourceCommit = git.stdout.trim();
assert(/^[0-9a-f]{40}$/u.test(sourceCommit), 'Source commit is invalid');
const status = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'status', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true });
assert(status.status === 0 && status.stdout.trim() === '', '33-E finalization requires a clean committed source tree');
const trackedSnapshot = spawnSync('git', [
  '-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', 'ls-tree', '-r', '--name-only', 'HEAD'
], { cwd: root, encoding: 'utf8', windowsHide: true });
assert(trackedSnapshot.status === 0, 'Could not enumerate the exact 33-E tracked source snapshot');
const trackedPaths = trackedSnapshot.stdout.trim().split(/\r?\n/u).filter(Boolean).sort();
assert(trackedPaths.length > 0 && new Set(trackedPaths).size === trackedPaths.length, '33-E tracked source snapshot is empty or contains duplicate paths');
const payloadPaths = [...new Set([...trackedPaths, ...supportingPayloadPaths])].sort();
assert(
  trackedPaths.every((path) => payloadPaths.includes(path))
    && supportingPayloadPaths.every((path) => payloadPaths.includes(path)),
  '33-E payload does not cover the exact tracked source snapshot and required evidence'
);

await mkdir(join(localPackageRoot, 'payload'), { recursive: true });
const payload = [];
for (const sourcePath of payloadPaths) {
  const bytes = await readFile(full(sourcePath));
  const packagePath = `payload/${sourcePath}`;
  await writeBytes(resolve(localPackageRoot, packagePath), bytes);
  payload.push({ sourcePath, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const manifestName = '33-E_CHECKPOINT_MANIFEST.json';
const manifest = {
  schemaVersion: 1,
  release,
  step: stepId,
  requirements: ['B5-04', 'EXT-031', 'EXT-034'],
  phase: 'B5_CATEGORY_LIFE_HOME_VEHICLE_CHECKPOINT_PACKAGE',
  status: 'PASS',
  sourceCommit,
  payloadMode: 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_REQUIRED_UNTRACKED_EVIDENCE',
  trackedSourceFileCount: trackedPaths.length,
  supplementalEvidenceFileCount: payloadPaths.length - trackedPaths.length,
  payloadCount: payload.length,
  payload,
  validation: { boundary: '51/51', contract: '15/15', runtime: '11/11', targetedTests: '25/25', fullTests: '956/956', builds: '18/18' },
  manualOnlyBoundary: true,
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  requirementCompletionClaimed: true,
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  createdAt: new Date().toISOString(),
  mandatoryTruthSentence: truth
};
const manifestBytes = jsonBytes(manifest);
const manifestHash = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes);
await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestHash}  ${manifestName}\n`, 'ascii'));
const expectedBase = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort();
const localBaseActual = (await listFiles(localPackageRoot)).filter((path) => !proofPairPaths.includes(path)).sort();
assert(JSON.stringify(localBaseActual) === JSON.stringify(expectedBase), 'Local 33-E checkpoint base set is not exact');

await mkdir(libraryRoot, { recursive: true });
for (const path of expectedBase) await copy(localPackageRoot, libraryRoot, path);
const baseReadback = await compare(localPackageRoot, libraryRoot, expectedBase);
assert(baseReadback.every((item) => item.status === 'PASS'), 'D: 33-E base package readback mismatch');

const readback = await writePair(paths.readback, {
  schemaVersion: 1, release, step: stepId, status: 'PASS', countsAsPass: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  expected: expectedBase.length, executed: baseReadback.length, matched: baseReadback.length, failed: 0,
  sourceCommit, manifestSha256: manifestHash, artifacts: baseReadback,
  verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
const receipt = await writePair(paths.receipt, {
  schemaVersion: 1, release, step: stepId, requirements: ['B5-04', 'EXT-031', 'EXT-034'], status: 'PASS',
  validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED',
  officialCompletionClaimed: true, requirementCompletionClaimed: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK', sourceCommit,
  basePackage: { expected: expectedBase.length, matched: expectedBase.length, failed: 0, manifestSha256: manifestHash, status: 'PASS' },
  libraryReadbackVerification: readback, dataSource: 'manual', externalRegistryLookup: 'not_performed',
  providerContact: 'not_performed', paymentExecution: 'not_performed', documentContentExposure: 'not_performed',
  networkEgressAdded: false, nextOfficialStep: '33-F', newBuildIssued: false,
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(readback);
await copyPair(receipt);
const receiptPaths = [paths.readback, `${paths.readback}.sha256`, paths.receipt, `${paths.receipt}.sha256`];
const receiptArtifacts = await compare(root, libraryRoot, receiptPaths);
assert(receiptArtifacts.every((item) => item.status === 'PASS'), 'D: 33-E receipt readback mismatch');
const receiptReadback = await writePair(paths.receiptReadback, {
  schemaVersion: 1, release, step: stepId, status: 'PASS', expected: receiptPaths.length,
  executed: receiptPaths.length, matched: receiptPaths.length, failed: 0, artifacts: receiptArtifacts,
  sourceCommit, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(receiptReadback);

const persistencePaths = [paths.receiptReadback, `${paths.receiptReadback}.sha256`];
const persistenceArtifacts = await compare(root, libraryRoot, persistencePaths);
assert(persistenceArtifacts.every((item) => item.status === 'PASS'), 'D: 33-E receipt persistence mismatch');
const persistence = await writePair(paths.persistence, {
  schemaVersion: 1, release, step: stepId, status: 'PASS', expected: persistencePaths.length,
  executed: persistencePaths.length, matched: persistencePaths.length, failed: 0, artifacts: persistenceArtifacts,
  sourceCommit, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(persistence);

const supplementPairs = [readback, receipt, receiptReadback, persistence];
const futureClosureNames = [
  paths.completion, `${paths.completion}.sha256`, paths.transition, `${paths.transition}.sha256`,
  paths.closureInventory, `${paths.closureInventory}.sha256`
];
const inventoryNames = [paths.finalInventory, `${paths.finalInventory}.sha256`, ...futureClosureNames];
const expectedBeforeInventory = [...expectedBase, ...supplementPairs.flatMap((item) => [item.path, `${item.path}.sha256`])].sort();
const actualBeforeInventory = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(actualBeforeInventory) === JSON.stringify(expectedBeforeInventory), 'D: 33-E pre-inventory set is not exact');
const finalInventory = await writePair(paths.finalInventory, {
  schemaVersion: 1, release, step: stepId, status: 'PASS', countsAsPass: true,
  officialCompletionClaimed: false, requirementCompletionClaimed: true, libraryPath: libraryRoot,
  expectedFilesBeforeInventory: expectedBeforeInventory.length, actualFilesBeforeInventory: actualBeforeInventory.length,
  finalExpectedFilesIncludingInventoryPair: expectedBeforeInventory.length + 2,
  filesBeforeInventory: await Promise.all(actualBeforeInventory.map((path) => bind(libraryRoot, path))),
  sourceCommit, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(finalInventory);
const baseFinalExpected = [...expectedBeforeInventory, paths.finalInventory, `${paths.finalInventory}.sha256`].sort();
const baseFinalActual = (await listFiles(libraryRoot)).filter((path) => !futureClosureNames.includes(path)).sort();
assert(JSON.stringify(baseFinalActual) === JSON.stringify(baseFinalExpected), 'D: 33-E base final inventory set is not exact');
const finalInventoryArtifacts = await compare(root, libraryRoot, [paths.finalInventory, `${paths.finalInventory}.sha256`]);
assert(finalInventoryArtifacts.every((item) => item.status === 'PASS'), 'D: 33-E final inventory pair readback mismatch');

const completedAt = new Date().toISOString();
const completion = await writePair(paths.completion, {
  schemaVersion: 1, release, step: stepId, requirements: ['B5-04', 'EXT-031', 'EXT-034'], status: 'PASS',
  officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true, requirementCompletionClaimed: true,
  persistentReceiptPath: paths.receipt, libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', sourceCommit,
  externalInventory: {
    baseExpectedFiles: baseFinalExpected.length, baseActualFiles: baseFinalActual.length, baseStatus: 'PASS',
    expectedFilesAfterClosureSeal: baseFinalExpected.length + 6, closureInventoryPath: paths.closureInventory,
    closureSealRequired: true
  },
  evidence: [...supplementPairs, finalInventory], dataSource: 'manual', externalRegistryLookup: 'not_performed',
  providerContact: 'not_performed', paymentExecution: 'not_performed', documentContentExposure: 'not_performed',
  networkEgressAdded: false, nextOfficialStep: '33-F', newBuildIssued: false,
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  completedAt, mandatoryTruthSentence: truth
});

const plan = await readJson(paths.plan);
const step = plan.steps.find((item) => item.id === stepId);
assert(step, '33-E work step is missing');
Object.assign(step, {
  status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
  persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS'
});
for (const evidence of [paths.receipt, paths.readback, paths.receiptReadback, paths.persistence, paths.finalInventory, paths.completion, paths.transition, paths.closureInventory]) {
  if (!step.localEvidence.includes(evidence)) step.localEvidence.push(evidence);
}
plan.updatedAt = completedAt;
plan.segmentationNote = '33-E is immutable COMPLETED/PASS with exact D: USB hash/size readback. 33-F remains PENDING until the next governed multi-requirement slice is selected.';

const ledger = await readJson(paths.ledger);
ledger.libraryUploadStatus = '33-E_COMPLETED_RECEIPT_PASS';
ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_33-E_PERSISTENT_RECEIPT';
ledger.activeMicroStep = null;
ledger.externalLibraryAuthority33E = {
  step: stepId, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot,
  localCheckpointPath: localPackageRoot, receipt: paths.receipt, focusedCheckpointOnly: true
};
ledger.updatedAt = completedAt;

const transitionChecks = [
  ['base package exact', baseReadback.every((item) => item.status === 'PASS')],
  ['receipt readback exact', receiptArtifacts.every((item) => item.status === 'PASS')],
  ['receipt persistence exact', persistenceArtifacts.every((item) => item.status === 'PASS')],
  ['base final inventory exact', baseFinalActual.length === baseFinalExpected.length],
  ['final inventory pair readback exact', finalInventoryArtifacts.every((item) => item.status === 'PASS')],
  ['boundary PASS', boundary.status === 'PASS' && boundary.checksPassed === 51],
  ['contract PASS', contract.status === 'PASS' && contract.checksPassed === 15],
  ['runtime PASS', runtime.status === 'PASS' && runtime.checksPassed === 11],
  ['work step complete', step.status === 'COMPLETED' && step.persistentReceiptStatus === 'PASS'],
  ['ledger complete', ledger.libraryUploadStatus === '33-E_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['manual-only truth', receipt && scope.truth.dataSource === 'manual' && scope.truth.networkEgressAdded === false],
  ['next step pending', plan.steps.find((item) => item.id === '33-F')?.status === 'PENDING']
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '33-E completion transition failed');
const transition = await writePair(paths.transition, {
  schemaVersion: 1, release, step: stepId, status: 'PASS', expected: transitionChecks.length,
  executed: transitionChecks.length, passed: transitionChecks.length, failed: 0, checks: transitionChecks,
  officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', sourceCommit,
  officialCompletionClaimed: true, requirementCompletionClaimed: true, newBuildIssued: false,
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});

await copyPair(completion);
await copyPair(transition);
const closureArtifacts = await compare(root, libraryRoot, [
  paths.completion, `${paths.completion}.sha256`, paths.transition, `${paths.transition}.sha256`
]);
assert(closureArtifacts.every((item) => item.status === 'PASS'), 'D: 33-E completion/transition pair readback mismatch');

const closureInventoryNames = [paths.closureInventory, `${paths.closureInventory}.sha256`];
const expectedBeforeClosureInventory = [...baseFinalExpected,
  paths.completion, `${paths.completion}.sha256`, paths.transition, `${paths.transition}.sha256`
].sort();
const actualBeforeClosureInventory = (await listFiles(libraryRoot)).filter((path) => !closureInventoryNames.includes(path)).sort();
assert(JSON.stringify(actualBeforeClosureInventory) === JSON.stringify(expectedBeforeClosureInventory), 'D: 33-E pre-closure inventory set is not exact');
const closureInventory = await writePair(paths.closureInventory, {
  schemaVersion: 1, release, step: stepId, status: 'PASS', countsAsPass: true,
  officialCompletionClaimed: true, requirementCompletionClaimed: true,
  libraryPath: libraryRoot, expectedFilesBeforeInventory: expectedBeforeClosureInventory.length,
  actualFilesBeforeInventory: actualBeforeClosureInventory.length,
  finalExpectedFilesIncludingInventoryPair: expectedBeforeClosureInventory.length + 2,
  filesBeforeInventory: await Promise.all(actualBeforeClosureInventory.map((path) => bind(libraryRoot, path))),
  sourceCommit, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(closureInventory);
const closureInventoryArtifacts = await compare(root, libraryRoot, [paths.closureInventory, `${paths.closureInventory}.sha256`]);
assert(closureInventoryArtifacts.every((item) => item.status === 'PASS'), 'D: 33-E closure inventory pair readback mismatch');
const closureFinalExpected = [...expectedBeforeClosureInventory, paths.closureInventory, `${paths.closureInventory}.sha256`].sort();
const closureFinalActual = await listFiles(libraryRoot);
assert(JSON.stringify(closureFinalActual) === JSON.stringify(closureFinalExpected), 'D: 33-E closure inventory set is not exact');
const localClosureFinalActual = await listFiles(localPackageRoot);
assert(JSON.stringify(localClosureFinalActual) === JSON.stringify(closureFinalExpected), 'Local 33-E closure inventory set is not exact');
const localClosureReadback = await compare(localPackageRoot, libraryRoot, closureFinalExpected);
assert(localClosureReadback.every((item) => item.status === 'PASS'), 'Local and D: 33-E closure packages differ');

await writeGovernanceJsonAtomic(paths.ledger, ledger);
await writeGovernanceJsonAtomic(paths.plan, plan);

console.log(`33-E external receipt finalized: PASS (${closureFinalExpected.length} exact D: files; source ${sourceCommit}).`);
