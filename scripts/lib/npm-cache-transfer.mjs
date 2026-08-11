import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { assessNpmOfflineCache, collectLockfileTarballs, npmCacheContentPath } from './npm-offline-cache.mjs';
import { inspectDeterministicZip, readStoredZipEntry, writeDeterministicZip } from './deterministic-zip.mjs';

export const OFFICIAL_NPM_REGISTRY = 'https://registry.npmjs.org/';
export const CACHE_TRANSFER_MANIFEST = 'npm-cache-transfer-manifest.json';
export const CACHE_TRANSFER_KIND = 'PPT_NPM_CACHE_TRANSFER_BUNDLE';
const CACHE_KEY_PREFIX = 'make-fetch-happen:request-cache:';

const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha512Integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const sha1Text = (text) => createHash('sha1').update(text).digest('hex');

const integrityHex = (integrity) => {
  if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) throw new Error(`Unsupported integrity: ${integrity}`);
  const digest = Buffer.from(integrity.slice('sha512-'.length), 'base64');
  if (digest.length !== 64) throw new Error(`Invalid SHA-512 integrity: ${integrity}`);
  return digest.toString('hex');
};

export const cacheTransferArchivePath = (integrity) => {
  const hex = integrityHex(integrity);
  return `tarballs/sha512/${hex.slice(0, 2)}/${hex.slice(2, 4)}/${hex.slice(4)}.tgz`;
};

const lockBytesFrom = async ({ lockBytes, lockPath = 'package-lock.json' }) => lockBytes ?? readFile(resolve(lockPath));
const lockFrom = ({ lock, bytes }) => lock ?? JSON.parse(bytes.toString('utf8'));

const deterministicManifest = ({ packageVersion, lockSha256, entries }) => ({
  schemaVersion: 1,
  kind: CACHE_TRANSFER_KIND,
  registry: OFFICIAL_NPM_REGISTRY,
  officialRegistryOnly: true,
  complete: true,
  packageVersion,
  packageLockSha256: lockSha256,
  requiredTarballCount: entries.length,
  includedTarballCount: entries.length,
  entries
});

export const createNpmCacheTransferBundle = async ({
  lock,
  lockBytes,
  lockPath = 'package-lock.json',
  packageVersion,
  cacheRoot,
  outputPath
}) => {
  const bytes = await lockBytesFrom({ lockBytes, lockPath });
  const parsedLock = lockFrom({ lock, bytes });
  const readiness = await assessNpmOfflineCache({
    lock: parsedLock,
    cacheRoot,
    registry: OFFICIAL_NPM_REGISTRY,
    includeReadyEntries: true
  });
  const base = {
    schemaVersion: 1,
    kind: CACHE_TRANSFER_KIND,
    registry: OFFICIAL_NPM_REGISTRY,
    packageVersion,
    packageLockSha256: sha256Bytes(bytes),
    cacheRoot: resolve(cacheRoot),
    requiredTarballCount: readiness.requiredTarballCount,
    readyTarballCount: readiness.readyTarballCount,
    missingOrInvalidTarballCount: readiness.missingOrInvalidTarballCount,
    readinessStatus: readiness.status,
    reasonCounts: readiness.reasonCounts
  };
  if (readiness.status !== 'PASS') {
    return { ...base, status: 'INCOMPLETE', archiveCreated: false, failures: ['A complete verified cache is required before creating a transfer bundle.'] };
  }

  const staging = await mkdtemp(join(tmpdir(), 'ppt-npm-cache-transfer-'));
  try {
    const entries = [];
    for (const item of readiness.entries.sort((left, right) => left.url.localeCompare(right.url, 'en'))) {
      if (item.status !== 'READY') throw new Error(`Unexpected non-ready cache entry: ${item.url} (${item.status})`);
      const source = npmCacheContentPath(cacheRoot, item.integrity);
      const content = await readFile(source);
      const archivePath = cacheTransferArchivePath(item.integrity);
      const target = resolve(staging, archivePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
      entries.push({
        url: item.url,
        integrity: item.integrity,
        bytes: content.length,
        sha256: sha256Bytes(content),
        archivePath
      });
    }
    const manifest = deterministicManifest({ packageVersion, lockSha256: sha256Bytes(bytes), entries });
    await writeFile(resolve(staging, CACHE_TRANSFER_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
    const paths = [CACHE_TRANSFER_MANIFEST, ...entries.map((entry) => entry.archivePath)]
      .sort((left, right) => left.localeCompare(right, 'en'));
    const archive = await writeDeterministicZip({ root: staging, paths, outputPath });
    return {
      ...base,
      status: 'PASS',
      archiveCreated: true,
      archiveFileName: basename(outputPath),
      archivePath: resolve(outputPath),
      archiveSha256: archive.archiveSha256,
      archiveBytes: archive.archiveBytes,
      archiveEntryCount: archive.entryCount,
      includedTarballCount: entries.length,
      deterministicArchive: true,
      failures: []
    };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};

const validateManifestShape = (manifest, failures) => {
  if (!manifest || typeof manifest !== 'object') { failures.push('Bundle manifest must be an object.'); return; }
  if (manifest.schemaVersion !== 1) failures.push(`Unsupported manifest schemaVersion=${manifest.schemaVersion}`);
  if (manifest.kind !== CACHE_TRANSFER_KIND) failures.push(`Unexpected manifest kind=${manifest.kind}`);
  if (manifest.registry !== OFFICIAL_NPM_REGISTRY || manifest.officialRegistryOnly !== true) failures.push('Bundle must use only the official npm registry.');
  if (manifest.complete !== true) failures.push('Bundle manifest must declare complete=true.');
  if (manifest.handoffRequestId !== undefined && !/^[a-f0-9]{64}$/.test(manifest.handoffRequestId)) failures.push(`Invalid handoffRequestId=${manifest.handoffRequestId}`);
  if (!Array.isArray(manifest.entries)) failures.push('Bundle manifest entries must be an array.');
};

export const verifyNpmCacheTransferBundle = async ({
  lock,
  lockBytes,
  lockPath = 'package-lock.json',
  packageVersion,
  archivePath,
  archiveBytes,
  expectedHandoffRequestId
}) => {
  const bytes = await lockBytesFrom({ lockBytes, lockPath });
  const parsedLock = lockFrom({ lock, bytes });
  const zipBytes = archiveBytes ?? await readFile(resolve(archivePath));
  const inspection = inspectDeterministicZip(zipBytes);
  const failures = [...inspection.failures];
  let manifest;
  try {
    manifest = JSON.parse(readStoredZipEntry(zipBytes, CACHE_TRANSFER_MANIFEST).toString('utf8'));
  } catch (error) {
    failures.push(`Bundle manifest read failed: ${error.message}`);
    manifest = {};
  }
  validateManifestShape(manifest, failures);
  const lockSha256 = sha256Bytes(bytes);
  if (manifest.packageLockSha256 !== lockSha256) failures.push(`package-lock SHA-256 mismatch: bundle=${manifest.packageLockSha256}, current=${lockSha256}`);
  if (packageVersion && manifest.packageVersion !== packageVersion) failures.push(`Package version mismatch: bundle=${manifest.packageVersion}, current=${packageVersion}`);
  if (expectedHandoffRequestId && manifest.handoffRequestId !== expectedHandoffRequestId) failures.push(`Handoff request mismatch: bundle=${manifest.handoffRequestId ?? 'none'}, expected=${expectedHandoffRequestId}`);

  let required = [];
  try { required = collectLockfileTarballs(parsedLock, OFFICIAL_NPM_REGISTRY); }
  catch (error) { failures.push(error.message); }
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (manifest.requiredTarballCount !== required.length) failures.push(`requiredTarballCount=${manifest.requiredTarballCount}; expected=${required.length}`);
  if (manifest.includedTarballCount !== required.length) failures.push(`includedTarballCount=${manifest.includedTarballCount}; expected=${required.length}`);
  if (entries.length !== required.length) failures.push(`Manifest entry count=${entries.length}; expected=${required.length}`);
  const sortedUrls = [...entries].map((entry) => entry?.url).sort((left, right) => String(left).localeCompare(String(right), 'en'));
  if (entries.some((entry, index) => entry?.url !== sortedUrls[index])) failures.push('Manifest entries must be strictly sorted by URL.');
  const manifestByUrl = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string') { failures.push('Manifest contains an invalid entry.'); continue; }
    if (manifestByUrl.has(entry.url)) failures.push(`Duplicate manifest URL=${entry.url}`);
    manifestByUrl.set(entry.url, entry);
  }

  const expectedArchivePaths = new Set([CACHE_TRANSFER_MANIFEST]);
  for (const tarball of required) {
    const entry = manifestByUrl.get(tarball.url);
    if (!entry) { failures.push(`Bundle is missing tarball=${tarball.url}`); continue; }
    if (entry.integrity !== tarball.integrity) failures.push(`Integrity mismatch for ${tarball.url}`);
    let expectedPath;
    try { expectedPath = cacheTransferArchivePath(tarball.integrity); } catch (error) { failures.push(error.message); continue; }
    if (entry.archivePath !== expectedPath) failures.push(`Archive path mismatch for ${tarball.url}: ${entry.archivePath}`);
    expectedArchivePaths.add(expectedPath);
    try {
      const content = readStoredZipEntry(zipBytes, expectedPath);
      if (entry.bytes !== content.length) failures.push(`Byte count mismatch for ${tarball.url}`);
      if (entry.sha256 !== sha256Bytes(content)) failures.push(`SHA-256 mismatch for ${tarball.url}`);
      if (sha512Integrity(content) !== tarball.integrity) failures.push(`SHA-512 lockfile mismatch for ${tarball.url}`);
    } catch (error) { failures.push(`Tarball read failed for ${tarball.url}: ${error.message}`); }
  }
  for (const entry of inspection.entries) if (!expectedArchivePaths.has(entry.path)) failures.push(`Unexpected bundle path=${entry.path}`);
  if (inspection.entries.length !== expectedArchivePaths.size) failures.push(`Archive entry count=${inspection.entries.length}; expected=${expectedArchivePaths.size}`);

  return {
    schemaVersion: 1,
    kind: CACHE_TRANSFER_KIND,
    archiveFileName: archivePath ? basename(archivePath) : null,
    archiveSha256: inspection.archiveSha256,
    archiveBytes: inspection.archiveBytes,
    archiveEntryCount: inspection.entryCount,
    packageVersion: manifest.packageVersion ?? null,
    handoffRequestId: manifest.handoffRequestId ?? null,
    packageLockSha256: lockSha256,
    requiredTarballCount: required.length,
    verifiedTarballCount: Math.max(0, required.length - failures.filter((failure) => /tarball|mismatch|missing/i.test(failure)).length),
    deterministicArchiveStatus: inspection.status,
    officialRegistryOnly: manifest.officialRegistryOnly === true,
    failures,
    status: failures.length === 0 ? 'PASS' : 'FAIL'
  };
};

const cacheIndexPath = (cacheRoot, key) => {
  const hex = createHash('sha256').update(key).digest('hex');
  return resolve(cacheRoot, '_cacache', 'index-v5', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));
};

const cacheIndexRecord = ({ url, integrity, size }) => {
  const key = `${CACHE_KEY_PREFIX}${url}`;
  const time = 1;
  const record = {
    key,
    integrity,
    time,
    size,
    metadata: {
      time,
      url,
      reqHeaders: {},
      resHeaders: {
        'content-type': 'application/octet-stream',
        'cache-control': 'public, immutable, max-age=31557600'
      },
      options: { compress: true }
    }
  };
  const json = JSON.stringify(record);
  return { key, line: `${sha1Text(json)}\t${json}\n` };
};

const pathExists = async (path) => {
  try { await lstat(path); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
};

export const importNpmCacheTransferBundle = async ({
  lock,
  lockBytes,
  lockPath = 'package-lock.json',
  packageVersion,
  archivePath,
  archiveBytes,
  targetCacheRoot
}) => {
  const target = resolve(targetCacheRoot);
  if (await pathExists(target)) throw new Error(`Target cache root must not already exist: ${target}`);
  const bytes = archiveBytes ?? await readFile(resolve(archivePath));
  const verification = await verifyNpmCacheTransferBundle({ lock, lockBytes, lockPath, packageVersion, archivePath, archiveBytes: bytes });
  if (verification.status !== 'PASS') return { ...verification, importStatus: 'NOT_RUN', targetCacheRoot: target, status: 'FAIL' };

  const manifest = JSON.parse(readStoredZipEntry(bytes, CACHE_TRANSFER_MANIFEST).toString('utf8'));
  const parent = dirname(target);
  await mkdir(parent, { recursive: true });
  const staging = resolve(parent, `.${basename(target)}.staging-${process.pid}-${randomBytes(6).toString('hex')}`);
  await mkdir(staging, { recursive: false });
  try {
    for (const entry of manifest.entries) {
      const content = readStoredZipEntry(bytes, entry.archivePath);
      const contentPath = npmCacheContentPath(staging, entry.integrity);
      await mkdir(dirname(contentPath), { recursive: true });
      await writeFile(contentPath, content, { flag: 'wx' });
      const index = cacheIndexRecord({ url: entry.url, integrity: entry.integrity, size: content.length });
      const indexPath = cacheIndexPath(staging, index.key);
      await mkdir(dirname(indexPath), { recursive: true });
      await writeFile(indexPath, `\n${index.line}`, { flag: 'wx' });
    }
    const parsedLockBytes = await lockBytesFrom({ lockBytes, lockPath });
    const parsedLock = lockFrom({ lock, bytes: parsedLockBytes });
    const readiness = await assessNpmOfflineCache({ lock: parsedLock, cacheRoot: staging, registry: OFFICIAL_NPM_REGISTRY });
    if (readiness.status !== 'PASS') throw new Error(`Staged cache readiness failed: ${readiness.readyTarballCount}/${readiness.requiredTarballCount}`);
    await rename(staging, target);
    return {
      ...verification,
      importStatus: 'PASS',
      targetCacheRoot: target,
      importedTarballCount: manifest.entries.length,
      readinessStatus: readiness.status,
      status: 'PASS'
    };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
};
