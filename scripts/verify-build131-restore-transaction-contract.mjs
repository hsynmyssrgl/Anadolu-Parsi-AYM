import { readFile, writeFile, mkdir } from 'node:fs/promises';

const files = {
  application: 'packages/application/src/full-backup-file-use-cases.ts',
  database: 'packages/database/src/backup-safety.ts',
  infrastructure: 'packages/infrastructure/src/sqlite-database-operations.ts',
  adapter: 'apps/desktop/src/main/full-backup-file-application-adapter.ts',
  store: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  meta: 'packages/domain/src/app-meta.ts',
  decision: 'docs/10_MASTER_DECISION_REGISTER.md',
  adr: 'docs/adr/ADR-016-durable-full-backup-restore-transaction.md'
};
const source = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key,path])=>[key,await readFile(path,'utf8')])));
const assertions = [
  ['application','readonly transactionId: string','restore transaction id'],
  ['application','discardRestore(','discard port'],
  ['application','DiscardFullBackupRestoreUseCase','discard use case'],
  ['application','readonly revokedTrustedDeviceCount: number','revoked device count contract'],
  ['database','prepareSqliteRestoredDatabaseForReauthorization','database reauthorization function'],
  ['database',"UPDATE trusted_devices SET revoked_at=? WHERE revoked_at IS NULL",'trust revocation'],
  ['database',"restore_reauthorization_required",'restore metadata flag'],
  ['database','BEGIN IMMEDIATE','atomic reauthorization transaction'],
  ['database','PRAGMA wal_checkpoint(TRUNCATE)','staged database checkpoint'],
  ['infrastructure','prepareRestoredFileForReauthorization','infrastructure delegation'],
  ['adapter',"type RestorePhase = 'prepared' | 'live-moved' | 'staged-installed' | 'committed'",'restore phases'],
  ['adapter',"RESTORE_JOURNAL_FILE = 'restore-transaction.json'",'durable journal file'],
  ['adapter','writeDurableJson','durable json writer'],
  ['adapter','fsyncSync(descriptor)','journal fsync'],
  ['adapter','recoverInterruptedFullBackupRestore','startup recovery'],
  ['adapter','rollbackRestoreJournal','rollback routine'],
  ['adapter','cleanupCommittedRestore','committed cleanup'],
  ['adapter','markerBelongsToTransaction','marker transaction binding'],
  ['adapter','restoreTransactionId: plan.transactionId','marker transaction id'],
  ['adapter','reauthorizationRequired: true','marker reauthorization'],
  ['adapter','trustedDevicesRevoked: true','marker trust revocation'],
  ['adapter','revokedTrustedDeviceCount: input.revokedTrustedDeviceCount','marker revocation count'],
  ['adapter',"phase: 'prepared'",'prepared journal'],
  ['adapter',"phase: 'live-moved'",'live moved journal'],
  ['adapter',"phase: 'staged-installed'",'staged installed journal'],
  ['adapter',"phase: 'committed'",'committed journal'],
  ['adapter',"[BKP-021]",'missing rollback copy fail closed'],
  ['adapter',"[BKP-023]",'parallel restore denial'],
  ['adapter',"[BKP-024]",'rollback failure signal'],
  ['adapter',".restore-stage-${transactionId}",'isolated staging path'],
  ['adapter',"mode: 0o600, flag: 'wx'",'exclusive staged file creation'],
  ['store','FullBackupRestoreRestartRequiredError','restart-required error'],
  ['store','recoverInterruptedFullBackupRestore({','constructor startup recovery'],
  ['store','backup.restore_interrupted_recovered','recovery log event'],
  ['store','PrepareRestoredDatabaseForReauthorizationUseCase','reauthorization use case'],
  ['store','restore-staged-database-post-reauthorization-integrity','post mutation integrity'],
  ['store','DiscardFullBackupRestoreUseCase','staging discard use case'],
  ['store','revokedTrustedDeviceCount:reauthorization.value.revokedTrustedDeviceCount','revocation count commit'],
  ['main','FullBackupRestoreRestartRequiredError','main restart recovery'],
  ['main','app.relaunch(); setImmediate(()=>app.exit(0));','mandatory restart'],
  ['renderer','tüm güvenilir cihaz kayıtları iptal edilir','renderer reauthorization warning'],
  ['meta',"stage: 'Bronze RC2 · Aktif Geliştirme · Build ",'active build stage'],
  ['decision','DEC-045','decision record'],
  ['adr','ADR-016','architecture decision']
];
const failures=[];
for(const [key,needle,label] of assertions){if(!source[key].includes(needle))failures.push(`${label}: ${needle}`);}
const applicationVersion=/version: '([^']+)'/u.exec(source.meta)?.[1]??null;
const packageVersion=/packageVersion: '([^']+)'/u.exec(source.meta)?.[1]??null;
const activeBuild=Number(/stage: 'Bronze RC2 · Aktif Geliştirme · Build (\d+)'/u.exec(source.meta)?.[1]??0);
if(activeBuild<131)failures.push(`active build ${activeBuild} is older than Build 131 continuity baseline`);
const evidence={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion,packageVersion,baselineBuild:131,activeBuild,assertions:assertions.length+1,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir('artifacts/validation',{recursive:true});
await writeFile('artifacts/validation/build131-restore-transaction-contract.json',JSON.stringify(evidence,null,2)+'\n');
if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log(`Build 131 restore transaction continuity contract verified: ${evidence.assertions}/${evidence.assertions} PASS.`);
