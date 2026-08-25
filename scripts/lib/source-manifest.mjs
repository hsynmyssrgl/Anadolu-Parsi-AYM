import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const SOURCE_MANIFEST_SCHEMA_VERSION = 3;
export const SOURCE_MANIFEST_FILE = 'manifest.json';
export const SOURCE_SHA256_FILE = 'SHA256SUMS.txt';

const excludedDirectoryNames = new Set(['node_modules', 'dist', 'release', '.git', 'coverage', '.tmp', 'tmp']);
const excludedFileNames = new Set([SOURCE_MANIFEST_FILE, SOURCE_SHA256_FILE]);
const excludedEntryNames = new Set(['.git']);
const excludedRelativeDirectories = new Set(['artifacts/validation']);

export const normalizeSourcePath = (value) => {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Source path must be a non-empty string.');
  if (value.includes('\0')) throw new Error(`Source path contains a NUL byte: ${JSON.stringify(value)}`);
  if (isAbsolute(value)) throw new Error(`Source path must be repository-relative: ${value}`);
  const normalized = value.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error(`Source path is not canonical: ${value}`);
  }
  return normalized;
};

const isExcludedRelativeDirectory = (relativePath) => {
  const normalized = relativePath.replaceAll('\\', '/');
  return excludedRelativeDirectories.has(normalized);
};

const isExcludedName = (name, isDirectory) => {
  if (excludedEntryNames.has(name)) return true;
  if (name.startsWith('.tmp')) return true;
  if (isDirectory) return excludedDirectoryNames.has(name);
  return excludedFileNames.has(name);
};

const resolveWithinRoot = (root, relativePath) => {
  const normalized = normalizeSourcePath(relativePath);
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, normalized);
  const traversal = relative(absoluteRoot, absolutePath);
  if (traversal.startsWith('..') || isAbsolute(traversal) || traversal.split(sep).includes('..')) {
    throw new Error(`Source path escapes repository root: ${relativePath}`);
  }
  return { normalized, absolutePath };
};

export const collectSourceFilePaths = async (root = '.') => {
  const absoluteRoot = resolve(root);
  const paths = [];

  const walk = async (directory, directoryRelative = '') => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const relativePath = directoryRelative ? `${directoryRelative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink() && (excludedDirectoryNames.has(entry.name) || entry.name.startsWith('.tmp'))) continue;
      if (isExcludedName(entry.name, entry.isDirectory())) continue;
      if (entry.isDirectory() && isExcludedRelativeDirectory(relativePath)) continue;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in source delivery: ${relativePath}`);
      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) throw new Error(`Unsupported filesystem entry in source delivery: ${relativePath}`);
      paths.push(normalizeSourcePath(relativePath));
    }
  };

  await walk(absoluteRoot);
  paths.sort((left, right) => left.localeCompare(right, 'en'));
  return paths;
};

export const sha256Buffer = (buffer) => createHash('sha256').update(buffer).digest('hex');

export const buildSourceEntries = async (root = '.', paths = undefined) => {
  const sourcePaths = paths ?? await collectSourceFilePaths(root);
  const entries = [];
  for (const path of sourcePaths) {
    const { absolutePath, normalized } = resolveWithinRoot(root, path);
    const fileStat = await lstat(absolutePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) throw new Error(`Manifest source is not a regular file: ${normalized}`);
    const content = await readFile(absolutePath);
    entries.push({ path: normalized, sha256: sha256Buffer(content), bytes: content.length });
  }
  return entries;
};

export const renderSha256Sums = (entries) => `${entries.map((entry) => `${entry.sha256}  ${entry.path}`).join('\n')}\n`;

export const parseSha256Sums = (content) => {
  if (typeof content !== 'string') throw new Error('SHA256SUMS content must be text.');
  const lines = content.replaceAll('\r\n', '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0) throw new Error('SHA256SUMS.txt must contain at least one entry.');
  return lines.map((line, index) => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match) throw new Error(`Invalid SHA256SUMS line ${index + 1}.`);
    return { sha256: match[1], path: normalizeSourcePath(match[2]) };
  });
};

const validateOrderedUniquePaths = (entries, label, failures) => {
  const seen = new Set();
  let previous = null;
  for (const [index, entry] of entries.entries()) {
    let normalized;
    try {
      normalized = normalizeSourcePath(entry.path);
    } catch (error) {
      failures.push(`${label}[${index}] path error: ${error.message}`);
      continue;
    }
    if (normalized !== entry.path) failures.push(`${label}[${index}] path is not canonical: ${entry.path}`);
    if (seen.has(normalized)) failures.push(`${label} contains duplicate path: ${normalized}`);
    seen.add(normalized);
    if (previous !== null && previous.localeCompare(normalized, 'en') >= 0) failures.push(`${label} paths are not strictly sorted: ${previous} then ${normalized}`);
    previous = normalized;
  }
};

export const generateSourceManifest = async (root = '.', options = {}) => {
  const absoluteRoot = resolve(root);
  const packageJson = JSON.parse(await readFile(resolve(absoluteRoot, 'package.json'), 'utf8'));
  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) throw new Error('package.json version is required.');
  const files = await buildSourceEntries(absoluteRoot);
  const manifest = {
    schemaVersion: SOURCE_MANIFEST_SCHEMA_VERSION,
    packageVersion: packageJson.version,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    fileCount: files.length,
    files
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(resolve(absoluteRoot, SOURCE_MANIFEST_FILE), manifestText);
  const sumsEntries = [...files, { path: SOURCE_MANIFEST_FILE, sha256: sha256Buffer(Buffer.from(manifestText)) }]
    .sort((left, right) => left.path.localeCompare(right.path, 'en'));
  await writeFile(resolve(absoluteRoot, SOURCE_SHA256_FILE), renderSha256Sums(sumsEntries));
  return { manifest, sumsEntries };
};

export const verifySourceManifestIntegrity = async (root = '.') => {
  const absoluteRoot = resolve(root);
  const failures = [];
  const packageJson = JSON.parse(await readFile(resolve(absoluteRoot, 'package.json'), 'utf8'));
  const manifestText = await readFile(resolve(absoluteRoot, SOURCE_MANIFEST_FILE), 'utf8');
  const sumsText = await readFile(resolve(absoluteRoot, SOURCE_SHA256_FILE), 'utf8');
  const manifest = JSON.parse(manifestText);

  if (manifest.schemaVersion !== SOURCE_MANIFEST_SCHEMA_VERSION) failures.push(`manifest schemaVersion=${manifest.schemaVersion}; expected ${SOURCE_MANIFEST_SCHEMA_VERSION}`);
  if (manifest.packageVersion !== packageJson.version) failures.push(`manifest packageVersion=${manifest.packageVersion}; package.json=${packageJson.version}`);
  if (!Number.isFinite(Date.parse(manifest.generatedAt))) failures.push(`manifest generatedAt is invalid: ${manifest.generatedAt}`);
  if (!Array.isArray(manifest.files)) failures.push('manifest files must be an array.');

  const manifestEntries = Array.isArray(manifest.files) ? manifest.files : [];
  if (manifest.fileCount !== manifestEntries.length) failures.push(`manifest fileCount=${manifest.fileCount}; actual entries=${manifestEntries.length}`);
  validateOrderedUniquePaths(manifestEntries, 'manifest.files', failures);

  for (const [index, entry] of manifestEntries.entries()) {
    if (!/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) failures.push(`manifest.files[${index}] has invalid sha256.`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) failures.push(`manifest.files[${index}] has invalid bytes=${entry.bytes}`);
    if (entry.path === SOURCE_MANIFEST_FILE || entry.path === SOURCE_SHA256_FILE) failures.push(`manifest must not include self-managed file: ${entry.path}`);
  }

  let actualEntries = [];
  try {
    actualEntries = await buildSourceEntries(absoluteRoot);
  } catch (error) {
    failures.push(`source collection failed: ${error.message}`);
  }
  const manifestByPath = new Map(manifestEntries.map((entry) => [entry.path, entry]));
  const actualByPath = new Map(actualEntries.map((entry) => [entry.path, entry]));
  for (const entry of manifestEntries) {
    const actual = actualByPath.get(entry.path);
    if (!actual) {
      failures.push(`manifest path is missing from source tree: ${entry.path}`);
      continue;
    }
    if (actual.bytes !== entry.bytes) failures.push(`byte mismatch for ${entry.path}: manifest=${entry.bytes}, actual=${actual.bytes}`);
    if (actual.sha256 !== entry.sha256) failures.push(`sha256 mismatch for ${entry.path}: manifest=${entry.sha256}, actual=${actual.sha256}`);
  }
  for (const entry of actualEntries) {
    if (!manifestByPath.has(entry.path)) failures.push(`source tree contains unmanifested file: ${entry.path}`);
  }

  let sumsEntries = [];
  try {
    sumsEntries = parseSha256Sums(sumsText);
  } catch (error) {
    failures.push(`SHA256SUMS parse failed: ${error.message}`);
  }
  validateOrderedUniquePaths(sumsEntries, 'SHA256SUMS', failures);
  if (sumsEntries.some((entry) => entry.path === SOURCE_SHA256_FILE)) failures.push('SHA256SUMS.txt must not contain a hash for itself.');

  const expectedSums = [...manifestEntries.map(({ path, sha256 }) => ({ path, sha256 })), {
    path: SOURCE_MANIFEST_FILE,
    sha256: sha256Buffer(Buffer.from(manifestText))
  }].sort((left, right) => left.path.localeCompare(right.path, 'en'));
  if (sumsEntries.length !== expectedSums.length) failures.push(`SHA256SUMS entry count=${sumsEntries.length}; expected ${expectedSums.length}`);
  const sumsByPath = new Map(sumsEntries.map((entry) => [entry.path, entry.sha256]));
  for (const expected of expectedSums) {
    const actualHash = sumsByPath.get(expected.path);
    if (!actualHash) failures.push(`SHA256SUMS is missing path: ${expected.path}`);
    else if (actualHash !== expected.sha256) failures.push(`SHA256SUMS mismatch for ${expected.path}: listed=${actualHash}, expected=${expected.sha256}`);
  }
  for (const entry of sumsEntries) {
    if (!expectedSums.some((expected) => expected.path === entry.path)) failures.push(`SHA256SUMS contains unexpected path: ${entry.path}`);
  }

  return {
    schemaVersion: 1,
    product: 'ParsYuva Aile Yaşam Merkezi',
    packageVersion: packageJson.version,
    manifestSchemaVersion: manifest.schemaVersion ?? null,
    manifestFileCount: manifestEntries.length,
    actualSourceFileCount: actualEntries.length,
    sha256EntryCount: sumsEntries.length,
    symlinksAllowed: false,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures
  };
};

export const writeIntegrityReport = async (reportPath, report) => {
  const absolutePath = resolve(reportPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2)}\n`);
};
