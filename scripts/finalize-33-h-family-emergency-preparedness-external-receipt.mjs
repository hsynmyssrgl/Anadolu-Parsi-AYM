import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--dry-run']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) {
  throw new Error('Unsupported 33-H finalizer argument');
}
const dryRun = process.argv.includes('--dry-run');
const release = 'Bronze 04.08.2026.29';
const stepId = '33-H';
const successorId = '33-I';
const decision = 'DEC-219';
const requirements = Object.freeze(['EXT-011', 'EXT-015']);
const expectedEvidence = Object.freeze({
  boundaryChecksPassed: 52,
  contractChecksPassed: 15,
  runtimeChecksPassed: 11,
  targetedTestFilesPassed: 3,
  targetedTestsPassed: 14,
  ppk021ExactAllowlistEntries: 545,
  ppk021UseCaseCompositionSurfaces: 277,
  ppk022CapabilitySurfaces: 242,
  latestDatabaseMigration: 86,
  requirementChainsComplete: 2
});
const expectedMigrationChecksum = 'ba95e841da7a08977d50e0c9cb441e0743af6fdcb1c6dee9c42bb136e20183dc';
const predecessorReceiptPath = 'artifacts/checkpoints/33-G_LIBRARY_RECEIPT.json';
const predecessorReceiptSidecarPath = `${predecessorReceiptPath}.sha256`;
const localPackageRoot = 'C:\\PPT\\AYM\\09_ARSIV\\KAYNAK_AGACI\\checkpoints\\33-H_Family_Emergency_Preparedness';
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\33-H_Family_Emergency_Preparedness';
const truth = 'Bu makbuz yalnız 33-H EXT-011 ve EXT-015 kapsamındaki manuel, çevrimdışı aile acil durum hazırlık kitleri, kit malzemeleri, stok ve son kullanma kontrolleri ile tatbikat geçmişini kapatır; barkod sorgusu, son kullanma doğrulaması, bildirim teslimi, sensör entegrasyonu, hazır olma garantisi veya ağ çıkışı iddiası değildir.';
const evidenceTriplet = Object.freeze([
  'artifacts/validation/33-H-family-emergency-preparedness-boundary.json',
  'artifacts/validation/33-H-family-emergency-preparedness-contract.json',
  'artifacts/validation/33-H-family-emergency-preparedness-runtime.json'
]);

const supportingPayloadPaths = Object.freeze([
  'package.json',
  'pnpm-lock.yaml',
  'config/work-segmentation-plan.json',
  'config/active-governance-ledger.json',
  'config/accepted-scope-registry.json',
  'config/user-decision-ledger.json',
  'config/bronze-current-audit-policy.json',
  'config/33-h-family-emergency-preparedness-scope.json',
  'config/33-h-family-emergency-preparedness-inventory.json',
  'config/32-q-ppk-021-platform-policy-ast-allowlist.json',
  'config/32-q-ppk-021-platform-policy-ast-gate-scope.json',
  'config/32-q-ppk-021-platform-policy-ast-gate-inventory.json',
  'docs/decisions/DEC-219-family-emergency-preparedness-kits-and-drills.md',
  'docs/security/THREAT_MODEL_33_H_FAMILY_EMERGENCY_PREPAREDNESS.md',
  'docs/audit/33-H_FAMILY_EMERGENCY_PREPAREDNESS_UST_KAPANIS.md',
  'docs/10_MASTER_DECISION_REGISTER.md',
  ...evidenceTriplet,
  predecessorReceiptPath,
  predecessorReceiptSidecarPath,
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
  'apps/desktop/src/renderer/styles.css',
  'packages/application/tests/family-emergency-preparedness.test.ts',
  'packages/repositories/family-emergency-preparedness-repository-policy.test.ts',
  'apps/desktop/tests/b5-family-emergency-preparedness-ipc-integration.test.ts',
  'packages/application/tests/managed-life-assets.test.ts',
  'packages/repositories/managed-life-repository-policy.test.ts',
  'apps/desktop/tests/b5-managed-life-ipc-integration.test.ts',
  'apps/desktop/tests/life-policy-enforcement-runtime.test.ts',
  'apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts',
  'apps/desktop/tests/data-store.test.ts',
  'scripts/verify-family-emergency-preparedness-boundary.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-contract.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-runtime.mjs',
  'scripts/verify-32-q-ppk-021-platform-policy-ast-gate-contract.mjs',
  'scripts/verify-32-q-ppk-021-platform-policy-ast-gate-runtime.mjs',
  'scripts/generate-current-delivery-report.mjs',
  'scripts/lib/authorized-successor-lifecycle.mjs',
  'scripts/finalize-33-h-family-emergency-preparedness-external-receipt.mjs',
  'scripts/verify-33-h-family-emergency-preparedness-completion.mjs'
]);

const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  scope: 'config/33-h-family-emergency-preparedness-scope.json',
  inventory: 'config/33-h-family-emergency-preparedness-inventory.json',
  boundary: evidenceTriplet[0],
  contract: evidenceTriplet[1],
  runtime: evidenceTriplet[2],
  migrationManifest: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  receipt: 'artifacts/checkpoints/33-H_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-H_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-H_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-H_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory: 'artifacts/validation/33-H_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  closureInventory: 'artifacts/validation/33-H_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-H_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-H_COMPLETION_TRANSITION_VALIDATION.json'
});
const proofKeys = Object.freeze([
  'receipt', 'readback', 'receiptReadback', 'persistence',
  'finalInventory', 'completion', 'transition', 'closureInventory'
]);
const proofPairPaths = Object.freeze(
  proofKeys.flatMap((key) => [paths[key], `${paths[key]}.sha256`])
);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const readJsonResult = async (path) => {
  try {
    return { ok: true, value: await readJson(path) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
const writeBytes = async (path, bytes) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
};
const writeGovernanceJsonAtomic = async (path, value) => {
  const target = full(path);
  const temporary = resolve(root, '.tmp', '33-h-governance-commit', `${basename(path)}.${process.pid}.tmp`);
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
      else throw new Error(`Special filesystem entry forbidden: ${path}`);
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
  const [source, target] = await Promise.all([
    readFile(resolve(sourceRoot, path)),
    readFile(resolve(targetRoot, path))
  ]);
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
const sidecarBindsExactBytes = async (path) => {
  try {
    const [bytes, sidecar] = await Promise.all([
      readFile(full(path)),
      readFile(full(`${path}.sha256`), 'utf8')
    ]);
    return sidecar === `${sha256(bytes)}  ${basename(path)}\n`;
  } catch {
    return false;
  }
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
const exactArray = (actual, expected) => Array.isArray(actual)
  && JSON.stringify(actual) === JSON.stringify(expected);
const exactTruth = (value) => value?.dataSource === 'manual'
  && value.offlineAvailability === 'local_only'
  && value.barcodeLookup === 'not_performed'
  && value.expiryVerification === 'not_performed'
  && value.notificationDelivery === 'not_performed'
  && value.sensorIntegration === 'not_performed'
  && value.readinessGuarantee === 'not_claimed'
  && value.networkEgressAdded === false;
const validationVector = (scope) => {
  const evidence = scope?.validation?.finalEvidence;
  return evidence ? Object.freeze({
    boundaryChecksPassed: evidence.boundaryChecksPassed,
    contractChecksPassed: evidence.contractChecksPassed,
    runtimeChecksPassed: evidence.runtimeChecksPassed,
    targetedTestFilesPassed: evidence.targetedTestFilesPassed,
    targetedTestsPassed: evidence.targetedTestsPassed,
    fullVitestTestFilesPassed: evidence.fullVitestTestFilesPassed,
    fullVitestTestsPassed: evidence.fullVitestTestsPassed,
    productionWorkspaceBuildsPassed: evidence.productionWorkspaceBuildsPassed,
    ppk021ExactAllowlistEntries: evidence.ppk021ExactAllowlistEntries,
    ppk021UseCaseCompositionSurfaces: evidence.ppk021UseCaseCompositionSurfaces,
    ppk022CapabilitySurfaces: evidence.ppk022CapabilitySurfaces,
    latestDatabaseMigration: evidence.latestDatabaseMigration,
    requirementChainsComplete: evidence.requirementChainsComplete
  }) : null;
};
const exactEvidence = (scope, boundary, contract, runtime, migrationManifest) => {
  const vector = validationVector(scope);
  const migration86 = migrationManifest?.migrationVersions?.find((item) => item.version === 86);
  return scope?.validation?.finalEvidence?.finalClosureEvidence === true
    && Object.values(vector ?? {}).every((value) => Number.isInteger(value) && value >= 0)
    && Object.entries(expectedEvidence).every(([key, value]) => vector?.[key] === value)
    && vector.fullVitestTestFilesPassed > 0
    && vector.fullVitestTestsPassed > 0
    && vector.productionWorkspaceBuildsPassed > 0
    && migrationManifest?.status === 'passed'
    && migration86?.name === 'b5_family_emergency_preparedness_ledger'
    && migration86?.checksum === expectedMigrationChecksum
    && boundary?.status === 'PASS' && boundary.checksFailed === 0
    && boundary.checksPassed === vector?.boundaryChecksPassed
    && boundary.ppk021ExactAllowlistEntries === expectedEvidence.ppk021ExactAllowlistEntries
    && boundary.ppk021UseCaseCompositionSurfaces === expectedEvidence.ppk021UseCaseCompositionSurfaces
    && boundary.ppk022CapabilitySurfaces === expectedEvidence.ppk022CapabilitySurfaces
    && boundary.latestDatabaseMigration === expectedEvidence.latestDatabaseMigration
    && contract?.status === 'PASS' && contract.checksFailed === 0
    && contract.checksPassed === vector?.contractChecksPassed
    && contract.migration86Checksum === expectedMigrationChecksum
    && contract.ppk021ExactAllowlistEntries === expectedEvidence.ppk021ExactAllowlistEntries
    && contract.ppk021UseCaseCompositionSurfaces === expectedEvidence.ppk021UseCaseCompositionSurfaces
    && contract.ppk022CapabilitySurfaces === expectedEvidence.ppk022CapabilitySurfaces
    && runtime?.status === 'PASS' && runtime.checksFailed === 0
    && runtime.checksPassed === vector?.runtimeChecksPassed
    && runtime.targetedTestFilesPassed === vector?.targetedTestFilesPassed
    && runtime.targetedTestsPassed === vector?.targetedTestsPassed
    && runtime.ppk021ExactAllowlistEntries === vector?.ppk021ExactAllowlistEntries
    && runtime.ppk021UseCaseCompositionSurfaces === vector?.ppk021UseCaseCompositionSurfaces
    && runtime.ppk022CapabilitySurfaces === vector?.ppk022CapabilitySurfaces
    && runtime.latestDatabaseMigration === vector?.latestDatabaseMigration;
};
const exactRegistry = (registry) => requirements.every((id) => {
  const item = registry?.requirements?.find((candidate) => candidate.id === id);
  return item?.status === 'COMPLETE'
    && Object.keys(item.chain ?? {}).length === 13
    && Object.values(item.chain).every((value) => value === true)
    && evidenceTriplet.every((path) => item.evidence?.includes(path));
});
const gitRun = (args) => spawnSync('git', [
  '-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args
], { cwd: root, encoding: 'utf8', windowsHide: true });

const documentEntries = Object.freeze([
  ['plan', paths.plan], ['ledger', paths.ledger], ['registry', paths.registry],
  ['scope', paths.scope], ['inventory', paths.inventory], ['boundary', paths.boundary],
  ['contract', paths.contract], ['runtime', paths.runtime],
  ['migrationManifest', paths.migrationManifest], ['predecessorReceipt', predecessorReceiptPath]
]);
const documentResults = Object.fromEntries(await Promise.all(
  documentEntries.map(async ([key, path]) => [key, await readJsonResult(path)])
));

if (dryRun) {
  const checks = [];
  const check = (name, passed, detail = undefined) => checks.push({
    name,
    status: passed ? 'PASS' : 'FAIL',
    ...(detail === undefined ? {} : { detail })
  });
  for (const [key, path] of documentEntries) {
    const result = documentResults[key];
    check(`${key} JSON is readable`, result.ok, result.ok ? path : result.error);
  }
  const plan = documentResults.plan.value;
  const ledger = documentResults.ledger.value;
  const scope = documentResults.scope.value;
  const inventory = documentResults.inventory.value;
  const boundary = documentResults.boundary.value;
  const contract = documentResults.contract.value;
  const runtime = documentResults.runtime.value;
  const migrationManifest = documentResults.migrationManifest.value;
  const predecessorReceipt = documentResults.predecessorReceipt.value;
  const registry = documentResults.registry.value;
  const step = plan?.steps?.find((item) => item.id === stepId);
  const successor = plan?.steps?.find((item) => item.id === successorId);
  const completed = step?.status === 'COMPLETED';
  const recovery = plan?.currentStep === stepId
    && step?.status === 'IN_PROGRESS'
    && step.validationStatus === 'PENDING'
    && step.persistentReceiptStatus === 'PENDING'
    && step.completionTransitionStatus === 'PENDING'
    && successor?.status === 'PENDING'
    && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1
    && ledger?.libraryUploadStatus === '33-H_COMPLETED_RECEIPT_PASS'
    && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_33-H_PERSISTENT_RECEIPT'
    && ledger?.activeMicroStep === null
    && ledger?.externalLibraryAuthority33H?.status === 'PASS'
    && ledger?.externalLibraryAuthority33H?.path === libraryRoot
    && ledger?.externalLibraryAuthority33H?.localCheckpointPath === localPackageRoot
    && ledger?.externalLibraryAuthority33H?.receipt === paths.receipt;
  const activeReady = plan?.currentStep === stepId
    && step?.status === 'IN_PROGRESS'
    && step.validationStatus === 'PENDING'
    && step.persistentReceiptStatus === 'PENDING'
    && step.completionTransitionStatus === 'PENDING'
    && successor?.status === 'PENDING'
    && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1
    && ledger?.activeMicroStep === stepId
    && ledger?.libraryUploadStatus === '33-H_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
    && ledger?.nextOfficialTask
      === '33-H governed offline 72-hour preparedness kits and emergency drills workflow';
  check('governance state is completed, ledger-sealed recovery, or active receipt-ready',
    completed || recovery || activeReady);
  if (completed || recovery) {
    const arguments_ = ['scripts/verify-33-h-family-emergency-preparedness-completion.mjs', '--external'];
    if (recovery) arguments_.push('--allow-plan-pending');
    const verification = spawnSync(process.execPath, arguments_, {
      cwd: root, encoding: 'utf8', windowsHide: true
    });
    check('existing completion package verifies read-only', verification.status === 0,
      `${verification.stdout ?? ''}${verification.stderr ?? ''}`.trim().slice(-2_000));
  } else {
    check('scope and inventory are exact COMPLETE', scope?.status === 'COMPLETE'
      && inventory?.status === 'COMPLETE'
      && scope?.decision === decision
      && exactArray(scope?.requirements, requirements)
      && exactArray(inventory?.requirements, requirements)
      && scope?.validation?.boundary === paths.boundary
      && scope?.validation?.contract === paths.contract
      && scope?.validation?.runtime === paths.runtime);
    check('scope truth is exact manual/local/no-external-service', exactTruth(scope?.truth));
    check('validation evidence and migration checksum are exact clean PASS',
      exactEvidence(scope, boundary, contract, runtime, migrationManifest));
    check('registry requirements are exact COMPLETE chains', exactRegistry(registry));
    const head = gitRun(['rev-parse', 'HEAD']);
    const status = gitRun(['status', '--porcelain']);
    check('HEAD is a valid commit', head.status === 0 && /^[0-9a-f]{40}$/u.test(head.stdout.trim()));
    const predecessorAncestry = /^[0-9a-f]{40}$/u.test(predecessorReceipt?.sourceCommit ?? '')
      ? gitRun(['merge-base', '--is-ancestor', predecessorReceipt.sourceCommit, 'HEAD'])
      : { status: 1 };
    check('33-G receipt sourceCommit is an ancestor base of current HEAD',
      predecessorAncestry.status === 0, predecessorReceipt?.sourceCommit);
    check('33-G predecessor receipt sidecar binds exact bytes',
      await sidecarBindsExactBytes(predecessorReceiptPath));
    check('source tree is clean and committed', status.status === 0 && status.stdout.trim() === '',
      status.stdout.trim().slice(0, 2_000));
    const payloadReads = await Promise.all(supportingPayloadPaths.map(async (path) => {
      try { await readFile(full(path)); return true; } catch { return false; }
    }));
    check('all restore-critical payload paths are readable', payloadReads.every(Boolean));
  }
  const failures = checks.filter((item) => item.status === 'FAIL');
  const line = `33-H external receipt dry audit: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${checks.length - failures.length}/${checks.length}; read-only, no files written).`;
  (failures.length === 0 ? console.log : console.error)(line);
  for (const item of failures) console.error(`- ${item.name}${item.detail ? `: ${item.detail}` : ''}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

assert(Object.values(documentResults).every((result) => result.ok),
  '33-H finalizer prerequisites are missing or unreadable');
const planBefore = documentResults.plan.value;
const ledgerBefore = documentResults.ledger.value;
const registry = documentResults.registry.value;
const scope = documentResults.scope.value;
const inventory = documentResults.inventory.value;
const boundary = documentResults.boundary.value;
const contract = documentResults.contract.value;
const runtime = documentResults.runtime.value;
const migrationManifest = documentResults.migrationManifest.value;
const predecessorReceipt = documentResults.predecessorReceipt.value;
const stepBefore = planBefore.steps.find((item) => item.id === stepId);
const successorBefore = planBefore.steps.find((item) => item.id === successorId);

if (stepBefore?.status === 'COMPLETED') {
  const verification = spawnSync(process.execPath, [
    'scripts/verify-33-h-family-emergency-preparedness-completion.mjs', '--external'
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (verification.stdout) process.stdout.write(verification.stdout);
  if (verification.stderr) process.stderr.write(verification.stderr);
  assert(verification.status === 0, '33-H is completed and verify-only readback failed');
  console.log('33-H is already completed; finalizer performed verify-only readback and made no changes.');
  process.exit(0);
}

const ledgerSealedPlanPending = planBefore.currentStep === stepId
  && stepBefore?.status === 'IN_PROGRESS'
  && stepBefore.validationStatus === 'PENDING'
  && stepBefore.persistentReceiptStatus === 'PENDING'
  && stepBefore.completionTransitionStatus === 'PENDING'
  && successorBefore?.status === 'PENDING'
  && planBefore.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1
  && ledgerBefore.libraryUploadStatus === '33-H_COMPLETED_RECEIPT_PASS'
  && ledgerBefore.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_33-H_PERSISTENT_RECEIPT'
  && ledgerBefore.activeMicroStep === null
  && ledgerBefore.externalLibraryAuthority33H?.status === 'PASS'
  && ledgerBefore.externalLibraryAuthority33H?.path === libraryRoot
  && ledgerBefore.externalLibraryAuthority33H?.localCheckpointPath === localPackageRoot
  && ledgerBefore.externalLibraryAuthority33H?.receipt === paths.receipt;
if (ledgerSealedPlanPending) {
  const head = gitRun(['rev-parse', 'HEAD']);
  assert(head.status === 0, 'Could not resolve source commit during 33-H governance recovery');
  const recoveryReceipt = await readJson(paths.receipt);
  assert(recoveryReceipt.sourceCommit === head.stdout.trim(),
    '33-H recovery receipt is not bound to current HEAD');
  const verification = spawnSync(process.execPath, [
    'scripts/verify-33-h-family-emergency-preparedness-completion.mjs',
    '--external', '--allow-plan-pending'
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (verification.stdout) process.stdout.write(verification.stdout);
  if (verification.stderr) process.stderr.write(verification.stderr);
  assert(verification.status === 0, '33-H ledger-sealed recovery verification failed');
  Object.assign(stepBefore, {
    status: 'COMPLETED',
    validationStatus: 'PASS',
    persistentReceiptStatus: 'PASS',
    persistentReceiptPath: paths.receipt,
    completionTransitionStatus: 'PASS'
  });
  stepBefore.localEvidence ??= [];
  for (const evidence of [
    paths.receipt, paths.readback, paths.receiptReadback, paths.persistence,
    paths.finalInventory, paths.completion, paths.transition, paths.closureInventory
  ]) {
    if (!stepBefore.localEvidence.includes(evidence)) stepBefore.localEvidence.push(evidence);
  }
  planBefore.updatedAt = (await readJson(paths.transition)).verifiedAt;
  planBefore.segmentationNote = '33-H is immutable COMPLETED/PASS with exact local and D: USB hash/size readback. 33-I remains PENDING for governed successor selection.';
  await writeGovernanceJsonAtomic(paths.plan, planBefore);
  const completedVerification = spawnSync(process.execPath, [
    'scripts/verify-33-h-family-emergency-preparedness-completion.mjs', '--external'
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (completedVerification.stdout) process.stdout.write(completedVerification.stdout);
  if (completedVerification.stderr) process.stderr.write(completedVerification.stderr);
  assert(completedVerification.status === 0, '33-H recovered completion verification failed');
  console.log('33-H governance recovery: PASS (ledger-sealed plan transition completed).');
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
  && ledgerBefore.libraryUploadStatus === '33-H_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'
  && ledgerBefore.nextOfficialTask
    === '33-H governed offline 72-hour preparedness kits and emergency drills workflow';
assert(localReady, '33-H is not the sole active receipt-pending step; completed steps are verify-only');
assert(scope.status === 'COMPLETE' && inventory.status === 'COMPLETE',
  '33-H scope or inventory is not COMPLETE');
assert(scope.decision === decision && exactArray(scope.requirements, requirements)
  && exactArray(inventory.requirements, requirements)
  && scope.validation?.boundary === paths.boundary
  && scope.validation?.contract === paths.contract
  && scope.validation?.runtime === paths.runtime,
'33-H DEC-219 requirement/evidence package changed');
assert(exactTruth(scope.truth), '33-H manual offline no-external-service truth changed');
assert(exactEvidence(scope, boundary, contract, runtime, migrationManifest),
  '33-H boundary, contract, runtime, targeted, full-test, or build evidence changed');
assert(exactRegistry(registry),
  'EXT-011/EXT-015 registry status, 13-link chain, or evidence changed');
const finalEvidence = validationVector(scope);

const git = gitRun(['rev-parse', 'HEAD']);
assert(git.status === 0, 'Could not resolve source commit');
const sourceCommit = git.stdout.trim();
assert(/^[0-9a-f]{40}$/u.test(sourceCommit), 'Source commit is invalid');
assert(predecessorReceipt?.step === '33-G'
  && predecessorReceipt.status === 'PASS'
  && predecessorReceipt.persistentReceiptStatus === 'PASS'
  && /^[0-9a-f]{40}$/u.test(predecessorReceipt.sourceCommit),
'33-G predecessor receipt is not an exact completed PASS source base');
assert(await sidecarBindsExactBytes(predecessorReceiptPath),
  '33-G predecessor receipt sidecar does not bind exact bytes');
const predecessorAncestry = gitRun([
  'merge-base', '--is-ancestor', predecessorReceipt.sourceCommit, sourceCommit
]);
assert(predecessorAncestry.status === 0,
  '33-G receipt sourceCommit is not an ancestor of the 33-H source commit');
const status = gitRun(['status', '--porcelain']);
assert(status.status === 0 && status.stdout.trim() === '',
  '33-H finalization requires a clean committed source tree');
const trackedSnapshot = gitRun(['ls-tree', '-r', 'HEAD']);
assert(trackedSnapshot.status === 0, 'Could not enumerate the exact 33-H tracked source snapshot');
const trackedEntries = trackedSnapshot.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
  const match = line.match(/^(\d{6}) blob ([0-9a-f]+)\t(.+)$/u);
  assert(match && (match[1] === '100644' || match[1] === '100755'),
    `33-H payload forbids non-regular tracked entries: ${line}`);
  return { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] };
});
const trackedPaths = trackedEntries.map((item) => item.sourcePath).sort();
const trackedEntryByPath = new Map(trackedEntries.map((item) => [item.sourcePath, item]));
assert(trackedPaths.length > 0 && new Set(trackedPaths).size === trackedPaths.length,
  '33-H tracked source snapshot is empty or contains duplicate paths');
const payloadPaths = [...new Set([...trackedPaths, ...supportingPayloadPaths])].sort();
assert(trackedPaths.every((path) => payloadPaths.includes(path))
  && supportingPayloadPaths.every((path) => payloadPaths.includes(path)),
'33-H payload does not cover the exact tracked source snapshot and required evidence');

await mkdir(join(localPackageRoot, 'payload'), { recursive: true });
const payload = [];
for (const sourcePath of payloadPaths) {
  const bytes = await readFile(full(sourcePath));
  const packagePath = `payload/${sourcePath}`;
  await writeBytes(resolve(localPackageRoot, packagePath), bytes);
  const trackedEntry = trackedEntryByPath.get(sourcePath);
  payload.push({
    sourcePath,
    packagePath,
    sourceClassification: trackedEntry ? 'TRACKED_HEAD' : 'SUPPLEMENTAL_REQUIRED_EVIDENCE',
    ...(trackedEntry ? { gitMode: trackedEntry.gitMode, gitObjectId: trackedEntry.gitObjectId } : {}),
    sizeBytes: bytes.length,
    sha256: sha256(bytes)
  });
}
const manifestName = '33-H_CHECKPOINT_MANIFEST.json';
const manifest = {
  schemaVersion: 1,
  release,
  step: stepId,
  decision,
  requirements,
  phase: 'FAMILY_EMERGENCY_PREPAREDNESS_CHECKPOINT_PACKAGE',
  status: 'PASS',
  sourceCommit,
  predecessorStep: '33-G',
  predecessorReceiptPath,
  predecessorSourceCommit: predecessorReceipt.sourceCommit,
  sourceCommitRange: `${predecessorReceipt.sourceCommit}..${sourceCommit}`,
  payloadMode: 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_REQUIRED_UNTRACKED_EVIDENCE',
  trackedEntryPolicy: 'REGULAR_BLOBS_ONLY_100644_OR_100755',
  trackedSourceFileCount: trackedPaths.length,
  supplementalEvidenceFileCount: payloadPaths.length - trackedPaths.length,
  payloadCount: payload.length,
  payload,
  validation: finalEvidence,
  migration86Checksum: expectedMigrationChecksum,
  manualOfflineBoundary: true,
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  requirementCompletionClaimed: true,
  currentAuthoritativeSourceExternalProtectionStatus:
    'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  createdAt: new Date().toISOString(),
  mandatoryTruthSentence: truth
};
const manifestBytes = jsonBytes(manifest);
const manifestHash = sha256(manifestBytes);
await writeBytes(join(localPackageRoot, manifestName), manifestBytes);
await writeBytes(join(localPackageRoot, `${manifestName}.sha256`),
  Buffer.from(`${manifestHash}  ${manifestName}\n`, 'ascii'));
const expectedBase = [
  ...payload.map((item) => item.packagePath), manifestName, `${manifestName}.sha256`
].sort();
const localBaseActual = (await listFiles(localPackageRoot))
  .filter((path) => !proofPairPaths.includes(path)).sort();
assert(JSON.stringify(localBaseActual) === JSON.stringify(expectedBase),
  'Local 33-H checkpoint base set is not exact');

await mkdir(libraryRoot, { recursive: true });
for (const path of expectedBase) await copy(localPackageRoot, libraryRoot, path);
const baseReadback = await compare(localPackageRoot, libraryRoot, expectedBase);
assert(baseReadback.every((item) => item.status === 'PASS'),
  'D: 33-H base package readback mismatch');

const proofCommon = Object.freeze({
  schemaVersion: 1,
  release,
  step: stepId,
  decision,
  requirements,
  sourceCommit,
  predecessorStep: '33-G',
  predecessorReceiptPath,
  predecessorSourceCommit: predecessorReceipt.sourceCommit,
  sourceCommitRange: `${predecessorReceipt.sourceCommit}..${sourceCommit}`,
  validation: finalEvidence,
  migration86Checksum: expectedMigrationChecksum,
  dataSource: 'manual',
  offlineAvailability: 'local_only',
  barcodeLookup: 'not_performed',
  expiryVerification: 'not_performed',
  notificationDelivery: 'not_performed',
  sensorIntegration: 'not_performed',
  readinessGuarantee: 'not_claimed',
  networkEgressAdded: false,
  mandatoryTruthSentence: truth
});
const readback = await writePair(paths.readback, {
  ...proofCommon,
  status: 'PASS',
  countsAsPass: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  libraryPath: libraryRoot,
  localCheckpointPath: localPackageRoot,
  expected: expectedBase.length,
  executed: baseReadback.length,
  matched: baseReadback.length,
  failed: 0,
  manifestSha256: manifestHash,
  artifacts: baseReadback,
  verifiedAt: new Date().toISOString()
});
const receipt = await writePair(paths.receipt, {
  ...proofCommon,
  status: 'PASS',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS',
  officialStepStatus: 'COMPLETED',
  officialCompletionClaimed: true,
  requirementCompletionClaimed: true,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  libraryPath: libraryRoot,
  localCheckpointPath: localPackageRoot,
  verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK',
  basePackage: {
    expected: expectedBase.length,
    matched: expectedBase.length,
    failed: 0,
    manifestSha256: manifestHash,
    status: 'PASS'
  },
  libraryReadbackVerification: readback,
  validation: finalEvidence,
  dataSource: 'manual',
  offlineAvailability: 'local_only',
  barcodeLookup: 'not_performed',
  expiryVerification: 'not_performed',
  notificationDelivery: 'not_performed',
  sensorIntegration: 'not_performed',
  readinessGuarantee: 'not_claimed',
  networkEgressAdded: false,
  nextOfficialStep: successorId,
  newBuildIssued: false,
  currentAuthoritativeSourceExternalProtectionStatus:
    'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  recordedAt: new Date().toISOString()
});
await copyPair(readback);
await copyPair(receipt);
const receiptPaths = [
  paths.readback, `${paths.readback}.sha256`, paths.receipt, `${paths.receipt}.sha256`
];
const receiptArtifacts = await compare(root, libraryRoot, receiptPaths);
assert(receiptArtifacts.every((item) => item.status === 'PASS'),
  'D: 33-H receipt readback mismatch');
const receiptReadback = await writePair(paths.receiptReadback, {
  ...proofCommon,
  status: 'PASS',
  expected: receiptPaths.length,
  executed: receiptPaths.length,
  matched: receiptPaths.length,
  failed: 0,
  artifacts: receiptArtifacts,
  verifiedAt: new Date().toISOString()
});
await copyPair(receiptReadback);

const persistencePaths = [paths.receiptReadback, `${paths.receiptReadback}.sha256`];
const persistenceArtifacts = await compare(root, libraryRoot, persistencePaths);
assert(persistenceArtifacts.every((item) => item.status === 'PASS'),
  'D: 33-H receipt persistence mismatch');
const persistence = await writePair(paths.persistence, {
  ...proofCommon,
  status: 'PASS',
  expected: persistencePaths.length,
  executed: persistencePaths.length,
  matched: persistencePaths.length,
  failed: 0,
  artifacts: persistenceArtifacts,
  verifiedAt: new Date().toISOString()
});
await copyPair(persistence);

const supplementPairs = [readback, receipt, receiptReadback, persistence];
const futureClosureNames = [
  paths.completion, `${paths.completion}.sha256`,
  paths.transition, `${paths.transition}.sha256`,
  paths.closureInventory, `${paths.closureInventory}.sha256`
];
const inventoryNames = [
  paths.finalInventory, `${paths.finalInventory}.sha256`, ...futureClosureNames
];
const expectedBeforeInventory = [
  ...expectedBase,
  ...supplementPairs.flatMap((item) => [item.path, `${item.path}.sha256`])
].sort();
const actualBeforeInventory = (await listFiles(libraryRoot))
  .filter((path) => !inventoryNames.includes(path)).sort();
assert(JSON.stringify(actualBeforeInventory) === JSON.stringify(expectedBeforeInventory),
  'D: 33-H pre-inventory set is not exact');
const finalInventory = await writePair(paths.finalInventory, {
  ...proofCommon,
  status: 'PASS',
  countsAsPass: true,
  officialCompletionClaimed: false,
  requirementCompletionClaimed: true,
  libraryPath: libraryRoot,
  expectedFilesBeforeInventory: expectedBeforeInventory.length,
  actualFilesBeforeInventory: actualBeforeInventory.length,
  finalExpectedFilesIncludingInventoryPair: expectedBeforeInventory.length + 2,
  filesBeforeInventory: await Promise.all(actualBeforeInventory.map((path) => bind(libraryRoot, path))),
  verifiedAt: new Date().toISOString()
});
await copyPair(finalInventory);
const baseFinalExpected = [
  ...expectedBeforeInventory, paths.finalInventory, `${paths.finalInventory}.sha256`
].sort();
const baseFinalActual = (await listFiles(libraryRoot))
  .filter((path) => !futureClosureNames.includes(path)).sort();
assert(JSON.stringify(baseFinalActual) === JSON.stringify(baseFinalExpected),
  'D: 33-H base final inventory set is not exact');
const finalInventoryArtifacts = await compare(root, libraryRoot, [
  paths.finalInventory, `${paths.finalInventory}.sha256`
]);
assert(finalInventoryArtifacts.every((item) => item.status === 'PASS'),
  'D: 33-H final inventory pair readback mismatch');

const completedAt = new Date().toISOString();
const completion = await writePair(paths.completion, {
  ...proofCommon,
  status: 'PASS',
  officialStepStatus: 'COMPLETED',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true,
  requirementCompletionClaimed: true,
  persistentReceiptPath: paths.receipt,
  libraryPath: libraryRoot,
  localCheckpointPath: localPackageRoot,
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  validation: finalEvidence,
  externalInventory: {
    baseExpectedFiles: baseFinalExpected.length,
    baseActualFiles: baseFinalActual.length,
    baseStatus: 'PASS',
    expectedFilesAfterClosureSeal: baseFinalExpected.length + 6,
    closureInventoryPath: paths.closureInventory,
    closureSealRequired: true
  },
  evidence: [...supplementPairs, finalInventory],
  dataSource: 'manual',
  offlineAvailability: 'local_only',
  barcodeLookup: 'not_performed',
  expiryVerification: 'not_performed',
  notificationDelivery: 'not_performed',
  sensorIntegration: 'not_performed',
  readinessGuarantee: 'not_claimed',
  networkEgressAdded: false,
  nextOfficialStep: successorId,
  newBuildIssued: false,
  currentAuthoritativeSourceExternalProtectionStatus:
    'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  completedAt
});

const plan = await readJson(paths.plan);
const step = plan.steps.find((item) => item.id === stepId);
assert(step, '33-H work step is missing');
Object.assign(step, {
  status: 'COMPLETED',
  validationStatus: 'PASS',
  persistentReceiptStatus: 'PASS',
  persistentReceiptPath: paths.receipt,
  completionTransitionStatus: 'PASS'
});
step.localEvidence ??= [];
for (const evidence of [
  paths.receipt, paths.readback, paths.receiptReadback, paths.persistence,
  paths.finalInventory, paths.completion, paths.transition, paths.closureInventory
]) {
  if (!step.localEvidence.includes(evidence)) step.localEvidence.push(evidence);
}
plan.updatedAt = completedAt;
plan.segmentationNote = '33-H is immutable COMPLETED/PASS with exact local and D: USB hash/size readback. 33-I remains PENDING for governed successor selection.';

const ledger = await readJson(paths.ledger);
ledger.libraryUploadStatus = '33-H_COMPLETED_RECEIPT_PASS';
ledger.nextOfficialTask = 'AUTO_PRIORITY_SELECTION_AFTER_33-H_PERSISTENT_RECEIPT';
ledger.activeMicroStep = null;
ledger.externalLibraryAuthority33H = {
  step: stepId,
  status: 'PASS',
  storageBackend: 'EXTERNAL_USB_D_DRIVE',
  path: libraryRoot,
  localCheckpointPath: localPackageRoot,
  receipt: paths.receipt,
  focusedCheckpointOnly: true
};
ledger.updatedAt = completedAt;

const transitionChecks = [
  ['base package exact', baseReadback.every((item) => item.status === 'PASS')],
  ['receipt readback exact', receiptArtifacts.every((item) => item.status === 'PASS')],
  ['receipt persistence exact', persistenceArtifacts.every((item) => item.status === 'PASS')],
  ['base final inventory exact', baseFinalActual.length === baseFinalExpected.length],
  ['final inventory pair readback exact', finalInventoryArtifacts.every((item) => item.status === 'PASS')],
  ['boundary PASS', boundary.status === 'PASS'
    && boundary.checksPassed === finalEvidence.boundaryChecksPassed],
  ['contract PASS', contract.status === 'PASS'
    && contract.checksPassed === finalEvidence.contractChecksPassed],
  ['runtime PASS', runtime.status === 'PASS'
    && runtime.checksPassed === finalEvidence.runtimeChecksPassed
    && runtime.targetedTestsPassed === finalEvidence.targetedTestsPassed],
  ['registry exact', exactRegistry(registry)],
  ['work step complete', step.status === 'COMPLETED'
    && step.persistentReceiptStatus === 'PASS'],
  ['ledger complete', ledger.libraryUploadStatus === '33-H_COMPLETED_RECEIPT_PASS'
    && ledger.activeMicroStep === null],
  ['manual offline truth', exactTruth(proofCommon)],
  ['next step pending', plan.steps.find((item) => item.id === successorId)?.status === 'PENDING']
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const transitionFailures = transitionChecks.filter((item) => item.status !== 'PASS');
for (const failure of transitionFailures) console.error(`33-H transition check failed: ${failure.name}`);
assert(transitionChecks.every((item) => item.status === 'PASS'),
  '33-H completion transition failed');
const transition = await writePair(paths.transition, {
  ...proofCommon,
  status: 'PASS',
  expected: transitionChecks.length,
  executed: transitionChecks.length,
  passed: transitionChecks.length,
  failed: 0,
  checks: transitionChecks,
  validation: finalEvidence,
  officialStepStatus: 'COMPLETED',
  persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true,
  requirementCompletionClaimed: true,
  nextOfficialStep: successorId,
  newBuildIssued: false,
  currentAuthoritativeSourceExternalProtectionStatus:
    'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  verifiedAt: new Date().toISOString()
});

await copyPair(completion);
await copyPair(transition);
const closureArtifacts = await compare(root, libraryRoot, [
  paths.completion, `${paths.completion}.sha256`,
  paths.transition, `${paths.transition}.sha256`
]);
assert(closureArtifacts.every((item) => item.status === 'PASS'),
  'D: 33-H completion/transition pair readback mismatch');

const closureInventoryNames = [paths.closureInventory, `${paths.closureInventory}.sha256`];
const expectedBeforeClosureInventory = [
  ...baseFinalExpected,
  paths.completion, `${paths.completion}.sha256`,
  paths.transition, `${paths.transition}.sha256`
].sort();
const actualBeforeClosureInventory = (await listFiles(libraryRoot))
  .filter((path) => !closureInventoryNames.includes(path)).sort();
assert(JSON.stringify(actualBeforeClosureInventory) === JSON.stringify(expectedBeforeClosureInventory),
  'D: 33-H pre-closure inventory set is not exact');
const closureInventory = await writePair(paths.closureInventory, {
  ...proofCommon,
  status: 'PASS',
  countsAsPass: true,
  officialCompletionClaimed: true,
  requirementCompletionClaimed: true,
  libraryPath: libraryRoot,
  localCheckpointPath: localPackageRoot,
  expectedFilesBeforeInventory: expectedBeforeClosureInventory.length,
  actualFilesBeforeInventory: actualBeforeClosureInventory.length,
  finalExpectedFilesIncludingInventoryPair: expectedBeforeClosureInventory.length + 2,
  filesBeforeInventory: await Promise.all(
    actualBeforeClosureInventory.map((path) => bind(libraryRoot, path))
  ),
  verifiedAt: new Date().toISOString()
});
await copyPair(closureInventory);
const closureInventoryArtifacts = await compare(root, libraryRoot, [
  paths.closureInventory, `${paths.closureInventory}.sha256`
]);
assert(closureInventoryArtifacts.every((item) => item.status === 'PASS'),
  'D: 33-H closure inventory pair readback mismatch');
const closureFinalExpected = [
  ...expectedBeforeClosureInventory, paths.closureInventory, `${paths.closureInventory}.sha256`
].sort();
const closureFinalActual = await listFiles(libraryRoot);
assert(JSON.stringify(closureFinalActual) === JSON.stringify(closureFinalExpected),
  'D: 33-H closure inventory set is not exact');
const localClosureFinalActual = await listFiles(localPackageRoot);
assert(JSON.stringify(localClosureFinalActual) === JSON.stringify(closureFinalExpected),
  'Local 33-H closure inventory set is not exact');
const localClosureReadback = await compare(localPackageRoot, libraryRoot, closureFinalExpected);
assert(localClosureReadback.every((item) => item.status === 'PASS'),
  'Local and D: 33-H closure packages differ');

// Crash-safe governance seal: every content/proof pair and the closure inventory
// already exist and read back before the ledger becomes authoritative. The plan
// is deliberately the final write; a crash between these two atomic renames is
// recovered by the exact ledgerSealedPlanPending branch above.
await writeGovernanceJsonAtomic(paths.ledger, ledger);
await writeGovernanceJsonAtomic(paths.plan, plan);

console.log(`33-H external receipt finalized: PASS (${closureFinalExpected.length} exact local/D: files; source ${sourceCommit}).`);
