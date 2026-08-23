import { createHash, createPublicKey } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { verifyIdentityAccessExternalEvidenceIntake } from './lib/identity-access-external-evidence-intake.mjs';
import { IDENTITY_ACCESS_COMPLETION_REQUIREMENTS } from './lib/identity-access-preparation-state-machine.mjs';
import {
  IDENTITY_ACCESS_COMPLETION_CHAIN_KEYS,
  IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS,
  IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS
} from './lib/identity-access-finalization-state-machine.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const allowedArguments = new Set(['--external']);
if (process.argv.slice(2).some((argument) => !allowedArguments.has(argument))) {
  throw new Error('Unsupported 33-P completion argument');
}
const external = process.argv.includes('--external');
const localRoot = resolve('C:\\PPT\\AYM', '09_ARSIV', 'KAYNAK_AGACI', 'checkpoints',
  '33-P_Passkeys_Federated_Identity_Verifiable_Temporary_Credentials');
const libraryRoot = resolve('D:\\AYM_LIBRARY', 'Panthera pardus tulliana',
  'Anadolu Parsı Aile Yaşam Merkezi', 'Bronze 04.08.2026.29', 'checkpoints',
  '33-P_Passkeys_Federated_Identity_Verifiable_Temporary_Credentials');
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  scope: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  inventory: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  decisionDocument: 'docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md',
  threatModel: 'docs/security/THREAT_MODEL_33_P_PASSKEYS_FEDERATED_IDENTITY_VERIFIABLE_TEMPORARY_CREDENTIALS.md',
  audit: 'docs/audit/33-P_IDENTITY_ACCESS_CREDENTIALS_UST_KAPANIS.md',
  boundary: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-boundary.json',
  contract: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-contract.json',
  runtime: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  predecessor: 'artifacts/checkpoints/33-O_LIBRARY_RECEIPT.json',
  evidenceReport: 'artifacts/validation/33-P-identity-access-external-evidence-intake.json',
  preparation: 'artifacts/checkpoints/33-P_PREPARATION_RECORD.json',
  receipt: 'artifacts/checkpoints/33-P_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-P_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-P_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-P_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  finalInventory: 'artifacts/validation/33-P_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-P_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-P_COMPLETION_TRANSITION_VALIDATION.json',
  closureInventory: 'artifacts/validation/33-P_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json'
});
const proofKeys = Object.freeze([
  'receipt', 'readback', 'receiptReadback', 'persistence', 'finalInventory',
  'completion', 'transition', 'closureInventory'
]);
const finalStatePaths = Object.freeze([
  paths.scope, paths.inventory, paths.registry, paths.plan, paths.ledger, paths.roadmap,
  paths.decisionDocument, paths.threatModel, paths.audit
]);
const full = (path) => resolve(root, path);
const posix = (path) => path.split(sep).join('/');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const gitRun = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 64 * 1024 * 1024
});
const gitBytes = (args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: null, windowsHide: true, timeout: 120_000, maxBuffer: 256 * 1024 * 1024
});
const nodeRun = (args) => spawnSync(process.execPath, args, {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 900_000,
  maxBuffer: 64 * 1024 * 1024, env: process.env
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
const bind = async (base, path) => {
  const bytes = await readFile(resolve(base, path));
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const inventoryTree = async (base) => {
  const names = await listFiles(base);
  const items = await Promise.all(names.map((path) => bind(base, path)));
  const canonical = items.map((item) => `${item.sha256}\t${item.sizeBytes}\t${item.path}\n`).join('');
  return { names, items, treeSha256: sha256(Buffer.from(canonical, 'utf8')) };
};
const sidecar = async (path) => {
  const bytes = await readFile(full(path));
  return await readFile(full(`${path}.sha256`), 'utf8') === `${sha256(bytes)}  ${basename(path)}\n`;
};
const checks = [];
const failures = [];
const check = (passed, name) => {
  checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
  if (!passed) failures.push(name);
};

for (const path of [paths.receipt, ...proofKeys.filter((key) => key !== 'receipt').map((key) => paths[key]),
  paths.evidenceReport, paths.preparation]) {
  try { await access(full(path)); } catch {
    throw new Error(`33-P completion requires finalized artifact: ${path}`);
  }
}
try { await access(localRoot); } catch {
  throw new Error(`33-P completion requires local checkpoint: ${localRoot}`);
}

const docs = {};
for (const [key, path] of Object.entries(paths)) {
  if (['audit', 'decisionDocument', 'threatModel'].includes(key)) continue;
  docs[key] = await readJson(path);
}
const [audit, decisionDocument, threatModel] = await Promise.all([
  readFile(full(paths.audit), 'utf8'),
  readFile(full(paths.decisionDocument), 'utf8'),
  readFile(full(paths.threatModel), 'utf8')
]);
check(proofKeys.every((key) => docs[key].status === 'PASS'), 'all 33-P proof documents are PASS');
check((await Promise.all([
  ...proofKeys.map((key) => sidecar(paths[key])),
  sidecar(paths.predecessor), sidecar(paths.evidenceReport), sidecar(paths.preparation)
])).every(Boolean), 'all proof predecessor evidence and preparation sidecars bind exact bytes');
check(proofKeys.every((key) => docs[key].sourceCommit === docs.receipt.sourceCommit
  && docs[key].evidenceSourceCommit === docs.evidenceReport.evidenceBinding.sourceCommit
  && docs[key].evidenceSourceTree === docs.evidenceReport.evidenceBinding.sourceTree
  && docs[key].evidenceTreeSha256 === docs.evidenceReport.evidenceBinding.evidenceTreeSha256
  && docs[key].signerKeyIdSha256 === docs.evidenceReport.evidenceBinding.signerKeyIdSha256
  && docs[key].decision === 'DEC-227'
  && exact(docs[key].requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS)
  && docs[key].nextOfficialStep === '33-Q' && docs[key].nextOfficialDecision === 'DEC-228'),
'proof documents bind one source signed evidence requirement set and exact successor');
check(proofKeys.every((key) => docs[key].externalEvidenceStatus === 'PASS_SIGNED_EXTERNAL_EVIDENCE'
  && docs[key].certificationClaimed === false && docs[key].legalCertificationClaimed === false
  && docs[key].privacyCertificationClaimed === false && docs[key].identityCertificationClaimed === false
  && docs[key].providerAvailabilityGuaranteed === false && docs[key].networkDeliveryGuaranteed === false
  && docs[key].physicalSecureEraseGuaranteed === false && docs[key].backupPropagationGuaranteed === false),
'proof documents preserve signed-evidence and no-certification guarantees');
check(proofKeys.every((key) => docs[key].currentAuthoritativeSourceExternalProtectionStatus
  === 'NOT_RUN_BY_FINALIZER_EXTERNAL_COMPLETION_REQUIRED'
  && docs[key].finalDeliveryStatus === 'PENDING_EXTERNAL_SOURCE_PROTECTION_VERIFICATION'
  && docs[key].finalDeliveryClaimed === false),
'proof documents defer final delivery until external source protection verification');
check(IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.every((id) => {
  const item = docs.registry.requirements?.find((candidate) => candidate.id === id);
  return item?.status === 'COMPLETE'
    && exact(Object.keys(item.chain ?? {}).sort(), [...IDENTITY_ACCESS_COMPLETION_CHAIN_KEYS].sort())
    && Object.values(item.chain).every(Boolean)
    && [paths.decisionDocument, paths.boundary, paths.contract, paths.runtime,
      paths.evidenceReport, paths.preparation, paths.receipt].every((path) => item.evidence?.includes(path));
}), 'all eight requirement chains are COMPLETE and evidence/receipt-bound');
check(docs.scope.status === 'COMPLETE' && docs.scope.governancePhase
  === 'COMPLETED_SIGNED_EXTERNAL_EVIDENCE_RECEIPT_PASS'
  && docs.scope.validation?.status === 'PASS' && docs.scope.validation?.countsAsRequirementPass === true
  && docs.scope.validation?.persistentReceipt === 'PASS' && docs.scope.persistentReceiptStatus === 'PASS'
  && docs.scope.persistentReceiptPath === paths.receipt && docs.scope.completionBlockers?.length === 0
  && docs.inventory.status === 'COMPLETE' && docs.inventory.persistentReceiptStatus === 'PASS'
  && docs.inventory.openBlockers?.length === 0, 'scope and inventory are exact COMPLETE/PASS');
check(docs.boundary.status === 'PASS' && docs.boundary.checksPassed === 21 && docs.boundary.checksFailed === 0
  && docs.contract.status === 'PASS' && docs.contract.checksPassed === 17 && docs.contract.checksFailed === 0
  && docs.runtime.status === 'PASS' && docs.runtime.checksPassed === 24 && docs.runtime.checksFailed === 0
  && docs.runtime.targetedTestFilesPassed === 19 && docs.runtime.targetedTestsPassed >= 116,
'boundary contract and runtime vectors are exact PASS');
const migration93 = docs.migration.migrationVersions?.find((item) => item.version === 93);
check(docs.preparation.status === 'PASS' && docs.preparation.persistentReceiptStatus === 'PENDING'
  && docs.preparation.countsAsRequirementPass === false
  && exact(docs.preparation.requirements, IDENTITY_ACCESS_COMPLETION_REQUIREMENTS)
  && docs.preparation.evidenceSourceCommit === docs.evidenceReport.evidenceBinding.sourceCommit
  && docs.preparation.evidenceSourceTree === docs.evidenceReport.evidenceBinding.sourceTree
  && docs.preparation.evidenceTreeSha256 === docs.evidenceReport.evidenceBinding.evidenceTreeSha256
  && docs.preparation.signerKeyIdSha256 === docs.evidenceReport.evidenceBinding.signerKeyIdSha256
  && docs.preparation.technicalEvidence?.migration93Checksum === migration93?.checksum
  && migration93?.checksum === '51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a',
'preparation signed evidence and migration 93 binding are exact');
check(docs.predecessor.step === '33-O' && docs.predecessor.status === 'PASS'
  && docs.receipt.predecessorSourceCommit === docs.predecessor.sourceCommit
  && gitRun(['merge-base', '--is-ancestor', docs.predecessor.sourceCommit, docs.receipt.sourceCommit]).status === 0,
'33-O predecessor receipt is an exact ancestor');
const changedPaths = gitRun(['diff', '--name-only',
  `${docs.evidenceReport.evidenceBinding.sourceCommit}..${docs.receipt.sourceCommit}`]);
check(changedPaths.status === 0
  && exact(changedPaths.stdout.trim().split(/\r?\n/u).filter(Boolean).sort(), IDENTITY_ACCESS_PREPARATION_CHANGE_PATHS),
'post-evidence source diff contains only governed preparation state');
const step = docs.plan.steps?.find((item) => item.id === '33-P');
check(step?.status === 'COMPLETED' && step.validationStatus === 'PASS'
  && step.persistentReceiptStatus === 'PASS' && step.persistentReceiptPath === paths.receipt
  && step.completionTransitionStatus === 'PASS' && docs.plan.currentStep === null
  && docs.plan.workflowStatus === 'COMPLETED', 'work plan records immutable 33-P completion');
check(docs.ledger.libraryUploadStatus === '33-P_COMPLETED_RECEIPT_PASS'
  && docs.ledger.externalLibraryAuthority33P?.status === 'PASS'
  && docs.ledger.externalLibraryAuthority33P?.path === libraryRoot
  && docs.ledger.externalLibraryAuthority33P?.localCheckpointPath === localRoot
  && docs.ledger.externalLibraryAuthority33P?.receipt === paths.receipt
  && docs.ledger.nextOfficialTask === '33-Q_DEC-228_ACTIVATION'
  && docs.ledger.activeMicroStep === null, 'active ledger binds exact local/D authority and successor');
check(docs.roadmap.packages?.find((item) => item.step === '33-P')?.status === 'COMPLETED'
  && docs.roadmap.packages?.find((item) => item.step === '33-Q')?.status === 'READY_NEXT'
  && docs.roadmap.packages?.find((item) => item.step === '33-Q')?.decision === 'DEC-228'
  && exact(docs.roadmap.packages?.find((item) => item.step === '33-Q')?.dependsOn,
    ['33-O', '33-P', 'PPK-016', 'PPK-019', 'PPK-022']),
'roadmap closes 33-P and declares exact inactive 33-Q successor');
check(docs.receipt.persistentReceiptStatus === 'PASS' && docs.receipt.officialStepStatus === 'COMPLETED'
  && docs.receipt.libraryPath === libraryRoot && docs.receipt.localCheckpointPath === localRoot
  && docs.receipt.nextOfficialStep === '33-Q' && docs.receipt.nextOfficialDecision === 'DEC-228',
'persistent receipt binds exact completion targets and successor');
check(audit.includes('COMPLETED / PASS') && audit.includes('Certification claim: false')
  && audit.includes('Provider availability ve network delivery guarantee: false')
  && audit.includes('Fiziksel secure erase ve backup propagation guarantee: false')
  && audit.includes('33-Q / DEC-228 yalnız ayrı aktivasyonla başlayabilir'),
'audit preserves exact signed-evidence and no-certification truth');
check([decisionDocument, threatModel].every((document) => document.includes('- Durum: COMPLETED')
  && document.includes('- Uygulama gerçeği: COMPLETED_SIGNED_EXTERNAL_EVIDENCE_RECEIPT_PASS')
  && document.includes('Actual external evidence: PASS_SIGNED_EXTERNAL_EVIDENCE')
  && document.includes('## Persistent receipt completion')),
'decision and threat model preserve exact completion truth');

const manifestName = '33-P_CHECKPOINT_MANIFEST.json';
const manifestBytes = await readFile(resolve(localRoot, manifestName));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
check(await readFile(resolve(localRoot, `${manifestName}.sha256`), 'utf8')
  === `${sha256(manifestBytes)}  ${manifestName}\n`, 'manifest sidecar binds exact bytes');
check(manifest.sourceCommit === docs.receipt.sourceCommit
  && manifest.evidenceSourceCommit === docs.evidenceReport.evidenceBinding.sourceCommit
  && manifest.evidenceTreeSha256 === docs.evidenceReport.evidenceBinding.evidenceTreeSha256
  && manifest.signerKeyIdSha256 === docs.evidenceReport.evidenceBinding.signerKeyIdSha256
  && manifest.payloadMode
  === 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_FINAL_GOVERNANCE_AND_SIGNED_EVIDENCE'
  && manifest.payloadCount === manifest.payload?.length
  && manifest.trackedSourceFileCount === manifest.payloadCount, 'manifest identity counts and signed evidence are exact');
const tree = gitRun(['ls-tree', '-r', manifest.sourceCommit]);
const treeEntries = tree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
  const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/u);
  return match ? { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] } : null;
});
const treeByPath = new Map(treeEntries.filter(Boolean).map((item) => [item.sourcePath, item]));
check(tree.status === 0 && treeEntries.every(Boolean) && treeEntries.length === manifest.payloadCount
  && manifest.payload.every((item) => {
    const tracked = treeByPath.get(item.sourcePath);
    return tracked && item.packagePath === `payload/${item.sourcePath}`
      && item.gitMode === tracked.gitMode && item.gitObjectId === tracked.gitObjectId;
  }), 'manifest covers exact regular-blob Git source tree');
let payloadExact = true;
for (const item of manifest.payload) {
  const bytes = await readFile(resolve(localRoot, item.packagePath));
  const blob = gitBytes(['cat-file', 'blob', item.gitObjectId]);
  if (blob.status !== 0 || !Buffer.isBuffer(blob.stdout)
    || bytes.length !== item.sizeBytes || blob.stdout.length !== item.sizeBytes
    || sha256(bytes) !== item.sha256 || sha256(blob.stdout) !== item.sha256
    || !bytes.equals(blob.stdout)) { payloadExact = false; break; }
}
check(payloadExact, 'local payload bytes bind exact sourceCommit Git blobs');
check(finalStatePaths.every((path) => manifest.finalStateBindings?.some((item) => item.sourcePath === path
  && item.packagePath === `final-state/${path}`)), 'manifest contains every final governance state binding');
let finalStateExact = true;
for (const item of manifest.finalStateBindings ?? []) {
  const [repository, checkpoint] = await Promise.all([
    readFile(full(item.sourcePath)), readFile(resolve(localRoot, item.packagePath))
  ]);
  if (repository.length !== item.sizeBytes || checkpoint.length !== item.sizeBytes
    || sha256(repository) !== item.sha256 || sha256(checkpoint) !== item.sha256) {
    finalStateExact = false; break;
  }
}
check(finalStateExact, 'repository and checkpoint final governance states are exact');
const expectedExternalEvidence = [
  { id: 'signed-manifest', ...docs.evidenceReport.evidenceBinding.manifest },
  ...docs.evidenceReport.evidenceBinding.files
];
check(exact(manifest.externalEvidenceBindings?.map((item) => ({
  id: item.id,
  relativePath: item.sourceRelativePath,
  sizeBytes: item.sizeBytes,
  sha256: item.sha256
})), expectedExternalEvidence), 'manifest contains exact signed external evidence bindings');
let externalEvidenceExact = true;
for (const item of manifest.externalEvidenceBindings ?? []) {
  const bytes = await readFile(resolve(localRoot, item.packagePath));
  if (bytes.length !== item.sizeBytes || sha256(bytes) !== item.sha256) {
    externalEvidenceExact = false; break;
  }
}
check(externalEvidenceExact, 'checkpoint signed evidence bytes match prepared binding');
const signerPublicKeyBytes = await readFile(resolve(localRoot, manifest.signerPublicKeyBinding.packagePath));
let signerKeyId;
try {
  const publicKey = createPublicKey(signerPublicKeyBytes.toString('utf8'));
  signerKeyId = publicKey.type === 'public' && publicKey.asymmetricKeyType === 'ed25519'
    ? sha256(publicKey.export({ type: 'spki', format: 'der' })) : undefined;
} catch { signerKeyId = undefined; }
check(signerPublicKeyBytes.length === manifest.signerPublicKeyBinding.sizeBytes
  && sha256(signerPublicKeyBytes) === manifest.signerPublicKeyBinding.sha256
  && signerKeyId === manifest.signerPublicKeyBinding.signerKeyIdSha256
  && signerKeyId === docs.evidenceReport.evidenceBinding.signerKeyIdSha256,
'checkpoint signer public key is exact Ed25519 governed authority');
const checkpointEvidenceRoot = resolve(localRoot, 'external-evidence');
const checkpointEvidenceReverification = await verifyIdentityAccessExternalEvidenceIntake({
  evidenceRoot: checkpointEvidenceRoot,
  manifestPath: resolve(checkpointEvidenceRoot, docs.evidenceReport.evidenceBinding.manifest.relativePath),
  trustedSignerPublicKeyPem: signerPublicKeyBytes.toString('utf8'),
  trustedSignerKeyIdsSha256: [docs.evidenceReport.evidenceBinding.signerKeyIdSha256],
  expectedSourceCommit: docs.evidenceReport.evidenceBinding.sourceCommit,
  expectedSourceTree: docs.evidenceReport.evidenceBinding.sourceTree,
  observedAt: docs.receipt.recordedAt
});
check(checkpointEvidenceReverification.status === 'PASS'
  && exact(checkpointEvidenceReverification.evidenceBinding, docs.evidenceReport.evidenceBinding),
'checkpoint evidence independently re-verifies signature semantics source and expiry');
signerPublicKeyBytes.fill(0);
const localInventory = await inventoryTree(localRoot);
const closurePairNames = new Set([paths.closureInventory, `${paths.closureInventory}.sha256`]);
const beforeClosureItems = localInventory.items.filter((item) => !closurePairNames.has(item.path));
const beforeClosureTreeSha256 = sha256(Buffer.from(beforeClosureItems
  .map((item) => `${item.sha256}\t${item.sizeBytes}\t${item.path}\n`).join(''), 'utf8'));
check(docs.closureInventory.finalExpectedFilesIncludingInventoryPair === localInventory.names.length
  && docs.closureInventory.filesBeforeInventory === beforeClosureItems.length
  && docs.closureInventory.treeSha256BeforeInventory === beforeClosureTreeSha256,
'closure inventory count and pre-inventory tree hash are exact');
const proofPairPaths = proofKeys.flatMap((key) => [paths[key], `${paths[key]}.sha256`]);
check((await Promise.all(proofPairPaths.map(async (path) => {
  const [repository, checkpoint] = await Promise.all([
    readFile(full(path)), readFile(resolve(localRoot, path))
  ]);
  return repository.length === checkpoint.length && sha256(repository) === sha256(checkpoint);
}))).every(Boolean), 'repository proof pairs equal local checkpoint exact bytes');
if (external) {
  const libraryInventory = await inventoryTree(libraryRoot);
  check(exact(localInventory.names, libraryInventory.names)
    && localInventory.treeSha256 === libraryInventory.treeSha256,
  'local and D: checkpoint inventories have exact size and SHA-256 equality');
  check((await Promise.all(proofPairPaths.map(async (path) => {
    const [repository, checkpoint] = await Promise.all([
      readFile(full(path)), readFile(resolve(libraryRoot, path))
    ]);
    return repository.length === checkpoint.length && sha256(repository) === sha256(checkpoint);
  }))).every(Boolean), 'repository proof pairs equal D: checkpoint exact bytes');
}
const head = gitRun(['rev-parse', 'HEAD']).stdout.trim();
check(/^[0-9a-f]{40}$/u.test(head)
  && gitRun(['merge-base', '--is-ancestor', docs.receipt.sourceCommit, head]).status === 0,
'current HEAD descends from receipt source commit');
const finalizationDiff = gitRun(['diff', '--name-only', `${docs.receipt.sourceCommit}..${head}`]);
const finalizationPaths = finalizationDiff.stdout.trim().split(/\r?\n/u).filter(Boolean).sort();
check(finalizationDiff.status === 0 && (head === docs.receipt.sourceCommit
  || exact(finalizationPaths, IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS)),
'post-receipt source diff is empty locally or exact governed finalization state');
if (external) {
  check(gitRun(['status', '--porcelain']).stdout.trim() === '', 'current source tree is clean');
  check(head !== docs.receipt.sourceCommit
    && exact(finalizationPaths, IDENTITY_ACCESS_FINALIZATION_CHANGE_PATHS),
  'external completion HEAD contains exact committed finalization paths only');
  check(remoteHead('github') === head, 'GitHub main HEAD equals local HEAD');
  check(remoteHead('backup') === head, 'D: Git backup main HEAD equals local HEAD');
  const localProtection = nodeRun(['scripts/protect-authoritative-source.mjs', 'verify']);
  let localProtectionResult;
  try { localProtectionResult = JSON.parse(localProtection.stdout.trim()); } catch { localProtectionResult = null; }
  check(localProtection.status === 0 && localProtectionResult?.status === 'EXTERNAL_RECEIPT_VERIFIED'
    && localProtectionResult?.externalLibraryReceiptStatus === 'PASS'
    && localProtectionResult?.officialCompletionClaimed === true,
  'current authoritative source has verified local protection and bound external receipt');
  const protection = nodeRun(['scripts/protect-authoritative-source-external.mjs', 'verify']);
  let protectionResult; try { protectionResult = JSON.parse(protection.stdout.trim()); } catch { protectionResult = null; }
  check(protection.status === 0 && protectionResult?.status === 'PASS' && protectionResult?.requirement === 'PR-233'
    && protectionResult?.governanceRequirement === 'GOV-005' && protectionResult?.decision === 'DEC-267',
  'current authoritative source has verified external D: protection');
}
const finalDeliveryStatus = external && failures.length === 0
  ? 'FINAL_DELIVERY_PASS'
  : failures.length === 0 ? 'LOCAL_PROOF_PASS_EXTERNAL_PROTECTION_NOT_RUN' : 'FAIL';
console.log(`33-P completion verification: ${finalDeliveryStatus} (${checks.length - failures.length}/${checks.length} checks${external ? ', external' : ''}).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
