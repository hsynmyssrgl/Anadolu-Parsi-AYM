import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
const root=process.cwd();const args=process.argv.slice(2);const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build139-external-backup-inventory-contract.json'));
const read=(path)=>readFile(join(root,path),'utf8');
const [pkg,meta,domain,migrations,repoContract,repository,useCases,appAdapter,composition,dataStore,main,preload,globalTypes,app,decision,security,trace,openItems,status]=await Promise.all([
  read('package.json'),read('packages/domain/src/app-meta.ts'),read('packages/domain/src/app-data.ts'),read('packages/database/src/family-database-migrations.ts'),
  read('packages/repository-contracts/src/external-backup-inventory-repository.ts'),read('packages/repositories/src/external-backup-inventory-repository.ts'),
  read('packages/application/src/external-backup-inventory-use-cases.ts'),read('apps/desktop/src/main/external-backup-inventory-application-adapter.ts'),
  read('apps/desktop/src/main/repository-composition-root.ts'),read('apps/desktop/src/main/data-store.ts'),read('apps/desktop/src/main/main.ts'),
  read('apps/desktop/src/main/preload.ts'),read('apps/desktop/src/renderer/global.d.ts'),read('apps/desktop/src/renderer/App.tsx'),
  read('docs/10_MASTER_DECISION_REGISTER.md'),read('docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md'),read('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md'),
  read('docs/06_OPEN_ITEMS_AFTER_CODING_START.md'),read('BUILD_STATUS.md')
]);
const ledger=JSON.parse(await read('artifacts/manifests/VERSION_LEDGER.json'));const current=ledger.entries?.at(-1);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(Boolean(current),'active version ledger entry is missing');
verify(Number(current?.sequence)>=139,'active ledger predates Build 139');
verify(JSON.parse(pkg).version===current?.packageVersion,'root package version does not match active ledger');
verify(meta.includes(`version: '${current?.version}'`),'application version does not match active ledger');
verify(status.includes(`Build ${current?.sequence}`)||status.includes(String(current?.sequence)),'active status does not mention current build');
for(const marker of ['ExternalBackupCopyKind','ExternalBackupCopyStatus','ExternalBackupCopyView','ExternalBackupInventorySummaryView','RegisterExternalBackupCopyInput','ReviewExternalBackupCopyInput','SetExternalBackupCopyLegalHoldInput','AttestExternalBackupCopyDestroyedInput'])verify(domain.includes(marker),`domain marker missing: ${marker}`);
for(const marker of ['external_backup_inventory','CREATE TABLE IF NOT EXISTS external_backup_copies','CREATE TABLE IF NOT EXISTS external_backup_copy_attestations','contains_historical_data_risk','next_review_at','legal_hold','destroyed_attested','REVISION-139-EXTERNAL-BACKUP-INVENTORY'])verify(migrations.includes(marker),`migration marker missing: ${marker}`);
for(const marker of ['listCopies','findCopy','insertCopy','reviewCopy','setLegalHold','attestDestroyed','expectedUpdatedAt','ExternalBackupCopyAttestationRow'])verify(repoContract.includes(marker),`repository contract marker missing: ${marker}`);
for(const marker of ['AND status!=\'destroyed\' AND updated_at=?','legal_hold=0','destroyed_attested','external_backup_copy_attestations','contains_historical_data_risk=0','evidence_sha256'])verify(repository.includes(marker),`repository safety marker missing: ${marker}`);
for(const marker of ['externalBackupReviewConfirmation','HARİCİ YEDEK TEYİT','externalBackupDestructionConfirmation','HARİCİ YEDEK İMHA','family_admin','strongAuth.verify','historicalDataRisk','reviewRequired','legalHold','validSha256'])verify(useCases.includes(marker),`use-case governance marker missing: ${marker}`);
verify(useCases.indexOf('externalBackupReviewConfirmation')<useCases.indexOf('strongAuth.verify'),'review exact confirmation is not evaluated before strong auth');
verify(useCases.indexOf('externalBackupDestructionConfirmation')<useCases.lastIndexOf('strongAuth.verify'),'destruction exact confirmation is not evaluated before strong auth');
verify(useCases.includes("status==='destroyed'"),'destroyed copies are not protected from later review');
verify(useCases.includes('Bu kayıt fiziksel imhanın otomatik teknik kanıtı değildir')||dataStore.includes('otomatik fiziksel imha kanıtı değildir'),'physical-destruction evidence limitation is not explicit');
for(const marker of ['RepositoryBackedExternalBackupInventoryAdapter','transactionExecutor','repository.listCopies','repository.attestDestroyed'])verify(appAdapter.includes(marker),`application adapter marker missing: ${marker}`);
verify(composition.includes('SqliteExternalBackupInventoryRepository'),'external backup inventory repository is not composed');
for(const marker of ['#listExternalBackupCopiesUseCase','#getExternalBackupInventorySummaryUseCase','#registerExternalBackupCopyUseCase','#reviewExternalBackupCopyUseCase','#setExternalBackupCopyLegalHoldUseCase','#attestExternalBackupCopyDestroyedUseCase','externalBackupInventoryRepository'])verify(dataStore.includes(marker),`data-store integration missing: ${marker}`);
for(const channel of ['dataLifecycle:listExternalBackupCopies','dataLifecycle:getExternalBackupInventorySummary','dataLifecycle:registerExternalBackupCopy','dataLifecycle:reviewExternalBackupCopy','dataLifecycle:setExternalBackupCopyLegalHold','dataLifecycle:attestExternalBackupCopyDestroyed'])verify(main.includes(channel),`IPC channel missing: ${channel}`);
for(const marker of ['listExternalBackupCopies','getExternalBackupInventorySummary','registerExternalBackupCopy','reviewExternalBackupCopy','setExternalBackupCopyLegalHold','attestExternalBackupCopyDestroyed'])verify(preload.includes(marker)&&globalTypes.includes(marker),`renderer bridge marker missing: ${marker}`);
for(const marker of ['Uygulama dışı yedek envanteri','Çevrimdışı disk','Bulut sürüm geçmişi','Teyit et','İmha teyidi','HARİCİ YEDEK TEYİT','HARİCİ YEDEK İMHA'])verify(app.includes(marker),`renderer disclosure marker missing: ${marker}`);
for(const [text,label] of [[decision,'DEC-053'],[security,'Build 139'],[trace,'Build 139'],[openItems,'Build 139']])verify(text.includes(label),`document marker missing: ${label}`);
verify(security.includes('kullanıcı beyanı')||openItems.includes('kullanıcı beyanı'),'user-attestation limitation is not documented');
verify(openItems.includes('çevrimdışı')||security.includes('çevrimdışı'),'offline-copy limitation is not documented');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:139,applicationVersion:current?.version??null,packageVersion:current?.packageVersion??null,stage:'Bronze RC2 Active Development',scope:'Unmanaged and offline backup inventory, periodic review, legal hold, strong-auth user attestation, optional evidence hash, CAS transitions, audit history and renderer governance',assertions,status:failures.length===0?'PASS':'FAIL',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 139 external backup inventory contract: ${report.status} (${assertions} assertions)`);if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}
