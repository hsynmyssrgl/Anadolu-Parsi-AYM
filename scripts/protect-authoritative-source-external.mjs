import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const mode = process.argv[2] ?? 'verify';
const sourceRoot = resolve(process.cwd());
const aymRoot = resolve(sourceRoot, '..', '..');
if (sourceRoot !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${sourceRoot}`);
const repositoryMetadata = JSON.parse(await readFile(resolve(sourceRoot, 'repository-metadata.json'), 'utf8'));
const visibleRelease = String(repositoryMetadata.visibleRelease ?? '').trim();
if (!/^(Bronze|Silver|Gold) \d{2}\.\d{2}\.\d{4}\.\d+$/u.test(visibleRelease)) throw new Error(`Unsafe visible release: ${visibleRelease}`);
const releaseRoot = join('D:\\AYM_LIBRARY', 'ParsYuva', 'ParsYuva Aile Yasam Merkezi', visibleRelease, 'authoritative-source');
const localReceiptRoot = resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT');
const externalReceiptRoot = resolve(aymRoot, '05_TEST', '30Z_EXTERNAL_RECEIPT');
const truth = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const posix = (path) => path.split(sep).join('/');
const writeBytes = async (path, bytes) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes); };
const writePair = async (path, value) => {
  const bytes = jsonBytes(value);
  const digest = sha256(bytes);
  await writeBytes(path, bytes);
  await writeBytes(`${path}.sha256`, Buffer.from(`${digest}  ${basename(path)}\n`, 'utf8'));
  return { path, sizeBytes: bytes.length, sha256: digest };
};
const copyChecked = async (source, target) => {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  const [left, right] = await Promise.all([readFile(source), readFile(target)]);
  assert(left.length === right.length && sha256(left) === sha256(right), `External readback mismatch: ${target}`);
  return { path: posix(relative(dirname(target), target)), sizeBytes: right.length, sha256: sha256(right), status: 'PASS' };
};
const listFiles = async (directory) => {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link is forbidden in external source protection: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(posix(relative(directory, path)));
      else throw new Error(`Special filesystem entry is forbidden in external source protection: ${path}`);
    }
  };
  await visit(directory);
  return files.sort();
};

const verifyLiveLocalSource = () => {
  const result = spawnSync(process.execPath, ['scripts/protect-authoritative-source.mjs', 'verify'], {
    cwd: sourceRoot,
    encoding: 'utf8',
    windowsHide: true
  });
  assert(result.status === 0, `Live local source protection failed: ${result.stderr || result.stdout}`);
  let evidence;
  try { evidence = JSON.parse(result.stdout.trim()); }
  catch { throw new Error('Live local source protection returned invalid evidence.'); }
  assert(typeof evidence.treeSha256 === 'string' && /^[0-9a-f]{64}$/u.test(evidence.treeSha256), 'Live local source protection tree identity is invalid.');
  return evidence;
};

const localProtection = async () => {
  const liveEvidence = verifyLiveLocalSource();
  const latestPath = resolve(localReceiptRoot, 'LATEST.json');
  const protection = await readJson(latestPath);
  assert(protection.source === '06_KOD/app' && protection.localReceiptStatus === 'LOCAL_RECEIPT_VERIFIED', 'Local source protection is not verified');
  const receiptPath = resolve(aymRoot, ...protection.receipt.path.split('/'));
  const backupPath = resolve(aymRoot, ...protection.backup.path.split('/'));
  const [receiptBytes, backupBytes] = await Promise.all([readFile(receiptPath), readFile(backupPath)]);
  assert(sha256(receiptBytes) === protection.receipt.sha256, 'Local source receipt hash mismatch');
  assert(sha256(backupBytes) === protection.backup.sha256 && backupBytes.length === protection.backup.bytes, 'Local deterministic backup mismatch');
  const receiptSidecar = `${receiptPath}.sha256`;
  const backupSidecar = `${backupPath}.sha256`;
  const declaredReceipt = (await readFile(receiptSidecar, 'utf8')).trim().split(/\s+/u)[0];
  const declaredBackup = (await readFile(backupSidecar, 'utf8')).trim().split(/\s+/u)[0];
  assert(declaredReceipt === protection.receipt.sha256 && declaredBackup === protection.backup.sha256, 'Local protection sidecar mismatch');
  const immutableProtectionPath = resolve(localReceiptRoot, `PROTECTION_${protection.treeSha256}.json`);
  const immutableProtection = await readJson(immutableProtectionPath);
  assert(immutableProtection.treeSha256 === protection.treeSha256, 'Immutable local protection identity mismatch');
  assert(liveEvidence.treeSha256 === protection.treeSha256, 'Live local source tree does not match the selected protection receipt');
  return { latestPath, protection, receiptPath, receiptSidecar, backupPath, backupSidecar, immutableProtectionPath };
};

const createExternal = async () => {
  const local = await localProtection();
  const { protection } = local;
  assert(protection.externalLibraryReceiptStatus === 'PENDING', 'External protection creation requires a fresh local PENDING receipt');
  const targetRoot = resolve(releaseRoot, protection.treeSha256);
  const base = [
    { source: local.receiptPath, path: `source-receipt/${basename(local.receiptPath)}` },
    { source: local.receiptSidecar, path: `source-receipt/${basename(local.receiptSidecar)}` },
    { source: local.immutableProtectionPath, path: `local-protection/${basename(local.immutableProtectionPath)}` },
    { source: local.backupPath, path: `source-backup/${basename(local.backupPath)}` },
    { source: local.backupSidecar, path: `source-backup/${basename(local.backupSidecar)}` }
  ];
  const copied = [];
  for (const item of base) {
    const target = resolve(targetRoot, item.path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(item.source, target);
    const [sourceBytes, targetBytes] = await Promise.all([readFile(item.source), readFile(target)]);
    const match = sourceBytes.length === targetBytes.length && sha256(sourceBytes) === sha256(targetBytes);
    assert(match, `D: source protection mismatch: ${item.path}`);
    copied.push({ path: item.path, sourceSizeBytes: sourceBytes.length, externalSizeBytes: targetBytes.length, sourceSha256: sha256(sourceBytes), externalSha256: sha256(targetBytes), status: 'PASS' });
  }
  const receipt = {
    schemaVersion: 1, release: visibleRelease, requirement: 'PR-233', decision: 'DEC-267',
    governanceRequirement: 'GOV-005',
    phase: 'AUTHORITATIVE_SOURCE_EXTERNAL_USB_PROTECTION', status: 'PASS', officialCompletionClaimed: true,
    source: protection.source, treeSha256: protection.treeSha256, fileCount: protection.fileCount, totalBytes: protection.totalBytes,
    storageBackend: 'EXTERNAL_USB_D_DRIVE', externalPath: targetRoot,
    localReceipt: protection.receipt, deterministicBackup: protection.backup,
    verificationBasis: 'EXACT_SIZE_AND_SHA256_READBACK', expected: copied.length, executed: copied.length,
    matched: copied.length, failed: 0, artifacts: copied, newBuildIssued: false,
    verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
  };
  const receiptName = `SOURCE_${protection.treeSha256}.json`;
  const localExternalReceiptPath = resolve(externalReceiptRoot, receiptName);
  const receiptBinding = await writePair(localExternalReceiptPath, receipt);
  const externalReceiptPath = resolve(targetRoot, 'external-receipt', receiptName);
  await copyChecked(localExternalReceiptPath, externalReceiptPath);
  await copyChecked(`${localExternalReceiptPath}.sha256`, `${externalReceiptPath}.sha256`);
  const externalReceiptBytes = await readFile(externalReceiptPath);
  assert(sha256(externalReceiptBytes) === receiptBinding.sha256, 'D: external receipt self readback mismatch');
  const readback = {
    schemaVersion: 1, release: receipt.release, requirement: 'PR-233', decision: 'DEC-267',
    governanceRequirement: 'GOV-005',
    phase: 'AUTHORITATIVE_SOURCE_EXTERNAL_USB_FINAL_READBACK', status: 'PASS', countsAsPass: true,
    storageBackend: 'EXTERNAL_USB_D_DRIVE', externalPath: targetRoot,
    treeSha256: protection.treeSha256, baseExpected: copied.length, baseMatched: copied.length,
    receiptExpected: 2, receiptMatched: 2, failed: 0,
    expectedFinalFileCount: copied.length + 4, verifiedAt: new Date().toISOString(), mandatoryTruthSentence: truth
  };
  const localReadbackPath = resolve(externalReceiptRoot, `READBACK_${protection.treeSha256}.json`);
  const readbackBinding = await writePair(localReadbackPath, readback);
  const externalReadbackPath = resolve(targetRoot, 'external-receipt', basename(localReadbackPath));
  await copyChecked(localReadbackPath, externalReadbackPath);
  await copyChecked(`${localReadbackPath}.sha256`, `${externalReadbackPath}.sha256`);
  const names = await listFiles(targetRoot);
  assert(names.length === readback.expectedFinalFileCount, `D: final source protection file count mismatch: ${names.length}`);
  const completedProtection = {
    ...protection,
    externalLibraryReceiptStatus: 'PASS', officialCompletionClaimed: true,
    externalReceipt: {
      path: `05_TEST/30Z_EXTERNAL_RECEIPT/${receiptName}`, sha256: receiptBinding.sha256,
      readbackPath: `05_TEST/30Z_EXTERNAL_RECEIPT/${basename(localReadbackPath)}`,
      readbackSha256: readbackBinding.sha256, storageBackend: 'EXTERNAL_USB_D_DRIVE',
      externalPath: targetRoot, finalFileCount: names.length
    }
  };
  const finalLiveEvidence = verifyLiveLocalSource();
  assert(finalLiveEvidence.treeSha256 === protection.treeSha256, 'Live local source changed before external protection promotion');
  await writeBytes(local.latestPath, jsonBytes(completedProtection));
  await writeBytes(resolve(externalReceiptRoot, 'LATEST.json'), jsonBytes(receipt));
  console.log(JSON.stringify({ status: 'PASS', requirement: receipt.requirement, governanceRequirement: receipt.governanceRequirement, decision: receipt.decision, treeSha256: protection.treeSha256, externalPath: targetRoot, files: names.length }));
};

const verifyExternal = async () => {
  const local = await localProtection();
  const { protection } = local;
  assert(protection.externalLibraryReceiptStatus === 'PASS' && protection.officialCompletionClaimed === true, 'Current source external protection is not PASS');
  assert(protection.externalReceipt?.storageBackend === 'EXTERNAL_USB_D_DRIVE' && String(protection.externalReceipt.externalPath).startsWith(`${releaseRoot}\\`), 'External D: backend truth boundary mismatch');
  const receiptPath = resolve(aymRoot, ...protection.externalReceipt.path.split('/'));
  const readbackPath = resolve(aymRoot, ...protection.externalReceipt.readbackPath.split('/'));
  const [receiptBytes, readbackBytes] = await Promise.all([readFile(receiptPath), readFile(readbackPath)]);
  assert(sha256(receiptBytes) === protection.externalReceipt.sha256, 'External receipt local hash mismatch');
  assert(sha256(readbackBytes) === protection.externalReceipt.readbackSha256, 'External readback local hash mismatch');
  const receipt = JSON.parse(receiptBytes.toString('utf8'));
  const readback = JSON.parse(readbackBytes.toString('utf8'));
  assert(receipt.status === 'PASS' && receipt.release === visibleRelease && receipt.requirement === 'PR-233' && receipt.governanceRequirement === 'GOV-005' && receipt.decision === 'DEC-267' && receipt.treeSha256 === protection.treeSha256 && receipt.externalPath === protection.externalReceipt.externalPath, 'External receipt identity mismatch');
  assert(readback.status === 'PASS' && readback.release === visibleRelease && readback.requirement === receipt.requirement && readback.governanceRequirement === receipt.governanceRequirement && readback.decision === receipt.decision && readback.treeSha256 === protection.treeSha256, 'External readback identity mismatch');
  const names = await listFiles(protection.externalReceipt.externalPath);
  assert(names.length === protection.externalReceipt.finalFileCount && names.length === readback.expectedFinalFileCount, 'D: external inventory count mismatch');
  for (const artifact of receipt.artifacts) {
    const bytes = await readFile(resolve(protection.externalReceipt.externalPath, artifact.path));
    assert(bytes.length === artifact.sourceSizeBytes && sha256(bytes) === artifact.sourceSha256, `D: artifact readback mismatch: ${artifact.path}`);
  }
  for (const path of [receiptPath, `${receiptPath}.sha256`, readbackPath, `${readbackPath}.sha256`]) {
    const external = resolve(protection.externalReceipt.externalPath, 'external-receipt', basename(path));
    const [left, right] = await Promise.all([readFile(path), readFile(external)]);
    assert(left.length === right.length && sha256(left) === sha256(right), `D: supplemental readback mismatch: ${basename(path)}`);
  }
  const finalLiveEvidence = verifyLiveLocalSource();
  assert(finalLiveEvidence.treeSha256 === protection.treeSha256, 'Live local source changed during external protection verification');
  console.log(JSON.stringify({ status: 'PASS', requirement: receipt.requirement, governanceRequirement: receipt.governanceRequirement, decision: receipt.decision, treeSha256: protection.treeSha256, externalPath: protection.externalReceipt.externalPath, files: names.length }));
};

if (mode === 'create') await createExternal();
else if (mode === 'verify') await verifyExternal();
else throw new Error(`Unknown mode: ${mode}. Use create or verify.`);
