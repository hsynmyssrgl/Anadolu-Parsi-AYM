import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/full-backup-file-use-cases.ts');
const adapter = read('apps/desktop/src/main/full-backup-file-application-adapter.ts');
const appIndex = read('packages/application/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const method = (signature) => {
  const start = dataStore.indexOf(signature);
  if (start < 0) return '';
  const nextPublic = dataStore.indexOf('\n  public ', start + signature.length);
  const nextPrivate = dataStore.indexOf('\n  #', start + signature.length);
  const candidates = [nextPublic, nextPrivate].filter((value) => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : dataStore.length;
  return dataStore.slice(start, end);
};

const exportBackup = method('  public exportFullBackup(');
const inspectBackup = method('  public inspectFullBackup(');
const restoreBackup = method('  public restoreFullBackup(');

const checks = [
  [
    'full backup application port exists',
    useCases.includes('export interface FullBackupFilePort')
      && useCases.includes('prepareDestination(')
      && useCases.includes('create(')
      && useCases.includes('inspect(')
      && useCases.includes('stageRestore(')
      && useCases.includes('commitRestore(')
  ],
  [
    'full backup use cases exist and are exported',
    useCases.includes('export class PrepareFullBackupDestinationUseCase')
      && useCases.includes('export class CreateFullBackupUseCase')
      && useCases.includes('export class InspectFullBackupUseCase')
      && useCases.includes('export class StageFullBackupRestoreUseCase')
      && useCases.includes('export class CommitFullBackupRestoreUseCase')
      && appIndex.includes("export * from './full-backup-file-use-cases.js';")
  ],
  [
    'filesystem adapter owns v2 backup container creation',
    adapter.includes('export class FileSystemFullBackupFilePort')
      && adapter.includes('version: 2')
      && adapter.includes("database: databaseBytes.toString('base64')")
      && adapter.includes("vaultKey: keyBytes.toString('base64')")
      && adapter.includes("algorithm: 'sha256'")
      && adapter.includes('writeFileSync(input.destinationPath, JSON.stringify(payload))')
  ],
  [
    'filesystem adapter owns backup inspection and encrypted archive verification',
    adapter.includes("'[BKP-002] Yedek dosyası geçerli JSON biçiminde değil.'")
      && adapter.includes("'[BKP-007] Yedek veritabanı hash doğrulamasını geçemedi.'")
      && adapter.includes('[BKP-011] Arşiv girdisi doğrulanamadı:')
      && adapter.includes('decryptBytes(')
      && adapter.includes("riskLevel: legacy ? 'attention' : 'low'")
  ],
  [
    'filesystem adapter owns restore staging atomic swap and rollback',
    adapter.includes("const stagingDirectory = join(baseDir, `.restore-${randomUUID()}`)")
      && adapter.includes('renameSync(plan.stagedDatabasePath, plan.databasePath)')
      && adapter.includes("'restore-required-login.json'")
      && adapter.includes('if (existsSync(oldDatabasePath)) renameSync(oldDatabasePath, plan.databasePath)')
      && adapter.includes('rmSync(plan.stagingDirectory, { recursive: true, force: true })')
  ],
  [
    'datastore constructs full backup file use cases',
    dataStore.includes('new FileSystemFullBackupFilePort()')
      && dataStore.includes('new PrepareFullBackupDestinationUseCase(fullBackupFiles)')
      && dataStore.includes('new CreateFullBackupUseCase(fullBackupFiles)')
      && dataStore.includes('new InspectFullBackupUseCase(fullBackupFiles)')
      && dataStore.includes('new StageFullBackupRestoreUseCase(fullBackupFiles)')
      && dataStore.includes('new CommitFullBackupRestoreUseCase(fullBackupFiles)')
  ],
  [
    'full backup export delegates after extension and checkpoint checks',
    exportBackup.includes("endsWith('.pptbackup')")
      && exportBackup.includes("#prepareDatabaseForBackup('backup-checkpoint')")
      && exportBackup.includes('#createFullBackupUseCase.execute')
      && exportBackup.includes("#writeAudit('backup.full_exported'")
      && exportBackup.indexOf("endsWith('.pptbackup')") < exportBackup.indexOf("#prepareDatabaseForBackup('backup-checkpoint')")
      && exportBackup.indexOf("#prepareDatabaseForBackup('backup-checkpoint')") < exportBackup.indexOf('#createFullBackupUseCase.execute')
      && exportBackup.indexOf('#createFullBackupUseCase.execute') < exportBackup.indexOf("#writeAudit('backup.full_exported'")
  ],
  [
    'backup inspection delegates without direct file or crypto operations',
    inspectBackup.includes('#inspectFullBackupUseCase.execute')
      && !inspectBackup.includes('readFileSync(')
      && !inspectBackup.includes('createHash(')
      && !inspectBackup.includes('decryptBytes(')
      && !inspectBackup.includes('JSON.parse(')
  ],
  [
    'restore orchestration delegates in preserved safety order',
    restoreBackup.includes('#inspectFullBackupUseCase.execute')
      && restoreBackup.includes('#prepareFullBackupDestinationUseCase.execute')
      && restoreBackup.includes('this.exportFullBackup(safetyBackupPath)')
      && restoreBackup.includes('#stageFullBackupRestoreUseCase.execute')
      && restoreBackup.includes('#verifyBackupDatabaseFile(staged.value.stagedDatabasePath')
      && restoreBackup.includes("#prepareDatabaseForBackup('restore-checkpoint')")
      && restoreBackup.includes('#databaseRuntime.close()')
      && restoreBackup.includes('#commitFullBackupRestoreUseCase.execute')
      && restoreBackup.includes('#sessionManager.clear()')
      && restoreBackup.indexOf('#inspectFullBackupUseCase.execute') < restoreBackup.indexOf('#prepareFullBackupDestinationUseCase.execute')
      && restoreBackup.indexOf('#prepareFullBackupDestinationUseCase.execute') < restoreBackup.indexOf('this.exportFullBackup(safetyBackupPath)')
      && restoreBackup.indexOf('this.exportFullBackup(safetyBackupPath)') < restoreBackup.indexOf('#stageFullBackupRestoreUseCase.execute')
      && restoreBackup.indexOf('#stageFullBackupRestoreUseCase.execute') < restoreBackup.indexOf('#verifyBackupDatabaseFile(staged.value.stagedDatabasePath')
      && restoreBackup.indexOf('#verifyBackupDatabaseFile(staged.value.stagedDatabasePath') < restoreBackup.indexOf("#prepareDatabaseForBackup('restore-checkpoint')")
      && restoreBackup.indexOf("#prepareDatabaseForBackup('restore-checkpoint')") < restoreBackup.indexOf('#databaseRuntime.close()')
      && restoreBackup.indexOf('#databaseRuntime.close()') < restoreBackup.indexOf('#commitFullBackupRestoreUseCase.execute')
      && restoreBackup.indexOf('#commitFullBackupRestoreUseCase.execute') < restoreBackup.indexOf('#sessionManager.clear()')
      && !restoreBackup.includes('renameSync(')
      && !restoreBackup.includes('rmSync(')
      && !restoreBackup.includes('writeFileSync(')
  ],
  [
    'build93 active development metadata exists',
    metadata.versionSequence === 93
      && metadata.revision === 'BUILD-93'
      && appMeta.includes("version: '24.07.2026.93'")
      && appMeta.includes('Build 93')
      && existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD93.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD93.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD93.md').includes('Code Freeze: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
