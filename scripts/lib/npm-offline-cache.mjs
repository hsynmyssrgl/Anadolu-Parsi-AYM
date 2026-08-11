import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';
const CACHE_KEY_PREFIX = 'make-fetch-happen:request-cache:';

const walkFiles = async (root) => {
  const files = [];
  const walk = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  await walk(root);
  return files;
};

export const resolveNpmCacheRoot = (explicitPath = undefined) => {
  const candidate = explicitPath
    ?? process.env.PPT_NPM_CACHE_PATH
    ?? process.env.npm_config_cache
    ?? process.env.NPM_CONFIG_CACHE
    ?? resolve(homedir(), '.npm');
  return resolve(candidate);
};

const sha512IntegrityToHex = (integrity) => {
  if (typeof integrity !== 'string') return undefined;
  const token = integrity.split(/\s+/).find((value) => value.startsWith('sha512-'));
  if (!token) return undefined;
  try {
    const digest = Buffer.from(token.slice('sha512-'.length), 'base64');
    return digest.length === 64 ? digest.toString('hex') : undefined;
  } catch {
    return undefined;
  }
};

export const npmCacheContentPath = (cacheRoot, integrity) => {
  const hex = sha512IntegrityToHex(integrity);
  if (!hex) return undefined;
  return resolve(cacheRoot, '_cacache', 'content-v2', 'sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4));
};

const resolveWithin = (root, candidate) => {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(candidate);
  const traversal = relative(absoluteRoot, absoluteCandidate);
  if (traversal.startsWith('..') || isAbsolute(traversal) || traversal.split(sep).includes('..')) {
    throw new Error(`Path escapes npm cache root: ${candidate}`);
  }
  return absoluteCandidate;
};

export const readNpmCacheIndex = async (cacheRoot) => {
  const indexRoot = resolveWithin(cacheRoot, resolve(cacheRoot, '_cacache', 'index-v5'));
  const records = new Map();
  const files = await walkFiles(indexRoot);
  for (const path of files) {
    const text = await readFile(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      const tabIndex = line.indexOf('\t');
      if (tabIndex < 0) continue;
      try {
        const record = JSON.parse(line.slice(tabIndex + 1));
        if (typeof record?.key !== 'string') continue;
        const previous = records.get(record.key);
        if (!previous || Number(record.time ?? 0) >= Number(previous.time ?? 0)) records.set(record.key, record);
      } catch {
        // Corrupt or partial index lines are ignored and surfaced as missing entries.
      }
    }
  }
  return { indexRoot, indexFileCount: files.length, records };
};

export const collectLockfileTarballs = (lock, registry = OFFICIAL_REGISTRY) => {
  if (!lock || typeof lock !== 'object' || !lock.packages || typeof lock.packages !== 'object') {
    throw new Error('package-lock packages object is required.');
  }
  const allowedOrigin = new URL(registry).origin;
  const byUrl = new Map();
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    if (!entry || typeof entry !== 'object' || typeof entry.resolved !== 'string' || !entry.resolved.startsWith('http')) continue;
    let url;
    try { url = new URL(entry.resolved); } catch { throw new Error(`Invalid resolved URL in package-lock: ${entry.resolved}`); }
    if (url.origin !== allowedOrigin) throw new Error(`Non-official registry origin in package-lock: ${url.origin}`);
    if (typeof entry.integrity !== 'string' || !entry.integrity.startsWith('sha512-')) {
      throw new Error(`Missing sha512 integrity for ${packagePath || '<root>'}: ${entry.resolved}`);
    }
    const existing = byUrl.get(entry.resolved);
    if (existing && existing.integrity !== entry.integrity) {
      throw new Error(`Conflicting integrity values for ${entry.resolved}`);
    }
    if (!existing) byUrl.set(entry.resolved, {
      url: entry.resolved,
      integrity: entry.integrity,
      packagePaths: [packagePath]
    });
    else existing.packagePaths.push(packagePath);
  }
  return [...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url, 'en'));
};

const verifyContent = async ({ contentPath, expectedIntegrity, expectedSize }) => {
  try {
    const info = await stat(contentPath);
    if (!info.isFile()) return { status: 'CONTENT_MISSING' };
    if (Number.isSafeInteger(expectedSize) && expectedSize >= 0 && info.size !== expectedSize) {
      return { status: 'SIZE_MISMATCH', actualSize: info.size, expectedSize };
    }
    const content = await readFile(contentPath);
    const digest = createHash('sha512').update(content).digest('base64');
    const actualIntegrity = `sha512-${digest}`;
    if (actualIntegrity !== expectedIntegrity) return { status: 'CONTENT_HASH_MISMATCH', actualIntegrity, actualSize: content.length };
    return { status: 'READY', actualSize: content.length };
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'CONTENT_MISSING' };
    return { status: 'CONTENT_READ_ERROR', error: error.message };
  }
};

export const assessNpmOfflineCache = async ({
  lock,
  cacheRoot = resolveNpmCacheRoot(),
  registry = OFFICIAL_REGISTRY,
  includeReadyEntries = false
}) => {
  if (registry !== OFFICIAL_REGISTRY) throw new Error(`Only the official npm registry is allowed; received ${registry}`);
  const tarballs = collectLockfileTarballs(lock, registry);
  const index = await readNpmCacheIndex(cacheRoot);
  const entries = [];
  const reasonCounts = {};
  let readyCount = 0;
  let readyBytes = 0;

  for (const tarball of tarballs) {
    const key = `${CACHE_KEY_PREFIX}${tarball.url}`;
    const record = index.records.get(key);
    let result;
    if (!record) {
      result = { status: 'INDEX_MISSING' };
    } else if (record.integrity !== tarball.integrity) {
      result = { status: 'INDEX_INTEGRITY_MISMATCH', indexIntegrity: record.integrity };
    } else {
      const contentPath = npmCacheContentPath(cacheRoot, tarball.integrity);
      result = contentPath
        ? await verifyContent({ contentPath, expectedIntegrity: tarball.integrity, expectedSize: record.size })
        : { status: 'INVALID_INTEGRITY' };
    }
    if (result.status === 'READY') {
      readyCount += 1;
      readyBytes += result.actualSize ?? 0;
    } else {
      reasonCounts[result.status] = (reasonCounts[result.status] ?? 0) + 1;
    }
    if (includeReadyEntries || result.status !== 'READY') {
      entries.push({
        url: tarball.url,
        integrity: tarball.integrity,
        packagePaths: tarball.packagePaths,
        ...result
      });
    }
  }

  return {
    schemaVersion: 1,
    registry,
    officialRegistryOnly: true,
    cacheRoot,
    cacheIndexFileCount: index.indexFileCount,
    requiredTarballCount: tarballs.length,
    readyTarballCount: readyCount,
    missingOrInvalidTarballCount: tarballs.length - readyCount,
    readyBytes,
    status: readyCount === tarballs.length ? 'PASS' : 'INCOMPLETE',
    reasonCounts,
    entries
  };
};
