import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import {
  access, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { verifyIdentityAccessExternalEvidenceIntake } from './lib/identity-access-external-evidence-intake.mjs';
import {
  IDENTITY_ACCESS_COMPLETION_REQUIREMENTS,
  IDENTITY_ACCESS_PASS_EVIDENCE
} from './lib/identity-access-preparation-state-machine.mjs';
import {
  buildIdentityAccessFinalState,
  evaluateIdentityAccessReceiptFinalization
} from './lib/identity-access-finalization-state-machine.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const rawArguments = process.argv.slice(2);
const allowedFlags = new Set(['--evidence-root', '--manifest', '--trusted-signer-public-key', '--dry-run']);
const valueFlags = new Set(['--evidence-root', '--manifest', '--trusted-signer-public-key']);
if (rawArguments.some((argument, index) => argument.startsWith('--')
  ? !allowedFlags.has(argument) : index === 0 || !valueFlags.has(rawArguments[index - 1]))) {
  throw new Error('Unsupported 33-P finalizer argument');
}
const dryRun = rawArguments.includes('--dry-run');
if (rawArguments.filter((argument) => argument === '--dry-run').length > 1) {
  throw new Error('33-P finalizer accepts --dry-run at most once');
}
const value = (name) => {
  const indexes = rawArguments.map((argument, index) => argument === name ? index : -1)
    .filter((index) => index >= 0);
  if (indexes.length !== 1 || indexes[0] === rawArguments.length - 1
    || rawArguments[indexes[0] + 1].startsWith('--')) {
    throw new Error(`33-P finalizer requires exactly one value for ${name}`);
  }
  return rawArguments[indexes[0] + 1];
};
const evidenceRootArgument = value('--evidence-root');
const manifestArgument = value('--manifest');
const trustedSignerPublicKeyArgument = value('--trusted-signer-public-key');

const stepId = '33-P';
const decision = 'DEC-227';
const localRoot = resolve('C:\\PPT\\AYM', '09_ARSIV', 'KAYNAK_AGACI', 'checkpoints',
  '33-P_Passkeys_Federated_Identity_Verifiable_Temporary_Credentials');
const libraryRoot = resolve('D:\\AYM_LIBRARY', 'Panthera pardus tulliana',
  'Anadolu Parsı Aile Yaşam Merkezi', 'Bronze 04.08.2026.29', 'checkpoints',
  '33-P_Passkeys_Federated_Identity_Verifiable_Temporary_Credentials');
const suffix = `.staging-${process.pid}-${Date.now()}`;
const localStaging = `${localRoot}${suffix}`;
const libraryStaging = `${libraryRoot}${suffix}`;
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  scope: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  inventory: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  trustedSigners: 'config/33-p-identity-access-external-evidence-trusted-signers.json',
  decisionDocument: 'docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md',
  threatModel: 'docs/security/THREAT_MODEL_33_P_PASSKEYS_FEDERATED_IDENTITY_VERIFIABLE_TEMPORARY_CREDENTIALS.md',
  audit: 'docs/audit/33-P_IDENTITY_ACCESS_CREDENTIALS_UST_KAPANIS.md',
  boundary: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-boundary.json',
  contract: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-contract.json',
  runtime: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  ppk021: 'artifacts/validation/platform-policy-ast-gate.json',
  ppk022: 'artifacts/validation/platform-capability-manifest-gate.json',
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
const proofPaths = Object.freeze(proofKeys.map((key) => paths[key]));
const finalStatePaths = Object.freeze([
  paths.scope, paths.inventory, paths.registry, paths.plan, paths.ledger, paths.roadmap,
  paths.decisionDocument, paths.threatModel, paths.audit
]);
const full = (path) => resolve(root, path);
const posix = (path) => path.split(sep).join('/');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
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
const sidecarExact = async (path) => {
  try {
    const bytes = await readFile(full(path));
    return await readFile(full(`${path}.sha256`), 'utf8') === `${sha256(bytes)}  ${basename(path)}\n`;
  } catch { return false; }
};
const writeNewBytes = async (path, bytes) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: 'wx' });
  const readback = await readFile(path);
  assert(readback.equals(bytes), `33-P no-overwrite readback mismatch: ${path}`);
};
const copy = async (sourceRoot, targetRoot, path) => {
  const target = resolve(targetRoot, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(sourceRoot, path), target, fsConstants.COPYFILE_EXCL);
  const [sourceBytes, targetBytes] = await Promise.all([
    readFile(resolve(sourceRoot, path)), readFile(target)
  ]);
  assert(sourceBytes.equals(targetBytes), `33-P checkpoint copy readback mismatch: ${path}`);
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
  return { names, items, fileCount: items.length, treeSha256: sha256(Buffer.from(canonical, 'utf8')) };
};
const compareTrees = async (left, right) => {
  const [a, b] = await Promise.all([inventoryTree(left), inventoryTree(right)]);
  return { status: a.fileCount === b.fileCount && a.treeSha256 === b.treeSha256 ? 'PASS' : 'FAIL', left: a, right: b };
};
const safeEvidenceBytes = async (base, relativePath, expected) => {
  assert(typeof relativePath === 'string' && relativePath.length > 0 && !isAbsolute(relativePath)
    && !relativePath.includes('\\') && !relativePath.split('/').some((part) => part === '' || part === '.' || part === '..'),
  `Unsafe 33-P evidence path: ${relativePath}`);
  const baseReal = await realpath(base);
  const target = resolve(baseReal, ...relativePath.split('/'));
  assert(target.startsWith(`${baseReal}${sep}`), `33-P evidence path escaped root: ${relativePath}`);
  const metadata = await lstat(target);
  assert(metadata.isFile() && !metadata.isSymbolicLink(), `33-P evidence entry is not a regular file: ${relativePath}`);
  const targetReal = await realpath(target);
  assert(targetReal.startsWith(`${baseReal}${sep}`), `33-P evidence realpath escaped root: ${relativePath}`);
  const bytes = await readFile(targetReal);
  assert(bytes.length === expected.sizeBytes && sha256(bytes) === expected.sha256,
    `33-P evidence bytes drifted after signed intake: ${relativePath}`);
  return bytes;
};
const cleanupStaging = async () => {
  for (const path of [localStaging, libraryStaging]) {
    if (await exists(path)) await rm(path, { recursive: true, force: true });
  }
};

for (const path of [paths.preparation, `${paths.preparation}.sha256`, paths.evidenceReport,
  `${paths.evidenceReport}.sha256`]) {
  assert(await exists(full(path)), `33-P finalizer requires prepared artifact: ${path}`);
}
const [
  scope, scopeInventory, registry, roadmap, workPlan, ledger, predecessorReceipt,
  trustedSignerRegistry, evidenceReport, preparationRecord, boundary, contract, runtime,
  migration, ppk021, ppk022, decisionDocument, threatModel, preparedAudit
] = await Promise.all([
  readJson(paths.scope), readJson(paths.inventory), readJson(paths.registry), readJson(paths.roadmap),
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.predecessor), readJson(paths.trustedSigners),
  readJson(paths.evidenceReport), readJson(paths.preparation), readJson(paths.boundary), readJson(paths.contract),
  readJson(paths.runtime), readJson(paths.migration), readJson(paths.ppk021), readJson(paths.ppk022),
  readFile(full(paths.decisionDocument), 'utf8'), readFile(full(paths.threatModel), 'utf8'),
  readFile(full(paths.audit), 'utf8')
]);
assert(await sidecarExact(paths.predecessor) && await sidecarExact(paths.evidenceReport)
  && await sidecarExact(paths.preparation), '33-P predecessor/evidence/preparation sidecar drift');
assert(boundary.status === 'PASS' && boundary.checksPassed === 21 && boundary.checksFailed === 0
  && contract.status === 'PASS' && contract.checksPassed === 17 && contract.checksFailed === 0
  && runtime.status === 'PASS' && runtime.checksPassed === 24 && runtime.checksFailed === 0
  && runtime.targetedTestFilesPassed === 19 && runtime.targetedTestsPassed >= 116,
'33-P technical validation artifacts drifted');
const migration93 = migration.migrationVersions?.find((item) => item.version === 93);
assert(migration.status === 'passed'
  && migration93?.checksum === '51191e62bcf4baec07e3eab5985ef4210402cdb8b7416064519ceb082322916a'
  && preparationRecord.technicalEvidence?.migration93Checksum === migration93.checksum,
'33-P migration 93 binding drift');
assert(ppk021.status === 'PASS' && ppk021.findings?.length === 0
  && ppk021.exactAllowlistEntries === preparationRecord.technicalEvidence?.ppk021?.exactAllowlistEntries
  && ppk022.status === 'PASS' && ppk022.findings?.length === 0
  && ppk022.exactManifestSurfaces === preparationRecord.technicalEvidence?.ppk022?.exactManifestSurfaces,
'33-P PPK-021/022 evidence drift');

const status = gitRun(['status', '--porcelain']);
const head = gitRun(['rev-parse', 'HEAD']);
const tree = gitRun(['rev-parse', 'HEAD^{tree}']);
assert(status.status === 0 && status.stdout.trim() === '', '33-P finalization requires a clean committed tree');
assert(head.status === 0 && /^[0-9a-f]{40}$/u.test(head.stdout.trim()), 'Could not resolve 33-P source HEAD');
assert(tree.status === 0 && /^[0-9a-f]{40}$/u.test(tree.stdout.trim()), 'Could not resolve 33-P source tree');
const sourceCommit = head.stdout.trim();
const evidenceSourceCommit = evidenceReport.evidenceBinding?.sourceCommit;
const sourceDiff = gitRun(['diff', '--name-only', `${evidenceSourceCommit}..${sourceCommit}`]);
assert(sourceDiff.status === 0, 'Could not resolve 33-P post-evidence source diff');
const changedPathsSinceEvidence = sourceDiff.stdout.trim().split(/\r?\n/u).filter(Boolean).sort();
const finalizedAt = new Date().toISOString();
const gitBinding = {
  clean: true,
  head: sourceCommit,
  tree: tree.stdout.trim(),
  evidenceSourceCommit,
  evidenceSourceAncestor: gitRun(['merge-base', '--is-ancestor', evidenceSourceCommit, sourceCommit]).status === 0,
  predecessorSourceCommit: predecessorReceipt.sourceCommit,
  predecessorAncestor: gitRun(['merge-base', '--is-ancestor', predecessorReceipt.sourceCommit, sourceCommit]).status === 0,
  remoteHeadsEqual: remoteHead('github') === sourceCommit && remoteHead('backup') === sourceCommit,
  changedPathsSinceEvidence
};

const signerPublicKeyPath = resolve(trustedSignerPublicKeyArgument);
const signerMetadata = await lstat(signerPublicKeyPath);
assert(signerMetadata.isFile() && !signerMetadata.isSymbolicLink(), '33-P signer public key must be a regular file');
const trustedSignerPublicKeyPem = await readFile(await realpath(signerPublicKeyPath), 'utf8');
assert(Buffer.byteLength(trustedSignerPublicKeyPem, 'utf8') <= 16 * 1024
  && trustedSignerPublicKeyPem.includes('-----BEGIN PUBLIC KEY-----')
  && trustedSignerPublicKeyPem.includes('-----END PUBLIC KEY-----')
  && !trustedSignerPublicKeyPem.includes('PRIVATE KEY'), '33-P signer input must be bounded public-key PEM');
const trustedSignerKeyIdsSha256 = trustedSignerRegistry.signers?.map((signer) => signer.signerKeyIdSha256) ?? [];
const reverifiedEvidence = await verifyIdentityAccessExternalEvidenceIntake({
  evidenceRoot: resolve(evidenceRootArgument),
  manifestPath: resolve(manifestArgument),
  trustedSignerPublicKeyPem,
  trustedSignerKeyIdsSha256,
  expectedSourceCommit: evidenceReport.evidenceBinding.sourceCommit,
  expectedSourceTree: evidenceReport.evidenceBinding.sourceTree,
  observedAt: finalizedAt
});
assert(reverifiedEvidence.status === 'PASS'
  && exact(reverifiedEvidence.evidenceBinding, evidenceReport.evidenceBinding),
'33-P signed evidence did not reverify to the prepared binding');

const completionEvidencePaths = [...new Set([
  paths.scope, paths.inventory, paths.trustedSigners, paths.decisionDocument, paths.threatModel,
  paths.boundary, paths.contract, paths.runtime, paths.migration, paths.ppk021, paths.ppk022,
  paths.evidenceReport, paths.preparation,
  ...(scopeInventory.implementedPaths ?? []), ...(scopeInventory.targetedTests ?? []),
  ...(scopeInventory.evidenceOutputs ?? [])
])].sort();
const evaluationInput = {
  scope, inventory: scopeInventory, acceptedScopeRegistry: registry, roadmap, workPlan, ledger,
  predecessorReceipt, trustedSignerRegistry, evidenceReport, preparationRecord, gitBinding, finalizedAt
};
const evaluation = evaluateIdentityAccessReceiptFinalization(evaluationInput);
assert(evaluation.status === 'PASS', `33-P finalization readiness failed: ${evaluation.checks
  .filter((item) => item.status === 'FAIL').map((item) => item.id).join(', ')}`);
for (const path of completionEvidencePaths) assert(await exists(full(path)), `33-P completion evidence is missing: ${path}`);
for (const path of proofPaths.flatMap((path) => [path, `${path}.sha256`])) {
  assert(!await exists(full(path)), `33-P finalizer no-overwrite proof target exists: ${path}`);
}
assert(!(await exists(localRoot)) && !(await exists(libraryRoot)), '33-P checkpoint target already exists');
assert(!(await exists(localStaging)) && !(await exists(libraryStaging)), '33-P checkpoint staging target already exists');
if (dryRun) {
  console.log(JSON.stringify({
    status: 'PASS', mode: 'DRY_RUN_READ_ONLY', mutated: false, step: stepId,
    checksPassed: evaluation.passed, sourceCommit, evidenceSourceCommit,
    externalEvidenceReverified: true, githubHead: sourceCommit, backupHead: sourceCommit,
    targetsAbsent: true, stagingTargetsAbsent: true
  }));
  process.exit(0);
}

const createdProofFiles = [];
let checkpointPromoted = false;
let localPromoted = false;
let libraryPromoted = false;
const writePair = async (path, value) => {
  const bytes = jsonBytes(value);
  const sidecarBytes = Buffer.from(`${sha256(bytes)}  ${basename(path)}\n`, 'ascii');
  await writeNewBytes(full(path), bytes);
  createdProofFiles.push(full(path));
  try {
    await writeNewBytes(full(`${path}.sha256`), sidecarBytes);
    createdProofFiles.push(full(`${path}.sha256`));
  } catch (error) {
    await rm(full(path), { force: true });
    createdProofFiles.pop();
    throw error;
  }
  return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
};
const copyPair = async (binding) => {
  for (const target of [localStaging, libraryStaging]) {
    await copy(root, target, binding.path);
    await copy(root, target, `${binding.path}.sha256`);
  }
};
const writeFinalStateAtomic = async (path, bytes) => {
  const temporary = resolve(root, '.tmp', '33-p-final-state', `${basename(path)}.${process.pid}.tmp`);
  try {
    await writeNewBytes(temporary, bytes);
    await rename(temporary, full(path));
    assert((await readFile(full(path))).equals(bytes), `33-P final state readback mismatch: ${path}`);
  } finally {
    if (await exists(temporary)) await rm(temporary, { force: true });
  }
};

try {
  const completedAt = finalizedAt;
  const finalStateResult = buildIdentityAccessFinalState({
    ...evaluationInput,
    finalizedAt: completedAt,
    receiptPath: paths.receipt,
    proofPaths,
    completionEvidencePaths,
    localCheckpointPath: localRoot,
    libraryCheckpointPath: libraryRoot
  });
  const markCompleted = (document, label) => {
    assert(document.includes('- Durum: VALIDATED_RECEIPT_PENDING')
      && document.includes('- Uygulama gerçeği: VALIDATED_EXTERNAL_EVIDENCE_RECEIPT_PENDING')
      && document.includes('Actual external evidence: PASS_SIGNED_EXTERNAL_EVIDENCE'),
    `${label} is not signed-evidence receipt-pending`);
    return document
      .replace('- Durum: VALIDATED_RECEIPT_PENDING', '- Durum: COMPLETED')
      .replace('- Uygulama gerçeği: VALIDATED_EXTERNAL_EVIDENCE_RECEIPT_PENDING',
        '- Uygulama gerçeği: COMPLETED_SIGNED_EXTERNAL_EVIDENCE_RECEIPT_PASS')
      + `\n\n## Persistent receipt completion\n\n`
      + `- 33-P status: COMPLETED / PASS.\n`
      + `- Receipt: ${paths.receipt}.\n`
      + `- Evidence source commit: ${evidenceSourceCommit}; finalizer source commit: ${sourceCommit}.\n`
      + `- Next package: 33-Q / DEC-228, READY_NEXT and not activated.\n`
      + `- Certification claim: false; provider/network delivery guarantees: false.\n`;
  };
  const finalDecisionDocument = Buffer.from(markCompleted(decisionDocument, 'DEC-227'), 'utf8');
  const finalThreatModel = Buffer.from(markCompleted(threatModel, '33-P threat model'), 'utf8');
  const finalAudit = Buffer.from(`# 33-P Kimlik Erişimi ve Yetki Belgeleri - Üst Kapanış\n\n`
    + `## Durum\n\nCOMPLETED / PASS. Governed signer, sekiz signed external evidence sınıfı, teknik gate ve persistent receipt exact source zincirine bağlıdır.\n\n`
    + `## Kanıt\n\n- Evidence source commit: ${evidenceSourceCommit}.\n`
    + `- Finalizer source commit: ${sourceCommit}.\n`
    + `- Evidence tree SHA-256: ${evidenceReport.evidenceBinding.evidenceTreeSha256}.\n`
    + `- Boundary 21/21; contract 17/17; runtime 24/24; hedefli test 19 dosya / ${runtime.targetedTestsPassed} test.\n`
    + `- Migration 93: ${migration93.checksum}.\n`
    + `- Yerel ve D: checkpoint recursive byte/size/SHA-256 readback: PASS.\n\n`
    + `## Dürüst sınırlar\n\n- Certification claim: false.\n`
    + `- Provider availability ve network delivery guarantee: false.\n`
    + `- Fiziksel secure erase ve backup propagation guarantee: false.\n`
    + `- Source protection finalizer tarafından çalıştırılmadı; external completion verifier öncesi final delivery PENDING.\n\n`
    + `## Ardıl\n\n33-Q / DEC-228 yalnız ayrı aktivasyonla başlayabilir.\n`, 'utf8');
  const finalState = new Map([
    [paths.plan, jsonBytes(finalStateResult.workPlan)],
    [paths.ledger, jsonBytes(finalStateResult.ledger)],
    [paths.roadmap, jsonBytes(finalStateResult.roadmap)],
    [paths.decisionDocument, finalDecisionDocument],
    [paths.threatModel, finalThreatModel],
    [paths.audit, finalAudit],
    [paths.scope, jsonBytes(finalStateResult.scope)],
    [paths.inventory, jsonBytes(finalStateResult.inventory)],
    // The accepted registry is the atomic closure authority and is published last.
    [paths.registry, jsonBytes(finalStateResult.acceptedScopeRegistry)]
  ]);

  const sourceTree = gitRun(['ls-tree', '-r', sourceCommit]);
  assert(sourceTree.status === 0, 'Could not enumerate 33-P source commit');
  const tracked = sourceTree.stdout.trim().split(/\r?\n/u).filter(Boolean).map((line) => {
    const match = line.match(/^(100644|100755) blob ([0-9a-f]+)\t(.+)$/u);
    assert(match, `Non-regular tracked entry: ${line}`);
    return { gitMode: match[1], gitObjectId: match[2], sourcePath: match[3] };
  });
  await mkdir(resolve(localStaging, 'payload'), { recursive: true });
  const payload = [];
  for (const item of tracked) {
    const blob = gitBytes(['cat-file', 'blob', item.gitObjectId]);
    assert(blob.status === 0 && Buffer.isBuffer(blob.stdout), `Could not read Git blob: ${item.gitObjectId}`);
    const packagePath = `payload/${item.sourcePath}`;
    await writeNewBytes(resolve(localStaging, packagePath), blob.stdout);
    payload.push({ ...item, packagePath, sizeBytes: blob.stdout.length, sha256: sha256(blob.stdout) });
  }
  const finalStateBindings = [];
  for (const [path, bytes] of finalState) {
    const packagePath = `final-state/${path}`;
    await writeNewBytes(resolve(localStaging, packagePath), bytes);
    finalStateBindings.push({ sourcePath: path, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes) });
  }
  const externalEvidenceBindings = [];
  for (const entry of [evidenceReport.evidenceBinding.manifest, ...evidenceReport.evidenceBinding.files]) {
    const relativePath = entry.relativePath;
    const bytes = await safeEvidenceBytes(resolve(evidenceRootArgument), relativePath, entry);
    const packagePath = `external-evidence/${relativePath}`;
    await writeNewBytes(resolve(localStaging, packagePath), bytes);
    externalEvidenceBindings.push({
      ...(entry.id ? { id: entry.id } : { id: 'signed-manifest' }),
      sourceRelativePath: relativePath, packagePath, sizeBytes: bytes.length, sha256: sha256(bytes)
    });
    bytes.fill(0);
  }
  const signerPublicKeyBytes = Buffer.from(trustedSignerPublicKeyPem, 'utf8');
  const signerPublicKeyPackagePath = 'external-evidence/trusted-signer-public-key.pem';
  await writeNewBytes(resolve(localStaging, signerPublicKeyPackagePath), signerPublicKeyBytes);
  const signerPublicKeyBinding = {
    packagePath: signerPublicKeyPackagePath,
    sizeBytes: signerPublicKeyBytes.length,
    sha256: sha256(signerPublicKeyBytes),
    signerKeyIdSha256: evidenceReport.evidenceBinding.signerKeyIdSha256
  };
  signerPublicKeyBytes.fill(0);

  const common = Object.freeze({
    schemaVersion: 1,
    release: 'Bronze 04.08.2026.29',
    step: stepId,
    decision,
    requirements: IDENTITY_ACCESS_COMPLETION_REQUIREMENTS,
    sourceCommit,
    evidenceSourceCommit,
    evidenceSourceTree: evidenceReport.evidenceBinding.sourceTree,
    evidenceTreeSha256: evidenceReport.evidenceBinding.evidenceTreeSha256,
    signerKeyIdSha256: evidenceReport.evidenceBinding.signerKeyIdSha256,
    predecessorStep: '33-O',
    predecessorReceiptPath: paths.predecessor,
    predecessorSourceCommit: predecessorReceipt.sourceCommit,
    sourceCommitRange: `${predecessorReceipt.sourceCommit}..${sourceCommit}`,
    preparationRecordPath: paths.preparation,
    evidenceReportPath: paths.evidenceReport,
    currentAuthoritativeSourceExternalProtectionStatus: 'NOT_RUN_BY_FINALIZER_EXTERNAL_COMPLETION_REQUIRED',
    finalDeliveryStatus: 'PENDING_EXTERNAL_SOURCE_PROTECTION_VERIFICATION',
    finalDeliveryClaimed: false,
    nextOfficialStep: '33-Q',
    nextOfficialDecision: 'DEC-228',
    externalEvidenceStatus: IDENTITY_ACCESS_PASS_EVIDENCE,
    certificationClaimed: false,
    legalCertificationClaimed: false,
    privacyCertificationClaimed: false,
    identityCertificationClaimed: false,
    providerAvailabilityGuaranteed: false,
    networkDeliveryGuaranteed: false,
    physicalSecureEraseGuaranteed: false,
    backupPropagationGuaranteed: false
  });
  const manifestName = '33-P_CHECKPOINT_MANIFEST.json';
  const manifest = {
    ...common,
    phase: 'IDENTITY_ACCESS_CREDENTIAL_CHECKPOINT_PACKAGE',
    status: 'PASS',
    payloadMode: 'EXACT_COMPLETE_TRACKED_SOURCE_SNAPSHOT_AT_HEAD_PLUS_FINAL_GOVERNANCE_AND_SIGNED_EVIDENCE',
    trackedSourceFileCount: tracked.length,
    payloadCount: payload.length,
    payload,
    finalStateBindings,
    externalEvidenceBindings,
    signerPublicKeyBinding,
    persistentReceiptStatus: 'PENDING',
    officialCompletionClaimed: false,
    createdAt: completedAt
  };
  const manifestBytes = jsonBytes(manifest);
  await writeNewBytes(resolve(localStaging, manifestName), manifestBytes);
  await writeNewBytes(resolve(localStaging, `${manifestName}.sha256`),
    Buffer.from(`${sha256(manifestBytes)}  ${manifestName}\n`, 'ascii'));
  const baseInventory = await inventoryTree(localStaging);
  await mkdir(libraryStaging, { recursive: true });
  for (const path of baseInventory.names) await copy(localStaging, libraryStaging, path);
  const baseCompare = await compareTrees(localStaging, libraryStaging);
  assert(baseCompare.status === 'PASS', '33-P D: base checkpoint readback mismatch');

  const readback = await writePair(paths.readback, {
    ...common, status: 'PASS', countsAsPass: true, storageBackend: 'EXTERNAL_USB_D_DRIVE',
    libraryPath: libraryRoot, localCheckpointPath: localRoot,
    expected: baseCompare.left.fileCount, matched: baseCompare.right.fileCount, failed: 0,
    sourceTreeSha256: baseCompare.left.treeSha256, libraryTreeSha256: baseCompare.right.treeSha256,
    verifiedAt: new Date().toISOString()
  });
  const receipt = await writePair(paths.receipt, {
    ...common, status: 'PASS', validationStatus: 'PASS', persistentReceiptStatus: 'PASS',
    officialStepStatus: 'COMPLETED', officialCompletionClaimed: true,
    storageBackend: 'EXTERNAL_USB_D_DRIVE', libraryPath: libraryRoot, localCheckpointPath: localRoot,
    verificationBasis: 'EXACT_RECURSIVE_FILE_SET_SHA256_SIZE_AND_SIGNED_EVIDENCE_READBACK',
    basePackage: {
      expected: baseCompare.left.fileCount, matched: baseCompare.right.fileCount, failed: 0,
      treeSha256: baseCompare.left.treeSha256, status: 'PASS'
    },
    recordedAt: new Date().toISOString()
  });
  await copyPair(readback);
  await copyPair(receipt);
  const receiptCompare = await compareTrees(localStaging, libraryStaging);
  assert(receiptCompare.status === 'PASS', '33-P receipt readback mismatch');
  const receiptReadback = await writePair(paths.receiptReadback, {
    ...common, status: 'PASS', expected: receiptCompare.left.fileCount,
    matched: receiptCompare.right.fileCount, failed: 0,
    localTreeSha256: receiptCompare.left.treeSha256, libraryTreeSha256: receiptCompare.right.treeSha256,
    verifiedAt: new Date().toISOString()
  });
  await copyPair(receiptReadback);
  const persistenceCompare = await compareTrees(localStaging, libraryStaging);
  assert(persistenceCompare.status === 'PASS', '33-P receipt persistence mismatch');
  const persistence = await writePair(paths.persistence, {
    ...common, status: 'PASS', expected: persistenceCompare.left.fileCount,
    matched: persistenceCompare.right.fileCount, failed: 0,
    localTreeSha256: persistenceCompare.left.treeSha256,
    libraryTreeSha256: persistenceCompare.right.treeSha256,
    verifiedAt: new Date().toISOString()
  });
  await copyPair(persistence);
  const beforeFinalInventory = await inventoryTree(localStaging);
  const finalInventory = await writePair(paths.finalInventory, {
    ...common, status: 'PASS', countsAsPass: true,
    filesBeforeInventory: beforeFinalInventory.fileCount,
    treeSha256BeforeInventory: beforeFinalInventory.treeSha256,
    finalExpectedFilesIncludingInventoryPair: beforeFinalInventory.fileCount + 2,
    verifiedAt: new Date().toISOString()
  });
  await copyPair(finalInventory);
  const completion = await writePair(paths.completion, {
    ...common, status: 'PASS', officialStepStatus: 'COMPLETED', validationStatus: 'PASS',
    persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
    persistentReceiptPath: paths.receipt, libraryPath: libraryRoot,
    localCheckpointPath: localRoot, storageBackend: 'EXTERNAL_USB_D_DRIVE', completedAt
  });
  await copyPair(completion);
  const transitionChecks = [
    ['readiness exact', evaluation.status === 'PASS'],
    ['registry exact', IDENTITY_ACCESS_COMPLETION_REQUIREMENTS.every((id) => {
      const item = finalStateResult.acceptedScopeRegistry.requirements.find((candidate) => candidate.id === id);
      return item?.status === 'COMPLETE' && Object.values(item.chain ?? {}).every(Boolean);
    })],
    ['work step complete', finalStateResult.workPlan.steps.find((item) => item.id === '33-P')?.status === 'COMPLETED'],
    ['successor declared', finalStateResult.roadmap.packages.find((item) => item.step === '33-Q')?.status === 'READY_NEXT'
      && finalStateResult.workPlan.currentStep === null]
  ].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
  assert(transitionChecks.every((item) => item.status === 'PASS'), '33-P completion transition failed');
  const transition = await writePair(paths.transition, {
    ...common, status: 'PASS', expected: transitionChecks.length, passed: transitionChecks.length,
    failed: 0, checks: transitionChecks, officialStepStatus: 'COMPLETED',
    persistentReceiptStatus: 'PASS', officialCompletionClaimed: true,
    verifiedAt: new Date().toISOString()
  });
  await copyPair(transition);
  const beforeClosure = await inventoryTree(localStaging);
  const closureInventory = await writePair(paths.closureInventory, {
    ...common, status: 'PASS', countsAsPass: true, officialCompletionClaimed: true,
    filesBeforeInventory: beforeClosure.fileCount, treeSha256BeforeInventory: beforeClosure.treeSha256,
    finalExpectedFilesIncludingInventoryPair: beforeClosure.fileCount + 2,
    verifiedAt: new Date().toISOString()
  });
  await copyPair(closureInventory);
  const finalCompare = await compareTrees(localStaging, libraryStaging);
  assert(finalCompare.status === 'PASS'
    && finalCompare.left.fileCount === beforeClosure.fileCount + 2,
  '33-P final local/D checkpoint mismatch');
  const promotionStatus = gitRun(['status', '--porcelain']);
  assert(promotionStatus.status === 0 && promotionStatus.stdout.trim() === '',
    '33-P source tree changed during checkpoint staging');
  assert(remoteHead('github') === sourceCommit && remoteHead('backup') === sourceCommit,
    '33-P remote HEAD changed during checkpoint staging');
  assert(!(await exists(localRoot)) && !(await exists(libraryRoot)),
    '33-P final checkpoint target appeared during staging');
  await rename(libraryStaging, libraryRoot);
  libraryPromoted = true;
  await rename(localStaging, localRoot);
  localPromoted = true;
  checkpointPromoted = true;
  for (const [path, bytes] of finalState) await writeFinalStateAtomic(path, bytes);
  console.log(`33-P external receipt: PASS; final delivery PENDING external source protection verification (${finalCompare.left.fileCount} exact local/D files; source ${sourceCommit}).`);
} catch (error) {
  if (!checkpointPromoted) {
    if (localPromoted && await exists(localRoot) && !(await exists(localStaging))) {
      await rename(localRoot, localStaging);
      localPromoted = false;
    }
    if (libraryPromoted && await exists(libraryRoot) && !(await exists(libraryStaging))) {
      await rename(libraryRoot, libraryStaging);
      libraryPromoted = false;
    }
  }
  await cleanupStaging();
  if (!checkpointPromoted) {
    for (const path of [...createdProofFiles].reverse()) await rm(path, { force: true });
  }
  throw error;
}
