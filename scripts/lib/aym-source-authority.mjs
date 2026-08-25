import { createHash } from 'node:crypto';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  assertAuthoritativeAndChannelExactEquality,
  captureAuthoritativeSourceProvenance,
  captureReleaseSourceProvenance,
  verifyLocalSourceProtectionArtifacts
} from './release-source-provenance.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const fail = (message) => { throw new Error(message); };
const samePath = (left, right) => resolve(left).toLowerCase() === resolve(right).toLowerCase();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const assertCanonicalRegularFile = async (targetPath, boundaryPath, label) => {
  const target = resolve(targetPath);
  const boundary = resolve(boundaryPath);
  const local = relative(boundary, target);
  if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    fail(`${label} escapes its canonical boundary.`);
  }
  let cursor = boundary;
  const segments = local.split(/[\\/]/u).filter(Boolean);
  for (let index = -1; index < segments.length; index += 1) {
    if (index >= 0) cursor = resolve(cursor, segments[index]);
    const item = await lstat(cursor);
    const isTarget = index === segments.length - 1;
    if (item.isSymbolicLink() || (isTarget ? !item.isFile() : !item.isDirectory())) {
      fail(`${label} contains a non-canonical or reparse path entry: ${cursor}`);
    }
    if (!samePath(await realpath(cursor), cursor)) fail(`${label} realpath drifted: ${cursor}`);
  }
  return target;
};

const readCanonicalRegularFile = async (targetPath, boundaryPath, label) => {
  const target = await assertCanonicalRegularFile(targetPath, boundaryPath, label);
  const handle = await open(target, 'r');
  try {
    const before = await handle.stat();
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (!before.isFile() || !after.isFile()
      || before.size !== after.size
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.mtimeMs !== after.mtimeMs
      || bytes.length !== after.size) {
      fail(`${label} changed while it was read.`);
    }
    await assertCanonicalRegularFile(target, boundaryPath, label);
    return Object.freeze({ fullPath: target, bytes, sizeBytes: bytes.length, sha256: sha256(bytes) });
  } finally {
    await handle.close();
  }
};

const trackedWorkingTreeReadback = async ({ root, entries, label }) => {
  const sourceRoot = resolve(root);
  const hash = createHash('sha256');
  let totalBytes = 0;
  for (const entry of entries) {
    const file = await readCanonicalRegularFile(resolve(sourceRoot, ...entry.path.split('/')), sourceRoot,
      `${label} tracked file ${entry.path}`);
    totalBytes += file.sizeBytes;
    hash.update(entry.path);
    hash.update('\0');
    hash.update(entry.mode);
    hash.update('\0');
    hash.update(String(file.sizeBytes));
    hash.update('\0');
    hash.update(file.sha256);
    hash.update('\0');
  }
  return Object.freeze({
    status: 'PASS',
    verification: 'ACTUAL_TRACKED_WORKTREE_FILE_BYTES_READBACK',
    sha256: hash.digest('hex'),
    fileCount: entries.length,
    totalBytes
  });
};

const assertCaptureStable = (before, after, label) => {
  const keys = ['source', 'branch', 'headCommit', 'headTree', 'objectFormat', 'worktreeClean'];
  for (const key of keys) if (before.provenance?.[key] !== after.provenance?.[key]) fail(`${label} ${key} changed.`);
  for (const fingerprint of ['trackedCommitFingerprint', 'governedSourceFingerprint']) {
    if (JSON.stringify(before.provenance?.[fingerprint]) !== JSON.stringify(after.provenance?.[fingerprint])) {
      fail(`${label} ${fingerprint} changed.`);
    }
  }
};

export const canonicalChannelSourceProtectionPath = ({ aymRoot, expectedChannel = 'Bronze' }) => {
  if (!new Set(['Bronze', 'Silver', 'Gold']).has(expectedChannel)) fail('Unsupported source-protection channel.');
  return resolve(aymRoot, '05_TEST', '30Z_LOCAL_RECEIPT', expectedChannel, 'LATEST.json');
};

export const readCanonicalChannelSourceProtection = async ({
  aymRoot,
  expectedChannel = 'Bronze',
  suppliedPath
}) => {
  const root = resolve(aymRoot);
  const canonicalPath = canonicalChannelSourceProtectionPath({ aymRoot: root, expectedChannel });
  if (suppliedPath !== undefined && suppliedPath !== null && String(suppliedPath).trim() !== ''
    && !samePath(suppliedPath, canonicalPath)) {
    fail(`Source-protection receipt must use the exact canonical ${expectedChannel} LATEST path.`);
  }
  const latest = await readCanonicalRegularFile(canonicalPath, root, `${expectedChannel} canonical LATEST receipt`);
  let protection;
  try { protection = JSON.parse(latest.bytes.toString('utf8')); }
  catch { fail(`${expectedChannel} canonical LATEST receipt is not valid JSON.`); }
  if (protection?.schemaVersion !== 2
    || protection.source !== `06_KOD/kanallar/${expectedChannel}`
    || !SHA256_PATTERN.test(String(protection.treeSha256 ?? ''))) {
    fail(`${expectedChannel} canonical LATEST receipt identity is invalid.`);
  }
  const completedExternalProtection = protection.externalLibraryReceiptStatus === 'PASS'
    && protection.officialCompletionClaimed === true;
  if (completedExternalProtection
    && !SHA256_PATTERN.test(String(protection.externalReceipt?.sha256 ?? ''))) {
    fail(`${expectedChannel} completed canonical LATEST receipt external identity is invalid.`);
  }
  const immutableName = completedExternalProtection
    ? `PROTECTION_${protection.treeSha256}_${protection.externalReceipt.sha256}.json`
    : `PROTECTION_${protection.treeSha256}.json`;
  const immutablePath = resolve(root, '05_TEST', '30Z_LOCAL_RECEIPT', expectedChannel,
    immutableName);
  const immutable = await readCanonicalRegularFile(immutablePath, root,
    `${expectedChannel} immutable source-protection receipt`);
  if (!latest.bytes.equals(immutable.bytes)) {
    fail(`${expectedChannel} canonical LATEST receipt does not equal its immutable protection record.`);
  }
  return Object.freeze({
    value: protection,
    binding: Object.freeze({
      fullPath: latest.fullPath,
      path: latest.fullPath,
      sizeBytes: latest.sizeBytes,
      sha256: latest.sha256,
      immutablePath: immutable.fullPath,
      immutableSha256: immutable.sha256,
      noReparseReadbackVerified: true
    })
  });
};

export const verifyAymGovernanceSourceAuthority = async ({ sourceRoot, aymRoot }) => {
  const appRoot = resolve(sourceRoot);
  const root = resolve(aymRoot);
  const bronzeRoot = resolve(root, '06_KOD', 'kanallar', 'Bronze');
  const [appBefore, bronzeBefore] = await Promise.all([
    captureAuthoritativeSourceProvenance({ root: appRoot }),
    captureReleaseSourceProvenance({ root: bronzeRoot, expectedChannel: 'Bronze' })
  ]);
  assertAuthoritativeAndChannelExactEquality(appBefore.provenance, bronzeBefore.provenance);
  const [appDiskBefore, bronzeDiskBefore] = await Promise.all([
    trackedWorkingTreeReadback({ root: appRoot, entries: appBefore.entries, label: 'Authoritative application' }),
    trackedWorkingTreeReadback({ root: bronzeRoot, entries: bronzeBefore.entries, label: 'Bronze release channel' })
  ]);
  if (JSON.stringify(appDiskBefore) !== JSON.stringify(bronzeDiskBefore)) {
    fail('Authoritative application / Bronze tracked working-tree disk readback mismatch.');
  }
  const canonical = await readCanonicalChannelSourceProtection({ aymRoot: root, expectedChannel: 'Bronze' });
  const localArtifactReadback = await verifyLocalSourceProtectionArtifacts({
    aymRoot: root,
    protection: canonical.value,
    expectedProvenance: bronzeBefore.provenance,
    expectedChannel: 'Bronze'
  });
  const [appAfter, bronzeAfter] = await Promise.all([
    captureAuthoritativeSourceProvenance({ root: appRoot }),
    captureReleaseSourceProvenance({ root: bronzeRoot, expectedChannel: 'Bronze' })
  ]);
  assertCaptureStable(appBefore, appAfter, 'Authoritative application');
  assertCaptureStable(bronzeBefore, bronzeAfter, 'Bronze release channel');
  assertAuthoritativeAndChannelExactEquality(appAfter.provenance, bronzeAfter.provenance);
  const [appDiskAfter, bronzeDiskAfter] = await Promise.all([
    trackedWorkingTreeReadback({ root: appRoot, entries: appAfter.entries, label: 'Authoritative application' }),
    trackedWorkingTreeReadback({ root: bronzeRoot, entries: bronzeAfter.entries, label: 'Bronze release channel' })
  ]);
  if (JSON.stringify(appDiskBefore) !== JSON.stringify(appDiskAfter)
    || JSON.stringify(bronzeDiskBefore) !== JSON.stringify(bronzeDiskAfter)) {
    fail('Tracked working-tree disk readback changed while AYM source authority was verified.');
  }
  return Object.freeze({
    status: 'PASS',
    app: appAfter,
    bronze: bronzeAfter,
    appDiskReadback: appDiskAfter,
    bronzeDiskReadback: bronzeDiskAfter,
    protection: canonical.value,
    canonicalLatest: canonical.binding,
    localArtifactReadback
  });
};
