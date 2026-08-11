import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { assessNpmOfflineCache } from './npm-offline-cache.mjs';
import { verifyNpmCacheTransferBundle } from './npm-cache-transfer.mjs';
import { CACHE_BUNDLE_ACCEPTANCE_KIND, CACHE_BUNDLE_ACCEPTANCE_SCHEMA } from './npm-cache-bundle-acceptance.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const allowedPointerFields = new Set(['schemaVersion', 'receiptFileName', 'receiptSha256', 'packageVersion', 'packageLockSha256', 'archiveSha256']);
const allowedReceiptRequired = [
  'schemaVersion', 'kind', 'product', 'stage', 'status', 'disposition', 'classification', 'packageVersion',
  'packageLockSha256', 'archiveFileName', 'archiveSha256', 'archiveBytes', 'verifiedTarballCount',
  'acceptedArchivePath', 'acceptedChecksumPath', 'cacheRoot', 'cacheReadinessStatus', 'generatedAt'
];

const fail = (code, message, details = {}) => Object.assign(new Error(message), { code, details });
const pathState = async (path) => {
  try { return await lstat(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
};
const ensureRegularFile = async (path, label, { maxBytes = Number.MAX_SAFE_INTEGER } = {}) => {
  const absolute = resolve(path);
  const info = await pathState(absolute);
  if (!info) throw fail(`${label.toUpperCase().replace(/\W+/g, '_')}_MISSING`, `${label} is missing: ${absolute}`);
  if (info.isSymbolicLink() || !info.isFile()) throw fail(`${label.toUpperCase().replace(/\W+/g, '_')}_UNSAFE`, `${label} must be a regular non-symlink file: ${absolute}`);
  if (!Number.isSafeInteger(info.size) || info.size < 1 || info.size > maxBytes) throw fail(`${label.toUpperCase().replace(/\W+/g, '_')}_SIZE_INVALID`, `${label} size=${info.size} is invalid.`);
  return { absolute, info, bytes: await readFile(absolute) };
};
const ensureWithin = (root, candidate, label) => {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(candidate);
  const traversal = relative(absoluteRoot, absoluteCandidate);
  if (traversal === '' || traversal.startsWith('..') || isAbsolute(traversal)) {
    if (traversal === '') return absoluteCandidate;
    throw fail(`${label.toUpperCase().replace(/\W+/g, '_')}_OUTSIDE_ROOT`, `${label} must remain inside ${absoluteRoot}.`);
  }
  return absoluteCandidate;
};
const parseSingleChecksum = ({ bytes, expectedFileName, label }) => {
  const text = bytes.toString('utf8');
  if (text.includes('\0')) throw fail('CHECKSUM_FORMAT_INVALID', `${label} contains NUL.`);
  const match = /^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i.exec(text);
  if (!match) throw fail('CHECKSUM_FORMAT_INVALID', `${label} must contain exactly one SHA-256 line.`);
  if (match[2] !== expectedFileName) throw fail('CHECKSUM_FILENAME_MISMATCH', `${label} filename=${match[2]} does not match ${expectedFileName}.`);
  return match[1].toLowerCase();
};
const parseJson = (bytes, label) => {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch (error) { throw fail(`${label.toUpperCase().replace(/\W+/g, '_')}_JSON_INVALID`, `${label} JSON is invalid: ${error.message}`); }
};

export const validateAcceptedNpmCacheForRc2 = async ({
  projectRoot = process.cwd(),
  acceptancePolicy,
  packageVersion,
  lockBytes,
  registry = 'https://registry.npmjs.org/',
  verifyBundlePayload = true,
  requireCompleteImportedCache = true
}) => {
  const root = resolve(projectRoot);
  if (!acceptancePolicy || acceptancePolicy.schemaVersion !== 1) throw fail('ACCEPTANCE_POLICY_INVALID', 'Unsupported npm cache bundle acceptance policy.');
  const receiptRoot = resolve(root, acceptancePolicy.receiptRoot);
  const acceptedRoot = resolve(root, acceptancePolicy.acceptedRoot);
  const expectedCacheRoot = resolve(root, acceptancePolicy.cacheRoot);
  const currentLockBytes = lockBytes ?? await readFile(resolve(root, 'package-lock.json'));
  const currentLock = parseJson(currentLockBytes, 'package-lock');
  const lockSha256 = sha256(currentLockBytes);
  const pointerPath = resolve(receiptRoot, 'current-accepted.json');
  const pointerFile = await ensureRegularFile(pointerPath, 'acceptance pointer', { maxBytes: 16_384 });
  const pointer = parseJson(pointerFile.bytes, 'acceptance pointer');
  if (pointer.schemaVersion !== 1) throw fail('POINTER_SCHEMA_UNSUPPORTED', `Acceptance pointer schemaVersion=${pointer.schemaVersion}`);
  const unknownPointerFields = Object.keys(pointer).filter((field) => !allowedPointerFields.has(field));
  if (unknownPointerFields.length) throw fail('POINTER_FIELDS_INVALID', `Acceptance pointer has unknown fields: ${unknownPointerFields.join(', ')}`);
  if (typeof pointer.receiptFileName !== 'string' || basename(pointer.receiptFileName) !== pointer.receiptFileName || !/^[a-f0-9]{64}-[a-f0-9]{64}\.json$/i.test(pointer.receiptFileName)) {
    throw fail('POINTER_RECEIPT_NAME_INVALID', 'Acceptance pointer receiptFileName is invalid.');
  }
  for (const field of ['receiptSha256', 'packageLockSha256', 'archiveSha256']) {
    if (!/^[a-f0-9]{64}$/i.test(pointer[field] ?? '')) throw fail('POINTER_HASH_INVALID', `Acceptance pointer ${field} is invalid.`);
  }
  if (pointer.packageVersion !== packageVersion) throw fail('POINTER_PACKAGE_VERSION_MISMATCH', `Pointer packageVersion=${pointer.packageVersion}; expected=${packageVersion}`);
  if (pointer.packageLockSha256 !== lockSha256) throw fail('POINTER_LOCK_MISMATCH', 'Acceptance pointer does not match the active package-lock.json.');

  const receiptPath = ensureWithin(receiptRoot, resolve(receiptRoot, pointer.receiptFileName), 'receipt path');
  const receiptChecksumPath = `${receiptPath}.sha256`;
  const receiptFile = await ensureRegularFile(receiptPath, 'acceptance receipt', { maxBytes: 262_144 });
  const receiptChecksumFile = await ensureRegularFile(receiptChecksumPath, 'acceptance receipt checksum', { maxBytes: 4096 });
  const checksumReceiptSha = parseSingleChecksum({ bytes: receiptChecksumFile.bytes, expectedFileName: basename(receiptPath), label: 'Acceptance receipt checksum' });
  const actualReceiptSha = sha256(receiptFile.bytes);
  if (actualReceiptSha !== pointer.receiptSha256 || actualReceiptSha !== checksumReceiptSha) throw fail('RECEIPT_SHA256_MISMATCH', 'Acceptance receipt SHA-256 mismatch.');
  const receipt = parseJson(receiptFile.bytes, 'acceptance receipt');
  for (const field of allowedReceiptRequired) if (!(field in receipt)) throw fail('RECEIPT_FIELD_MISSING', `Acceptance receipt field missing: ${field}`);
  if (receipt.schemaVersion !== CACHE_BUNDLE_ACCEPTANCE_SCHEMA || receipt.kind !== CACHE_BUNDLE_ACCEPTANCE_KIND) throw fail('RECEIPT_SCHEMA_INVALID', 'Acceptance receipt schema/kind is invalid.');
  if (receipt.status !== 'PASS' || !['ACCEPTED', 'ALREADY_ACCEPTED'].includes(receipt.disposition) || receipt.classification !== 'VERIFIED_AND_IMPORTED') {
    throw fail('RECEIPT_STATUS_INVALID', `Acceptance receipt status=${receipt.status}/${receipt.disposition}/${receipt.classification}`);
  }
  if (receipt.packageVersion !== packageVersion || receipt.packageLockSha256 !== lockSha256 || receipt.archiveSha256 !== pointer.archiveSha256) {
    throw fail('RECEIPT_IDENTITY_MISMATCH', 'Acceptance receipt does not match the active package, lockfile or pointer.');
  }
  if (!Number.isSafeInteger(receipt.verifiedTarballCount) || receipt.verifiedTarballCount < 1) throw fail('RECEIPT_TARBALL_COUNT_INVALID', 'Acceptance receipt verifiedTarballCount is invalid.');

  const acceptedArchivePath = ensureWithin(acceptedRoot, receipt.acceptedArchivePath, 'accepted archive');
  const acceptedChecksumPath = ensureWithin(acceptedRoot, receipt.acceptedChecksumPath, 'accepted checksum');
  if (acceptedChecksumPath !== `${acceptedArchivePath}.sha256`) throw fail('ACCEPTED_CHECKSUM_PATH_INVALID', 'Accepted checksum path must be archive path plus .sha256.');
  if (resolve(receipt.cacheRoot) !== expectedCacheRoot) throw fail('CACHE_ROOT_MISMATCH', `Receipt cacheRoot=${receipt.cacheRoot}; expected=${expectedCacheRoot}`);
  const archiveFile = await ensureRegularFile(acceptedArchivePath, 'accepted archive', { maxBytes: acceptancePolicy.maxArchiveBytes });
  const archiveChecksumFile = await ensureRegularFile(acceptedChecksumPath, 'accepted archive checksum', { maxBytes: acceptancePolicy.maxChecksumBytes });
  const actualArchiveSha = sha256(archiveFile.bytes);
  const checksumArchiveSha = parseSingleChecksum({ bytes: archiveChecksumFile.bytes, expectedFileName: basename(acceptedArchivePath), label: 'Accepted archive checksum' });
  if (actualArchiveSha !== pointer.archiveSha256 || actualArchiveSha !== receipt.archiveSha256 || actualArchiveSha !== checksumArchiveSha) {
    throw fail('ACCEPTED_ARCHIVE_SHA256_MISMATCH', 'Accepted archive SHA-256 mismatch.');
  }
  if (receipt.archiveBytes !== archiveFile.info.size) throw fail('ACCEPTED_ARCHIVE_SIZE_MISMATCH', `Receipt archiveBytes=${receipt.archiveBytes}; actual=${archiveFile.info.size}`);

  let bundleVerification = { status: 'NOT_RUN', reason: 'POLICY_DISABLED' };
  if (verifyBundlePayload) {
    bundleVerification = await verifyNpmCacheTransferBundle({ lock: currentLock, lockBytes: currentLockBytes, packageVersion, archiveBytes: archiveFile.bytes, archivePath: acceptedArchivePath });
    if (bundleVerification.status !== 'PASS') throw fail('ACCEPTED_BUNDLE_VERIFICATION_FAILED', `Accepted bundle verification failed: ${(bundleVerification.failures ?? []).slice(0, 5).join('; ')}`, { bundleVerification });
    if (bundleVerification.requiredTarballCount !== receipt.verifiedTarballCount) throw fail('ACCEPTED_TARBALL_COUNT_MISMATCH', `Bundle tarballs=${bundleVerification.requiredTarballCount}; receipt=${receipt.verifiedTarballCount}`);
  }
  const cacheReadiness = await assessNpmOfflineCache({ lock: currentLock, cacheRoot: expectedCacheRoot, registry });
  if (requireCompleteImportedCache && cacheReadiness.status !== 'PASS') throw fail('ACCEPTED_CACHE_NOT_READY', `Accepted cache readiness=${cacheReadiness.status}`, { cacheReadiness });
  if (receipt.cacheReadinessStatus !== 'PASS') throw fail('RECEIPT_CACHE_STATUS_INVALID', `Receipt cacheReadinessStatus=${receipt.cacheReadinessStatus}`);

  return {
    schemaVersion: 1,
    status: 'PASS',
    classification: 'ACCEPTED_CACHE_VERIFIED_FOR_RC2',
    packageVersion,
    packageLockSha256: lockSha256,
    pointerPath,
    pointerSha256: sha256(pointerFile.bytes),
    receiptPath,
    receiptChecksumPath,
    receiptSha256: actualReceiptSha,
    acceptedArchivePath,
    acceptedChecksumPath,
    archiveSha256: actualArchiveSha,
    archiveBytes: archiveFile.info.size,
    verifiedTarballCount: receipt.verifiedTarballCount,
    cacheRoot: expectedCacheRoot,
    cacheReadiness,
    bundleVerification,
    verifiedAt: new Date().toISOString()
  };
};
