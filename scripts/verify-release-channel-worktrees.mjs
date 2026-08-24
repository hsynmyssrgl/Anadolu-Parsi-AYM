import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptCheckoutRoot = resolve(import.meta.dirname, '..');
const allowedKinds = new Set(['mutation', 'test', 'build', 'installation', 'deletion', 'publish', 'read-only']);
const releaseSensitiveKinds = new Set(['build', 'installation', 'publish']);
const expectedChannels = Object.freeze([
  { channel: 'Bronze', directory: 'Bronze', branch: 'channel/bronze' },
  { channel: 'Silver', directory: 'Silver', branch: 'channel/silver' },
  { channel: 'Gold', directory: 'Gold', branch: 'channel/gold' }
]);

const fail = (message) => { throw new Error(message); };
const samePath = (left, right) => resolve(left).toLowerCase() === resolve(right).toLowerCase();
const defaultRunGit = (args, cwd) => {
  const result = spawnSync('git', ['-c', `safe.directory=${cwd}`, ...args], {
    cwd, encoding: 'utf8', windowsHide: true
  });
  if (result.status !== 0) fail((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  return result.stdout.trim();
};
const parseWorktrees = (text) => text.split(/\r?\n\r?\n/u).filter(Boolean).map((record) => ({
  path: /^worktree (.+)$/mu.exec(record)?.[1] ?? '',
  branch: /^branch refs\/heads\/(.+)$/mu.exec(record)?.[1] ?? null,
  detached: /^detached$/mu.test(record)
}));

export const verifyReleaseChannelWorktrees = ({
  kind,
  checkoutRoot = scriptCheckoutRoot,
  configuration,
  runGit = defaultRunGit
}) => {
  if (!allowedKinds.has(kind)) fail('Release-channel worktree gate requires a valid --kind value.');

  const commonGitDirectory = resolve(checkoutRoot, runGit(['rev-parse', '--git-common-dir'], checkoutRoot));
  const authoritativeRepositoryRoot = dirname(commonGitDirectory);
  const codeRoot = dirname(authoritativeRepositoryRoot);
  const activeConfiguration = configuration
    ?? JSON.parse(readFileSync(resolve(checkoutRoot, 'config/release-channel-worktrees.json'), 'utf8'));

  if (activeConfiguration?.schemaVersion !== 1
    || activeConfiguration.policyId !== 'PPT-RELEASE-CHANNEL-WORKTREE-ISOLATION-V1'
    || activeConfiguration.authoritativeRepositoryDirectory !== basename(authoritativeRepositoryRoot)
    || activeConfiguration.worktreeRootDirectory !== 'kanallar'
    || JSON.stringify(activeConfiguration.channels) !== JSON.stringify(expectedChannels)
    || activeConfiguration.rules?.sharedGitObjectDatabase !== true
    || activeConfiguration.rules?.separateBranchesRequired !== true
    || activeConfiguration.rules?.separateWorkingDirectoriesRequired !== true
    || activeConfiguration.rules?.directDirectoryCopyProhibited !== true
    || activeConfiguration.rules?.crossChannelBuildOutputReuseProhibited !== true
    || activeConfiguration.rules?.crossChannelUserDataReuseProhibited !== true) {
    fail('PR-236 release-channel worktree policy is incomplete or drifted.');
  }

  if (releaseSensitiveKinds.has(kind)) {
    const records = parseWorktrees(runGit(['worktree', 'list', '--porcelain'], checkoutRoot));
    for (const definition of expectedChannels) {
      const expectedRoot = resolve(codeRoot, activeConfiguration.worktreeRootDirectory, definition.directory);
      const record = records.find((entry) => samePath(entry.path, expectedRoot));
      if (!record || record.detached || record.branch !== definition.branch) {
        fail(`${definition.channel} release worktree is missing or bound to the wrong branch: ${expectedRoot}`);
      }
      const topLevel = runGit(['rev-parse', '--show-toplevel'], expectedRoot);
      const branch = runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], expectedRoot);
      const channelCommonGitDirectory = resolve(expectedRoot, runGit(['rev-parse', '--git-common-dir'], expectedRoot));
      if (!samePath(topLevel, expectedRoot) || branch !== definition.branch
        || !samePath(channelCommonGitDirectory, commonGitDirectory)) {
        fail(`${definition.channel} release worktree registration or shared Git database is invalid.`);
      }
      const status = runGit(['status', '--porcelain=v1', '--untracked-files=all'], expectedRoot);
      if (status.trim()) {
        fail(`${definition.channel} release worktree is not clean; commit and validate the channel before this operation.`);
      }
    }
  }

  return {
    status: 'PASS',
    policyId: activeConfiguration.policyId,
    kind,
    verification: releaseSensitiveKinds.has(kind) ? 'ALL_CHANNEL_WORKTREES_VERIFIED' : 'POLICY_CONFIGURATION_VERIFIED',
    authoritativeRepositoryRoot,
    commonGitDirectory,
    channels: expectedChannels.map((entry) => entry.channel)
  };
};

const isDirectExecution = process.argv[1]
  && samePath(fileURLToPath(import.meta.url), process.argv[1]);
if (isDirectExecution) {
  const kindIndex = process.argv.indexOf('--kind');
  const kind = kindIndex >= 0 ? String(process.argv[kindIndex + 1] ?? '') : '';
  process.stdout.write(`${JSON.stringify(verifyReleaseChannelWorktrees({ kind }), null, 2)}\n`);
}
