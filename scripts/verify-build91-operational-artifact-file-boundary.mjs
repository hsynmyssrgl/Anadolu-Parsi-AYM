import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/operational-artifact-file-use-cases.ts');
const adapter = read('apps/desktop/src/main/operational-artifact-file-application-adapter.ts');
const appIndex = read('packages/application/src/index.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const method = (name) => {
  const start = dataStore.indexOf(`  public ${name}(`);
  if (start < 0) return '';
  const next = dataStore.indexOf('\n  public ', start + 10);
  return dataStore.slice(start, next < 0 ? dataStore.length : next);
};

const reportExport = method('exportDiagnosticReport');
const diagnosticArchive = method('archiveDiagnostics');
const archiveRead = method('readDiagnosticArchive');
const maintenanceExport = method('exportMaintenanceHistory');
const exportVerification = method('verifyExportArtifact');

const checks = [
  [
    'operational artifact file application port exists',
    useCases.includes('export interface OperationalArtifactFilePort')
      && useCases.includes('writeText(')
      && useCases.includes('writeGzipText(')
      && useCases.includes('verify(')
      && useCases.includes('readGzipText(')
  ],
  [
    'operational artifact use cases exist and are exported',
    useCases.includes('export class WriteOperationalTextArtifactUseCase')
      && useCases.includes('export class WriteOperationalGzipArtifactUseCase')
      && useCases.includes('export class VerifyOperationalArtifactUseCase')
      && useCases.includes('export class ReadOperationalTextArtifactUseCase')
      && useCases.includes('export class ReadOperationalGzipArtifactUseCase')
      && appIndex.includes("export * from './operational-artifact-file-use-cases.js';")
  ],
  [
    'filesystem adapter owns text and gzip writes',
    adapter.includes('export class FileSystemOperationalArtifactFilePort')
      && adapter.includes("gzipSync(Buffer.from(input.content, 'utf8'))")
      && adapter.includes('writeFileSync(destinationPath, bytes)')
  ],
  [
    'filesystem adapter owns SHA-256 verification and gzip reads',
    adapter.includes("createHash('sha256').update(bytes).digest('hex')")
      && adapter.includes('actualSha256 === input.expectedSha256')
      && adapter.includes("gunzipSync(readFileSync(input.filePath)).toString('utf8')")
  ],
  [
    'datastore constructs operational artifact use cases',
    dataStore.includes('new FileSystemOperationalArtifactFilePort()')
      && dataStore.includes('new WriteOperationalTextArtifactUseCase(operationalArtifactFiles)')
      && dataStore.includes('new WriteOperationalGzipArtifactUseCase(operationalArtifactFiles)')
      && dataStore.includes('new VerifyOperationalArtifactUseCase(operationalArtifactFiles)')
  ],
  [
    'diagnostic report write keeps persistence audit and export ordering',
    reportExport.includes('#writeOperationalTextArtifactUseCase.execute')
      && reportExport.indexOf('#writeOperationalTextArtifactUseCase.execute') < reportExport.indexOf('#recordDiagnosticReportUseCase.execute')
      && reportExport.indexOf('#recordDiagnosticReportUseCase.execute') < reportExport.indexOf("#writeAudit('diagnostic.exported'")
      && reportExport.indexOf("#writeAudit('diagnostic.exported'") < reportExport.indexOf("recordExportArtifact('diagnostic_report'")
  ],
  [
    'diagnostic archive write and cleanup delegate in preserved order',
    diagnosticArchive.includes('#writeOperationalGzipArtifactUseCase.execute')
      && diagnosticArchive.indexOf('#writeOperationalGzipArtifactUseCase.execute') < diagnosticArchive.indexOf('#recordDiagnosticArchiveUseCase.execute')
      && diagnosticArchive.indexOf('#recordDiagnosticArchiveUseCase.execute') < diagnosticArchive.indexOf('#deleteDiagnosticsThroughUseCase.execute')
  ],
  [
    'verification and archive read delegate through application boundary',
    exportVerification.includes('#verifyOperationalArtifactUseCase.execute')
      && archiveRead.includes('#verifyOperationalArtifactUseCase.execute')
      && archiveRead.includes('#readOperationalGzipArtifactUseCase.execute')
      && maintenanceExport.includes('#writeOperationalTextArtifactUseCase.execute')
  ],
  [
    'direct datastore diagnostic artifact gzip and file hashing removed',
    !dataStore.includes("import { gzipSync, gunzipSync } from 'node:zlib'")
      && !diagnosticArchive.includes('gzipSync(')
      && !archiveRead.includes('gunzipSync(')
      && !reportExport.includes('writeFileSync(')
      && !maintenanceExport.includes("createHash('sha256')")
  ],
  [
    'build91 active development metadata exists',
    metadata.versionSequence === 91
      && metadata.revision === 'BUILD-91'
      && appMeta.includes("version: '24.07.2026.91'")
      && appMeta.includes('Build 91')
      && existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD91.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD91.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD91.md').includes('Code Freeze: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
