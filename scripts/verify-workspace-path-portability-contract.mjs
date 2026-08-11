import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  canonicalRepositoryPath,
  isWorkspaceLockPath,
  workspaceLockPathFromManifest,
  workspaceManifestPath
} from './lib/workspace-paths.mjs';

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const reportPath = resolve(option('--report', 'artifacts/validation/workspace-path-portability-contract.json'));
let assertions = 0;
const failures = [];
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const rejects = (operation, marker) => {
  try {
    operation();
    verify(false, `unsafe path accepted=${marker}`);
  } catch {
    verify(true, marker);
  }
};

for (const [input, expected] of [
  ['apps/desktop/package.json', 'apps/desktop/package.json'],
  ['apps\\desktop\\package.json', 'apps/desktop/package.json'],
  ['packages/core/package.json', 'packages/core/package.json'],
  ['packages\\repository-contracts\\package.json', 'packages/repository-contracts/package.json']
]) {
  verify(canonicalRepositoryPath(input) === expected, `canonical mismatch=${input}`);
}
verify(workspaceManifestPath('apps', 'desktop') === 'apps/desktop/package.json', 'apps manifest path is not canonical');
verify(workspaceManifestPath('packages', 'core') === 'packages/core/package.json', 'package manifest path is not canonical');
verify(workspaceLockPathFromManifest('apps/desktop/package.json') === 'apps/desktop', 'POSIX manifest lock path mismatch');
verify(workspaceLockPathFromManifest('apps\\desktop\\package.json') === 'apps/desktop', 'Windows manifest lock path mismatch');
verify(workspaceLockPathFromManifest('packages\\core\\package.json') === 'packages/core', 'Windows package lock path mismatch');

for (const valid of ['apps/desktop', 'apps\\desktop', 'packages/core', 'packages\\repository-contracts']) {
  verify(isWorkspaceLockPath(valid), `valid workspace lock path rejected=${valid}`);
}
for (const invalid of [
  '',
  'package.json',
  'apps',
  'apps/desktop/package.json',
  'apps/desktop/node_modules/esbuild',
  'node_modules/electron',
  '../apps/desktop',
  'C:\\apps\\desktop',
  '/apps/desktop'
]) {
  verify(!isWorkspaceLockPath(invalid), `invalid workspace lock path accepted=${invalid}`);
}
for (const unsafe of [
  '',
  '.',
  '..',
  '../apps/desktop',
  'apps/../desktop',
  'apps//desktop',
  '/apps/desktop',
  'C:\\apps\\desktop'
]) {
  rejects(() => canonicalRepositoryPath(unsafe), unsafe);
}
rejects(() => workspaceLockPathFromManifest('apps/desktop'), 'manifest suffix required');

const verifierSource = await readFile('scripts/verify-active-version-contract.mjs', 'utf8');
const updaterSource = await readFile('scripts/set-workspace-version.mjs', 'utf8');
for (const marker of ['workspaceManifestPath', 'workspaceLockPathFromManifest']) {
  verify(verifierSource.includes(marker), `active version verifier missing portability helper=${marker}`);
}
for (const marker of ['workspaceManifestPath', 'isWorkspaceLockPath']) {
  verify(updaterSource.includes(marker), `version updater missing portability helper=${marker}`);
}
verify(!verifierSource.includes("path.replace(/\\/package\\.json$/"), 'active version verifier retains separator-sensitive lock lookup');
verify(!updaterSource.includes("/^(?:apps|packages)\\/[^/]+$/.test(packagePath)"), 'version updater retains inline separator-sensitive matcher');

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '26.07.2026.122',
  packageVersion: '26.7.2026-122',
  stage: 'Bronze RC2 Active Development',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Workspace path portability contract: ${report.status} — ${assertions} assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;
