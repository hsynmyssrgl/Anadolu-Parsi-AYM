import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root=process.cwd();
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build137-backup-purge-propagation-contract.json'));
const read=(path)=>readFile(resolve(root,path),'utf8');
const [pkg,domain,migrations,repoContract,repository,useCases,orchestration,fileUseCases,fileAdapter,dataStore,main,preload,globalTypes,app,decision,adr,security,trace,openItems,status]=await Promise.all([
  read('package.json'),read('packages/domain/src/app-data.ts'),read('packages/database/src/family-database-migrations.ts'),
  read('packages/repository-contracts/src/backup-propagation-repository.ts'),read('packages/repositories/src/backup-propagation-repository.ts'),
  read('packages/application/src/backup-propagation-use-cases.ts'),read('packages/application/src/managed-backup-propagation-use-case.ts'),
  read('packages/application/src/backup-purge-propagation-file-use-cases.ts'),read('apps/desktop/src/main/backup-purge-propagation-file-application-adapter.ts'),
  read('apps/desktop/src/main/data-store.ts'),read('apps/desktop/src/main/main.ts'),read('apps/desktop/src/main/preload.ts'),
  read('apps/desktop/src/renderer/global.d.ts'),read('apps/desktop/src/renderer/App.tsx'),read('docs/10_MASTER_DECISION_REGISTER.md'),
  read('docs/adr/ADR-022-verified-managed-backup-purge-propagation.md'),read('docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md'),
  read('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md'),read('docs/06_OPEN_ITEMS_AFTER_CODING_START.md'),read('BUILD_STATUS.md')
]);
const assertions=[];const failures=[];
const verify=(condition,label)=>{assertions.push(label);if(!condition)failures.push(label);};
const rootPackage=JSON.parse(pkg);
const ledger=JSON.parse(await read('artifacts/manifests/VERSION_LEDGER.json'));
const current=ledger.entries?.at(-1);
verify(Boolean(current),'active version ledger entry is missing');
verify(rootPackage.version===current?.packageVersion,'root package version matches active ledger');
verify(status.includes(String(current?.sequence??'')),'active status mentions current build');
for(const marker of ['REVISION-137-BACKUP-PURGE-PROPAGATION','CREATE TABLE IF NOT EXISTS backup_propagation_runs','quarantined_artifacts','manual_backup_warning','target_results'])verify(migrations.includes(marker),`migration marker: ${marker}`);
for(const marker of ['updatedAt:string','markCompleted','insertRun','listRuns'])verify(repoContract.includes(marker),`repository contract marker: ${marker}`);
verify(repository.includes('AND updated_at=?'),'tombstone completion uses compare-and-set updated_at');
verify(repository.includes('row.updatedAt'),'repository passes expected updatedAt');
verify(repository.includes('quarantined_artifacts'),'repository stores quarantine count');
verify(repository.includes('target_results'),'repository stores per-target results');
for(const marker of ['CompleteBackupPropagationUseCase','RESOURCE_CONFLICT','completed.value!==records.length','yinelenen kayıt'])verify(useCases.includes(marker),`completion use-case marker: ${marker}`);
for(const marker of ['executeManagedBackupPropagation','createVerifiedBackup','quarantineManagedArtifacts','deleteManagedRun','listArtifacts','completePending'])verify(orchestration.includes(marker),`orchestration marker: ${marker}`);
verify(orchestration.indexOf('createVerifiedBackup')<orchestration.indexOf('quarantineManagedArtifacts'),'fresh verified backup precedes quarantine');
verify(orchestration.lastIndexOf('completePending')>orchestration.indexOf('quarantineManagedArtifacts'),'pending completion follows quarantine');
verify(orchestration.includes('artifactPaths'),'only registered managed paths are passed to quarantine');
verify(orchestration.includes('success: unmanaged === 0'),'active unmanaged backup blocks target success');
verify(orchestration.includes('manualBackupWarning'),'manual backup warning is part of run result');
for(const marker of ['artifactPaths','tombstones','batchId','quarantinedAt','SHA-256'])verify(fileUseCases.includes(marker),`quarantine use-case marker: ${marker}`);
for(const marker of ['.purge-quarantine','isWithin','excludeFilePath','renameSync','fsyncSync','0o600','0o700','manifest.json'])verify(fileAdapter.includes(marker),`file adapter safety marker: ${marker}`);
verify(fileAdapter.includes('input.artifactPaths'),'adapter moves explicit managed paths only');
verify(!fileAdapter.includes('readdirSync(targetPath'),'adapter does not sweep arbitrary target files');
verify(fileAdapter.includes('renameSync(artifact.quarantinedFilePath, artifact.originalFilePath)'),'adapter rolls back moved files on failure');
verify(dataStore.includes("taskType:'backup.propagation'"),'permanent purge enqueues backup propagation task');
verify(dataStore.includes("else if(type==='backup.propagation')"),'task queue executes backup propagation');
verify(dataStore.includes('executeManagedBackupPropagation'),'data store delegates to testable propagation use-case');
verify(dataStore.includes('runBackupTarget(targetId,{applyRetention:false})'),'ordinary retention is disabled during propagation');
verify(dataStore.includes('fingerprint:createHash'),'tombstone identifiers are hashed for manifest');
verify(dataStore.includes('quarantineManagedBackupArtifactsUseCase'),'quarantine adapter is wired');
for(const channel of ['dataLifecycle:listBackupPropagationRuns','dataLifecycle:propagatePurgedBackups'])verify(main.includes(channel),`IPC channel: ${channel}`);
for(const marker of ['listBackupPropagationRuns','propagatePurgedBackups'])verify(preload.includes(marker)&&globalTypes.includes(marker),`renderer bridge marker: ${marker}`);
for(const marker of ['Yönetilen yedeklerde imha yayılımı','geri alınabilir karantinaya taşır','manuel veya yönetilmeyen kopyalara dokunulmaz','quarantinedArtifacts'])verify(app.includes(marker),`renderer disclosure marker: ${marker}`);
for(const marker of ['BackupPropagationTargetResultView','freshBackupSha256','quarantineDirectory','quarantineManifestPath','quarantinedArtifacts','unmanagedArtifacts'])verify(domain.includes(marker),`domain view marker: ${marker}`);
for(const [text,label] of [[decision,'DEC-051'],[adr,'ADR-022'],[security,'Build 137 yönetilen yedek imha yayılımı'],[trace,'Build 137'],[openItems,'Build 137 ile kaynakta kapatılanlar']])verify(text.includes(label),`document marker: ${label}`);
for(const marker of ['önce güncel','başarılı `backup_runs`','updatedAt','Karantina fiziksel imha değildir'])verify(adr.includes(marker),`ADR safety marker: ${marker}`);
verify(security.includes('Karantina fiziksel imha değildir'),'physical deletion limitation documented');
verify(openItems.includes('Karantina dosyaları için'),'quarantine final-retention policy remains open');
verify(openItems.includes('OneDrive, iCloud ve Google Drive'),'cloud version-history propagation remains open');

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:137,applicationVersion:current?.version??null,packageVersion:current?.packageVersion??null,stage:'Bronze RC2 Active Development',scope:'Verified fresh backup before managed-only recoverable quarantine, unmanaged copy preservation/blocking, CAS tombstone completion, task queue and disclosure',assertions:assertions.length,status:failures.length===0?'PASS':'FAIL',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 137 backup purge propagation contract: ${report.status} (${assertions.length} assertions)`);
if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}
