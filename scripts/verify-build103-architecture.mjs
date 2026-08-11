import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.103';
const expectedPackageVersion = '25.7.2026-103';
const expectedBuild = 103;
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
verify(lock.packages?.['']?.version === expectedPackageVersion, `lock root package version=${lock.packages?.['']?.version}`);
for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  if (/^(?:apps|packages)\/[^/]+$/.test(packagePath)) {
    verify(entry.version === expectedPackageVersion, `${packagePath} version=${entry.version}`);
  }
  if (entry.link === true) {
    verify(packagePath.startsWith('node_modules/@ppt/'), `unexpected workspace link ${packagePath}`);
    verify(/^(?:apps|packages)\//.test(entry.resolved ?? ''), `workspace link is not local: ${packagePath}`);
  }
}

const repositoryTransactionPorts = await readFile('packages/repositories/src/transaction-ports.ts', 'utf8');
verify(repositoryTransactionPorts.includes('export interface TransactionContext'), 'repository TransactionContext port is missing');
verify(repositoryTransactionPorts.includes('export interface TransactionExecutor'), 'repository TransactionExecutor port is missing');
verify(repositoryTransactionPorts.includes('operation: (context: TransactionContext)'), 'transaction executor does not expose transaction context');
const repositoryIndex = await readFile('packages/repositories/src/index.ts', 'utf8');
verify(repositoryIndex.includes("export * from './transaction-ports.js';"), 'repository transaction ports are not exported');

const adapterDirectory = 'apps/desktop/src/main';
const mainFiles = (await readdir(adapterDirectory)).filter((name) => name.endsWith('.ts'));
const adapterFiles = mainFiles.filter((name) => name.endsWith('-application-adapter.ts'));
for (const file of adapterFiles) {
  const source = await readFile(join(adapterDirectory, file), 'utf8');
  verify(!source.includes("from '@ppt/database'"), `${file} imports the database implementation package`);
  verify(!source.includes("from 'node:sqlite'"), `${file} imports node:sqlite`);
  verify(!/\bDatabase(?:Executor|Connection|Sync)\b/.test(source), `${file} exposes a database implementation type`);
  verify(!/\b(?:inspectSqliteRuntimeHealth|executeSqliteMaintenance|checkpointSqliteForBackup|verifySqliteBackupFileIntegrity|installSqliteAuditAppendOnlyGuards)\b/.test(source), `${file} calls a concrete SQLite operation`);
  verify(!/Sqlite[A-Za-z0-9]+Repository/.test(source), `${file} depends on a concrete repository class`);
  verify(!/\.(?:prepare|exec)\(/.test(source), `${file} performs direct database operations`);
  verify(!/\b(?:SELECT|INSERT INTO|UPDATE\s+[A-Za-z_]|DELETE FROM|CREATE TABLE|ALTER TABLE|PRAGMA|CREATE TRIGGER)\b/i.test(source), `${file} owns raw SQL`);
  if (source.includes('transactionExecutor')) {
    verify(source.includes("from '@ppt/repositories'"), `${file} transaction port is not imported from repositories`);
    verify(source.includes('TransactionExecutor'), `${file} does not use TransactionExecutor`);
  }
  if (source.includes("from '@ppt/repositories'")) {
    verify(/import\s+type\s*\{[^;]*\}\s*from '@ppt\/repositories';/s.test(source), `${file} has a runtime repository import`);
  }
}

const movedDesktopAdapters = [
  'audit-storage-protection-application-adapter.ts',
  'backup-database-safety-application-adapter.ts',
  'database-health-application-adapter.ts',
  'database-maintenance-application-adapter.ts'
];
for (const file of movedDesktopAdapters) {
  verify(!existsSync(join(adapterDirectory, file)), `${file} still exists in the desktop application layer`);
}

const infrastructureAdapter = await readFile('packages/infrastructure/src/sqlite-database-operations.ts', 'utf8');
const infrastructureClasses = [
  'SqliteAuditStorageProtectionCommandPort',
  'SqliteBackupDatabaseSafetyPort',
  'SqliteDatabaseMaintenanceCommandPort',
  'SqliteDatabaseRuntimeHealthQueryPort'
];
for (const className of infrastructureClasses) {
  verify(infrastructureAdapter.includes(`export class ${className}`), `${className} is missing from infrastructure`);
}
for (const operationName of [
  'installSqliteAuditAppendOnlyGuards',
  'checkpointSqliteForBackup',
  'verifySqliteBackupFileIntegrity',
  'executeSqliteMaintenance',
  'inspectSqliteRuntimeHealth'
]) {
  verify(infrastructureAdapter.includes(operationName), `${operationName} is not owned by the infrastructure adapter`);
}
const infrastructureIndex = await readFile('packages/infrastructure/src/index.ts', 'utf8');
verify(infrastructureIndex.includes("export * from './sqlite-database-operations.js';"), 'SQLite infrastructure adapters are not exported');
const infrastructureManifest = await readJson('packages/infrastructure/package.json');
for (const dependency of ['@ppt/application', '@ppt/core', '@ppt/database']) {
  verify(infrastructureManifest.dependencies?.[dependency] === expectedPackageVersion, `infrastructure ${dependency}=${infrastructureManifest.dependencies?.[dependency]}`);
}
const infrastructureLock = lock.packages?.['packages/infrastructure'];
for (const dependency of ['@ppt/application', '@ppt/core', '@ppt/database']) {
  verify(infrastructureLock?.dependencies?.[dependency] === expectedPackageVersion, `lock infrastructure ${dependency}=${infrastructureLock?.dependencies?.[dependency]}`);
}

const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
for (const className of infrastructureClasses) {
  verify(dataStore.includes(className), `FamilyDataStore does not consume ${className}`);
}
verify(dataStore.includes("from '@ppt/infrastructure'"), 'FamilyDataStore does not import infrastructure adapters');
verify(dataStore.includes("import type { TransactionExecutor } from '@ppt/repositories';"), 'FamilyDataStore transaction port is not repository-facing');
verify(!/\.(?:prepare|exec)\(/.test(dataStore), 'FamilyDataStore performs direct database operations');
verify(!/\b(?:SELECT|INSERT INTO|UPDATE\s+[A-Za-z_]|DELETE FROM|CREATE TABLE|ALTER TABLE|PRAGMA|CREATE TRIGGER)\b/i.test(dataStore), 'FamilyDataStore owns raw SQL');

const compositionRoot = await readFile('apps/desktop/src/main/repository-composition-root.ts', 'utf8');
const concreteRepositoryReferences = compositionRoot.match(/new Sqlite[A-Za-z0-9]+Repository\(/g) ?? [];
verify(concreteRepositoryReferences.length >= 20, `composition root coverage=${concreteRepositoryReferences.length}`);
for (const file of mainFiles.filter((name) => name !== 'repository-composition-root.ts')) {
  const source = await readFile(join(adapterDirectory, file), 'utf8');
  verify(!/new Sqlite[A-Za-z0-9]+Repository\(/.test(source), `${file} constructs a repository outside the composition root`);
}

const runtime = await readFile('apps/desktop/src/main/family-database-runtime.ts', 'utf8');
verify(runtime.includes('new SqliteTransactionExecutor('), 'database runtime no longer owns concrete transaction construction');
verify(runtime.includes("import type { TransactionExecutor } from '@ppt/repositories';"), 'database runtime does not expose repository-facing transaction port');
verify(!/type TransactionExecutor[\s\S]*from '@ppt\/database'/.test(runtime), 'database runtime imports transaction port from database package');

const versionUpdater = await readFile('scripts/set-workspace-version.mjs', 'utf8');
verify(versionUpdater.includes("const repositoryMetadataPath = 'repository-metadata.json';"), 'version updater does not synchronize repository metadata');
verify(versionUpdater.includes('repositoryMetadata.repositoryVersion = displayVersion;'), 'repositoryVersion is not synchronized');
verify(versionUpdater.includes('repositoryMetadata.applicationVersion = displayVersion;'), 'applicationVersion is not synchronized');
verify(versionUpdater.includes('repositoryMetadata.versionSequence = Number(buildText);'), 'metadata sequence is not synchronized');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 103'"), 'active development stage mismatch');
const ledger = await readJson('artifacts/manifests/VERSION_LEDGER.json');
const latestLedger = ledger.entries?.at(-1);
verify(latestLedger?.version === expectedDisplayVersion, `ledger version=${latestLedger?.version}`);
verify(latestLedger?.packageVersion === expectedPackageVersion, `ledger package=${latestLedger?.packageVersion}`);
verify(latestLedger?.sequence === expectedBuild, `ledger sequence=${latestLedger?.sequence}`);
const repositoryMetadata = await readJson('repository-metadata.json');
verify(repositoryMetadata.repositoryVersion === expectedDisplayVersion, `metadata repositoryVersion=${repositoryMetadata.repositoryVersion}`);
verify(repositoryMetadata.applicationVersion === expectedDisplayVersion, `metadata applicationVersion=${repositoryMetadata.applicationVersion}`);
verify(repositoryMetadata.packageVersion === expectedPackageVersion, `metadata packageVersion=${repositoryMetadata.packageVersion}`);
verify(repositoryMetadata.revision === 'BUILD-103', `metadata revision=${repositoryMetadata.revision}`);
verify(repositoryMetadata.versionSequence === expectedBuild, `metadata sequence=${repositoryMetadata.versionSequence}`);

const rootManifest = await readJson('package.json');
verify(rootManifest.scripts?.['verify:build103:architecture'] === 'node scripts/verify-build103-architecture.mjs', 'Build 103 verifier is not registered');
verify(rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);

if (failures.length > 0) {
  console.error(`Build 103 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 103 architecture verification completed: ${checks} targeted assertions / ${adapterFiles.length} desktop application adapters / ${concreteRepositoryReferences.length} composed repositories.`);
