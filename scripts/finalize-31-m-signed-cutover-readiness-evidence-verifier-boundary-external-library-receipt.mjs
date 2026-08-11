import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const release = 'Bronze 04.08.2026.29';
const step = '31-M';
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\31-M_Signed_Cutover_Readiness_Evidence_Verifier';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\31-M_Signed_Cutover_Readiness_Evidence_Verifier';
const truth = 'Bu teslim yalnız 31-M açık-anahtar doğrulama sınırını kanıtlar; üretim anahtar otoritesi, imzalayıcı, runtime bağlantısı, gerçek veri veya cutover PASS değildir.';
const payloadPaths = Object.freeze([
  'package.json',
  'docs/10_MASTER_DECISION_REGISTER.md',
  'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  'docs/decisions/DEC-173-protected-cutover-readiness-journal-port.md',
  'docs/decisions/DEC-174-signed-cutover-readiness-evidence-verifier-boundary.md',
  'docs/audit/31-M_SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_BOUNDARY.md',
  'docs/current/09_KULLANICI_KARARLARI_KAYDI.md',
  'config/work-segmentation-plan.json',
  'config/active-governance-ledger.json',
  'config/accepted-scope-registry.json',
  'config/user-decision-ledger.json',
  'config/31-m-signed-cutover-readiness-evidence-verifier-boundary-scope.json',
  'artifacts/authority/31-M_SIGNED_EVIDENCE_VERIFIER_BOUNDARY_AUTHORITY.json',
  'artifacts/validation/31-M_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/checkpoints/31-M_EXECUTION_RECORD.json',
  'artifacts/checkpoints/31-M_INITIAL_VALIDATION_FAILURES.json',
  'artifacts/inventory/31-M_SCOPE_AND_STATUS_REPORT.json',
  'artifacts/validation/31-M_SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_CONTRACT.json',
  'artifacts/validation/31-M_ROOT_TYPESCRIPT.json',
  'artifacts/validation/31-M_TARGETED_VITEST.json',
  'artifacts/validation/31-M_CORE_SERVICE_RUNTIME.json',
  'artifacts/validation/31-M_SECURITY_AND_PREDECESSOR_REGRESSION.json',
  'artifacts/validation/31-M_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-M_PRODUCTION_BUILD.json',
  'artifacts/validation/platform-policy-gate.json',
  'apps/core-service/src/signed-cutover-readiness-evidence-verifier.ts',
  'apps/core-service/src/family-data-cutover-readiness-ledger.ts',
  'apps/core-service/src/core-service-runtime.ts',
  'apps/core-service/src/index.ts',
  'apps/core-service/tests/signed-cutover-readiness-evidence-verifier.test.ts',
  'apps/core-service/tests/family-data-cutover-readiness-ledger.test.ts',
  'packages/core-service-contracts/src/index.ts',
  'scripts/lib/authorized-successor-lifecycle.mjs',
  'scripts/start-31-m-signed-cutover-readiness-evidence-verifier-boundary.mjs',
  'scripts/verify-31-m-signed-cutover-readiness-evidence-verifier-boundary-contract.mjs',
  'scripts/run-31-m-signed-cutover-readiness-evidence-verifier-local-validation.mjs',
  'scripts/finalize-31-m-signed-cutover-readiness-evidence-verifier-boundary-external-library-receipt.mjs',
  'scripts/verify-31-m-signed-cutover-readiness-evidence-verifier-boundary-completion-transition.mjs',
  'scripts/verify-31-k-monotonic-cutover-readiness-evidence-contract.mjs',
  'scripts/verify-31-k-monotonic-cutover-readiness-completion-transition.mjs',
  'scripts/verify-31-l-protected-cutover-readiness-journal-port-contract.mjs',
  'scripts/verify-31-l-protected-cutover-readiness-journal-port-completion-transition.mjs'
]);
const paths = {
  receipt: 'artifacts/checkpoints/31-M_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-M_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-M_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/31-M_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-M_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-M_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-M_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-M_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/31-M_SCOPE_AND_STATUS_REPORT.json',
  scopeConfig: 'config/31-m-signed-cutover-readiness-evidence-verifier-boundary-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeBytes = async (path, bytes) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
};
const writeJson = async (path, value) => writeBytes(path, jsonBytes(value));
const posix = (path) => path.split(sep).join('/');
const listFiles = async (directory) => {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link is forbidden in checkpoint: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(posix(relative(directory, path)));
    }
  };
  await visit(directory);
  return files.sort();
};
const bind = async (base, path) => {
  const bytes = await readFile(resolve(base, path));
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const copy = async (sourceRoot, targetRoot, path) => {
  const target = resolve(targetRoot, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, path), target);
};
const compare = async (sourceRoot, targetRoot, names) => Promise.all(names.map(async (path) => {
  const [source, target] = await Promise.all([readFile(resolve(sourceRoot, path)), readFile(resolve(targetRoot, path))]);
  const match = source.length === target.length && sha256(source) === sha256(target);
  return {
    path,
    sourceSizeBytes: source.length,
    librarySizeBytes: target.length,
    sourceSha256: sha256(source),
    librarySha256: sha256(target),
    status: match ? 'PASS' : 'FAIL'
  };
}));
const writePair = async (path, value) => {
  const bytes = jsonBytes(value);
  const digest = sha256(bytes);
  await writeBytes(full(path), bytes);
  await writeBytes(full(`${path}.sha256`), Buffer.from(`${digest}  ${basename(path)}\n`, 'ascii'));
  return { path, sizeBytes: bytes.length, sha256: digest };
};
const copyPair = async (item) => {
  await copy(root, libraryRoot, item.path);
  await copy(root, libraryRoot, `${item.path}.sha256`);
};

const validationPaths = [
  'artifacts/validation/31-M_PRIORITY_SELECTION_VALIDATION.json',
  'artifacts/validation/31-M_SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_CONTRACT.json',
  'artifacts/validation/31-M_ROOT_TYPESCRIPT.json',
  'artifacts/validation/31-M_TARGETED_VITEST.json',
  'artifacts/validation/31-M_CORE_SERVICE_RUNTIME.json',
  'artifacts/validation/31-M_SECURITY_AND_PREDECESSOR_REGRESSION.json',
  'artifacts/validation/31-M_FULL_VITEST_REGRESSION.json',
  'artifacts/validation/31-M_PRODUCTION_BUILD.json',
  'artifacts/validation/platform-policy-gate.json'
];
const [planBefore, executionBefore, ...validations] = await Promise.all([
  readJson(full(paths.plan)),
  readJson(full(paths.execution)),
  ...validationPaths.map((path) => readJson(full(path)))
]);
const stepBefore = planBefore.steps.find((item) => item.id === step);
const localPass = stepBefore?.status === 'IN_PROGRESS'
  && stepBefore.validationStatus === 'PASS'
  && stepBefore.persistentReceiptStatus === 'PENDING'
  && executionBefore.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';
const recoverable = stepBefore?.status === 'COMPLETED'
  && stepBefore.validationStatus === 'PASS'
  && stepBefore.persistentReceiptStatus === 'PASS'
  && executionBefore.status === 'PASS';
assert(localPass || recoverable, '31-M is neither local PASS awaiting receipt nor a recoverable finalization');
assert(validations.every((item) => item.status === 'PASS'), '31-M validation is not clean PASS');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true });
const payload = [];
for (const sourcePath of payloadPaths) {
  const bytes = await readFile(full(sourcePath));
  const packagePath = `payload/${sourcePath}`;
  await writeBytes(resolve(localPackageRoot, packagePath), bytes);
  payload.push({ sourcePath, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const manifest = {
  schemaVersion: 1,
  release,
  step,
  primaryRequirement: 'DHA-001',
  phase: 'SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_CHECKPOINT_PACKAGE',
  status: 'PASS',
  payloadCount: payload.length,
  payload,
  validation: executionBefore.validation,
  requirements: executionBefore.requirements,
  requirementCompletionClaimed: false,
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  newBuildIssued: false,
  createdAt: new Date().toISOString(),
  mandatoryTruthSentence: truth
};
const manifestName = '31-M_CHECKPOINT_MANIFEST.json';
const manifestBytes = jsonBytes(manifest);
const manifestDigest = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes);
await writeBytes(join(localPackageRoot, `${manifestName}.sha256`), Buffer.from(`${manifestDigest}  ${manifestName}\n`, 'ascii'));
const expectedBase = [...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`].sort();
assert(JSON.stringify(await listFiles(localPackageRoot)) === JSON.stringify(expectedBase), 'Local package set is not exact');

await mkdir(libraryRoot, { recursive: true });
for (const path of expectedBase) await copy(localPackageRoot, libraryRoot, path);
const base = await compare(localPackageRoot, libraryRoot, expectedBase);
assert(base.every((item) => item.status === 'PASS'), 'D: base readback mismatch');
const readback = await writePair(paths.readback, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_BASE_PACKAGE_READBACK', status: 'PASS', countsAsPass: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  expected: expectedBase.length, executed: base.length, matched: base.length, failed: 0, manifestSha256: manifestDigest,
  artifacts: base, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
const scopeConfigBefore = await readJson(full(paths.scopeConfig));
const receipt = await writePair(paths.receipt, {
  schemaVersion: 1, release, step, primaryRequirement: 'DHA-001', phase: 'SIGNED_CUTOVER_READINESS_EVIDENCE_VERIFIER_EXTERNAL_LIBRARY_RECEIPT',
  status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED', officialCompletionClaimed: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, physicalLibraryPath: libraryRoot, localCheckpointPath: localPackageRoot,
  verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK',
  basePackage: { expected: expectedBase.length, matched: expectedBase.length, failed: 0, manifestSha256: manifestDigest, status: 'PASS' },
  libraryReadbackVerification: readback, targetSliceStatus: 'PASS', requirementCompletionClaimed: false,
  openBoundaries: scopeConfigBefore.openBoundaries, nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-M_PERSISTENT_RECEIPT',
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  newBuildIssued: false, recordedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(readback);
await copyPair(receipt);
const stageOnePaths = [paths.readback, `${paths.readback}.sha256`, paths.receipt, `${paths.receipt}.sha256`];
const stageOne = await compare(root, libraryRoot, stageOnePaths);
assert(stageOne.every((item) => item.status === 'PASS'), 'D: receipt readback mismatch');
const receiptReadback = await writePair(paths.receiptReadback, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK', status: 'PASS',
  expected: 4, executed: 4, matched: 4, failed: 0, artifacts: stageOne, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(receiptReadback);
const stageTwoPaths = [paths.receiptReadback, `${paths.receiptReadback}.sha256`];
const stageTwo = await compare(root, libraryRoot, stageTwoPaths);
assert(stageTwo.every((item) => item.status === 'PASS'), 'D: receipt persistence mismatch');
const persistence = await writePair(paths.persistence, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_RECEIPT_READBACK_PERSISTENCE', status: 'PASS',
  expected: 2, executed: 2, matched: 2, failed: 0, artifacts: stageTwo, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(persistence);
const supplement = [readback, receipt, receiptReadback, persistence];
const beforeExpected = [...expectedBase, ...supplement.flatMap((item) => [item.path, `${item.path}.sha256`])].sort();
const inventoryNames = [paths.inventory, `${paths.inventory}.sha256`];
const beforeActual = (await listFiles(libraryRoot)).filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(beforeActual) === JSON.stringify(beforeExpected), 'D: pre-inventory set is not exact');
const inventory = await writePair(paths.inventory, {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_USB_LIBRARY_FINAL_INVENTORY', status: 'PASS', countsAsPass: true,
  libraryPath: libraryRoot, expectedFilesBeforeInventory: beforeExpected.length, actualFilesBeforeInventory: beforeActual.length,
  finalExpectedFilesIncludingInventoryPair: beforeExpected.length + 2,
  filesBeforeInventory: await Promise.all(beforeActual.map((path) => bind(libraryRoot, path))),
  requirementCompletionClaimed: false, officialCompletionClaimed: true, newBuildIssued: false,
  verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
await copyPair(inventory);
const finalExpected = [...beforeExpected, paths.inventory, `${paths.inventory}.sha256`].sort();
const finalActual = await listFiles(libraryRoot);
assert(JSON.stringify(finalActual) === JSON.stringify(finalExpected), 'D: final inventory is not exact');

const completedAt = new Date().toISOString();
const completion = {
  schemaVersion: 1, release, step, primaryRequirement: 'DHA-001', requirements: executionBefore.requirements,
  status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
  persistentReceiptPath: paths.receipt, libraryPath: libraryRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE',
  externalInventory: { expectedFiles: finalExpected.length, actualFiles: finalActual.length, status: 'PASS' },
  evidence: [...supplement, inventory], targetSliceStatus: 'PASS', requirementCompletionClaimed: false,
  nextOfficialStep: 'AUTO_PRIORITY_SELECTION_AFTER_31-M_PERSISTENT_RECEIPT',
  currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  newBuildIssued: false, completedAt, mandatoryTruthSentence: truth
};
await writeJson(full(paths.completion), completion);
const plan = await readJson(full(paths.plan));
const step31M = plan.steps.find((item) => item.id === step);
Object.assign(step31M, {
  status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
  persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS'
});
for (const path of [paths.receipt, paths.readback, paths.receiptReadback, paths.persistence, paths.inventory, paths.completion, paths.transition]) {
  if (!step31M.localEvidence.includes(path)) step31M.localEvidence.push(path);
}
plan.updatedAt = completedAt;
plan.segmentationNote = '31-M signed readiness-evidence verifier boundary is immutable COMPLETED/PASS with exact D: USB readback. Production key authority, signer, and runtime attachment remain detached; DEC-171 cutover, real family-data transfer, and SQLite ownership transfer remain blocked.';
await writeJson(full(paths.plan), plan);
const ledger = await readJson(full(paths.ledger));
ledger.libraryUploadStatus = '31-M_COMPLETED_RECEIPT_PASS';
ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_31-M_PERSISTENT_RECEIPT';
ledger.activeMicroStep = null;
ledger.externalLibraryAuthority31M = {
  step, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot,
  receipt: paths.receipt, focusedCheckpointOnly: true
};
ledger.updatedAt = completedAt;
await writeJson(full(paths.ledger), ledger);
const execution = await readJson(full(paths.execution));
Object.assign(execution, {
  status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt,
  officialCompletionClaimed: true, requirementCompletionClaimed: false, libraryPath: libraryRoot,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt
});
await writeJson(full(paths.execution), execution);
const scopeReport = await readJson(full(paths.scope));
Object.assign(scopeReport, {
  status: 'PASS', officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', persistentReceiptPath: paths.receipt,
  officialCompletionClaimed: true, requirementCompletionClaimed: false, libraryPath: libraryRoot,
  storageBackend: 'EXTERNAL_USB_D_DRIVE', generatedAt: completedAt
});
await writeJson(full(paths.scope), scopeReport);
const scopeConfig = await readJson(full(paths.scopeConfig));
Object.assign(scopeConfig, {
  status: 'COMPLETED', targetSliceStatus: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true, requirementCompletionClaimed: false, completedAt
});
await writeJson(full(paths.scopeConfig), scopeConfig);
const checks = [
  ['base package', base.every((item) => item.status === 'PASS')],
  ['receipt readback', stageOne.every((item) => item.status === 'PASS')],
  ['receipt persistence', stageTwo.every((item) => item.status === 'PASS')],
  ['final inventory', finalActual.length === finalExpected.length],
  ['work plan', step31M.status === 'COMPLETED' && step31M.persistentReceiptStatus === 'PASS'],
  ['governance', ledger.libraryUploadStatus === '31-M_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null],
  ['public-key-only boundary', scopeConfig.targets.publicKeyInput === 'PUBLIC_KEY_KEYOBJECT_ONLY_NO_PEM_OR_PRIVATE_KEY_INPUT'],
  ['production key authority detached', scopeConfig.openBoundaries.productionVerifierKeyAuthority === 'NOT_ATTACHED_DEFAULT_DENY'],
  ['DEC-171 boundary', completion.requirementCompletionClaimed === false && scopeConfig.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED'],
  ['SQLite boundary', scopeConfig.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED'],
  ['Build boundary', completion.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-M transition failed');
await writeJson(full(paths.transition), {
  schemaVersion: 1, release, step, phase: 'EXTERNAL_LIBRARY_RECEIPT_COMPLETION_TRANSITION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks,
  officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
  requirementCompletionClaimed: false, newBuildIssued: false, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
});
console.log(`31-M external USB Library receipt: PASS (${expectedBase.length}/${expectedBase.length} base files; ${finalActual.length}/${finalExpected.length} final files).`);
console.log(`Library: ${libraryRoot}`);
console.log('31-M official step status: COMPLETED; production key authority/signer/runtime: DETACHED; DEC-171 cutover: BLOCKED; new Build: false.');
