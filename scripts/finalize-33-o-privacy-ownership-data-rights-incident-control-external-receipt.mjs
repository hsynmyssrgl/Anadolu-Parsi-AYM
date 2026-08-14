
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--dry-run']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) throw new Error('Unsupported 33-O finalizer argument');
const dryRun = process.argv.includes('--dry-run');
const stepId = '33-O';
const decision = 'DEC-226';
const requirements = Object.freeze(['B6-02', 'PPK-028', 'AUD-COM-006', 'EXT-036', 'EXT-037', 'EXT-038', 'EXT-040', 'EXT-041', 'EXT-042']);
const manualTruthLine = '- Manuel kapanış kanıtı: legalReview=NOT_RUN; privacyReview=NOT_RUN; realDevice=NOT_RUN; humanUat=NOT_RUN; certificationClaimed=false.';
const localRoot = resolve('C:\\PPT\\AYM', '09_ARSIV', 'KAYNAK_AGACI', 'checkpoints', '33-O_Privacy_Ownership_Data_Rights_Incident_Control');
const libraryRoot = resolve('D:\\AYM_LIBRARY', 'Panthera pardus tulliana', 'Anadolu Parsı Aile Yaşam Merkezi', 'Bronze 04.08.2026.29', 'checkpoints', '33-O_Privacy_Ownership_Data_Rights_Incident_Control');
const suffix = `.staging-${process.pid}-${Date.now()}`;
const localStaging = `${localRoot}${suffix}`;
const libraryStaging = `${libraryRoot}${suffix}`;
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json', roadmap: 'config/remaining-scope-package-roadmap.json',
  scope: 'config/33-o-privacy-ownership-data-rights-incident-control-scope.json', inventory: 'config/33-o-privacy-ownership-data-rights-incident-control-inventory.json',
  decisionDocument: 'docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md',
  threatModel: 'docs/security/THREAT_MODEL_33_O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL.md',
  audit: 'docs/audit/33-O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL_UST_KAPANIS.md',
  boundary: 'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-boundary.json',
  contract: 'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-contract.json',
  runtime: 'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  predecessor: 'artifacts/checkpoints/33-N_LIBRARY_RECEIPT.json',
  receipt: 'artifacts/checkpoints/33-O_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-O_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-O_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-O_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory: 'artifacts/validation/33-O_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-O_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-O_COMPLETION_TRANSITION_VALIDATION.json',
  closureInventory: 'artifacts/validation/33-O_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json'
});
const proofKeys = Object.freeze(['receipt', 'readback', 'receiptReadback', 'persistence', 'finalInventory', 'completion', 'transition', 'closureInventory']);
const finalStatePaths = Object.freeze([
  paths.scope, paths.inventory, paths.plan, paths.ledger, paths.roadmap,
  paths.decisionDocument, paths.threatModel, paths.audit
]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const full = (path) => resolve(root, path);
const posix = (path) => path.split(sep).join('/');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' }); };
const writeAtomic = async (path, bytes) => {
  const target = full(path);
  const temporary = resolve(root, '.tmp', '33-o-final-state', `${basename(path)}.${process.pid}.tmp`);
  await writeBytes(temporary, bytes);
  await rename(temporary, target);
};
const gitRun = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 64 * 1024 * 1024
});
const gitBytes = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: null, windowsHide: true, timeout: 120_000, maxBuffer: 256 * 1024 * 1024
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
  await copyFile(resolve(sourceRoot, path), target, fsConstants.COPYFILE_EXCL);
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
const markCompleted = (document, label) => {
  assert(document.includes('- Durum: VALIDATED_RECEIPT_PENDING'), `${label} status is not receipt-pending validated`);
  assert(document.includes('- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION'), `${label} validation truth drift`);
  assert(document.includes(manualTruthLine), `${label} manual evidence truth drift`);
  return document.replace('- Durum: VALIDATED_RECEIPT_PENDING', '- Durum: COMPLETED');
};
const copyPair = async (binding) => {
  for (const target of [localStaging, libraryStaging]) {
    await copy(root, target, binding.path);
    await copy(root, target, `${binding.path}.sha256`);
  }
};
const cleanupStaging = async () => {
  for (const target of [localStaging, libraryStaging]) {
    if (await exists(target)) await rm(target, { recursive: true, force: true });
  }
};

const [plan, ledger, registry, roadmap, scope, scopeInventory, boundary, contract, runtime, migration, predecessor] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.roadmap), readJson(paths.scope),
  readJson(paths.inventory), readJson(paths.boundary), readJson(paths.contract), readJson(paths.runtime), readJson(paths.migration), readJson(paths.predecessor)
]);
const [decisionDocument, threatModel] = await Promise.all([
  readFile(full(paths.decisionDocument), 'utf8'),
  readFile(full(paths.threatModel), 'utf8')
]);
const step = plan.steps?.find((item) => item.id === stepId);
const roadmap33O = roadmap.packages?.find((item) => item.step === '33-O');
const roadmap33P = roadmap.packages?.find((item) => item.step === '33-P');
const migration92 = migration.migrationVersions?.find((item) => item.version === 92);
const finalEvidence = scope.validation?.finalEvidence;
assert(step?.status === 'IN_PROGRESS' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PENDING', '33-O is not validated receipt-pending');
assert(plan.currentStep === stepId && ledger.activeMicroStep === stepId && plan.steps?.filter((item) => item.status === 'IN_PROGRESS').length === 1, '33-O active step drift');
assert(scope.status === 'COMPLETE' && scope.validation?.status === 'PASS' && scopeInventory.status === 'COMPLETE', '33-O scope/inventory not prepared');
assert(requirements.every((id) => {
  const item = registry.requirements?.find((candidate) => candidate.id === id);
  return item?.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every(Boolean)
    && [paths.boundary, paths.contract, paths.runtime].every((path) => item.evidence?.includes(path));
}), '33-O registry chains are incomplete');
assert(boundary.status === 'PASS' && boundary.checksPassed === 45 && boundary.checksFailed === 0
  && contract.status === 'PASS' && contract.checksPassed === 18 && contract.checksFailed === 0
  && runtime.status === 'PASS' && runtime.checksPassed === 18 && runtime.checksFailed === 0
  && runtime.targetedTestFilesPassed === 11 && runtime.targetedTestsPassed === 167, '33-O evidence triplet drift');
assert(Number.isInteger(finalEvidence?.fullVitestTestFilesPassed) && finalEvidence.fullVitestTestFilesPassed > 0
  && Number.isInteger(finalEvidence.fullVitestTestsPassed) && finalEvidence.fullVitestTestsPassed > 0
  && finalEvidence.boundaryChecksPassed === 45 && finalEvidence.contractChecksPassed === 18
  && finalEvidence.runtimeChecksPassed === 18 && finalEvidence.targetedTestFilesPassed === 11
  && finalEvidence.targetedTestsPassed === 167
  && finalEvidence.productionWorkspaceBuildsPassed === 18 && finalEvidence.requirementChainsComplete === 9
  && finalEvidence.ppk021ExactAllowlistEntries === 590 && finalEvidence.ppk021UseCaseCompositionSurfaces === 297
  && finalEvidence.ppk022CapabilitySurfaces === 254 && finalEvidence.networkChannels === 0
  && finalEvidence.operatingSystemSettingsModified === false
  && finalEvidence.localUserSelectedEncryptedFileWriteSupported === true
  && finalEvidence.legalReview === 'NOT_RUN' && finalEvidence.privacyReview === 'NOT_RUN'
  && finalEvidence.realDevice === 'NOT_RUN' && finalEvidence.humanUat === 'NOT_RUN'
  && finalEvidence.certificationClaimed === false, '33-O final validation vector drift');
assert(roadmap33O?.status === 'VALIDATED_AWAITING_RECEIPT' && roadmap33P?.status === 'PLANNED_NEXT'
  && roadmap33P.decision === 'DEC-227' && JSON.stringify(roadmap33P.dependsOn) === JSON.stringify(['33-O']),
  '33-P / DEC-227 exact successor binding drift');
assert(migration.status === 'passed' && migration92?.name === 'privacy_ownership_data_rights_incident_control'
  && migration92.checksum === 'a81c13518563172d29aa2b351218faf553a2189616657fc0fbda9b1922eee137'
  && migration92.checksum === finalEvidence.migration92Checksum, 'Migration 92 binding drift');
assert(predecessor.step === '33-N' && predecessor.status === 'PASS' && predecessor.persistentReceiptStatus === 'PASS'
  && await sidecarExact(paths.predecessor), '33-N predecessor receipt is not exact PASS');
const headResult = gitRun(['rev-parse', 'HEAD']);
assert(headResult.status === 0 && /^[0-9a-f]{40}$/u.test(headResult.stdout.trim()), 'Could not resolve source HEAD');
const sourceCommit = headResult.stdout.trim();
assert(gitRun(['merge-base', '--is-ancestor', predecessor.sourceCommit, sourceCommit]).status === 0, '33-N receipt source is not an ancestor');
const status = gitRun(['status', '--porcelain']);
assert(status.status === 0 && status.stdout.trim() === '', `33-O finalization requires a clean committed tree: ${status.stdout.trim()}`);
assert(remoteHead('github') === sourceCommit, 'GitHub main must equal the 33-O source commit');
assert(remoteHead('backup') === sourceCommit, 'D: Git backup main must equal the 33-O source commit');
assert(!(await exists(localRoot)) && !(await exists(libraryRoot)), '33-O checkpoint target already exists; overwrite is forbidden');
assert(!(await exists(localStaging)) && !(await exists(libraryStaging)), '33-O staging target already exists; overwrite is forbidden');
if (dryRun) {
  console.log(JSON.stringify({ status: 'PASS', mode: 'DRY_RUN_READ_ONLY', mutated: false, step: stepId, sourceCommit, githubHead: sourceCommit, backupHead: sourceCommit, targetsAbsent: true, stagingTargetsAbsent: true }));
  process.exit(0);
}

try {
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
finalPlan.segmentationNote = '33-O is immutable COMPLETED/PASS with exact local and D: receipt. 33-P / DEC-227 is the declared next package and requires its own activation.';
const finalLedger = structuredClone(ledger);
finalLedger.libraryUploadStatus = '33-O_COMPLETED_RECEIPT_PASS';
finalLedger.nextOfficialTask = '33-P_DEC-227_ACTIVATION';
finalLedger.activeMicroStep = null;
finalLedger.postflightStatus = 'PASS';
finalLedger.externalLibraryAuthority33O = {
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
finalRoadmap.packages.find((item) => item.step === '33-O').status = 'COMPLETED';
finalRoadmap.packages.find((item) => item.step === '33-P').status = 'READY_NEXT';
finalRoadmap.completedRequirementCount = (roadmap.completedRequirementCount ?? 0) + requirements.length;
finalRoadmap.remainingRequirementCount = Math.max(0, (roadmap.remainingRequirementCount ?? requirements.length) - requirements.length);
finalRoadmap.updatedAt = completedAt;
const finalDecisionDocument = Buffer.from(markCompleted(decisionDocument, 'DEC-226'), 'utf8');
const finalThreatModel = Buffer.from(markCompleted(threatModel, '33-O threat model'), 'utf8');
const finalAudit = Buffer.from(`# 33-O Gizlilik Sahiplik Veri Haklari ve Olay Kontrolu - Ust Kapanis

## Durum

COMPLETED / PASS. DEC-226 ve dokuz requirement otomatik kaynak, guvenlik, migration, build, test ve persistent receipt kanitlariyla kapandi.

## Dogrulama

- Boundary 45/45, contract 18/18, runtime 18/18.
- Hedefli test 11 dosya / ${finalEvidence.targetedTestsPassed} test.
- Tam regresyon ${finalEvidence.fullVitestTestFilesPassed} dosya / ${finalEvidence.fullVitestTestsPassed} test.
- Production build 18 workspace.
- Migration 92 checksum ${migration92.checksum}.
- Yerel ve D: checkpoint SHA-256/size readback ile esit; persistent receipt PASS.

## Dürüst kanıt sınırı

- Gerçek cihaz: NOT_RUN.
- İnsan UAT: NOT_RUN.
- Hukuk incelemesi: NOT_RUN.
- Gizlilik incelemesi: NOT_RUN.
- Gizlilik sertifikasyonu: false.
- certificationClaimed=false.
- Kaynak koruma: NOT_RUN_BY_FINALIZER; final teslim ancak external completion verification PASS sonrasında geçerlidir.

## Ardil

Siradaki acik paket 33-P / DEC-227'dir; ayri aktivasyon ve kanit zinciri gerektirir.
`, 'utf8');
const finalState = new Map([
  [paths.scope, jsonBytes(finalScope)], [paths.inventory, jsonBytes(finalScopeInventory)],
  [paths.plan, jsonBytes(finalPlan)], [paths.ledger, jsonBytes(finalLedger)], [paths.roadmap, jsonBytes(finalRoadmap)],
  [paths.decisionDocument, finalDecisionDocument], [paths.threatModel, finalThreatModel], [paths.audit, finalAudit]
]);

const tree = gitRun(['ls-tree', '-r', sourceCommit]);
assert(tree.status === 0, 'Could not enumerate source commit');
const tracked = tree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
  const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/u);
  assert(match, `Non-regular tracked entry: ${line}`);
  return { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] };
});
await mkdir(resolve(localStaging, 'payload'), { recursive: true });
const payload = [];
for (const item of tracked) {
  const blob = gitBytes(['cat-file', 'blob', item.gitObjectId]);
  assert(blob.status === 0 && Buffer.isBuffer(blob.stdout), `Could not read Git blob: ${item.gitObjectId} ${item.sourcePath}`);
  const bytes = blob.stdout;
  const packagePath = `payload/${item.sourcePath}`;
  await writeBytes(resolve(localStaging, packagePath), bytes);
  const checkpointBytes = await readFile(resolve(localStaging, packagePath));
  const digest = sha256(bytes);
  assert(checkpointBytes.length === bytes.length && sha256(checkpointBytes) === digest && checkpointBytes.equals(bytes),
    `Git blob checkpoint readback mismatch: ${item.gitObjectId} ${item.sourcePath}`);
  payload.push({ ...item, packagePath, sizeBytes: bytes.length, sha256: digest });
}
const finalStateBindings = [];
for (const [path, bytes] of finalState) {
  const packagePath = `final-state/${path}`;
  await writeBytes(resolve(localStaging, packagePath), bytes);
  finalStateBindings.push({ sourcePath: path, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
}
const truth = Object.freeze({
  windowsNarrator: 'NOT_RUN', windowsMagnifier: 'NOT_RUN', realDevice: 'NOT_RUN', humanUat: 'NOT_RUN',
  certificationClaimed: false, legalReview: 'NOT_RUN', privacyReview: 'NOT_RUN',
  legalCertificationClaimed: false, privacyCertificationClaimed: false,
  remoteWipePerformed: false, mdmOperationPerformed: false, networkDeliveryGuaranteed: false,
  operatingSystemSettingsModified: false, networkChannelsAdded: 0
});
const common = Object.freeze({
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: stepId, decision, requirements, sourceCommit,
  predecessorStep: '33-N', predecessorReceiptPath: paths.predecessor, predecessorSourceCommit: predecessor.sourceCommit,
  sourceCommitRange: `${predecessor.sourceCommit}..${sourceCommit}`, validation: finalEvidence,
  migration92Checksum: migration92.checksum, currentAuthoritativeSourceExternalProtectionStatus: 'NOT_RUN_BY_FINALIZER_EXTERNAL_COMPLETION_REQUIRED',
  finalDeliveryStatus: 'PENDING_EXTERNAL_SOURCE_PROTECTION_VERIFICATION', finalDeliveryClaimed: false,
  nextOfficialStep: '33-P', nextOfficialDecision: 'DEC-227', ...truth
});
const manifestName = '33-O_CHECKPOINT_MANIFEST.json';
const manifest = {
  ...common, phase: 'PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL_CHECKPOINT_PACKAGE', status: 'PASS',
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
  ['ledger complete', finalLedger.libraryUploadStatus === '33-O_COMPLETED_RECEIPT_PASS' && finalLedger.activeMicroStep === null],
  ['successor declared', finalLedger.nextOfficialTask === '33-P_DEC-227_ACTIVATION' && finalPlan.currentStep === null
    && finalRoadmap.packages.find((item) => item.step === '33-P')?.decision === 'DEC-227'
    && JSON.stringify(finalRoadmap.packages.find((item) => item.step === '33-P')?.dependsOn) === JSON.stringify(['33-O'])]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(transitionChecks.every((item) => item.status === 'PASS'), '33-O completion transition failed');
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
const promotionStatus = gitRun(['status', '--porcelain']);
assert(promotionStatus.status === 0 && promotionStatus.stdout.trim() === '', 'Source tree changed during checkpoint staging');
assert(remoteHead('github') === sourceCommit, 'GitHub main changed during checkpoint staging');
assert(remoteHead('backup') === sourceCommit, 'D: Git backup main changed during checkpoint staging');

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
console.log(`33-O external receipt: PASS; final delivery PENDING external source protection verification (${finalCompare.left.fileCount} exact local/D: files; source ${sourceCommit}).`);
} catch (error) {
  await cleanupStaging();
  throw error;
}
