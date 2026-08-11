import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const expectedDisplayVersion = '25.07.2026.102';
const expectedPackageVersion = '25.7.2026-102';
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

const databasePort = await readFile('packages/database/src/migration-runner.ts', 'utf8');
verify(/export interface DatabaseConnection extends DatabaseExecutor/.test(databasePort), 'DatabaseConnection port is missing');
verify(/close\(\): void;/.test(databasePort), 'DatabaseConnection does not expose close()');

const sqliteFactory = await readFile('packages/database/src/sqlite.ts', 'utf8');
verify(sqliteFactory.includes("import { DatabaseSync } from 'node:sqlite';"), 'SQLite factory no longer owns the native node:sqlite import');
verify(/\): DatabaseConnection => new DatabaseSync/.test(sqliteFactory), 'SQLite factory does not return DatabaseConnection');

const migrationOwner = await readFile('packages/database/src/family-database-migrations.ts', 'utf8');
verify(!migrationOwner.includes('DatabaseSync'), 'Migration owner leaks DatabaseSync');
verify(migrationOwner.includes('readonly database: DatabaseConnection;'), 'Migration owner does not depend on DatabaseConnection');
verify(/CREATE TABLE/i.test(migrationOwner), 'Database package no longer owns migration SQL');

const repositoryBase = await readFile('packages/repositories/src/sqlite-base.ts', 'utf8');
verify(repositoryBase.includes('export type RepositoryExecutionContext = RepositoryContext<DatabaseExecutor>;'), 'Generic repository execution context is missing');
verify(repositoryBase.includes('export type SqliteRepositoryContext = RepositoryExecutionContext;'), 'Repository compatibility alias is missing');

const mainFiles = (await readdir('apps/desktop/src/main')).filter((name) => name.endsWith('.ts'));
const adapterFiles = mainFiles.filter((name) => name.endsWith('-application-adapter.ts'));
for (const file of mainFiles) {
  const source = await readFile(join('apps/desktop/src/main', file), 'utf8');
  verify(!source.includes("from 'node:sqlite'"), `${file} imports node:sqlite`);
  verify(!/\bDatabaseSync\b/.test(source), `${file} exposes DatabaseSync`);
}
for (const file of adapterFiles) {
  const source = await readFile(join('apps/desktop/src/main', file), 'utf8');
  verify(!/\bSqliteTransactionExecutor\b/.test(source), `${file} depends on SqliteTransactionExecutor`);
  verify(!/\bSqliteRepositoryContext\b/.test(source), `${file} depends on SqliteRepositoryContext`);
  verify(!/Sqlite[A-Za-z0-9]+Repository/.test(source), `${file} depends on a concrete repository class`);
  if (source.includes('transactionExecutor')) {
    verify(source.includes('TransactionExecutor'), `${file} does not use the TransactionExecutor port`);
  }
  if (source.includes("from '@ppt/repositories'")) {
    verify(/import\s+type\s*\{[^;]*\}\s*from '@ppt\/repositories';/s.test(source), `${file} has a runtime repository import`);
    verify(source.includes('RepositoryExecutionContext'), `${file} does not use RepositoryExecutionContext`);
  }
}

const dataStore = await readFile('apps/desktop/src/main/data-store.ts', 'utf8');
verify(dataStore.includes('readonly #database: DatabaseConnection;'), 'FamilyDataStore database field is not a port');
verify(dataStore.includes('readonly #transactionExecutor: TransactionExecutor;'), 'FamilyDataStore transaction executor is not a port');
verify(!dataStore.includes('SqliteTransactionExecutor'), 'FamilyDataStore depends on concrete SqliteTransactionExecutor');
verify(dataStore.includes('createSqliteRepositoryCompositionRoot'), 'FamilyDataStore does not consume repository composition root');

const runtime = await readFile('apps/desktop/src/main/family-database-runtime.ts', 'utf8');
verify(runtime.includes('public readonly database: DatabaseConnection;'), 'Database runtime does not expose DatabaseConnection');
verify(runtime.includes('public readonly transactionExecutor: TransactionExecutor;'), 'Database runtime does not expose TransactionExecutor');
verify(runtime.includes('new SqliteTransactionExecutor('), 'Database runtime no longer owns concrete transaction construction');

const compositionRoot = await readFile('apps/desktop/src/main/repository-composition-root.ts', 'utf8');
verify(compositionRoot.includes('createSqliteRepositoryCompositionRoot'), 'Repository composition root factory is missing');
const concreteRepositoryReferences = compositionRoot.match(/new Sqlite[A-Za-z0-9]+Repository\(/g) ?? [];
verify(concreteRepositoryReferences.length >= 20, `Composition root coverage is unexpectedly low: ${concreteRepositoryReferences.length}`);

for (const file of mainFiles.filter((name) => name !== 'repository-composition-root.ts')) {
  const source = await readFile(join('apps/desktop/src/main', file), 'utf8');
  verify(!/new Sqlite[A-Za-z0-9]+Repository\(/.test(source), `${file} constructs a concrete repository outside composition root`);
}

const desktopMigrationShim = await readFile('apps/desktop/src/main/database-migrations.ts', 'utf8');
verify(!/\b(?:CREATE|ALTER|INSERT|UPDATE|DELETE|PRAGMA)\b/i.test(desktopMigrationShim), 'Desktop migration shim contains raw SQL');

const rootManifest = await readJson('package.json');
verify(rootManifest.scripts?.['verify:build102:architecture'] === 'node scripts/verify-build102-architecture.mjs', 'Build 102 verifier is not registered');
verify(rootManifest.scripts?.typecheck === 'tsc --noEmit', `typecheck=${rootManifest.scripts?.typecheck}`);
verify(rootManifest.scripts?.['validate:rc2:gates'] === 'node scripts/run-rc2-validation-gates.mjs', 'Ordered RC2 gate runner is not registered');

const gateConfig = await readJson('config/rc2-validation-gates.json');
verify(gateConfig.schemaVersion === 2, `validation gate schema=${gateConfig.schemaVersion}`);
verify(gateConfig.gates.every((gate) => Number.isSafeInteger(gate.timeoutMs) && gate.timeoutMs > 0), 'one or more validation gates have no positive timeout');
verify(gateConfig.gates[0].args.includes('--fetch-retries=0'), 'npm ci gate does not disable opaque fetch retries');
verify(gateConfig.gates[0].args.includes('--fetch-timeout=20000'), 'npm ci gate has no bounded fetch timeout');
const gateRunner = await readFile('scripts/run-rc2-validation-gates.mjs', 'utf8');
verify(gateRunner.includes('PPT_RC2_GATE_TIMEOUT_OVERRIDE_MS'), 'gate runner has no controlled timeout override');
verify(gateRunner.includes("reason: 'TIMEOUT'"), 'gate runner does not record timeout failures');
verify(gateRunner.includes('terminateProcessTree'), 'gate runner does not terminate timed-out process trees');
verify(gateRunner.includes('await persistReport();'), 'gate runner does not persist validation evidence incrementally');
verify(gateRunner.includes("process.once('SIGTERM'"), 'gate runner does not handle termination signals');
const versionUpdater = await readFile('scripts/set-workspace-version.mjs', 'utf8');
verify(versionUpdater.includes("artifacts/manifests/VERSION_LEDGER.json"), 'safe version updater does not synchronize VERSION_LEDGER');
verify(versionUpdater.includes('ledger.entries.push(ledgerEntry)'), 'safe version updater cannot append the next ledger entry');
verify(versionUpdater.includes('expectedSequence'), 'safe version updater does not enforce sequence continuity');

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${expectedDisplayVersion}'`), 'display version mismatch');
verify(appMeta.includes(`packageVersion: '${expectedPackageVersion}'`), 'package version mismatch');
verify(appMeta.includes("stage: 'Bronze RC2 · Aktif Geliştirme · Build 102'"), 'active development stage mismatch');

if (failures.length > 0) {
  console.error(`Build 102 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 102 architecture verification completed: ${checks} targeted assertions / ${adapterFiles.length} application adapters / ${concreteRepositoryReferences.length} composed repositories.`);
