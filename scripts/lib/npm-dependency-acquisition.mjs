import { createHash, randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  CACHE_TRANSFER_KIND,
  CACHE_TRANSFER_MANIFEST,
  OFFICIAL_NPM_REGISTRY,
  cacheTransferArchivePath,
  verifyNpmCacheTransferBundle
} from './npm-cache-transfer.mjs';
import { collectLockfileTarballs } from './npm-offline-cache.mjs';
import { writeDeterministicZip } from './deterministic-zip.mjs';

export const DEPENDENCY_ACQUISITION_PLAN_KIND = 'PPT_NPM_DEPENDENCY_ACQUISITION_PLAN';
export const DEPENDENCY_ACQUISITION_PLAN_SCHEMA = 1;

const sha256Bytes = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha512Integrity = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const lockBytesFrom = async ({ lockBytes, lockPath = 'package-lock.json' }) => lockBytes ?? readFile(resolve(lockPath));
const lockFrom = ({ lock, bytes }) => lock ?? JSON.parse(bytes.toString('utf8'));

const resolveWithin = (root, candidate) => {
  const absoluteRoot = resolve(root);
  const absoluteCandidate = resolve(candidate);
  const traversal = relative(absoluteRoot, absoluteCandidate);
  if (traversal.startsWith('..') || isAbsolute(traversal) || traversal.split(sep).includes('..')) {
    throw new Error(`Path escapes dependency acquisition staging root: ${candidate}`);
  }
  return absoluteCandidate;
};

const validatePolicy = (policy) => {
  if (!policy || typeof policy !== 'object') throw new Error('Dependency acquisition policy must be an object.');
  if (policy.schemaVersion !== 1) throw new Error(`Unsupported dependency acquisition policy schemaVersion=${policy.schemaVersion}`);
  if (policy.registry !== OFFICIAL_NPM_REGISTRY || policy.officialRegistryOnly !== true) {
    throw new Error('Dependency acquisition policy must allow only the official npm registry.');
  }
  for (const [name, minimum, maximum] of [
    ['concurrency', 1, 16],
    ['maxAttempts', 1, 10],
    ['baseDelayMs', 0, 60_000],
    ['maxDelayMs', 0, 300_000],
    ['requestTimeoutMs', 1_000, 900_000],
    ['maxTarballBytes', 1_024, 1_073_741_824],
    ['maxBundleBytes', 1_024, 4_294_967_295]
  ]) {
    const value = policy[name];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error(`Invalid dependency acquisition policy ${name}=${value}`);
    }
  }
  if (policy.maxDelayMs < policy.baseDelayMs) throw new Error('maxDelayMs must be greater than or equal to baseDelayMs.');
  if (!Array.isArray(policy.retryableHttpStatuses) || !policy.retryableHttpStatuses.every(Number.isInteger)) {
    throw new Error('retryableHttpStatuses must be an integer array.');
  }
  if (!Array.isArray(policy.retryableNetworkCodes) || !policy.retryableNetworkCodes.every((item) => typeof item === 'string')) {
    throw new Error('retryableNetworkCodes must be a string array.');
  }
  if (policy.redirectPolicy !== 'SAME_ORIGIN_ONLY') throw new Error('Only SAME_ORIGIN_ONLY redirect policy is supported.');
  if (typeof policy.userAgent !== 'string' || policy.userAgent.length < 8 || policy.userAgent.length > 200) {
    throw new Error('Dependency acquisition userAgent is invalid.');
  }
  return policy;
};

const expectedPlanEntries = (lock) => collectLockfileTarballs(lock, OFFICIAL_NPM_REGISTRY).map((entry) => ({
  url: entry.url,
  integrity: entry.integrity,
  archivePath: cacheTransferArchivePath(entry.integrity),
  packagePaths: [...entry.packagePaths].sort((left, right) => left.localeCompare(right, 'en'))
}));

export const createDependencyAcquisitionPlan = async ({
  lock,
  lockBytes,
  lockPath = 'package-lock.json',
  packageVersion
}) => {
  if (typeof packageVersion !== 'string' || packageVersion.length === 0) throw new Error('packageVersion is required.');
  const bytes = await lockBytesFrom({ lockBytes, lockPath });
  const parsedLock = lockFrom({ lock, bytes });
  const entries = expectedPlanEntries(parsedLock);
  return {
    schemaVersion: DEPENDENCY_ACQUISITION_PLAN_SCHEMA,
    kind: DEPENDENCY_ACQUISITION_PLAN_KIND,
    registry: OFFICIAL_NPM_REGISTRY,
    officialRegistryOnly: true,
    packageVersion,
    packageLockSha256: sha256Bytes(bytes),
    requiredTarballCount: entries.length,
    entries
  };
};

export const verifyDependencyAcquisitionPlan = async ({
  plan,
  lock,
  lockBytes,
  lockPath = 'package-lock.json',
  packageVersion
}) => {
  const failures = [];
  if (!plan || typeof plan !== 'object') failures.push('Acquisition plan must be an object.');
  if (plan?.schemaVersion !== DEPENDENCY_ACQUISITION_PLAN_SCHEMA) failures.push(`Unsupported plan schemaVersion=${plan?.schemaVersion}`);
  if (plan?.kind !== DEPENDENCY_ACQUISITION_PLAN_KIND) failures.push(`Unexpected plan kind=${plan?.kind}`);
  if (plan?.registry !== OFFICIAL_NPM_REGISTRY || plan?.officialRegistryOnly !== true) failures.push('Plan must use only the official npm registry.');

  let bytes;
  let parsedLock;
  let required = [];
  try {
    bytes = await lockBytesFrom({ lockBytes, lockPath });
    parsedLock = lockFrom({ lock, bytes });
    required = expectedPlanEntries(parsedLock);
  } catch (error) {
    failures.push(error.message);
  }
  const lockSha256 = bytes ? sha256Bytes(bytes) : null;
  if (lockSha256 && plan?.packageLockSha256 !== lockSha256) failures.push(`package-lock SHA-256 mismatch: plan=${plan?.packageLockSha256}, current=${lockSha256}`);
  if (packageVersion && plan?.packageVersion !== packageVersion) failures.push(`Package version mismatch: plan=${plan?.packageVersion}, current=${packageVersion}`);
  if (plan?.handoffRequestId !== undefined && !/^[a-f0-9]{64}$/.test(plan.handoffRequestId)) failures.push(`Invalid handoffRequestId=${plan?.handoffRequestId}`);
  if (!Array.isArray(plan?.entries)) failures.push('Plan entries must be an array.');
  const entries = Array.isArray(plan?.entries) ? plan.entries : [];
  if (plan?.requiredTarballCount !== required.length) failures.push(`requiredTarballCount=${plan?.requiredTarballCount}; expected=${required.length}`);
  if (entries.length !== required.length) failures.push(`Plan entry count=${entries.length}; expected=${required.length}`);
  const sorted = [...entries].map((entry) => entry?.url).sort((left, right) => String(left).localeCompare(String(right), 'en'));
  if (entries.some((entry, index) => entry?.url !== sorted[index])) failures.push('Plan entries must be strictly sorted by URL.');
  const byUrl = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || typeof entry.url !== 'string') {
      failures.push('Plan contains an invalid entry.');
      continue;
    }
    if (byUrl.has(entry.url)) failures.push(`Duplicate plan URL=${entry.url}`);
    byUrl.set(entry.url, entry);
    try {
      const url = new URL(entry.url);
      if (url.protocol !== 'https:' || url.origin !== new URL(OFFICIAL_NPM_REGISTRY).origin) failures.push(`Non-official plan URL=${entry.url}`);
    } catch {
      failures.push(`Invalid plan URL=${entry.url}`);
    }
  }
  for (const expected of required) {
    const actual = byUrl.get(expected.url);
    if (!actual) {
      failures.push(`Plan is missing ${expected.url}`);
      continue;
    }
    if (actual.integrity !== expected.integrity) failures.push(`Integrity mismatch for ${expected.url}`);
    if (actual.archivePath !== expected.archivePath) failures.push(`Archive path mismatch for ${expected.url}`);
    if (JSON.stringify(actual.packagePaths) !== JSON.stringify(expected.packagePaths)) failures.push(`packagePaths mismatch for ${expected.url}`);
  }
  return {
    schemaVersion: 1,
    kind: DEPENDENCY_ACQUISITION_PLAN_KIND,
    packageVersion: plan?.packageVersion ?? null,
    packageLockSha256: lockSha256,
    requiredTarballCount: required.length,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures
  };
};

const readResponseBytes = async (response, maxBytes) => {
  const lengthText = response.headers.get('content-length');
  if (lengthText) {
    const length = Number(lengthText);
    if (!Number.isSafeInteger(length) || length < 0) throw Object.assign(new Error(`Invalid content-length=${lengthText}`), { code: 'INVALID_CONTENT_LENGTH' });
    if (length > maxBytes) throw Object.assign(new Error(`Tarball content-length=${length} exceeds maxTarballBytes=${maxBytes}`), { code: 'TARBALL_TOO_LARGE' });
  }
  const chunks = [];
  let total = 0;
  const reader = response.body?.getReader();
  if (!reader) return Buffer.from(await response.arrayBuffer());
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel('tarball-size-limit');
      throw Object.assign(new Error(`Tarball bytes exceed maxTarballBytes=${maxBytes}`), { code: 'TARBALL_TOO_LARGE' });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
};

export const fetchOfficialNpmTarball = async ({ url, policy }) => {
  const validatedPolicy = validatePolicy(policy);
  const requested = new URL(url);
  const official = new URL(OFFICIAL_NPM_REGISTRY);
  if (requested.protocol !== 'https:' || requested.origin !== official.origin) {
    throw Object.assign(new Error(`Only official npm HTTPS tarballs are allowed: ${url}`), { code: 'NON_OFFICIAL_REGISTRY' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), validatedPolicy.requestTimeoutMs);
  try {
    const response = await fetch(requested, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'application/octet-stream',
        'user-agent': validatedPolicy.userAgent
      },
      signal: controller.signal
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw Object.assign(new Error(`Redirect without location for ${url}`), { status: response.status, code: 'REDIRECT_REJECTED' });
      const redirected = new URL(location, requested);
      if (redirected.protocol !== 'https:' || redirected.origin !== official.origin) {
        throw Object.assign(new Error(`Cross-origin redirect rejected: ${redirected.href}`), { status: response.status, code: 'REDIRECT_REJECTED' });
      }
      throw Object.assign(new Error(`Redirect response rejected; canonical lockfile URL is required: ${redirected.href}`), { status: response.status, code: 'REDIRECT_REJECTED' });
    }
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), { status: response.status, code: `HTTP_${response.status}` });
    return readResponseBytes(response, validatedPolicy.maxTarballBytes);
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error(`Tarball request timed out after ${validatedPolicy.requestTimeoutMs} ms: ${url}`), { code: 'ETIMEDOUT' });
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const verifyTarballBytes = (entry, bytes, policy) => {
  if (!Buffer.isBuffer(bytes)) throw new Error(`Fetcher did not return a Buffer for ${entry.url}`);
  if (bytes.length > policy.maxTarballBytes) throw new Error(`Tarball bytes=${bytes.length} exceed maxTarballBytes=${policy.maxTarballBytes} for ${entry.url}`);
  const actual = sha512Integrity(bytes);
  if (actual !== entry.integrity) throw Object.assign(new Error(`SHA-512 integrity mismatch for ${entry.url}`), { code: 'INTEGRITY_MISMATCH', actualIntegrity: actual });
};

const existingVerified = async (path, entry, policy) => {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Staged tarball must be a regular non-symlink file: ${path}`);
    if (info.size > policy.maxTarballBytes) return false;
    const bytes = await readFile(path);
    verifyTarballBytes(entry, bytes, policy);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'INTEGRITY_MISMATCH') return false;
    throw error;
  }
};

const errorStatus = (error) => Number.isInteger(error?.status) ? error.status : (Number.isInteger(error?.cause?.status) ? error.cause.status : undefined);
const errorCode = (error) => typeof error?.code === 'string' ? error.code : (typeof error?.cause?.code === 'string' ? error.cause.code : undefined);

const retryable = (error, policy) => {
  const status = errorStatus(error);
  const code = errorCode(error);
  if (Number.isInteger(status) && policy.retryableHttpStatuses.includes(status)) return true;
  if (typeof code === 'string' && policy.retryableNetworkCodes.includes(code)) return true;
  return false;
};

const fetchWithRetry = async ({ entry, policy, fetchTarball, onAttempt }) => {
  let lastError;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      onAttempt?.({ entry, attempt });
      const bytes = await fetchTarball({ url: entry.url, entry, policy, attempt });
      verifyTarballBytes(entry, bytes, policy);
      return { bytes, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= policy.maxAttempts || !retryable(error, policy)) break;
      const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** (attempt - 1)));
      if (delay > 0) await sleep(delay);
    }
  }
  throw Object.assign(new Error(`Tarball acquisition failed for ${entry.url}: ${lastError?.message ?? 'unknown error'}`), {
    code: errorCode(lastError),
    status: errorStatus(lastError),
    cause: lastError
  });
};

const writeAtomic = async (path, bytes) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.partial-${process.pid}-${randomBytes(6).toString('hex')}`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

const runPool = async (items, concurrency, worker) => {
  let cursor = 0;
  const results = new Array(items.length);
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

export const acquireDependencyBundle = async ({
  plan,
  lock,
  lockBytes,
  lockPath = 'package-lock.json',
  packageVersion,
  policy,
  stagingRoot,
  outputPath,
  fetchTarball = fetchOfficialNpmTarball,
  onProgress
}) => {
  const validatedPolicy = validatePolicy(policy);
  const planVerification = await verifyDependencyAcquisitionPlan({ plan, lock, lockBytes, lockPath, packageVersion });
  if (planVerification.status !== 'PASS') {
    return { schemaVersion: 1, status: 'FAIL', classification: 'PLAN_REJECTED', planVerification, failures: planVerification.failures };
  }
  const absoluteStagingRoot = resolve(stagingRoot);
  await mkdir(absoluteStagingRoot, { recursive: true });
  const entries = [...plan.entries];
  let downloadedTarballCount = 0;
  let reusedTarballCount = 0;
  let retryCount = 0;
  let totalBytes = 0;

  const acquired = await runPool(entries, validatedPolicy.concurrency, async (entry, index) => {
    const target = resolveWithin(absoluteStagingRoot, resolve(absoluteStagingRoot, entry.archivePath));
    if (await existingVerified(target, entry, validatedPolicy)) {
      const info = await stat(target);
      reusedTarballCount += 1;
      totalBytes += info.size;
      onProgress?.({ phase: 'reused', index: index + 1, total: entries.length, url: entry.url, bytes: info.size });
      return { ...entry, path: target, bytes: info.size, sha256: sha256Bytes(await readFile(target)), source: 'REUSED', attempts: 0 };
    }
    await rm(target, { force: true });
    const result = await fetchWithRetry({
      entry,
      policy: validatedPolicy,
      fetchTarball,
      onAttempt: ({ attempt }) => {
        if (attempt > 1) retryCount += 1;
        onProgress?.({ phase: 'attempt', index: index + 1, total: entries.length, url: entry.url, attempt });
      }
    });
    await writeAtomic(target, result.bytes);
    downloadedTarballCount += 1;
    totalBytes += result.bytes.length;
    onProgress?.({ phase: 'downloaded', index: index + 1, total: entries.length, url: entry.url, bytes: result.bytes.length, attempts: result.attempts });
    return { ...entry, path: target, bytes: result.bytes.length, sha256: sha256Bytes(result.bytes), source: 'DOWNLOADED', attempts: result.attempts };
  });

  if (totalBytes > validatedPolicy.maxBundleBytes) {
    return { schemaVersion: 1, status: 'FAIL', classification: 'BUNDLE_SIZE_LIMIT', totalBytes, failures: [`Bundle bytes=${totalBytes} exceed maxBundleBytes=${validatedPolicy.maxBundleBytes}`] };
  }

  const transferManifest = {
    schemaVersion: 1,
    kind: CACHE_TRANSFER_KIND,
    registry: OFFICIAL_NPM_REGISTRY,
    officialRegistryOnly: true,
    complete: true,
    packageVersion: plan.packageVersion,
    packageLockSha256: plan.packageLockSha256,
    ...(plan.handoffRequestId ? { handoffRequestId: plan.handoffRequestId } : {}),
    requiredTarballCount: acquired.length,
    includedTarballCount: acquired.length,
    entries: acquired.map(({ url, integrity, bytes, sha256, archivePath }) => ({ url, integrity, bytes, sha256, archivePath }))
  };
  const manifestPath = resolveWithin(absoluteStagingRoot, resolve(absoluteStagingRoot, CACHE_TRANSFER_MANIFEST));
  await writeFile(manifestPath, `${JSON.stringify(transferManifest, null, 2)}\n`);
  const paths = [CACHE_TRANSFER_MANIFEST, ...acquired.map((entry) => entry.archivePath)]
    .sort((left, right) => left.localeCompare(right, 'en'));
  const archive = await writeDeterministicZip({ root: absoluteStagingRoot, paths, outputPath });
  const verification = await verifyNpmCacheTransferBundle({
    lock,
    lockBytes,
    lockPath,
    packageVersion,
    archivePath: outputPath
  });
  if (verification.status !== 'PASS') {
    await rm(resolve(outputPath), { force: true });
    return { schemaVersion: 1, status: 'FAIL', classification: 'BUNDLE_VERIFICATION_FAILED', verification, failures: verification.failures };
  }
  return {
    schemaVersion: 1,
    status: 'PASS',
    classification: 'NONE',
    registry: OFFICIAL_NPM_REGISTRY,
    officialRegistryOnly: true,
    packageVersion: plan.packageVersion,
    packageLockSha256: plan.packageLockSha256,
    ...(plan.handoffRequestId ? { handoffRequestId: plan.handoffRequestId } : {}),
    requiredTarballCount: entries.length,
    downloadedTarballCount,
    reusedTarballCount,
    retryCount,
    totalTarballBytes: totalBytes,
    archivePath: resolve(outputPath),
    archiveFileName: basename(outputPath),
    archiveSha256: archive.archiveSha256,
    archiveBytes: archive.archiveBytes,
    archiveEntryCount: archive.entryCount,
    deterministicArchive: true,
    verificationStatus: verification.status,
    failures: []
  };
};
