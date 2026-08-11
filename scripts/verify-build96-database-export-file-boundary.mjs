import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/database-export-file-use-cases.ts');
const adapter = read('apps/desktop/src/main/database-export-file-application-adapter.ts');
const applicationIndex = read('packages/application/src/index.ts');
const main = read('apps/desktop/src/main/main.ts');

const exportMethodStart = dataStore.indexOf('public exportBackup(destinationPath: string): void');
const exportMethod = dataStore.slice(
  exportMethodStart,
  dataStore.indexOf('public getSystemHealth()', exportMethodStart)
);
const ipcExportMethodStart = main.indexOf("registerIpcHandler('backup:export',");
const ipcExportMethod = main.slice(ipcExportMethodStart, main.indexOf('\n}', ipcExportMethodStart));

const checks = [
  [
    'historical raw database export boundary remains available for source archaeology',
    useCases.includes('export interface DatabaseExportFilePort')
      && useCases.includes('copyDatabase(')
      && useCases.includes('sourcePath: string')
      && useCases.includes('destinationPath: string')
      && useCases.includes('export class ExportDatabaseFileUseCase')
  ],
  [
    'historical raw copy adapter is explicitly dormant and fail-closed',
    adapter.includes('Historical raw-copy adapter retained for source archaeology only.')
      && adapter.includes('implements DormantDatabaseExportFilePort')
      && adapter.includes('Korumasız SQLite kopyalama adaptörü kalıcı olarak devre dışıdır.')
      && adapter.includes('ERROR_CODES.AUTHORIZATION_DENIED')
      && adapter.includes("replacement: 'protected-full-backup'")
      && !adapter.includes('copyFileSync')
      && !adapter.includes("from 'node:fs'")
  ],
  [
    'application root no longer exports the raw database boundary',
    !applicationIndex.includes("export * from './database-export-file-use-cases.js';")
  ],
  [
    'production datastore does not compose the raw database exporter',
    !dataStore.includes('ExportDatabaseFileUseCase')
      && !dataStore.includes('FileSystemDatabaseExportFilePort')
      && !dataStore.includes('#exportDatabaseFileUseCase')
  ],
  [
    'legacy exportBackup fails closed for .db and delegates only to protected full backup',
    exportMethodStart >= 0
      && exportMethod.indexOf('this.#requireAuth()') >= 0
      && exportMethod.indexOf("endsWith('.pptbackup')") > exportMethod.indexOf('this.#requireAuth()')
      && exportMethod.includes('Korumasız .db dışa aktarımı yasaktır')
      && exportMethod.indexOf('this.exportFullBackup(destinationPath)') > exportMethod.indexOf("endsWith('.pptbackup')")
      && !exportMethod.includes('withDatabaseSnapshot')
      && !exportMethod.includes('copyDatabase')
  ],
  [
    'production IPC offers only the protected .pptbackup destination',
    ipcExportMethodStart >= 0
      && ipcExportMethod.includes('Cihaz korumalı tam yedeği kaydet')
      && ipcExportMethod.includes('.pptbackup`')
      && ipcExportMethod.includes("extensions: ['pptbackup']")
      && ipcExportMethod.includes('store().exportBackup(result.filePath)')
      && !ipcExportMethod.includes("extensions: ['db']")
  ],
  [
    'datastore never owns a physical raw-copy primitive',
    !dataStore.includes("import { copyFileSync } from 'node:fs';")
      && !exportMethod.includes('copyFileSync(')
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
