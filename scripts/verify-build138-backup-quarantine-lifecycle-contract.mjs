import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root=process.cwd();
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build138-backup-quarantine-lifecycle-contract.json'));
const read=(path)=>readFile(join(root,path),'utf8');
const [pkg,meta,domain,migrations,repoContract,repository,useCases,appAdapter,fileAdapter,composition,dataStore,main,preload,globalTypes,app,styles,decision,security,trace,openItems,status]=await Promise.all([
  read('package.json'),read('packages/domain/src/app-meta.ts'),read('packages/domain/src/app-data.ts'),read('packages/database/src/family-database-migrations.ts'),
  read('packages/repository-contracts/src/backup-quarantine-repository.ts'),read('packages/repositories/src/backup-quarantine-repository.ts'),
  read('packages/application/src/backup-quarantine-use-cases.ts'),read('apps/desktop/src/main/backup-quarantine-application-adapter.ts'),
  read('apps/desktop/src/main/backup-quarantine-file-application-adapter.ts'),read('apps/desktop/src/main/repository-composition-root.ts'),
  read('apps/desktop/src/main/data-store.ts'),read('apps/desktop/src/main/main.ts'),read('apps/desktop/src/main/preload.ts'),
  read('apps/desktop/src/renderer/global.d.ts'),read('apps/desktop/src/renderer/App.tsx'),read('apps/desktop/src/renderer/styles.css'),
  read('docs/10_MASTER_DECISION_REGISTER.md'),read('docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md'),read('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md'),
  read('docs/06_OPEN_ITEMS_AFTER_CODING_START.md'),read('BUILD_STATUS.md')
]);
const ledger=JSON.parse(await read('artifacts/manifests/VERSION_LEDGER.json'));
const current=ledger.entries?.at(-1);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(Boolean(current),'active version ledger entry is missing');
verify(/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(current?.version??''),'active ledger version is invalid');
verify(JSON.parse(pkg).version===current?.packageVersion,'root package version does not match active ledger');
verify(meta.includes(`version: '${current?.version}'`),'application version does not match active ledger');
verify(status.includes(`Build ${current?.version?.split('.').at(-1)}`),'active status does not mention current build');
for(const marker of ['BackupQuarantineBatchStatus','BackupQuarantinePolicyView','BackupQuarantineBatchView','UpdateBackupQuarantinePolicyInput','SetBackupQuarantineLegalHoldInput','DestroyBackupQuarantineBatchInput','BackupQuarantineDestructionResultView'])verify(domain.includes(marker),`domain marker missing: ${marker}`);
for(const marker of ['backup_quarantine_lifecycle','CREATE TABLE IF NOT EXISTS backup_quarantine_policy','CREATE TABLE IF NOT EXISTS backup_quarantine_batches','retention_days','retain_until','legal_hold','destroyed_bytes','REVISION-138-BACKUP-QUARANTINE-LIFECYCLE'])verify(migrations.includes(marker),`migration marker missing: ${marker}`);
for(const marker of ['getPolicy','updatePolicy','insertBatch','listBatches','findBatch','setLegalHold','beginDestruction','completeDestruction','expectedUpdatedAt'])verify(repoContract.includes(marker),`repository contract marker missing: ${marker}`);
for(const marker of ["status='retained'","status='destroying'","status='destroyed'","AND updated_at=?","legal_hold=0","destroyed_artifacts","destroyed_bytes"])verify(repository.includes(marker),`repository transition marker missing: ${marker}`);
for(const marker of ['backupQuarantineDestructionConfirmation','KARANTİNA İMHA','retentionDays<1','retentionDays>3650','family_admin','strongAuth.verify','Karantina saklama süresi','legalHold','beginDestruction','completeDestruction','status===\'destroying\''])verify(useCases.includes(marker),`use-case governance marker missing: ${marker}`);
verify(useCases.indexOf('backupQuarantineDestructionConfirmation')<useCases.indexOf('strongAuth.verify'),'exact confirmation is evaluated before strong authentication');
verify(useCases.indexOf('beginDestruction')<useCases.indexOf('files.destroy'),'database enters destroying before filesystem erasure');
verify(useCases.lastIndexOf('files.destroy')<useCases.lastIndexOf('completeDestruction'),'filesystem erasure precedes destroyed audit completion');
for(const marker of ['RepositoryBackedBackupQuarantineAdapter','transactionExecutor','repository.getPolicy','repository.beginDestruction','repository.completeDestruction'])verify(appAdapter.includes(marker),`application adapter marker missing: ${marker}`);
for(const marker of ['.purge-quarantine','.destroying-','.purge-destruction-receipts','destruction-state.json','manifest.json','sha256File','overwriteAndDelete','fsyncSync','0o600','0o700','receiptPath','resumed'])verify(fileAdapter.includes(marker),`filesystem safety marker missing: ${marker}`);
verify(fileAdapter.includes("basename(quarantineRoot)!=='.purge-quarantine'"),'quarantine root boundary is not enforced');
verify(fileAdapter.includes('statSync(filePath).size!==artifact.sizeBytes||sha256File(filePath)!==artifact.sha256'),'artifact hash and size are not verified before destruction');
verify(fileAdapter.includes('if(existsSync(receiptPath))'),'destruction receipt does not support idempotent resume');
verify(fileAdapter.includes('renameSync(originalDirectory,destroyingDirectory)'),'destruction does not claim directory atomically');
verify(fileAdapter.includes('writeDurableJson(statePath,state)'),'durable destruction state is missing');
verify(composition.includes('SqliteBackupQuarantineRepository'),'backup quarantine repository is not composed');
for(const marker of ['#reconcileBackupQuarantineBatches','GetBackupQuarantinePolicyUseCase','ListBackupQuarantineBatchesUseCase','RegisterBackupQuarantineBatchUseCase','UpdateBackupQuarantinePolicyUseCase','SetBackupQuarantineLegalHoldUseCase','DestroyBackupQuarantineBatchUseCase','FileSystemBackupQuarantineDestructionPort','backupQuarantineRepository'])verify(dataStore.includes(marker),`data-store integration missing: ${marker}`);
verify(dataStore.includes("createHash('sha256').update")&&dataStore.includes('run.id')&&dataStore.includes('target.targetId')&&dataStore.includes('slice(0,32)'), 'deterministic quarantine record identity is missing');
for(const channel of ['dataLifecycle:getBackupQuarantinePolicy','dataLifecycle:listBackupQuarantineBatches','dataLifecycle:updateBackupQuarantinePolicy','dataLifecycle:setBackupQuarantineLegalHold','dataLifecycle:destroyBackupQuarantineBatch'])verify(main.includes(channel),`IPC channel missing: ${channel}`);
for(const marker of ['getBackupQuarantinePolicy','listBackupQuarantineBatches','updateBackupQuarantinePolicy','setBackupQuarantineLegalHold','destroyBackupQuarantineBatch'])verify(preload.includes(marker)&&globalTypes.includes(marker),`renderer bridge marker missing: ${marker}`);
for(const marker of ['Yedek karantina saklama süresi','Karantina politikasını güncelle','Bekletmeye al','Nihai imha','KARANTİNA İMHA'])verify(app.includes(marker),`renderer disclosure marker missing: ${marker}`);
verify(styles.includes('quarantine-list')||styles.includes('lifecycle-list'),'quarantine lifecycle styling is missing');
for(const [text,label] of [[decision,'DEC-052'],[security,'Build 138'],[trace,'Build 138'],[openItems,'Build 138']])verify(text.includes(label),`document marker missing: ${label}`);
verify(openItems.includes('SSD')||security.includes('SSD'),'physical SSD destruction limitation is not documented');
verify(security.includes('90 gün')||security.includes('90 günlük')||openItems.includes('90 gün'),'operational 90-day default is not disclosed');
verify(openItems.includes('hukuk')||security.includes('hukuk'),'legal retention review remains explicit');

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:138,applicationVersion:current?.version??null,packageVersion:current?.packageVersion??null,stage:'Bronze RC2 Active Development',scope:'Timed backup-quarantine retention, strong-auth policy changes, legal hold, CAS state transitions, verified crash-resumable filesystem destruction, receipts and renderer governance',assertions,status:failures.length===0?'PASS':'FAIL',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 138 backup quarantine lifecycle contract: ${report.status} (${assertions} assertions)`);
if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}
