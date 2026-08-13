import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--dry-run']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) throw new Error('Unsupported 33-M finalizer argument');
const dryRun = process.argv.includes('--dry-run');
const stepId = '33-M';
const decision = 'DEC-224';
const requirements = Object.freeze(Array.from({ length: 13 }, (_, index) => `B7-${String(index + 1).padStart(2, '0')}`));
const localRoot = resolve('C:\\PPT\\AYM', '09_ARSIV', 'KAYNAK_AGACI', 'checkpoints', '33-M_Accessibility_Preference_Center');
const libraryRoot = resolve('D:\\AYM_LIBRARY', 'Panthera pardus tulliana', 'Anadolu Parsı Aile Yaşam Merkezi', 'Bronze 04.08.2026.29', 'checkpoints', '33-M_Accessibility_Preference_Center');
const suffix = `.staging-${process.pid}-${Date.now()}`;
const localStaging = `${localRoot}${suffix}`;
const libraryStaging = `${libraryRoot}${suffix}`;
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json', roadmap: 'config/remaining-scope-package-roadmap.json',
  scope: 'config/33-m-accessibility-preference-center-scope.json', inventory: 'config/33-m-accessibility-preference-center-inventory.json',
  audit: 'docs/audit/33-M_ACCESSIBILITY_PREFERENCE_CENTER_UST_KAPANIS.md',
  boundary: 'artifacts/validation/33-M-accessibility-boundary.json',
  contract: 'artifacts/validation/33-M-accessibility-contract.json',
  runtime: 'artifacts/validation/33-M-accessibility-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  predecessor: 'artifacts/checkpoints/33-L_LIBRARY_RECEIPT.json',
  receipt: 'artifacts/checkpoints/33-M_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-M_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-M_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-M_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory: 'artifacts/validation/33-M_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-M_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-M_COMPLETION_TRANSITION_VALIDATION.json',
  closureInventory: 'artifacts/validation/33-M_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json'
});
const proofKeys = Object.freeze(['receipt', 'readback', 'receiptReadback', 'persistence', 'finalInventory', 'completion', 'transition', 'closureInventory']);
const finalStatePaths = Object.freeze([paths.scope, paths.inventory, paths.plan, paths.ledger, paths.roadmap, paths.audit]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const posix = (path) => path.split(sep).join('/');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const writeAtomic = async (path, bytes) => {
  const target = full(path);
  const temporary = resolve(root, '.tmp', '33-m-final-state', `${basename(path)}.${process.pid}.tmp`);
  await writeBytes(temporary, bytes);
  await rename(temporary, target);
};
const gitRun = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 64 * 1024 * 1024
});
const remoteHead = (remote) => {
  const result = gitRun(['ls-remote', '--heads', remote, 'main']);
  return result.status === 0 ? result.stdout.trim().match(/^([0-9a-f]{40})\s+refs\/heads\/main$/u)?.[1] : undefined;
};
const listFiles = async (directory) => {
  const files = [];
  const visit = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
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
const bind = async (base, path) => {
  const bytes = await readFile(resolve(base, path));
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const inventory = async (base) => {
  const names = await listFiles(base);
  const items = await Promise.all(names.map((path) => bind(base, path)));
  const canonical = items.map((item) => `${item.sha256}\t${item.sizeBytes}\t${item.path}\n`).join('');
  return { names, items, fileCount: items.length, treeSha256: sha256(Buffer.from(canonical, 'utf8')) };
};
const compareTrees = async (left, right) => {
  const [a, b] = await Promise.all([inventory(left), inventory(right)]);
  return { status: a.fileCount === b.fileCount && a.treeSha256 === b.treeSha256 ? 'PASS' : 'FAIL', left: a, right: b };
};
const sidecarExact = async (path) => {
  try {
    const bytes = await readFile(full(path));
    return await readFile(full(`${path}.sha256`), 'utf8') === `${sha256(bytes)}  ${basename(path)}\n`;
  } catch { return false; }
};
const writePair = async (path, value) => {
  const bytes = jsonBytes(value);
  const digest = sha256(bytes);
  await writeBytes(full(path), bytes);
  await writeBytes(full(`${path}.sha256`), Buffer.from(`${digest}  ${basename(path)}\n`, 'ascii'));
  return { path, sizeBytes: bytes.length, sha256: digest };
};
const copyPair = async (binding) => {
  for (const target of [localStaging, libraryStaging]) {
    await copy(root, target, binding.path);
    await copy(root, target, `${binding.path}.sha256`);
  }
};

const [plan, ledger, registry, roadmap, scope, scopeInventory, boundary, contract, runtime, migration, predecessor] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.roadmap), readJson(paths.scope),
  readJson(paths.inventory), readJson(paths.boundary), readJson(paths.contract), readJson(paths.runtime), readJson(paths.migration), readJson(paths.predecessor)
]);
const step = plan.steps?.find((item) => item.id === stepId);
const migration90 = migration.migrationVersions?.find((item) => item.version === 90);
const finalEvidence = scope.validation?.finalEvidence;
assert(step?.status === 'IN_PROGRESS' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PENDING', '33-M is not validated receipt-pending');
assert(plan.currentStep === stepId && ledger.activeMicroStep === stepId && plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1, '33-M active step drift');
assert(scope.status === 'COMPLETE' && scope.validation?.status === 'PASS' && scopeInventory.status === 'COMPLETE', '33-M scope/inventory not prepared');
assert(requirements.every((id) => {
  const item = registry.requirements?.find((candidate) => candidate.id === id);
  return item?.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every(Boolean)
    && [paths.boundary, paths.contract, paths.runtime].every((path) => item.evidence?.includes(path));
}), '33-M registry chains are incomplete');
assert(boundary.status === 'PASS' && boundary.checksPassed === 27 && boundary.checksFailed === 0
  && contract.status === 'PASS' && contract.checksPassed === 15 && contract.checksFailed === 0
  && runtime.status === 'PASS' && runtime.checksPassed === 9 && runtime.checksFailed === 0
  && runtime.targetedTestFilesPassed === 5 && runtime.targetedTestsPassed === 19, '33-M evidence triplet drift');
assert(finalEvidence?.fullVitestTestFilesPassed === 134 && finalEvidence.fullVitestTestsPassed === 1102
  && finalEvidence.productionWorkspaceBuildsPassed === 18 && finalEvidence.requirementChainsComplete === 13
  && finalEvidence.ppk021ExactAllowlistEntries === 566 && finalEvidence.ppk021UseCaseCompositionSurfaces === 288
  && finalEvidence.ppk022CapabilitySurfaces === 246 && finalEvidence.networkChannels === 0 && finalEvidence.operatingSystemWrites === 0
  && finalEvidence.certificationClaimed === false, '33-M final validation vector drift');
assert(migration.status === 'passed' && migration90?.name === 'b7_accessibility_preferences'
  && migration90.checksum === finalEvidence.migration90Checksum, 'Migration 90 binding drift');
assert(predecessor.step === '33-L' && predecessor.status === 'PASS' && predecessor.persistentReceiptStatus === 'PASS'
  && await sidecarExact(paths.predecessor), '33-L predecessor receipt is not exact PASS');
const headResult = gitRun(['rev-parse', 'HEAD']);
assert(headResult.status === 0 && /^[0-9a-f]{40}$/u.test(headResult.stdout.trim()), 'Could not resolve source HEAD');
const sourceCommit = headResult.stdout.trim();
assert(gitRun(['merge-base', '--is-ancestor', predecessor.sourceCommit, sourceCommit]).status === 0, '33-L receipt source is not an ancestor');
const status = gitRun(['status', '--porcelain']);
assert(status.status === 0 && status.stdout.trim() === '', `33-M finalization requires a clean committed tree: ${status.stdout.trim()}`);
assert(remoteHead('github') === sourceCommit, 'GitHub main must equal the 33-M source commit');
assert(remoteHead('backup') === sourceCommit, 'D: Git backup main must equal the 33-M source commit');
assert(!(await exists(localRoot)) && !(await exists(libraryRoot)), '33-M checkpoint target already exists; overwrite is forbidden');
if (dryRun) {
  console.log(JSON.stringify({ status: 'PASS', step: stepId, sourceCommit, githubHead: sourceCommit, backupHead: sourceCommit, targetsAbsent: true }));
  process.exit(0);
}

const completedAt = new Date().toISOString();
const finalPlan = structuredClone(plan);
const finalStep = finalPlan.steps.find((item) => item.id === stepId);
Object.assign(finalStep, {
  status: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
  persistentReceiptPath: paths.receipt, completionTransitionStatus: 'PASS'
});
for (const path of proofKeys.map((key) => paths[key])) if (!finalStep.localEvidence.includes(path)) finalStep.localEvidence.push(path);
finalPlan.currentStep = null;
finalPlan.workflowStatus = 'COMPLETED';
finalPlan.updatedAt = completedAt;
finalPlan.segmentationNote = '33-M is immutable COMPLETED/PASS with exact local and D: receipt. 33-N / DEC-225 is the declared next package and requires its own activation.';
const finalLedger = structuredClone(ledger);
finalLedger.libraryUploadStatus = '33-M_COMPLETED_RECEIPT_PASS';
finalLedger.nextOfficialTask = '33-N_DEC-225_ACTIVATION';
finalLedger.activeMicroStep = null;
finalLedger.postflightStatus = 'PASS';
finalLedger.externalLibraryAuthority33M = {
  step: stepId, status: 'PASS', storageBackend: 'EXTERNAL_USB_D_DRIVE', path: libraryRoot,
  localCheckpointPath: localRoot, receipt: paths.receipt, focusedCheckpointOnly: true
};
finalLedger.updatedAt = completedAt;
const finalScope = structuredClone(scope);
finalScope.persistentReceiptStatus = 'PASS';
finalScope.persistentReceiptPath = paths.receipt;
finalScope.completedAt = completedAt;
finalScope.completionBlockers = [];
const finalScopeInventory = structuredClone(scopeInventory);
finalScopeInventory.persistentReceiptStatus = 'PASS';
finalScopeInventory.completedAt = completedAt;
finalScopeInventory.openBlockers = [];
const finalRoadmap = structuredClone(roadmap);
finalRoadmap.packages.find((item) => item.step === '33-M').status = 'COMPLETED';
finalRoadmap.packages.find((item) => item.step === '33-N').status = 'READY_NEXT';
finalRoadmap.completedRequirementCount = 13;
finalRoadmap.remainingRequirementCount = 261;
finalRoadmap.updatedAt = completedAt;
const finalAudit = Buffer.from(`# 33-M Erişilebilirlik Tercih Merkezi — Üst Kapanış\n\n## Durum\n\n\`COMPLETED / PASS\`. DEC-224 ve B7-01…B7-13 otomatik kaynak, güvenlik, migration, build, test ve persistent receipt kanıtlarıyla kapandı.\n\n## Doğrulama\n\n- Boundary 27/27, contract 15/15, runtime 9/9.\n- Hedefli test 5 dosya / 19 test.\n- Tam regresyon 134/134 dosya / 1.102/1.102 test.\n- Production build 18/18 workspace.\n- Migration 1–90 ve data-store smoke 14/14 PASS.\n- PPK-021 566 exact yüzey / 288 use-case composition; PPK-022 246 exact capability yüzeyi.\n- Yerel ve D: checkpoint SHA-256/size readback ile eşit; persistent receipt PASS.\n\n## Dürüst sınır\n\nWindows Narrator: NOT_RUN. Windows Magnifier: NOT_RUN. Gerçek cihaz: NOT_RUN. İnsan UAT: NOT_RUN. Sertifika iddiası yoktur. Uygulama işletim sistemi erişilebilirlik ayarlarını değiştirmez ve yeni ağ kanalı açmaz.\n\n## Ardıl\n\nSıradaki açık paket 33-N / DEC-225'tir; ayrı aktivasyon ve kanıt zinciri gerektirir.\n`, 'utf8');
const finalState = new Map([
  [paths.scope, jsonBytes(finalScope)], [paths.inventory, jsonBytes(finalScopeInventory)],
  [paths.plan, jsonBytes(finalPlan)], [paths.ledger, jsonBytes(finalLedger)], [paths.roadmap, jsonBytes(finalRoadmap)], [paths.audit, finalAudit]
]);

const tree = gitRun(['ls-tree', '-r', 'HEAD']);
assert(tree.status === 0, 'Could not enumerate source commit');
const tracked = tree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
  const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/u);
  assert(match, `Non-regular tracked entry: ${line}`);
  return { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] };
});
await mkdir(resolve(localStaging, 'payload'), { recursive: true });
const payload = [];
for (const item of tracked) {
  const bytes = await readFile(full(item.sourcePath));
  const packagePath = `payload/${item.sourcePath}`;
  await writeBytes(resolve(localStaging, packagePath), bytes);
  payload.push({ ...item, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const finalStateBindings = [];
for (const [path, bytes] of finalState) {
  const packagePath = `final-state/${path}`;
  await writeBytes(resolve(localStaging, packagePath), bytes);
  finalStateBindings.push({ sourcePath: path, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const truth = Object.freeze({
  windowsNarrator: 'NOT_RUN', windowsMagnifier: 'NOT_RUN', realDevice: 'NOT_RUN', humanUat: 'NOT_RUN',
  certificationClaimed: false, operatingSystemSettingsModified: false, networkChannelsAdded: 0
});
const common = Object.freeze({
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: stepId, decision, requirements, sourceCommit,
  predecessorStep: '33-L', predecessorReceiptPath: paths.predecessor, predecessorSourceCommit: predecessor.sourceCommit,
  sourceCommitRange: `${predecessor.sourceCommit}..${sourceCommit}`, validation: finalEvidence,
  migration90Checksum: migration90.checksum, currentAuthoritativeSourceExternalProtectionStatus: 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE',
  nextOfficialStep: '33-N', ...truth
});
const manifestName = '33-M_CHECKPOINT_MANIFEST.json';
const manifest = {
  ...common, phase: 'ACCESSIBILITY_PREFERENCE_CENTER_CHECKPOINT_PACKAGE', status: 'PASS',
  payloadMode: 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_FINAL_GOVERNANCE_STATE',
  trackedSourceFileCount: tracked.length, payloadCount: payload.length, payload, finalStateBindings,
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, createdAt: completedAt
};
const manifestBytes = jsonBytes(manifest);
await writeBytes(resolve(localStaging, manifestName), manifestBytes);
await writeBytes(resolve(localStaging, `${manifestName}.sha256`), Buffer.from(`${sha256(manifestBytes)}  ${manifestName}\n`, 'ascii'));
const baseInventory = await inventory(localStaging);
await mkdir(libraryStaging, { recursive: true });
for (const path of baseInventory.names) await copy(localStaging, libraryStaging, path);
const baseCompare = await compareTrees(localStaging, libraryStaging);
assert(baseCompare.status === 'PASS', 'D: base checkpoint readback mismatch');

const readback = await writePair(paths.readback, {
  ...common, status: 'PASS', countsAsPass: true, storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot,
  localCheckpointPath: localRoot, expected: baseCompare.left.fileCount, matched: baseCompare.right.fileCount, failed: 0,
  sourceTreeSha256: baseCompare.left.treeSha256, libraryTreeSha256: baseCompare.right.treeSha256, verifiedAt: new Date().toISOString()
});
const receipt = await writePair(paths.receipt, {
  ...common, status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS', officialStepStatus: 'COMPLETED',
  officialCompletionClaimed: true, storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot,
  localCheckpointPath: localRoot, verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_AND_SIZE_READBACK',
  basePackage: { expected: baseCompare.left.fileCount, matched: baseCompare.right.fileCount, failed: 0, treeSha256: baseCompare.left.treeSha256, status: 'PASS' },
  recordedAt: new Date().toISOString()
});
await copyPair(readback);
await copyPair(receipt);
const receiptReadbackCompare = await compareTrees(localStaging, libraryStaging);
assert(receiptReadbackCompare.status === 'PASS', 'D: receipt readback mismatch');
const receiptReadback = await writePair(paths.receiptReadback, {
  ...common, status: 'PASS', expected: receiptReadbackCompare.left.fileCount, matched: receiptReadbackCompare.right.fileCount,
  failed: 0, localTreeSha256: receiptReadbackCompare.left.treeSha256, libraryTreeSha256: receiptReadbackCompare.right.treeSha256,
  verifiedAt: new Date().toISOString()
});
await copyPair(receiptReadback);
const persistenceCompare = await compareTrees(localStaging, libraryStaging);
assert(persistenceCompare.status === 'PASS', 'D: receipt persistence mismatch');
const persistence = await writePair(paths.persistence, {
  ...common, status: 'PASS', expected: persistenceCompare.left.fileCount, matched: persistenceCompare.right.fileCount,
  failed: 0, localTreeSha256: persistenceCompare.left.treeSha256, libraryTreeSha256: persistenceCompare.right.treeSha256,
  verifiedAt: new Date().toISOString()
});
await copyPair(persistence);
const beforeFinalInventory = await inventory(localStaging);
const finalInventory = await writePair(paths.finalInventory, {
  ...common, status: 'PASS', countsAsPass: true, filesBeforeInventory: beforeFinalInventory.fileCount,
  treeSha256BeforeInventory: beforeFinalInventory.treeSha256, finalExpectedFilesIncludingInventoryPair: beforeFinalInventory.fileCount + 2,
  verifiedAt: new Date().toISOString()
});
await copyPair(finalInventory);
const completion = await writePair(paths.completion, {
  ...common, status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
  officialCompletionClaimed: true, persistentReceiptPath: paths.receipt, libraryPath: libraryRoot,
  localCheckpointPath: localRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt
});
await copyPair(completion);
const transitionChecks = [
  ['base package exact', baseCompare.status === 'PASS'], ['registry exact', requirements.every((id) => registry.requirements.find((item) => item.id === id)?.status === 'COMPLETE')],
  ['validation exact', boundary.status === 'PASS' && contract.status === 'PASS' && runtime.status === 'PASS'],
  ['work step complete', finalStep.status === 'COMPLETED' && finalStep.persistentReceiptStatus === 'PASS'],
  ['ledger complete', finalLedger.libraryUploadStatus === '33-M_COMPLETED_RECEIPT_PASS' && finalLedger.activeMicroStep === null],
  ['successor declared', finalLedger.nextOfficialTask === '33-N_DEC-225_ACTIVATION' && finalPlan.currentStep === null]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '33-M completion transition failed');
const transition = await writePair(paths.transition, {
  ...common, status: 'PASS', expected: transitionChecks.length, passed: transitionChecks.length, failed: 0, checks: transitionChecks,
  officialStepStatus: 'COMPLETED', persistentReceiptStatus: 'PASS', officialCompletionClaimed: true, verifiedAt: new Date().toISOString()
});
await copyPair(transition);
const beforeClosure = await inventory(localStaging);
const closureInventory = await writePair(paths.closureInventory, {
  ...common, status: 'PASS', countsAsPass: true, officialCompletionClaimed: true,
  filesBeforeInventory: beforeClosure.fileCount, treeSha256BeforeInventory: beforeClosure.treeSha256,
  finalExpectedFilesIncludingInventoryPair: beforeClosure.fileCount + 2, verifiedAt: new Date().toISOString()
});
await copyPair(closureInventory);
const finalCompare = await compareTrees(localStaging, libraryStaging);
assert(finalCompare.status === 'PASS', 'Local and D: final checkpoint packages differ');
assert(finalCompare.left.fileCount === beforeClosure.fileCount + 2, 'Final checkpoint inventory count drift');

let libraryPromoted = false;
try {
  assert(!(await exists(localRoot)) && !(await exists(libraryRoot)), 'Final checkpoint target appeared during staging');
  await rename(libraryStaging, libraryRoot);
  libraryPromoted = true;
  await rename(localStaging, localRoot);
} catch (error) {
  if (libraryPromoted && await exists(libraryRoot) && !(await exists(libraryStaging))) await rename(libraryRoot, libraryStaging);
  throw error;
}
for (const [path, bytes] of finalState) await writeAtomic(path, bytes);
console.log(`33-M external receipt finalized: PASS (${finalCompare.left.fileCount} exact local/D: files; source ${sourceCommit}).`);
