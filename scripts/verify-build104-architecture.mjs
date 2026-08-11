import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.104';
const expectedPackageVersion = '25.7.2026-104';
const expectedBuild = 104;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
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
verify(lock.packages?.['']?.version === expectedPackageVersion, `lock root package version=${lock.packages?.['']?.version}`);
for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  if (/^(?:apps|packages)\/[^/]+$/.test(packagePath)) verify(entry.version === expectedPackageVersion, `${packagePath} version=${entry.version}`);
  if (entry.link === true) {
    verify(packagePath.startsWith('node_modules/@ppt/'), `unexpected workspace link ${packagePath}`);
    verify(/^(?:apps|packages)\//.test(entry.resolved ?? ''), `workspace link is not local: ${packagePath}`);
  }
}

const repositoryDirectory = 'packages/repositories/src';
const repositoryFiles = (await readdir(repositoryDirectory)).filter((name) => name.endsWith('-repository.ts') && name !== 'repository-ports.ts').sort();
verify(repositoryFiles.length === 26, `repository implementation count=${repositoryFiles.length}`);
for (const file of repositoryFiles) {
  const source = await readFile(join(repositoryDirectory, file), 'utf8');
  const classMatch = /export class (Sqlite[A-Za-z0-9]+Repository) extends SqliteRepository implements ([A-Za-z0-9]+RepositoryPort)\s*\{/.exec(source);
  verify(Boolean(classMatch), `${file} does not explicitly implement a repository port`);
  verify(/export interface [A-Za-z0-9]+RepositoryPort\s*\{/.test(source), `${file} explicit repository port is missing`);
  verify(!source.includes('SqliteRepositoryContext'), `${file} uses deprecated SQLite repository context`);
  verify(source.includes("from './repository-context.js'"), `${file} does not consume repository contract context/result`);
}

const portSurface = await readFile('packages/repositories/src/repository-ports.ts', 'utf8');
verify(!/import type \{ Sqlite[A-Za-z0-9]+Repository/.test(portSurface), 'repository ports import concrete SQLite repositories');
verify(!portSurface.includes('PublicRepositoryPort'), 'repository ports are structurally derived from concrete repositories');
verify(portSurface.includes("from './repository-context.js';"), 'repository contract context is not exported from the port surface');
verify(portSurface.includes("from './transaction-ports.js';"), 'transaction ports are not exported from the port surface');
for (const file of repositoryFiles) {
  const base = file.replace(/\.ts$/, '.js');
  verify(portSurface.includes(`from './${base}';`), `${file} port contract is absent from the contract-only surface`);
}

const contextSource = await readFile('packages/repositories/src/repository-context.ts', 'utf8');
verify(contextSource.includes('export interface RepositoryContext'), 'generic RepositoryContext is missing');
verify(contextSource.includes('export type RepositoryExecutionContext = RepositoryContext<DatabaseExecutor>;'), 'RepositoryExecutionContext is not isolated in the contract module');
const sqliteBase = await readFile('packages/repositories/src/sqlite-base.ts', 'utf8');
verify(sqliteBase.includes("from './repository-context.js';"), 'SQLite base does not consume the contract module');
verify(!sqliteBase.includes("from './index.js';"), 'SQLite base still depends on the package barrel');
const repositoryIndex = await readFile('packages/repositories/src/index.ts', 'utf8');
verify(repositoryIndex.startsWith("export * from './repository-context.js';"), 'repository contract module is not the first package export');

const repositoriesManifest = await readJson('packages/repositories/package.json');
verify(repositoriesManifest.exports?.['./ports']?.types === './dist/repository-ports.d.ts', 'repository contract type subpath is missing');
verify(repositoriesManifest.exports?.['./ports']?.default === './dist/repository-ports.js', 'repository contract runtime subpath is missing');
const rootTsconfig = await readJson('tsconfig.json');
verify(rootTsconfig.compilerOptions?.paths?.['@ppt/repositories/ports']?.[0] === 'packages/repositories/src/repository-ports.ts', 'root typecheck path does not resolve repository contracts');

const adapterDirectory = 'apps/desktop/src/main';
const adapterFiles = (await readdir(adapterDirectory)).filter((name) => name.endsWith('-application-adapter.ts')).sort();
verify(adapterFiles.length === 30, `desktop application adapter count=${adapterFiles.length}`);
for (const file of adapterFiles) {
  const source = await readFile(join(adapterDirectory, file), 'utf8');
  verify(!/\bSqlite[A-Za-z0-9_]*/.test(source), `${file} exposes SQLite-specific application naming`);
  verify(!source.includes("from '@ppt/repositories';"), `${file} imports the implementation-bearing repository root`);
  if (source.includes('Repository') || source.includes('TransactionExecutor')) {
    verify(source.includes("from '@ppt/repositories/ports';"), `${file} does not import the contract-only repository surface`);
  }
  verify(!source.includes("from '@ppt/database'"), `${file} imports the database package`);
  verify(!source.includes("from '@ppt/infrastructure'"), `${file} imports infrastructure`);
  verify(!/new Sqlite[A-Za-z0-9]+Repository\(/.test(source), `${file} constructs a concrete repository`);
  verify(!/\.(?:prepare|exec)\(/.test(source), `${file} performs direct database operations`);
  verify(!/\b(?:SELECT|INSERT INTO|UPDATE\s+[A-Za-z_]|DELETE FROM|CREATE TABLE|ALTER TABLE|PRAGMA|CREATE TRIGGER)\b/i.test(source), `${file} owns raw SQL`);
}

const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
verify(dataStore.includes("import type { TransactionExecutor } from '@ppt/repositories/ports';"), 'FamilyDataStore does not consume the transaction contract subpath');
for (const oldName of ['SqliteFamilyApplicationUnitOfWork', 'SqliteAuthApplicationUnitOfWork', 'SqliteTimelineQueryPort', 'SqliteDashboardQueryPort']) {
  verify(!dataStore.includes(oldName), `FamilyDataStore retains infrastructure-specific application name ${oldName}`);
}
verify(dataStore.includes('RepositoryBackedFamilyApplicationUnitOfWork'), 'FamilyDataStore does not compose the repository-backed family application adapter');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 104'"), 'active development stage mismatch');
const ledger = await readJson('artifacts/manifests/VERSION_LEDGER.json');
const latestLedger = ledger.entries?.at(-1);
verify(latestLedger?.version === expectedDisplayVersion, `ledger version=${latestLedger?.version}`);
verify(latestLedger?.packageVersion === expectedPackageVersion, `ledger package=${latestLedger?.packageVersion}`);
verify(latestLedger?.sequence === expectedBuild, `ledger sequence=${latestLedger?.sequence}`);
const metadata = await readJson('repository-metadata.json');
verify(metadata.repositoryVersion === expectedDisplayVersion, `metadata repositoryVersion=${metadata.repositoryVersion}`);
verify(metadata.packageVersion === expectedPackageVersion, `metadata packageVersion=${metadata.packageVersion}`);
verify(metadata.revision === 'BUILD-104', `metadata revision=${metadata.revision}`);
verify(metadata.versionSequence === expectedBuild, `metadata sequence=${metadata.versionSequence}`);

const rootManifest = await readJson('package.json');
verify(rootManifest.scripts?.['verify:build104:architecture'] === 'node scripts/verify-build104-architecture.mjs', 'Build 104 verifier is not registered');
verify(rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);

if (failures.length > 0) {
  console.error(`Build 104 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 104 architecture verification completed: ${checks} targeted assertions / ${repositoryFiles.length} explicit repository ports / ${adapterFiles.length} application adapters.`);
