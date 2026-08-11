import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const expectedDisplayVersion = '25.07.2026.107';
const expectedPackageVersion = '25.7.2026-107';
const expectedBuild = 107;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };

const rootManifest = await readJson('package.json');
const manifestPaths = ['package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory() && await exists(join(parent, entry.name, 'package.json'))) {
      manifestPaths.push(join(parent, entry.name, 'package.json'));
    }
  }
}
const workspaceNames = new Set();
for (const path of manifestPaths.slice(1)) workspaceNames.add((await readJson(path)).name);
verify(workspaceNames.size === 14, `workspace count=${workspaceNames.size}`);
verify(workspaceNames.has('@ppt/repository-contracts'), 'repository contract workspace is missing');
for (const path of manifestPaths) {
  const manifest = await readJson(path);
  verify(manifest.version === expectedPackageVersion, `${path} version=${manifest.version}`);
  if (path !== 'package.json') verify(manifest.private === true, `${path} private=${manifest.private}`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (workspaceNames.has(name)) verify(version === expectedPackageVersion, `${path} ${section}.${name}=${version}`);
    }
  }
}

verify(rootManifest.scripts?.['typecheck:package-source'] === 'node scripts/verify-package-source-types.mjs', 'package source typecheck is not registered');
verify(rootManifest.scripts?.['typecheck:desktop-main-source'] === 'node scripts/verify-desktop-main-source-types.mjs', 'desktop main source typecheck is not registered');
verify(rootManifest.scripts?.['verify:workspace-dependencies'] === 'node scripts/verify-workspace-dependencies.mjs', 'strong workspace verifier is not registered');
verify(rootManifest.scripts?.['verify:lockfile']?.endsWith('node scripts/verify-workspace-dependencies.mjs'), 'lockfile chain does not include strong workspace verifier');
verify(rootManifest.scripts?.['verify:build107:architecture'] === 'node scripts/verify-build107-architecture.mjs', 'Build 107 verifier is not registered');

const contractManifest = await readJson('packages/repository-contracts/package.json');
verify(contractManifest.private === true, 'repository-contracts must remain private');
const packageTsconfig = await readJson('tsconfig.packages.json');
verify(packageTsconfig.compilerOptions?.paths?.['@ppt/repository-contracts']?.[0] === 'packages/repository-contracts/src/index.ts', 'package source typecheck path misses repository-contracts');
verify(packageTsconfig.compilerOptions?.paths?.['@ppt/repositories/ports'] === undefined, 'removed repositories/ports path alias remains');
const desktopTypeScript = await readFile('scripts/verify-desktop-main-source-types.mjs', 'utf8');
verify(desktopTypeScript.includes("'@ppt/repository-contracts': ['packages/repository-contracts/src/index.ts']"), 'desktop source typecheck path misses repository-contracts');
verify(!desktopTypeScript.includes("'@ppt/repositories/ports'"), 'desktop source typecheck retains removed ports alias');

for (const stale of [
  'packages/repositories/src/repository-context.ts',
  'packages/repositories/src/repository-ports.ts',
  'packages/repositories/src/transaction-ports.ts'
]) verify(!(await exists(stale)), `stale compatibility shim remains: ${stale}`);

const compositionRoot = await readFile('apps/desktop/src/main/repository-composition-root.ts', 'utf8');
verify(compositionRoot.includes("} from '@ppt/repositories';"), 'composition root no longer imports concrete repositories');
verify(compositionRoot.includes("} from '@ppt/repository-contracts';"), 'composition root does not import port contracts from contract package');
const typeImportStart = compositionRoot.indexOf('import type {');
const typeImportEnd = compositionRoot.indexOf("} from '@ppt/repository-contracts';", typeImportStart);
verify(typeImportStart >= 0 && typeImportEnd > typeImportStart, 'composition root contract type import is malformed');
verify(!compositionRoot.slice(typeImportStart, typeImportEnd + 40).includes("from '@ppt/repositories';"), 'composition root obtains port types from implementation package');

const desktopManifest = await readJson('apps/desktop/package.json');
verify(desktopManifest.dependencies?.['@ppt/test-data'] === undefined, 'desktop declares unused test-data runtime dependency');
const applicationManifest = await readJson('packages/application/package.json');
verify(applicationManifest.devDependencies?.['@ppt/test-data'] === expectedPackageVersion, 'application tests do not declare test-data development dependency');
const applicationTest = await readFile('packages/application/tests/service.test.ts', 'utf8');
verify(applicationTest.includes("from './in-memory-timeline-repository.js';"), 'application test does not use local repository test double');
verify(!applicationTest.includes("from '@ppt/infrastructure'"), 'application test depends upward on infrastructure');

const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
verify(dataStore.includes("import { arch, platform } from 'node:os';"), 'data-store misses node:os platform/arch imports');
verify(dataStore.includes('databasePath: options.databasePath,'), 'data-store does not resolve storage layout from constructor input');
const constructorStart = dataStore.indexOf('public constructor(options: DataStoreOptions)');
const databaseAssignment = dataStore.indexOf('this.#databasePath = storageLayout.databasePath;', constructorStart);
verify(constructorStart >= 0 && databaseAssignment > constructorStart, 'data-store constructor assignment markers are missing');
verify(!dataStore.slice(constructorStart, databaseAssignment).includes('databasePath: this.#databasePath,'), 'data-store reads #databasePath before assignment');
verify(!dataStore.includes('this.#correlationId('), 'data-store references missing #correlationId method');
verify(dataStore.includes('userId: asUserId(accountId)'), 'AI consent context does not use typed user id conversion');

for (const [file, required, forbidden] of [
  ['apps/desktop/src/main/family-storage-layout-application-adapter.ts', ['dirname(input.databasePath)', 'databasePath: input.databasePath'], ['transactionPath']],
  ['apps/desktop/src/main/system-resource-snapshot-application-adapter.ts', ['existsSync(input.databasePath)'], ['transactionPath']],
  ['apps/desktop/src/main/full-backup-file-application-adapter.ts', ['readFileSync(input.databasePath)', "Buffer.from(parsed.database, 'base64')", 'parsed.manifest.databaseSha256', "Buffer.from(payload.database, 'base64')", 'plan.databasePath', "typeof payload.database !== 'string'", 'database: payload.database'], ['transactionPath', 'transactionSha256', 'payload.transaction', 'parsed.transaction', 'plan.transactionPath', 'input.transactionPath']]
]) {
  const source = await readFile(file, 'utf8');
  for (const text of required) verify(source.includes(text), `${file} misses canonical database usage: ${text}`);
  for (const text of forbidden) verify(!source.includes(text), `${file} retains legacy field: ${text}`);
}

const verifierRun = spawnSync(process.execPath, ['scripts/verify-workspace-dependencies.mjs'], { encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
verify(verifierRun.status === 0, `workspace dependency verifier failed: ${verifierRun.stderr || verifierRun.stdout}`);
for (const [scriptPath, evidenceFile] of [
  ['scripts/verify-package-source-types.mjs', 'PACKAGE_SOURCE_TYPECHECK.json'],
  ['scripts/verify-desktop-main-source-types.mjs', 'DESKTOP_MAIN_SOURCE_TYPECHECK.json']
]) {
  const run = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
  verify(run.status === 0, `${scriptPath} failed: ${run.stderr || run.stdout}`);
  const evidence = await readJson(join('artifacts', 'validation', evidenceFile.toLowerCase().replaceAll('_', '-')));
  verify(evidence.status === 'PASS', `${evidenceFile} status=${evidence.status}`);
  verify(evidence.exitCode === 0, `${evidenceFile} exitCode=${evidence.exitCode}`);
}

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 107'"), 'active development stage mismatch');
const ledger = await readJson('artifacts/manifests/VERSION_LEDGER.json');
const latestLedger = ledger.entries?.at(-1);
verify(latestLedger?.version === expectedDisplayVersion, `ledger version=${latestLedger?.version}`);
verify(latestLedger?.packageVersion === expectedPackageVersion, `ledger package=${latestLedger?.packageVersion}`);
verify(latestLedger?.sequence === expectedBuild, `ledger sequence=${latestLedger?.sequence}`);
const metadata = await readJson('repository-metadata.json');
verify(metadata.repositoryVersion === expectedDisplayVersion, `metadata repositoryVersion=${metadata.repositoryVersion}`);
verify(metadata.applicationVersion === expectedDisplayVersion, `metadata applicationVersion=${metadata.applicationVersion}`);
verify(metadata.packageVersion === expectedPackageVersion, `metadata packageVersion=${metadata.packageVersion}`);
verify(metadata.revision === 'BUILD-107', `metadata revision=${metadata.revision}`);
verify(metadata.versionSequence === expectedBuild, `metadata sequence=${metadata.versionSequence}`);

const adapterFiles = (await readdir('apps/desktop/src/main')).filter((name) => name.endsWith('-application-adapter.ts')).sort();
verify(adapterFiles.length === 30, `desktop application adapter count=${adapterFiles.length}`);
for (const file of adapterFiles) {
  const source = await readFile(join('apps/desktop/src/main', file), 'utf8');
  verify(!source.includes("from '@ppt/database'"), `${file} imports database implementation package`);
  verify(!source.includes('transactionPath'), `${file} retains legacy transactionPath`);
}

if (failures.length > 0) {
  console.error(`Build 107 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 107 architecture verification completed: ${checks} targeted assertions / ${workspaceNames.size} workspaces / ${adapterFiles.length} application adapters.`);
