import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const runtime = read('apps/desktop/src/main/family-database-runtime.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const checks = [
  [
    'family database runtime exists',
    runtime.includes('export class SqliteFamilyDatabaseRuntime')
      && runtime.includes('SqliteFamilyDatabaseRuntimeOptions')
  ],
  [
    'runtime owns database open and startup pragmas',
    runtime.includes('openSqliteDatabase(options.databasePath)')
      && runtime.includes('applySqliteStartupPragmas(this.database')
      && runtime.includes("journalMode: 'WAL'")
  ],
  [
    'runtime owns migration lifecycle',
    runtime.includes('runFamilyDatabaseMigrations')
      && runtime.includes('options.onMigrationCompleted?.(migrationSummary)')
  ],
  [
    'runtime owns transaction executor construction',
    runtime.includes('new SqliteTransactionExecutor(this.database, options.clock)')
  ],
  [
    'runtime owns database close',
    runtime.includes('public close(): void')
      && runtime.includes('this.database.close()')
  ],
  [
    'datastore constructs runtime and consumes dependencies',
    dataStore.includes('new SqliteFamilyDatabaseRuntime')
      && dataStore.includes('this.#database = this.#databaseRuntime.database')
      && dataStore.includes('this.#transactionExecutor = this.#databaseRuntime.transactionExecutor')
  ],
  [
    'datastore delegates normal and restore close',
    dataStore.match(/this\.#databaseRuntime\.close\(\)/g)?.length === 2
      && !dataStore.includes('this.#database.close()')
  ],
  [
    'direct datastore startup lifecycle removed',
    !dataStore.includes('openSqliteDatabase')
      && !dataStore.includes('applySqliteStartupPragmas')
      && !dataStore.includes('runFamilyDatabaseMigrations')
      && !dataStore.includes('new SqliteTransactionExecutor')
  ],
  [
    'version and release notes are build89',
    metadata.versionSequence === 89
      && metadata.revision === 'BUILD-89'
      && appMeta.includes("version: '24.07.2026.89'")
      && appMeta.includes('Build 89')
      && existsSync(new URL('RELEASE_NOTES_BRONZE_RC2_BUILD89.md', root))
  ],
  [
    'active development status preserved',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD89.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD89.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD89.md').includes('Code Freeze: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
