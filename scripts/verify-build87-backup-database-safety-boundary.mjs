import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const application = read('packages/application/src/backup-database-safety-use-cases.ts');
const applicationIndex = read('packages/application/src/index.ts');
const adapter = read('apps/desktop/src/main/backup-database-safety-application-adapter.ts');
const database = read('packages/database/src/backup-safety.ts');
const databaseIndex = read('packages/database/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const checks = [
  [
    'backup safety use cases exist',
    application.includes('PrepareBackupDatabaseUseCase')
      && application.includes('VerifyBackupDatabaseIntegrityUseCase')
  ],
  [
    'backup safety port exists',
    application.includes('BackupDatabaseSafetyPort')
      && applicationIndex.includes("./backup-database-safety-use-cases.js")
  ],
  [
    'desktop adapter exists',
    adapter.includes('SqliteBackupDatabaseSafetyPort')
      && adapter.includes('implements BackupDatabaseSafetyPort')
  ],
  [
    'database package owns backup checkpoint',
    database.includes('checkpointSqliteForBackup')
      && database.includes('PRAGMA wal_checkpoint(FULL)')
  ],
  [
    'database package owns file integrity verification',
    database.includes('verifySqliteBackupFileIntegrity')
      && database.includes('PRAGMA integrity_check')
      && databaseIndex.includes("./backup-safety.js")
  ],
  [
    'datastore constructs safety use cases',
    dataStore.includes('new PrepareBackupDatabaseUseCase')
      && dataStore.includes('new VerifyBackupDatabaseIntegrityUseCase')
  ],
  [
    'all backup checkpoints delegate',
    (dataStore.match(/#prepareDatabaseForBackup\(/g) ?? []).length === 4
      && dataStore.includes("'backup-checkpoint'")
      && dataStore.includes("'restore-checkpoint'")
      && dataStore.includes("'database-export-checkpoint'")
  ],
  [
    'staged restore verification delegates',
    dataStore.includes("#verifyBackupDatabaseFile(stagedDb, 'restore-staged-database-integrity')")
  ],
  [
    'datastore has no direct backup pragma or runtime sqlite probe',
    !dataStore.includes('PRAGMA wal_checkpoint(FULL)')
      && !dataStore.includes('PRAGMA integrity_check')
      && !dataStore.includes('new DatabaseSync')
  ],
  [
    'version and release notes are build87',
    metadata.versionSequence === 87
      && metadata.revision === 'BUILD-87'
      && appMeta.includes("version: '24.07.2026.87'")
      && appMeta.includes('Build 87')
      && existsSync(new URL('RELEASE_NOTES_BRONZE_RC2_BUILD87.md', root))
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
