import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/database-export-file-use-cases.ts');
const adapter = read('apps/desktop/src/main/database-export-file-application-adapter.ts');
const applicationIndex = read('packages/application/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const exportMethod = dataStore.slice(
  dataStore.indexOf('public exportBackup(destinationPath: string): void'),
  dataStore.indexOf('public getSystemHealth()', dataStore.indexOf('public exportBackup(destinationPath: string): void'))
);

const checks = [
  [
    'application database export file port exists',
    useCases.includes('export interface DatabaseExportFilePort')
      && useCases.includes('copyDatabase(')
      && useCases.includes('sourcePath: string')
      && useCases.includes('destinationPath: string')
  ],
  [
    'database export use case validates the destination',
    useCases.includes('export class ExportDatabaseFileUseCase')
      && useCases.includes("endsWith('.db')")
      && useCases.includes('Kaynak ve hedef veritabanı yolu aynı olamaz.')
  ],
  [
    'filesystem adapter implements the export port',
    adapter.includes('export class FileSystemDatabaseExportFilePort implements DatabaseExportFilePort')
      && adapter.includes("from '@ppt/application'")
  ],
  [
    'filesystem adapter owns the physical database copy',
    adapter.includes("import { copyFileSync } from 'node:fs';")
      && adapter.includes('copyFileSync(input.sourcePath, input.destinationPath)')
  ],
  [
    'application index exports the new boundary',
    applicationIndex.includes("export * from './database-export-file-use-cases.js';")
  ],
  [
    'datastore constructs and delegates to the export use case',
    dataStore.includes("import { FileSystemDatabaseExportFilePort } from './database-export-file-application-adapter.js';")
      && dataStore.includes('readonly #exportDatabaseFileUseCase: ExportDatabaseFileUseCase;')
      && dataStore.includes('new ExportDatabaseFileUseCase(new FileSystemDatabaseExportFilePort())')
      && exportMethod.includes('this.#exportDatabaseFileUseCase.execute(')
  ],
  [
    'checkpoint copy and audit sequence is preserved',
    exportMethod.indexOf("this.#prepareDatabaseForBackup('database-export-checkpoint')") >= 0
      && exportMethod.indexOf('this.#exportDatabaseFileUseCase.execute(') > exportMethod.indexOf("this.#prepareDatabaseForBackup('database-export-checkpoint')")
      && exportMethod.indexOf("this.#writeAudit('backup.exported'") > exportMethod.indexOf('this.#exportDatabaseFileUseCase.execute(')
  ],
  [
    'datastore no longer owns the physical copy operation',
    !dataStore.includes("import { copyFileSync } from 'node:fs';")
      && !exportMethod.includes('copyFileSync(')
  ],
  [
    'build96 version metadata is aligned',
    metadata.versionSequence === 96
      && metadata.revision === 'BUILD-96'
      && metadata.packageVersion === '24.7.2026-96'
      && appMeta.includes("version: '24.07.2026.96'")
      && appMeta.includes("packageVersion: '24.7.2026-96'")
      && appMeta.includes('Build 96')
  ],
  [
    'build96 remains active development',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD96.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD96.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD96.md').includes('Code Freeze: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD96.md').includes('Silver: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
