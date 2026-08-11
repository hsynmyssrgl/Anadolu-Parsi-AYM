import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const useCases = read('packages/application/src/backup-target-file-use-cases.ts');
const adapter = read('apps/desktop/src/main/backup-target-file-application-adapter.ts');
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

const listTargets = method('  public listBackupTargets(');
const retention = method('  #applyBackupRetention(');
const runTarget = method('  public runBackupTarget(');

const checks = [
  [
    'backup target file application port exists',
    useCases.includes('export interface BackupTargetFilePort')
      && useCases.includes('inspectFreeBytes(')
      && useCases.includes('prepareWritableTarget(')
      && useCases.includes('inspectArtifact(')
      && useCases.includes('listArtifacts(')
  ],
  [
    'backup target file use cases exist and are exported',
    useCases.includes('export class GetBackupTargetFreeBytesUseCase')
      && useCases.includes('export class PrepareBackupTargetUseCase')
      && useCases.includes('export class CreateBackupArtifactPathUseCase')
      && useCases.includes('export class InspectBackupArtifactUseCase')
      && useCases.includes('export class DeleteBackupArtifactUseCase')
      && useCases.includes('export class ListBackupArtifactsUseCase')
      && appIndex.includes("export * from './backup-target-file-use-cases.js';")
  ],
  [
    'filesystem adapter owns writability probe and free space inspection',
    adapter.includes('export class FileSystemBackupTargetFilePort')
      && adapter.includes("writeFileSync(probePath, 'ok')")
      && adapter.includes('statfsSync(targetPath)')
      && adapter.includes('rmSync(probePath, { force: true })')
  ],
  [
    'filesystem adapter owns backup artifact path and readback hash verification',
    adapter.includes('Anadolu_Parsi_${timestamp}_${input.attempt}.pptbackup')
      && adapter.includes("createHash('sha256').update(bytes).digest('hex')")
      && adapter.includes('readbackSha256 !== sha256')
  ],
  [
    'datastore constructs backup target file use cases',
    dataStore.includes('new FileSystemBackupTargetFilePort()')
      && dataStore.includes('new PrepareBackupTargetUseCase(backupTargetFiles)')
      && dataStore.includes('new InspectBackupArtifactUseCase(backupTargetFiles)')
      && dataStore.includes('new ListBackupArtifactsUseCase(backupTargetFiles)')
  ],
  [
    'backup target listing delegates free space inspection',
    listTargets.includes('#getBackupTargetFreeBytesUseCase.execute')
      && !listTargets.includes('statfsSync(')
  ],
  [
    'backup execution delegates prepare path and artifact inspection in preserved order',
    runTarget.includes('#prepareBackupTargetUseCase.execute')
      && runTarget.includes('#createBackupArtifactPathUseCase.execute')
      && runTarget.includes('#inspectBackupArtifactUseCase.execute')
      && runTarget.indexOf('#prepareBackupTargetUseCase.execute') < runTarget.indexOf('this.exportFullBackup(filePath)')
      && runTarget.indexOf('this.exportFullBackup(filePath)') < runTarget.indexOf('#inspectBackupArtifactUseCase.execute')
      && runTarget.indexOf('#inspectBackupArtifactUseCase.execute') < runTarget.indexOf('#recordBackupRunUseCase.execute')
  ],
  [
    'backup retention delegates artifact listing and deletion',
    retention.includes('#listBackupArtifactsUseCase.execute')
      && retention.includes('#deleteBackupArtifactUseCase.execute')
      && !retention.includes('readdirSync(')
      && !retention.includes('rmSync(')
      && !retention.includes('existsSync(')
  ],
  [
    'direct datastore backup target filesystem operations removed',
    !dataStore.includes('statfsSync')
      && !runTarget.includes('.ppt-write-test')
      && !runTarget.includes("createHash('sha256')")
      && !runTarget.includes('readFileSync(filePath)')
  ],
  [
    'build92 active development metadata exists',
    metadata.versionSequence === 92
      && metadata.revision === 'BUILD-92'
      && appMeta.includes("version: '24.07.2026.92'")
      && appMeta.includes('Build 92')
      && existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD92.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD92.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD92.md').includes('Code Freeze: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
