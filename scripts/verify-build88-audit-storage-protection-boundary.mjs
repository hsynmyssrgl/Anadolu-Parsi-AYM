import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const application = read('packages/application/src/audit-storage-protection-use-cases.ts');
const applicationIndex = read('packages/application/src/index.ts');
const adapter = read('apps/desktop/src/main/audit-storage-protection-application-adapter.ts');
const database = read('packages/database/src/audit-storage-protection.ts');
const databaseIndex = read('packages/database/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const checks = [
  [
    'audit storage protection use case exists',
    application.includes('InstallAuditStorageProtectionUseCase')
  ],
  [
    'audit storage protection port exists',
    application.includes('AuditStorageProtectionCommandPort')
      && applicationIndex.includes("./audit-storage-protection-use-cases.js")
  ],
  [
    'desktop adapter exists',
    adapter.includes('SqliteAuditStorageProtectionCommandPort')
      && adapter.includes('implements AuditStorageProtectionCommandPort')
  ],
  [
    'database package owns append-only trigger SQL',
    database.includes('installSqliteAuditAppendOnlyGuards')
      && database.includes('audit_log_append_only_update')
      && database.includes('audit_log_append_only_delete')
      && database.includes('AUDIT-APPEND-ONLY')
      && databaseIndex.includes("./audit-storage-protection.js")
  ],
  [
    'datastore constructs protection use case',
    dataStore.includes('new InstallAuditStorageProtectionUseCase')
      && dataStore.includes('new SqliteAuditStorageProtectionCommandPort(this.#database)')
  ],
  [
    'datastore executes protection after audit backfill',
    dataStore.indexOf('auditBackfillResult') < dataStore.indexOf('auditProtectionResult')
      && dataStore.indexOf('auditProtectionResult') < dataStore.indexOf('ensureAdminCorrelationId')
  ],
  [
    'datastore checks protection result',
    dataStore.includes('if (!auditProtectionResult.ok)')
      && dataStore.includes('audit-storage-protection-')
  ],
  [
    'datastore direct trigger installer removed',
    !dataStore.includes('#installAuditGuards')
      && !dataStore.includes('CREATE TRIGGER IF NOT EXISTS audit_log_append_only_update')
      && !dataStore.includes("RAISE(ABORT,'AUDIT-APPEND-ONLY')")
  ],
  [
    'version and release notes are build88',
    metadata.versionSequence === 88
      && metadata.revision === 'BUILD-88'
      && appMeta.includes("version: '24.07.2026.88'")
      && appMeta.includes('Build 88')
      && existsSync(new URL('RELEASE_NOTES_BRONZE_RC2_BUILD88.md', root))
  ],
  [
    'active development status preserved',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD88.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD88.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD88.md').includes('Code Freeze: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
