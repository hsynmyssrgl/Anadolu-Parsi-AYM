import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const application = read('packages/application/src/database-maintenance-use-cases.ts');
const adapter = read('apps/desktop/src/main/database-maintenance-application-adapter.ts');
const database = read('packages/database/src/maintenance.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));
const methodStart = dataStore.indexOf('public runMaintenance(');
const methodEnd = dataStore.indexOf('\n\n  #installAuditGuards', methodStart);
const maintenanceMethod = dataStore.slice(methodStart, methodEnd);

const checks = [
  ['application use case exists', application.includes('RunDatabaseMaintenanceUseCase')],
  ['command port exists', application.includes('DatabaseMaintenanceCommandPort')],
  ['desktop adapter exists', adapter.includes('SqliteDatabaseMaintenanceCommandPort')],
  ['database executor exists', database.includes('executeSqliteMaintenance')],
  ['database package owns integrity check', database.includes("PRAGMA integrity_check")],
  ['database package owns maintenance commands', database.includes("PRAGMA wal_checkpoint(TRUNCATE)") && database.includes("database.exec('ANALYZE')") && database.includes("database.exec('VACUUM')")],
  ['datastore delegates to use case', maintenanceMethod.includes('#runDatabaseMaintenanceUseCase.execute')],
  ['datastore maintenance method has no direct SQL', !maintenanceMethod.includes('PRAGMA ') && !maintenanceMethod.includes("database.exec('ANALYZE')") && !maintenanceMethod.includes("database.exec('VACUUM')")],
  ['version is build86', metadata.versionSequence === 86 && metadata.revision === 'BUILD-86' && appMeta.includes("version: '24.07.2026.86'") && appMeta.includes('Build 86')],
  ['release notes exist', existsSync(new URL('RELEASE_NOTES_BRONZE_RC2_BUILD86.md', root))]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
