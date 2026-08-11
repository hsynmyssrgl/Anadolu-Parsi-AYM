import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { assessNpmOfflineCache } from './npm-offline-cache.mjs';
import { importNpmCacheTransferBundle, verifyNpmCacheTransferBundle } from './npm-cache-transfer.mjs';

export const CACHE_BUNDLE_ACCEPTANCE_KIND = 'PPT_NPM_CACHE_BUNDLE_ACCEPTANCE_RECEIPT';
export const CACHE_BUNDLE_ACCEPTANCE_SCHEMA = 1;
const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safeCode = (value) => String(value ?? 'REJECTED').replace(/[^A-Z0-9_-]/gi, '_').slice(0, 80).toUpperCase();

const pathState = async (path) => {
  try { return await lstat(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
};

const ensureSafeDirectory = async (path) => {
  await mkdir(path, { recursive: true });
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw Object.assign(new Error(`Directory symlink is not allowed: ${path}`), { code: 'DIRECTORY_SYMLINK_REJECTED' });
  if (!info.isDirectory()) throw Object.assign(new Error(`Expected directory: ${path}`), { code: 'DIRECTORY_INVALID' });
};

const readRegularFile = async (path, { label, maxBytes }) => {
  const absolute = resolve(path);
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) throw Object.assign(new Error(`${label} symlink is not allowed.`), { code: 'SOURCE_SYMLINK_REJECTED' });
  if (!info.isFile()) throw Object.assign(new Error(`${label} must be a regular file.`), { code: 'SOURCE_FILE_INVALID' });
  if (!Number.isSafeInteger(info.size) || info.size < 1 || info.size > maxBytes) {
    throw Object.assign(new Error(`${label} size=${info.size} is outside the allowed range.`), { code: 'SOURCE_SIZE_INVALID' });
  }
  return { absolute, info, bytes: await readFile(absolute) };
};

const parseChecksum = ({ bytes, archiveFileName }) => {
  const text = bytes.toString('utf8');
  if (text.includes('\0')) throw Object.assign(new Error('Checksum file contains NUL.'), { code: 'CHECKSUM_FORMAT_INVALID' });
  const match = /^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i.exec(text);
  if (!match) throw Object.assign(new Error('Checksum file must contain exactly one SHA-256 line.'), { code: 'CHECKSUM_FORMAT_INVALID' });
  if (match[2] !== archiveFileName) {
    throw Object.assign(new Error(`Checksum filename=${match[2]} does not match archive=${archiveFileName}.`), { code: 'CHECKSUM_FILENAME_MISMATCH' });
  }
  return match[1].toLowerCase();
};

const writeAtomic = async (path, bytes) => {
  await ensureSafeDirectory(dirname(path));
  const temporary = resolve(dirname(path), `.${basename(path)}.partial-${process.pid}-${randomBytes(6).toString('hex')}`);
  await writeFile(temporary, bytes, { flag: 'wx' });
  try { await rename(temporary, path); }
  catch (error) { await rm(temporary, { force: true }); throw error; }
};

const verifyExistingBytes = async (path, expectedSha256) => {
  const info = await pathState(path);
  if (!info) return false;
  if (info.isSymbolicLink() || !info.isFile()) throw Object.assign(new Error(`Existing artifact is not a safe regular file: ${path}`), { code: 'EXISTING_ARTIFACT_INVALID' });
  const actual = sha256Bytes(await readFile(path));
  if (actual !== expectedSha256) throw Object.assign(new Error(`Existing artifact SHA-256 mismatch: ${basename(path)}`), { code: 'EXISTING_ARTIFACT_TAMPERED' });
  return true;
};

const receiptPaths = ({ receiptRoot, lockSha256, archiveSha256 }) => {
  const stem = `${lockSha256}-${archiveSha256}`;
  return {
    receiptPath: resolve(receiptRoot, `${stem}.json`),
    receiptChecksumPath: resolve(receiptRoot, `${stem}.json.sha256`),
    pointerPath: resolve(receiptRoot, 'current-accepted.json')
  };
};

const rejectionReceiptPaths = ({ receiptRoot, lockSha256, archiveSha256, classification }) => {
  const stem = `${lockSha256}-${archiveSha256}-rejected-${safeCode(classification)}`;
  return {
    receiptPath: resolve(receiptRoot, `${stem}.json`),
    receiptChecksumPath: resolve(receiptRoot, `${stem}.json.sha256`)
  };
};

const writeReceipt = async ({ receipt, receiptPath, receiptChecksumPath }) => {
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const checksum = sha256Bytes(bytes);
  await writeAtomic(receiptPath, bytes);
  await writeAtomic(receiptChecksumPath, Buffer.from(`${checksum}  ${basename(receiptPath)}\n`));
  return checksum;
};

const quarantine = async ({ archive, checksum, quarantineRoot, archiveSha256, classification }) => {
  await ensureSafeDirectory(quarantineRoot);
  const stem = `${archiveSha256}-${safeCode(classification)}`;
  const archivePath = resolve(quarantineRoot, `${stem}.zip`);
  const checksumPath = resolve(quarantineRoot, `${stem}.zip.sha256`);
  if (!(await verifyExistingBytes(archivePath, archiveSha256))) await writeAtomic(archivePath, archive.bytes);
  if (checksum?.bytes) {
    const checksumSha256 = sha256Bytes(checksum.bytes);
    if (!(await verifyExistingBytes(checksumPath, checksumSha256))) await writeAtomic(checksumPath, checksum.bytes);
  }
  return { quarantineArchivePath: archivePath, quarantineChecksumPath: checksum?.bytes ? checksumPath : null };
};

const validatePolicy = (policy) => {
  if (!policy || typeof policy !== 'object' || policy.schemaVersion !== 1) throw new Error('Unsupported cache bundle acceptance policy.');
  for (const [name, minimum, maximum] of [
    ['maxArchiveBytes', 1024, 4_294_967_295],
    ['maxChecksumBytes', 64, 65_536]
  ]) {
    const value = policy[name];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid acceptance policy ${name}=${value}`);
  }
  for (const name of ['requireChecksumSidecar', 'importVerifiedBundle', 'replaceExistingCache']) {
    if (typeof policy[name] !== 'boolean') throw new Error(`Invalid acceptance policy ${name}.`);
  }
  return policy;
};

export const acceptNpmCacheTransferBundle = async ({
  archivePath,
  checksumPath,
  packageVersion,
  lockPath = 'package-lock.json',
  lockBytes,
  expectedHandoffRequestId,
  policy,
  acceptedRoot = policy?.acceptedRoot,
  quarantineRoot = policy?.quarantineRoot,
  receiptRoot = policy?.receiptRoot,
  cacheRoot = policy?.cacheRoot
}) => {
  const validatedPolicy = validatePolicy(policy);
  const resolvedAcceptedRoot = resolve(acceptedRoot);
  const resolvedQuarantineRoot = resolve(quarantineRoot);
  const resolvedReceiptRoot = resolve(receiptRoot);
  const resolvedCacheRoot = resolve(cacheRoot);
  const currentLockBytes = lockBytes ?? await readFile(resolve(lockPath));
  const lockSha256 = sha256Bytes(currentLockBytes);
  let archive;
  let checksum;
  let archiveSha256 = null;
  let classification = 'ACCEPTANCE_ERROR';
  let failures = [];
  try {
    archive = await readRegularFile(archivePath, { label: 'Archive', maxBytes: validatedPolicy.maxArchiveBytes });
    if (extname(archive.absolute).toLowerCase() !== '.zip') throw Object.assign(new Error('Archive extension must be .zip.'), { code: 'ARCHIVE_EXTENSION_INVALID' });
    archiveSha256 = sha256Bytes(archive.bytes);
    if (validatedPolicy.requireChecksumSidecar && !checksumPath) throw Object.assign(new Error('Checksum sidecar is required.'), { code: 'CHECKSUM_REQUIRED' });
    if (checksumPath) checksum = await readRegularFile(checksumPath, { label: 'Checksum', maxBytes: validatedPolicy.maxChecksumBytes });
    if (checksum) {
      const expectedSha256 = parseChecksum({ bytes: checksum.bytes, archiveFileName: basename(archive.absolute) });
      if (expectedSha256 !== archiveSha256) throw Object.assign(new Error(`Archive SHA-256 mismatch: expected=${expectedSha256}, actual=${archiveSha256}`), { code: 'CHECKSUM_MISMATCH' });
    }

    const paths = receiptPaths({ receiptRoot: resolvedReceiptRoot, lockSha256, archiveSha256 });
    const existingReceipt = await pathState(paths.receiptPath);
    if (existingReceipt) {
      if (existingReceipt.isSymbolicLink() || !existingReceipt.isFile()) throw Object.assign(new Error('Existing receipt is unsafe.'), { code: 'RECEIPT_TAMPERED' });
      const receiptBytes = await readFile(paths.receiptPath);
      const receipt = JSON.parse(receiptBytes.toString('utf8'));
      const checksumBytes = await readFile(paths.receiptChecksumPath);
      const expectedReceiptSha = parseChecksum({ bytes: checksumBytes, archiveFileName: basename(paths.receiptPath) });
      if (sha256Bytes(receiptBytes) !== expectedReceiptSha || receipt.archiveSha256 !== archiveSha256 || receipt.packageLockSha256 !== lockSha256 || receipt.status !== 'PASS' || (expectedHandoffRequestId && receipt.handoffRequestId !== expectedHandoffRequestId)) {
        throw Object.assign(new Error('Existing acceptance receipt failed integrity checks.'), { code: 'RECEIPT_TAMPERED' });
      }
      await verifyExistingBytes(receipt.acceptedArchivePath, archiveSha256);
      const readiness = await assessNpmOfflineCache({ lock: JSON.parse(currentLockBytes.toString('utf8')), cacheRoot: receipt.cacheRoot, registry: 'https://registry.npmjs.org/' });
      if (readiness.status !== 'PASS') throw Object.assign(new Error('Previously accepted cache is no longer complete.'), { code: 'ACCEPTED_CACHE_TAMPERED' });
      return { ...receipt, disposition: 'ALREADY_ACCEPTED', receiptPath: paths.receiptPath, receiptChecksumPath: paths.receiptChecksumPath, receiptSha256: expectedReceiptSha, cacheReadiness: readiness };
    }

    const verification = await verifyNpmCacheTransferBundle({ lockBytes: currentLockBytes, packageVersion, archiveBytes: archive.bytes, archivePath: archive.absolute, expectedHandoffRequestId });
    if (verification.status !== 'PASS') throw Object.assign(new Error(`Bundle verification failed: ${verification.failures.slice(0, 5).join('; ')}`), { code: 'BUNDLE_VERIFICATION_FAILED', verification });

    await ensureSafeDirectory(resolvedAcceptedRoot);
    await ensureSafeDirectory(resolvedReceiptRoot);
    const acceptedArchivePath = resolve(resolvedAcceptedRoot, `npm-cache-transfer-${expectedHandoffRequestId ? `${expectedHandoffRequestId}-` : ''}${packageVersion}-${archiveSha256}.zip`);
    const acceptedChecksumPath = `${acceptedArchivePath}.sha256`;
    if (!(await verifyExistingBytes(acceptedArchivePath, archiveSha256))) await writeAtomic(acceptedArchivePath, archive.bytes);
    const acceptedChecksumBytes = Buffer.from(`${archiveSha256}  ${basename(acceptedArchivePath)}\n`);
    const acceptedChecksumSha = sha256Bytes(acceptedChecksumBytes);
    if (!(await verifyExistingBytes(acceptedChecksumPath, acceptedChecksumSha))) await writeAtomic(acceptedChecksumPath, acceptedChecksumBytes);

    let cacheImport = { status: 'NOT_RUN', reason: 'POLICY_DISABLED' };
    if (validatedPolicy.importVerifiedBundle) {
      const cacheInfo = await pathState(resolvedCacheRoot);
      if (cacheInfo) {
        if (cacheInfo.isSymbolicLink() || !cacheInfo.isDirectory()) throw Object.assign(new Error('Existing cache root is unsafe.'), { code: 'TARGET_CACHE_INVALID' });
        if (validatedPolicy.replaceExistingCache) await rm(resolvedCacheRoot, { recursive: true, force: true });
        else throw Object.assign(new Error('Target cache root already exists; refusing replacement.'), { code: 'TARGET_CACHE_EXISTS' });
      }
      cacheImport = await importNpmCacheTransferBundle({ lockBytes: currentLockBytes, packageVersion, archiveBytes: archive.bytes, archivePath: archive.absolute, targetCacheRoot: resolvedCacheRoot });
      if (cacheImport.status !== 'PASS') throw Object.assign(new Error('Verified bundle cache import failed.'), { code: 'CACHE_IMPORT_FAILED', cacheImport });
    }
    const cacheReadiness = validatedPolicy.importVerifiedBundle
      ? await assessNpmOfflineCache({ lock: JSON.parse(currentLockBytes.toString('utf8')), cacheRoot: resolvedCacheRoot, registry: 'https://registry.npmjs.org/' })
      : { status: 'NOT_RUN' };
    if (validatedPolicy.importVerifiedBundle && cacheReadiness.status !== 'PASS') throw Object.assign(new Error('Imported cache readiness failed.'), { code: 'CACHE_READINESS_FAILED' });

    const receipt = {
      schemaVersion: CACHE_BUNDLE_ACCEPTANCE_SCHEMA,
      kind: CACHE_BUNDLE_ACCEPTANCE_KIND,
      product: 'Anadolu Parsı Aile Yaşam Merkezi',
      stage: 'Bronze RC2 Active Development',
      status: 'PASS',
      disposition: 'ACCEPTED',
      classification: 'VERIFIED_AND_IMPORTED',
      packageVersion,
      packageLockSha256: lockSha256,
      ...(verification.handoffRequestId ? { handoffRequestId: verification.handoffRequestId } : {}),
      archiveFileName: basename(archive.absolute),
      archiveSha256,
      archiveBytes: archive.bytes.length,
      verifiedTarballCount: verification.requiredTarballCount,
      acceptedArchivePath,
      acceptedChecksumPath,
      cacheRoot: resolvedCacheRoot,
      cacheReadinessStatus: cacheReadiness.status,
      generatedAt: new Date().toISOString()
    };
    const receiptSha256 = await writeReceipt({ receipt, receiptPath: paths.receiptPath, receiptChecksumPath: paths.receiptChecksumPath });
    const pointer = { schemaVersion: 1, receiptFileName: basename(paths.receiptPath), receiptSha256, packageVersion, packageLockSha256: lockSha256, archiveSha256, ...(receipt.handoffRequestId ? { handoffRequestId: receipt.handoffRequestId } : {}) };
    await writeAtomic(paths.pointerPath, Buffer.from(`${JSON.stringify(pointer, null, 2)}\n`));
    return { ...receipt, receiptPath: paths.receiptPath, receiptChecksumPath: paths.receiptChecksumPath, receiptSha256, pointerPath: paths.pointerPath, cacheImport, cacheReadiness };
  } catch (error) {
    classification = error?.code ?? classification;
    failures = [error?.message ?? String(error)];
    if (!archive) return { schemaVersion: 1, kind: CACHE_BUNDLE_ACCEPTANCE_KIND, status: 'FAIL', disposition: 'REJECTED', classification, packageVersion, packageLockSha256: lockSha256, archiveSha256, failures };
    archiveSha256 ??= sha256Bytes(archive.bytes);
    let quarantineResult = {};
    try { quarantineResult = await quarantine({ archive, checksum, quarantineRoot: resolvedQuarantineRoot, archiveSha256, classification }); }
    catch (quarantineError) { failures.push(`Quarantine failed: ${quarantineError.message}`); }
    const paths = rejectionReceiptPaths({ receiptRoot: resolvedReceiptRoot, lockSha256, archiveSha256, classification });
    const receipt = {
      schemaVersion: CACHE_BUNDLE_ACCEPTANCE_SCHEMA,
      kind: CACHE_BUNDLE_ACCEPTANCE_KIND,
      product: 'Anadolu Parsı Aile Yaşam Merkezi',
      stage: 'Bronze RC2 Active Development',
      status: 'FAIL',
      disposition: 'REJECTED',
      classification,
      packageVersion,
      packageLockSha256: lockSha256,
      ...(expectedHandoffRequestId ? { expectedHandoffRequestId } : {}),
      archiveFileName: basename(archive.absolute),
      archiveSha256,
      archiveBytes: archive.bytes.length,
      failures,
      ...quarantineResult,
      generatedAt: new Date().toISOString()
    };
    try {
      const receiptSha256 = await writeReceipt({ receipt, receiptPath: paths.receiptPath, receiptChecksumPath: paths.receiptChecksumPath });
      return { ...receipt, receiptPath: paths.receiptPath, receiptChecksumPath: paths.receiptChecksumPath, receiptSha256 };
    } catch (receiptError) {
      return { ...receipt, failures: [...failures, `Receipt write failed: ${receiptError.message}`] };
    }
  }
};
