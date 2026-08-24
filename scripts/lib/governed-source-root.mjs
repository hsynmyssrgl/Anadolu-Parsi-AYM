import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DEFAULT_CODE_ROOT = resolve('C:\\PPT\\AYM', '06_KOD');
const RELEASE_CHANNELS = Object.freeze(['Bronze', 'Silver', 'Gold']);
const normalize = (value) => resolve(value).replaceAll('\\', '/').toLocaleLowerCase('en-US');
const samePath = (left, right) => normalize(left) === normalize(right);

export const classifyGovernedSourceRoot = ({
  root,
  codeRoot = DEFAULT_CODE_ROOT,
  allowReleaseChannel = false
}) => {
  const resolvedRoot = resolve(root);
  const authoritativeRoot = resolve(codeRoot, 'app');
  if (samePath(resolvedRoot, authoritativeRoot)) {
    return Object.freeze({ root: resolvedRoot, kind: 'AUTHORITATIVE', channel: null });
  }

  const channel = RELEASE_CHANNELS.find((candidate) =>
    samePath(resolvedRoot, resolve(codeRoot, 'kanallar', candidate))
  );
  if (!channel || !allowReleaseChannel) throw new Error(`Unsafe source root: ${resolvedRoot}`);
  return Object.freeze({ root: resolvedRoot, kind: 'RELEASE_CHANNEL', channel });
};

export const assertGovernedSourceRoot = ({
  root = process.cwd(),
  allowReleaseChannel = false,
  codeRoot = DEFAULT_CODE_ROOT
} = {}) => {
  const classified = classifyGovernedSourceRoot({ root, codeRoot, allowReleaseChannel });
  const realRoot = realpathSync.native(classified.root);
  if (!samePath(realRoot, classified.root)) throw new Error(`Source root resolves through an alias: ${classified.root}`);

  const git = spawnSync('git', ['-C', classified.root, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (git.status !== 0) throw new Error(`Source root is not a readable Git worktree: ${classified.root}`);
  const gitTopLevel = String(git.stdout ?? '').trim();
  if (!samePath(gitTopLevel, classified.root)) {
    throw new Error(`Source root is not the exact Git worktree root: ${classified.root}`);
  }
  if (classified.kind === 'RELEASE_CHANNEL' && basename(classified.root) !== classified.channel) {
    throw new Error(`Release-channel root identity mismatch: ${classified.root}`);
  }
  return classified.root;
};
