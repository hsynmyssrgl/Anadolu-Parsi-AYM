import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.105';
const expectedPackageVersion = '25.7.2026-105';
const expectedBuild = 105;
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

const contracts = await readFile('packages/contracts/src/persistence.ts', 'utf8');
for (const contract of ['StatementRunResult', 'DatabaseStatement', 'DatabaseExecutor', 'DatabaseConnection', 'RepositoryTransaction', 'TransactionContext', 'TransactionExecutor']) {
  verify(new RegExp(`export interface ${contract}\\b`).test(contracts), `contracts layer does not own ${contract}`);
}
verify(contracts.includes('declare const repositoryTransactionBrand: unique symbol;'), 'repository transaction is not nominal/opaque');
verify(contracts.includes('readonly transaction: RepositoryTransaction;'), 'transaction context does not expose the opaque transaction token');
verify(!contracts.includes('readonly database: DatabaseExecutor;'), 'transaction context still exposes SQL-capable database executor');
verify((await readFile('packages/contracts/src/index.ts', 'utf8')).includes("export * from './persistence.js';"), 'persistence contracts are not exported');

const migrationRunner = await readFile('packages/database/src/migration-runner.ts', 'utf8');
verify(migrationRunner.includes("from '@ppt/contracts';"), 'database migration runner does not consume neutral contracts');
for (const declaration of ['DatabaseExecutor', 'DatabaseConnection', 'TransactionContext', 'TransactionExecutor']) {
  verify(!new RegExp(`export interface ${declaration}\\b`).test(migrationRunner), `database package still owns duplicate ${declaration}`);
}
const familyMigrations = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
verify(familyMigrations.includes('createSqliteSafetyBackup,'), 'family migration runtime does not import safety backup helper');
verify(familyMigrations.includes('defaultMigrationBackupDirectory,'), 'family migration runtime does not import default backup directory helper');
verify(!familyMigrations.includes("from './backup-safety.js';"), 'family migration runtime imports migration safety helpers from the wrong module');

const transaction = await readFile('packages/database/src/transaction.ts', 'utf8');
verify(transaction.includes('transaction: this.database as unknown as RepositoryTransaction'), 'SQLite transaction executor does not wrap the native executor as an opaque token');
verify(!transaction.includes('database: this.database'), 'SQLite transaction callback still exposes the native database');

const repositoryContext = await readFile('packages/repositories/src/repository-context.ts', 'utf8');
verify(repositoryContext.includes("import type { RepositoryTransaction } from '@ppt/contracts';"), 'repository context does not depend on the opaque contract');
verify(repositoryContext.includes('RepositoryContext<RepositoryTransaction>'), 'repository execution context does not use opaque transaction token');
verify(!repositoryContext.includes('DatabaseExecutor'), 'repository contract context exposes SQL capability');
const transactionPorts = await readFile('packages/repositories/src/transaction-ports.ts', 'utf8');
verify(transactionPorts.includes("from '@ppt/contracts';"), 'repository transaction compatibility surface is not contract-owned');
verify(!transactionPorts.includes('interface TransactionContext'), 'repository package duplicates transaction context');

const sqliteBase = await readFile('packages/repositories/src/sqlite-base.ts', 'utf8');
verify(sqliteBase.includes('protected database(context: RepositoryExecutionContext): DatabaseExecutor'), 'SQLite repository base does not own the controlled token unwrap');
verify(sqliteBase.includes('context.transaction as unknown as DatabaseExecutor'), 'SQLite repository base does not unwrap the opaque token');
verify(!sqliteBase.includes('SqliteRepositoryContext'), 'deprecated SQLite repository context alias remains');

const repositoryDirectory = 'packages/repositories/src';
const repositoryFiles = (await readdir(repositoryDirectory)).filter((name) => name.endsWith('-repository.ts') && name !== 'repository-ports.ts').sort();
verify(repositoryFiles.length === 26, `repository implementation count=${repositoryFiles.length}`);
for (const file of repositoryFiles) {
  const source = await readFile(join(repositoryDirectory, file), 'utf8');
  verify(!/\b[A-Za-z_$][A-Za-z0-9_$]*\.transaction\.(?:prepare|exec)\(/.test(source), `${file} directly consumes the opaque transaction token`);
  const portStart = source.search(/export interface [A-Za-z0-9]+RepositoryPort\b/);
  const classStart = source.search(/export class Sqlite[A-Za-z0-9]+Repository\b/);
  const portSection = portStart >= 0 && classStart > portStart ? source.slice(portStart, classStart) : '';
  verify(!/\([^)]*\b[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*[^)]*\)/.test(portSection), `${file} repository port contains a parameter initializer`);
  verify(!source.includes('SqliteRepositoryContext'), `${file} uses removed SQLite repository context alias`);
  verify(/export class Sqlite[A-Za-z0-9]+Repository extends SqliteRepository implements [A-Za-z0-9]+RepositoryPort/.test(source), `${file} does not explicitly implement its port`);
}

const adapterDirectory = 'apps/desktop/src/main';
const adapterFiles = (await readdir(adapterDirectory)).filter((name) => name.endsWith('-application-adapter.ts')).sort();
verify(adapterFiles.length === 30, `desktop application adapter count=${adapterFiles.length}`);
for (const file of adapterFiles) {
  const source = await readFile(join(adapterDirectory, file), 'utf8');
  verify(!source.includes('.database'), `${file} sees a database handle`);
  verify(!/\.(?:prepare|exec)\(/.test(source), `${file} performs database operations`);
  verify(!source.includes("from '@ppt/database'"), `${file} imports database implementation package`);
  verify(!source.includes("from '@ppt/infrastructure'"), `${file} imports infrastructure package`);
  if (source.includes('TransactionContext')) verify(source.includes('.transaction'), `${file} does not forward opaque transaction token`);
}
const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
verify(!dataStore.includes('transaction.database'), 'FamilyDataStore forwards SQL-capable transaction database');
verify(dataStore.includes('transaction: transaction.transaction'), 'FamilyDataStore does not forward opaque transaction tokens');

for (const path of ['packages/database/package.json', 'packages/repositories/package.json', 'packages/infrastructure/package.json', 'apps/desktop/package.json']) {
  const manifest = await readJson(path);
  verify(manifest.dependencies?.['@ppt/contracts'] === expectedPackageVersion, `${path} does not declare @ppt/contracts`);
}
const infrastructureOperations = await readFile('packages/infrastructure/src/sqlite-database-operations.ts', 'utf8');
verify(infrastructureOperations.includes("import type { DatabaseExecutor } from '@ppt/contracts';"), 'infrastructure imports database executor from implementation package');
const familyRuntime = await readFile('apps/desktop/src/main/family-database-runtime.ts', 'utf8');
verify(familyRuntime.includes("import type { DatabaseConnection } from '@ppt/contracts';"), 'desktop runtime does not consume neutral database connection contract');
verify(familyRuntime.includes("from '@ppt/repositories/ports';"), 'desktop runtime imports transaction port from implementation-bearing root');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 105'"), 'active development stage mismatch');
const ledger = await readJson('artifacts/manifests/VERSION_LEDGER.json');
const latestLedger = ledger.entries?.at(-1);
verify(latestLedger?.version === expectedDisplayVersion, `ledger version=${latestLedger?.version}`);
verify(latestLedger?.packageVersion === expectedPackageVersion, `ledger package=${latestLedger?.packageVersion}`);
verify(latestLedger?.sequence === expectedBuild, `ledger sequence=${latestLedger?.sequence}`);
const metadata = await readJson('repository-metadata.json');
verify(metadata.repositoryVersion === expectedDisplayVersion, `metadata repositoryVersion=${metadata.repositoryVersion}`);
verify(metadata.packageVersion === expectedPackageVersion, `metadata packageVersion=${metadata.packageVersion}`);
verify(metadata.revision === 'BUILD-105', `metadata revision=${metadata.revision}`);
verify(metadata.versionSequence === expectedBuild, `metadata sequence=${metadata.versionSequence}`);

const rootManifest = await readJson('package.json');
verify(rootManifest.scripts?.['verify:build105:architecture'] === 'node scripts/verify-build105-architecture.mjs', 'Build 105 verifier is not registered');
verify(rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);

if (failures.length > 0) {
  console.error(`Build 105 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 105 architecture verification completed: ${checks} targeted assertions / ${repositoryFiles.length} repositories / ${adapterFiles.length} application adapters.`);
