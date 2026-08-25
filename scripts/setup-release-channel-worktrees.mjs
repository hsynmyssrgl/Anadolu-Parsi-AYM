import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRepositoryRoot = resolve(import.meta.dirname, '..');
const samePath = (left, right) => resolve(left).toLowerCase() === resolve(right).toLowerCase();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

const normalizeManifestPath = (value) => {
  if (typeof value !== 'string' || value === '' || isAbsolute(value) || value.includes('\\')) {
    throw new Error(`Unsafe manifest payload path: ${String(value)}`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe manifest payload path: ${value}`);
  }
  return value;
};

export const selectUntrackedManifestPayloadEntries = ({ manifestFiles, trackedPaths }) => {
  if (!Array.isArray(manifestFiles)) throw new Error('Source manifest file inventory is invalid.');
  const tracked = trackedPaths instanceof Set ? trackedPaths : new Set(trackedPaths ?? []);
  const seen = new Set();
  const entries = [];
  for (const entry of manifestFiles) {
    const path = normalizeManifestPath(entry?.path);
    if (seen.has(path)) throw new Error(`Duplicate source manifest payload path: ${path}`);
    seen.add(path);
    if (!SHA256_PATTERN.test(String(entry?.sha256 ?? ''))
      || !Number.isSafeInteger(entry?.bytes) || entry.bytes < 0) {
      throw new Error(`Invalid source manifest payload identity: ${path}`);
    }
    if (!tracked.has(path)) entries.push(Object.freeze({ path, sha256: entry.sha256, bytes: entry.bytes }));
  }
  return Object.freeze(entries);
};

const assertCanonicalRoot = (root, label) => {
  const full = resolve(root);
  const item = lstatSync(full);
  if (!item.isDirectory() || item.isSymbolicLink() || !samePath(realpathSync(full), full)) {
    throw new Error(`${label} is not a canonical directory.`);
  }
  return full;
};

const assertCanonicalPayloadFile = (root, relativePath, label) => {
  const canonicalRoot = assertCanonicalRoot(root, `${label} root`);
  let cursor = canonicalRoot;
  const segments = normalizeManifestPath(relativePath).split('/');
  for (const [index, segment] of segments.entries()) {
    cursor = resolve(cursor, segment);
    const local = relative(canonicalRoot, cursor);
    if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
      throw new Error(`${label} escapes its canonical root: ${relativePath}`);
    }
    const item = lstatSync(cursor);
    const isTarget = index === segments.length - 1;
    if (item.isSymbolicLink() || (isTarget ? !item.isFile() : !item.isDirectory())
      || !samePath(realpathSync(cursor), cursor)) {
      throw new Error(`${label} contains a non-canonical entry: ${relativePath}`);
    }
  }
  return cursor;
};

const ensureCanonicalTargetParent = (root, relativePath, label) => {
  const canonicalRoot = assertCanonicalRoot(root, `${label} root`);
  const segments = normalizeManifestPath(relativePath).split('/');
  let cursor = canonicalRoot;
  for (const segment of segments.slice(0, -1)) {
    cursor = resolve(cursor, segment);
    const local = relative(canonicalRoot, cursor);
    if (!local || local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
      throw new Error(`${label} escapes its canonical root: ${relativePath}`);
    }
    if (!existsSync(cursor)) mkdirSync(cursor);
    const item = lstatSync(cursor);
    if (!item.isDirectory() || item.isSymbolicLink() || !samePath(realpathSync(cursor), cursor)) {
      throw new Error(`${label} contains a non-canonical directory: ${relativePath}`);
    }
  }
  return resolve(canonicalRoot, ...segments);
};

const hydrateManifestPayload = ({ repositoryRoot, target, manifest, trackedPaths }) => {
  const entries = selectUntrackedManifestPayloadEntries({ manifestFiles: manifest.files, trackedPaths });
  let copied = 0;
  let unchanged = 0;
  for (const entry of entries) {
    const sourcePath = assertCanonicalPayloadFile(repositoryRoot, entry.path, 'Authoritative manifest payload');
    const bytes = readFileSync(sourcePath);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) {
      throw new Error(`Authoritative manifest payload hash mismatch: ${entry.path}`);
    }
    const targetPath = ensureCanonicalTargetParent(target, entry.path, 'Release-channel manifest payload');
    if (existsSync(targetPath)) {
      const item = lstatSync(targetPath);
      if (!item.isFile() || item.isSymbolicLink() || !samePath(realpathSync(targetPath), targetPath)) {
        throw new Error(`Release-channel manifest payload target is not canonical: ${entry.path}`);
      }
      const current = readFileSync(targetPath);
      if (current.length === entry.bytes && sha256(current) === entry.sha256) {
        unchanged += 1;
        continue;
      }
    }
    const temporaryPath = resolve(dirname(targetPath), `.tmp-channel-payload-${randomUUID()}`);
    try {
      writeFileSync(temporaryPath, bytes, { flag: 'wx' });
      renameSync(temporaryPath, targetPath);
    } finally {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
    const readback = readFileSync(assertCanonicalPayloadFile(target, entry.path, 'Release-channel manifest payload'));
    if (readback.length !== entry.bytes || sha256(readback) !== entry.sha256) {
      throw new Error(`Release-channel manifest payload readback mismatch: ${entry.path}`);
    }
    copied += 1;
  }
  return Object.freeze({ status: 'PASS', manifestPayloadFiles: entries.length, copied, unchanged });
};

export const assertCleanWorktree = (status, label) => {
  if (String(status).trim()) throw new Error(`${label} is not clean. Commit and validate first.`);
};

export const assertExactCommit = (actualCommit, authoritativeCommit, label) => {
  const actual = String(actualCommit).trim();
  const expected = String(authoritativeCommit).trim();
  if (!/^[0-9a-f]{40,64}$/iu.test(actual) || actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} does not point to the authoritative HEAD commit.`);
  }
};

export const setupReleaseChannelWorktrees = ({ repositoryRoot = scriptRepositoryRoot } = {}) => {
  const codeRoot = dirname(repositoryRoot);
  const configuration = JSON.parse(readFileSync(join(repositoryRoot, 'config/release-channel-worktrees.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(repositoryRoot, 'manifest.json'), 'utf8'));
  const git = (args, { allowFailure = false, cwd = repositoryRoot } = {}) => {
    const result = spawnSync('git', ['-c', `safe.directory=${cwd}`, ...args], {
      cwd, encoding: 'utf8', windowsHide: true
    });
    if (!allowFailure && result.status !== 0) {
      throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
    }
    return result;
  };

  if (configuration.schemaVersion !== 1 || configuration.authoritativeRepositoryDirectory !== basename(repositoryRoot)) {
    throw new Error('Release-channel worktree configuration does not match the authoritative repository.');
  }
  assertCleanWorktree(git(['status', '--porcelain=v1', '--untracked-files=all']).stdout,
    'The authoritative repository');
  const authoritativeHead = git(['rev-parse', 'HEAD']).stdout.trim();
  const trackedPaths = new Set(git(['ls-files', '-z']).stdout.split('\0').filter(Boolean));
  const authoritativeCommonGitDirectory = resolve(repositoryRoot,
    git(['rev-parse', '--git-common-dir']).stdout.trim());

  const worktreeRoot = resolve(codeRoot, configuration.worktreeRootDirectory);
  if (dirname(worktreeRoot) !== codeRoot) throw new Error('Worktree root must be a direct child of the code directory.');
  mkdirSync(worktreeRoot, { recursive: true });

  const registered = new Map();
  const records = git(['worktree', 'list', '--porcelain']).stdout.split(/\r?\n\r?\n/u);
  for (const record of records) {
    const path = /^worktree (.+)$/mu.exec(record)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/mu.exec(record)?.[1];
    if (path) registered.set(resolve(path), branch ?? null);
  }

  const verifyWorktree = (definition, target) => {
    const actualBranch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: target }).stdout.trim();
    if (actualBranch !== definition.branch) {
      throw new Error(`${definition.channel} worktree is bound to an unexpected branch.`);
    }
    assertCleanWorktree(git(['status', '--porcelain=v1', '--untracked-files=all'], { cwd: target }).stdout,
      `${definition.channel} worktree`);
    assertExactCommit(git(['rev-parse', 'HEAD'], { cwd: target }).stdout, authoritativeHead,
      `${definition.channel} worktree`);
    const commonGitDirectory = resolve(target,
      git(['rev-parse', '--git-common-dir'], { cwd: target }).stdout.trim());
    if (!samePath(commonGitDirectory, authoritativeCommonGitDirectory)) {
      throw new Error(`${definition.channel} worktree does not share the authoritative Git object database.`);
    }
  };

  const outcomes = [];
  for (const definition of configuration.channels) {
    const target = resolve(worktreeRoot, definition.directory);
    if (dirname(target) !== worktreeRoot) throw new Error(`Invalid channel worktree directory: ${definition.directory}`);
    const existingBranch = registered.get(target);
    if (existingBranch !== undefined) {
      if (existingBranch !== definition.branch) throw new Error(`${definition.channel} worktree is bound to an unexpected branch.`);
      verifyWorktree(definition, target);
      const payload = hydrateManifestPayload({ repositoryRoot, target, manifest, trackedPaths });
      verifyWorktree(definition, target);
      outcomes.push({ channel: definition.channel, directory: target, branch: definition.branch, status: 'EXISTING', payload });
      continue;
    }
    if (existsSync(target)) throw new Error(`${target} exists but is not a registered Git worktree.`);
    const branchExists = git(['show-ref', '--verify', '--quiet', `refs/heads/${definition.branch}`], { allowFailure: true }).status === 0;
    if (branchExists) {
      const branchCommit = git(['rev-parse', `refs/heads/${definition.branch}`]).stdout.trim();
      assertExactCommit(branchCommit, authoritativeHead, `${definition.channel} branch`);
    }
    git(branchExists
      ? ['worktree', 'add', target, definition.branch]
      : ['worktree', 'add', '-b', definition.branch, target, 'HEAD']);
    verifyWorktree(definition, target);
    const payload = hydrateManifestPayload({ repositoryRoot, target, manifest, trackedPaths });
    verifyWorktree(definition, target);
    outcomes.push({ channel: definition.channel, directory: target, branch: definition.branch, status: 'CREATED', payload });
  }

  return { status: 'PASS', policyId: configuration.policyId, authoritativeHead, worktrees: outcomes };
};

const isDirectExecution = process.argv[1]
  && samePath(fileURLToPath(import.meta.url), process.argv[1]);
if (isDirectExecution) {
  process.stdout.write(`${JSON.stringify(setupReleaseChannelWorktrees(), null, 2)}\n`);
}
