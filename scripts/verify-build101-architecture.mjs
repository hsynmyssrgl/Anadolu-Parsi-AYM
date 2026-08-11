import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.101';
const expectedPackageVersion = '25.7.2026-101';
const failures = [];
let checks = 0;
const verify = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const manifestPaths = ['package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) manifestPaths.push(join(parent, entry.name, 'package.json'));
  }
}
const workspaceNames = new Set();
for (const path of manifestPaths.slice(1)) workspaceNames.add((await readJson(path)).name);
for (const path of manifestPaths) {
  const manifest = await readJson(path);
  verify(manifest.version === expectedPackageVersion, `${path} version=${manifest.version}`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (workspaceNames.has(name)) verify(version === expectedPackageVersion, `${path} ${name}=${version}`);
    }
  }
}

const lock = await readJson('package-lock.json');
verify(lock.version === expectedPackageVersion, `lock root version=${lock.version}`);
let externalTarballs = 0;
for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  if (entry.link === true) {
    verify(packagePath.startsWith('node_modules/@ppt/'), `unexpected lock link ${packagePath}`);
    verify(/^(apps|packages)\//.test(entry.resolved ?? ''), `non-local internal link ${packagePath}`);
    continue;
  }
  if (!entry.resolved) continue;
  let url;
  try { url = new URL(entry.resolved); } catch { continue; }
  if (!url.pathname.endsWith('.tgz')) continue;
  externalTarballs += 1;
  verify(url.protocol === 'https:', `${packagePath} is not HTTPS`);
  verify(url.hostname === 'registry.npmjs.org', `${packagePath} host=${url.hostname}`);
  verify(/^sha512-/.test(entry.integrity ?? ''), `${packagePath} has no sha512 integrity`);
}
verify(externalTarballs >= 400, `external tarball coverage is unexpectedly low: ${externalTarballs}`);

const rootManifest = await readJson('package.json');
verify(rootManifest.scripts?.['canonicalize:lockfile'] === 'node scripts/canonicalize-lockfile-registry.mjs', 'canonicalize:lockfile is not registered');
verify(rootManifest.scripts?.['verify:dependency-supply'] === 'node scripts/verify-dependency-supply.mjs', 'verify:dependency-supply is not registered');
verify(rootManifest.scripts?.['validate:rc2:gates'] === 'node scripts/run-rc2-validation-gates.mjs', 'validate:rc2:gates is not registered');
verify(rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);

const gateConfig = await readJson('config/rc2-validation-gates.json');
const expectedGateOrder = ['clean-npm-ci', 'tsc-no-emit', 'electron-production-build', 'smoke-tests', 'windows-real-launch', 'windows-installer'];
verify(gateConfig.stopOnFailure === true, 'validation gates must stop on failure');
verify(JSON.stringify(gateConfig.gates?.map((gate) => gate.id)) === JSON.stringify(expectedGateOrder), 'validation gate order differs from the approved order');
verify(gateConfig.gates?.[0]?.command === 'npm' && gateConfig.gates?.[0]?.args?.[0] === 'ci', 'first gate is not npm ci');
verify(gateConfig.gates?.[1]?.args?.join(' ') === 'run typecheck', 'second gate is not root tsc --noEmit');
verify(gateConfig.gates?.[4]?.platforms?.length === 1 && gateConfig.gates[4].platforms[0] === 'win32', 'Windows launch gate is not Windows-only');
verify(gateConfig.gates?.[5]?.platforms?.length === 1 && gateConfig.gates[5].platforms[0] === 'win32', 'installer gate is not Windows-only');

const gateRunner = await readFile('scripts/run-rc2-validation-gates.mjs', 'utf8');
verify(gateRunner.includes("status: 'NOT_RUN'"), 'gate runner does not record NOT_RUN');
verify(gateRunner.includes("overallStatus: results.every"), 'gate runner does not derive overall status from actual results');
verify(gateRunner.includes("if (report.overallStatus !== 'PASS') process.exit(1)"), 'gate runner does not fail incomplete validation');
const launchScript = await readFile('scripts/windows-real-launch-test.ps1', 'utf8');
verify(launchScript.includes('Start-Process'), 'Windows launch test does not start Electron');
verify(launchScript.includes('Start-Sleep -Seconds 15'), 'Windows launch test has no sustained startup observation');
verify(launchScript.includes('Stop-Process'), 'Windows launch test does not clean up the process');

const workflow = await readFile('.github/workflows/windows-rc2-validation.yml', 'utf8');
verify(/workflow_dispatch:/.test(workflow), 'Windows validation workflow is not manual');
verify(workflow.includes('windows-latest'), 'Windows validation workflow does not use a Windows runner');
verify(workflow.includes('validate:rc2:gates'), 'Windows workflow bypasses the ordered gate runner');
verify(workflow.includes('if: always()'), 'Windows workflow does not preserve failure evidence');

const desktopMigrationShim = await readFile('apps/desktop/src/main/database-migrations.ts', 'utf8');
const databaseMigrations = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
verify(!/\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE|PRAGMA)\b/i.test(desktopMigrationShim), 'desktop migration shim contains raw SQL');
verify(/CREATE TABLE/i.test(databaseMigrations), 'database package no longer owns migration SQL');
const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
verify(dataStore.includes('createSqliteRepositoryCompositionRoot'), 'FamilyDataStore no longer consumes the composition root');
const adapterFiles = (await readdir('apps/desktop/src/main')).filter((name) => name.endsWith('-application-adapter.ts'));
for (const file of adapterFiles) {
  const source = await readFile(join('apps/desktop/src/main', file), 'utf8');
  if (!source.includes("from '@ppt/repositories'")) continue;
  verify(/import\s+type\s*\{[^;]*\}\s*from '@ppt\/repositories';/s.test(source), `${file} has a runtime repository import`);
  verify(!/Sqlite[A-Za-z]+Repository/.test(source), `${file} has a concrete repository dependency`);
}

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 101'"), 'active development stage mismatch');

if (failures.length > 0) {
  console.error(`Build 101 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 101 architecture verification completed: ${checks} targeted assertions / ${externalTarballs} canonical tarballs.`);
