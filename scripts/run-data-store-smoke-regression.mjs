import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertGovernedSourceRoot } from './lib/governed-source-root.mjs';

const noWrite = process.argv.includes('--no-write');
if (!noWrite) throw new Error('--no-write is required.');
if (process.argv.length !== 3) throw new Error('Only --no-write is accepted.');
const root = assertGovernedSourceRoot({ allowReleaseChannel: true });
const requiredWorkspaceEntrypoints = Object.freeze([
  'packages/application/dist/index.js',
  'packages/contracts/dist/index.js',
  'packages/core/dist/index.js',
  'packages/database/dist/index.js',
  'packages/domain/dist/index.js',
  'packages/events/dist/index.js',
  'packages/infrastructure/dist/index.js',
  'packages/logging/dist/index.js',
  'packages/platform-policy/dist/index.js',
  'packages/repositories/dist/index.js',
  'packages/repository-contracts/dist/index.js',
  'packages/security/dist/index.js'
]);
for (const relativePath of requiredWorkspaceEntrypoints) {
  try { accessSync(resolve(root, relativePath)); }
  catch { throw new Error(`Data-store smoke package preparation is missing: ${relativePath}`); }
}

const run = (label, args, timeout) => {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
  return result;
};

run('data-store smoke TypeScript preparation', [
  'node_modules/typescript/bin/tsc',
  '-p',
  'tests/smoke/tsconfig.data-store.json'
], 10 * 60 * 1000);
const smoke = run('data-store smoke', [
  'scripts/verify-data-store-smoke.mjs',
  '--no-write'
], 10 * 60 * 1000);
process.stdout.write(smoke.stdout ?? '');
