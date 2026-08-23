import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--external']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) throw new Error('Unsupported 33-M completion argument');
const external = process.argv.includes('--external');
const requirements = Object.freeze(Array.from({ length: 13 }, (_, index) => `B7-${String(index + 1).padStart(2, '0')}`));
const localRoot = resolve('C:\\PPT\\AYM', '09_ARSIV', 'KAYNAK_AGACI', 'checkpoints', '33-M_Accessibility_Preference_Center');
const libraryRoot = resolve('D:\\AYM_LIBRARY', 'Panthera pardus tulliana', 'Anadolu Parsı Aile Yaşam Merkezi', 'Bronze 04.08.2026.29', 'checkpoints', '33-M_Accessibility_Preference_Center');
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json',
  roadmap: 'config/remaining-scope-package-roadmap.json', scope: 'config/33-m-accessibility-preference-center-scope.json',
  inventory: 'config/33-m-accessibility-preference-center-inventory.json', audit: 'docs/audit/33-M_ACCESSIBILITY_PREFERENCE_CENTER_UST_KAPANIS.md',
  boundary: 'artifacts/validation/33-M-accessibility-boundary.json', contract: 'artifacts/validation/33-M-accessibility-contract.json',
  runtime: 'artifacts/validation/33-M-accessibility-runtime.json', migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  predecessor: 'artifacts/checkpoints/33-L_LIBRARY_RECEIPT.json', receipt: 'artifacts/checkpoints/33-M_LIBRARY_RECEIPT.json',
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
const full = (path) => resolve(root, path);
const posix = (path) => path.split(sep).join('/');
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const gitRun = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 64 * 1024 * 1024
});
const nodeRun = (args) => spawnSync(process.execPath, args, {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 900_000, maxBuffer: 64 * 1024 * 1024, env: process.env
});
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
const binding = async (base, path) => {
  const bytes = await readFile(resolve(base, path));
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const inventory = async (base) => {
  const names = await listFiles(base);
  const items = await Promise.all(names.map((path) => binding(base, path)));
  return { names, items, treeSha256: sha256(Buffer.from(items.map((item) => `${item.sha256}\t${item.sizeBytes}\t${item.path}\n`).join(''), 'utf8')) };
};
const checks = [];
const failures = [];
const check = (passed, name) => { checks.push({ name, status: passed ? 'PASS' : 'FAIL' }); if (!passed) failures.push(name); };
const sidecar = async (path) => {
  const bytes = await readFile(full(path));
  return await readFile(full(`${path}.sha256`), 'utf8') === `${sha256(bytes)}  ${basename(path)}\n`;
};

const docs = {};
for (const [key, path] of Object.entries(paths)) {
  if (key === 'audit') continue;
  docs[key] = await readJson(path);
}
const audit = await readFile(full(paths.audit), 'utf8');
check(proofKeys.every((key) => docs[key].status === 'PASS'), 'all proof documents are PASS');
check((await Promise.all(proofKeys.map((key) => sidecar(paths[key])))).every(Boolean), 'all proof sidecars bind exact bytes');
check(proofKeys.every((key) => docs[key].sourceCommit === docs.receipt.sourceCommit && docs[key].decision === 'DEC-224'
  && JSON.stringify(docs[key].requirements) === JSON.stringify(requirements)), 'all proof documents bind one source commit DEC and requirement set');
check(proofKeys.every((key) => docs[key].windowsNarrator === 'NOT_RUN' && docs[key].windowsMagnifier === 'NOT_RUN'
  && docs[key].realDevice === 'NOT_RUN' && docs[key].humanUat === 'NOT_RUN' && docs[key].certificationClaimed === false
  && docs[key].operatingSystemSettingsModified === false && docs[key].networkChannelsAdded === 0), 'all proof documents preserve manual-certification and local-only truth');
check(requirements.every((id) => {
  const item = docs.registry.requirements?.find((candidate) => candidate.id === id);
  return item?.status === 'COMPLETE' && Object.keys(item.chain ?? {}).length === 13 && Object.values(item.chain).every(Boolean)
    && [paths.boundary, paths.contract, paths.runtime].every((path) => item.evidence?.includes(path));
}), 'all thirteen requirement chains are COMPLETE and evidence-bound');
check(docs.scope.status === 'COMPLETE' && docs.scope.validation?.status === 'PASS' && docs.scope.persistentReceiptStatus === 'PASS'
  && docs.inventory.status === 'COMPLETE' && docs.inventory.persistentReceiptStatus === 'PASS'
  && docs.scope.completionBlockers?.length === 0 && docs.inventory.openBlockers?.length === 0, 'scope and inventory are exact COMPLETE/PASS');
const evidence = docs.scope.validation?.finalEvidence;
const migration90 = docs.migration.migrationVersions?.find((item) => item.version === 90);
check(docs.boundary.status === 'PASS' && docs.boundary.checksPassed === 27 && docs.contract.status === 'PASS' && docs.contract.checksPassed === 15
  && docs.runtime.status === 'PASS' && docs.runtime.checksPassed === 9 && docs.runtime.targetedTestFilesPassed === 5 && docs.runtime.targetedTestsPassed === 19,
  'boundary contract and runtime vectors are exact PASS');
check(evidence?.fullVitestTestFilesPassed === 134 && evidence.fullVitestTestsPassed === 1102 && evidence.productionWorkspaceBuildsPassed === 18
  && evidence.ppk021ExactAllowlistEntries === 566 && evidence.ppk021UseCaseCompositionSurfaces === 288 && evidence.ppk022CapabilitySurfaces === 246
  && evidence.latestDatabaseMigration === 90 && evidence.requirementChainsComplete === 13 && evidence.certificationClaimed === false
  && docs.migration.status === 'passed' && migration90?.name === 'b7_accessibility_preferences' && migration90?.checksum === evidence.migration90Checksum,
  'full validation and migration 90 binding are exact');
check(docs.predecessor.step === '33-L' && docs.predecessor.status === 'PASS' && await sidecar(paths.predecessor)
  && docs.receipt.predecessorSourceCommit === docs.predecessor.sourceCommit
  && gitRun(['merge-base', '--is-ancestor', docs.predecessor.sourceCommit, docs.receipt.sourceCommit]).status === 0,
  '33-L predecessor receipt is an exact ancestor');
const step = docs.plan.steps?.find((item) => item.id === '33-M');
check(step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS'
  && step.persistentReceiptPath === paths.receipt && step.completionTransitionStatus === 'PASS', 'work plan records immutable 33-M completion');
check(docs.plan.currentStep === null || docs.plan.currentStep === '33-N', 'work plan has no invented successor outside 33-N');
check(docs.ledger.libraryUploadStatus === '33-M_COMPLETED_RECEIPT_PASS' && docs.ledger.externalLibraryAuthority33M?.status === 'PASS'
  && docs.ledger.externalLibraryAuthority33M?.path === libraryRoot && docs.ledger.externalLibraryAuthority33M?.localCheckpointPath === localRoot
  && docs.ledger.externalLibraryAuthority33M?.receipt === paths.receipt, 'active ledger binds exact local and D: authority');
check(docs.receipt.persistentReceiptStatus === 'PASS' && docs.receipt.officialStepStatus === 'COMPLETED'
  && docs.receipt.libraryPath === libraryRoot && docs.receipt.localCheckpointPath === localRoot && docs.receipt.nextOfficialStep === '33-N',
  'persistent receipt binds exact completion targets and successor');
check(audit.includes('COMPLETED / PASS') && audit.includes('Windows Narrator: NOT_RUN') && audit.includes('İnsan UAT: NOT_RUN'), 'audit preserves exact completion and certification truth');

const manifestName = '33-M_CHECKPOINT_MANIFEST.json';
const manifestBytes = await readFile(resolve(localRoot, manifestName));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
check(await readFile(resolve(localRoot, `${manifestName}.sha256`), 'utf8') === `${sha256(manifestBytes)}  ${manifestName}\n`, 'manifest sidecar binds exact bytes');
check(manifest.sourceCommit === docs.receipt.sourceCommit && manifest.payloadMode === 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_FINAL_GOVERNANCE_STATE'
  && manifest.payloadCount === manifest.payload?.length && manifest.trackedSourceFileCount === manifest.payloadCount, 'manifest identity and counts are exact');
const tree = gitRun(['ls-tree', '-r', manifest.sourceCommit]);
const treeEntries = tree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
  const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/u);
  return match ? { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] } : null;
});
const treeByPath = new Map(treeEntries.filter(Boolean).map((item) => [item.sourcePath, item]));
check(tree.status === 0 && treeEntries.every(Boolean) && treeEntries.length === manifest.payloadCount
  && manifest.payload.every((item) => {
    const tracked = treeByPath.get(item.sourcePath);
    return tracked && item.packagePath === `payload/${item.sourcePath}` && item.gitMode === tracked.gitMode && item.gitObjectId === tracked.gitObjectId;
  }), 'manifest covers exact regular-blob Git source tree');
let payloadExact = true;
for (const item of manifest.payload) {
  const bytes = await readFile(resolve(localRoot, item.packagePath));
  if (bytes.length !== item.sizeBytes || sha256(bytes) !== item.sha256) { payloadExact = false; break; }
}
check(payloadExact, 'local tracked payload hashes and sizes are exact');
check(finalStatePaths.every((path) => manifest.finalStateBindings?.some((item) => item.sourcePath === path && item.packagePath === `final-state/${path}`)), 'manifest contains all final governance state bindings');
let finalStateExact = true;
for (const item of manifest.finalStateBindings ?? []) {
  const [repository, checkpoint] = await Promise.all([readFile(full(item.sourcePath)), readFile(resolve(localRoot, item.packagePath))]);
  if (repository.length !== item.sizeBytes || checkpoint.length !== item.sizeBytes || sha256(repository) !== item.sha256 || sha256(checkpoint) !== item.sha256) {
    finalStateExact = false; break;
  }
}
check(finalStateExact, 'repository and checkpoint final governance states are exact');
const localInventory = await inventory(localRoot);
check(docs.closureInventory.finalExpectedFilesIncludingInventoryPair === localInventory.names.length, 'closure inventory file count is exact');
const proofPairPaths = proofKeys.flatMap((key) => [paths[key], `${paths[key]}.sha256`]);
check((await Promise.all(proofPairPaths.map(async (path) => {
  const [repository, checkpoint] = await Promise.all([readFile(full(path)), readFile(resolve(localRoot, path))]);
  return repository.length === checkpoint.length && sha256(repository) === sha256(checkpoint);
}))).every(Boolean), 'repository proof pairs equal local checkpoint exact bytes');
if (external) {
  const libraryInventory = await inventory(libraryRoot);
  check(JSON.stringify(localInventory.names) === JSON.stringify(libraryInventory.names) && localInventory.treeSha256 === libraryInventory.treeSha256,
    'local and D: checkpoint inventories have exact size and SHA-256 equality');
  check((await Promise.all(proofPairPaths.map(async (path) => {
    const [repository, checkpoint] = await Promise.all([readFile(full(path)), readFile(resolve(libraryRoot, path))]);
    return repository.length === checkpoint.length && sha256(repository) === sha256(checkpoint);
  }))).every(Boolean), 'repository proof pairs equal D: checkpoint exact bytes');
}
const head = gitRun(['rev-parse', 'HEAD']).stdout.trim();
check(/^[0-9a-f]{40}$/u.test(head) && gitRun(['merge-base', '--is-ancestor', docs.receipt.sourceCommit, head]).status === 0,
  'current HEAD descends from receipt source commit');
if (external) {
  check(gitRun(['status', '--porcelain']).stdout.trim() === '', 'current source tree is clean');
  const remote = (name) => gitRun(['ls-remote', '--heads', name, 'main']).stdout.trim().match(/^([0-9a-f]{40})\s+refs\/heads\/main$/u)?.[1];
  check(remote('github') === head, 'GitHub main HEAD equals local HEAD');
  check(remote('backup') === head, 'D: Git backup main HEAD equals local HEAD');
  const localProtection = nodeRun(['scripts/protect-authoritative-source.mjs', 'verify']);
  let localProtectionResult;
  try { localProtectionResult = JSON.parse(localProtection.stdout.trim()); } catch { localProtectionResult = null; }
  check(localProtection.status === 0 && localProtectionResult?.status === 'EXTERNAL_RECEIPT_VERIFIED'
    && localProtectionResult?.externalLibraryReceiptStatus === 'PASS' && localProtectionResult?.officialCompletionClaimed === true,
  'current authoritative source has verified local protection and bound external receipt');
  const protection = nodeRun(['scripts/protect-authoritative-source-external.mjs', 'verify']);
  let protectionResult; try { protectionResult = JSON.parse(protection.stdout.trim()); } catch { protectionResult = null; }
  check(protection.status === 0 && protectionResult?.status === 'PASS' && protectionResult?.requirement === 'PR-233'
    && protectionResult?.governanceRequirement === 'GOV-005' && protectionResult?.decision === 'DEC-267',
    'current authoritative source has verified external D: protection');
}
console.log(`33-M completion verification: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${checks.length - failures.length}/${checks.length} checks${external ? ', external' : ''}).`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
