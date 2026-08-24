import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRepositoryRoot = resolve(import.meta.dirname, '..');
const samePath = (left, right) => resolve(left).toLowerCase() === resolve(right).toLowerCase();

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
      outcomes.push({ channel: definition.channel, directory: target, branch: definition.branch, status: 'EXISTING' });
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
    outcomes.push({ channel: definition.channel, directory: target, branch: definition.branch, status: 'CREATED' });
  }

  return { status: 'PASS', policyId: configuration.policyId, authoritativeHead, worktrees: outcomes };
};

const isDirectExecution = process.argv[1]
  && samePath(fileURLToPath(import.meta.url), process.argv[1]);
if (isDirectExecution) {
  process.stdout.write(`${JSON.stringify(setupReleaseChannelWorktrees(), null, 2)}\n`);
}
