import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const out=resolve(process.argv[2]??'artifacts/validation/build187-clean-rewrite-recovery-chronology-contract.json');
const paths={
  service:'apps/desktop/src/main/automatic-clean-backup-rewrite-service.ts',
  dataStore:'apps/desktop/src/main/data-store.ts',
  application:'packages/application/src/backup-propagation-use-cases.ts',
  repositoryContract:'packages/repository-contracts/src/backup-propagation-repository.ts',
  repository:'packages/repositories/src/backup-propagation-repository.ts',
  migration:'packages/database/src/family-database-migrations.ts',
  decision:'docs/10_MASTER_DECISION_REGISTER.md',authority:'docs/11_DOCUMENT_AUTHORITY_MATRIX.md',
  spec:'docs/CLEAN_BACKUP_REWRITE_RECOVERY_CHRONOLOGY_V1.md',
  adr:'docs/adr/ADR-060-restart-safe-clean-backup-rewrite-recovery.md',
  policy:'config/product-lifecycle-policy.json',preflight:'config/source-preflight-checks.json',
  attestation:'config/delivery-attestation-contract.json',package:'package.json',
  scope:'docs/00_SCOPE_FREEZE.md',technical:'docs/01_TECHNICAL_STACK.md',security:'docs/02_SECURITY_BASELINE.md',
  test:'docs/03_TEST_AND_ACCEPTANCE.md',release:'docs/04_RELEASE_PLAN.md',done:'docs/05_DEFINITION_OF_DONE.md',
  open:'docs/06_OPEN_ITEMS_AFTER_CODING_START.md',trace:'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md',
  status:'docs/09_ACTIVE_DEVELOPMENT_STATUS.md',catalog:'docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md',
  ui:'docs/13_UI_UX_ACCESSIBILITY_STANDARD.md',backup:'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md',
  governance:'docs/15_RELEASE_VALIDATION_GOVERNANCE.md',lifecycle:'docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md',
  readme:'README.md',contributing:'CONTRIBUTING.md',securityRoot:'SECURITY.md',
  start:'START_HERE_TR.md',delivery:'DELIVERY_SUMMARY_TR.md',verification:'VERIFICATION_REPORT.md',
  releaseNotes:'RELEASE_NOTES_BRONZE_RC2_BUILD187.md',buildStatus:'BUILD_STATUS_BRONZE_RC2_BUILD187.md'
};
const files=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await readFile(path,'utf8')])));
const checks=[];const failures=[];const check=(label,condition)=>{checks.push(label);if(!condition)failures.push(label);};const has=(key,marker)=>files[key].includes(marker);
for(const marker of [
  'recoverInterruptedBackupCleanRewrite(observedAt:string,error:string)',
  "const observedAt=this.now()",
  'const clockAdjusted=safeObservedAt!==',
  "backup.clean_rewrite_recovered_clock_adjusted",
  'store.recoverInterruptedBackupCleanRewrite(safeObservedAt',
  'Kesinti kurtarma gözlem',
  'çalışma başlangıcı: ${policy.inProgressStartedAt}',
  'gözlenen saat: ${observedAt}'
])check(`service ${marker}`,has('service',marker));
check('legacy precomputed recovery backoff removed',!files.service.includes('recoverInterruptedBackupCleanRewrite(at,addMinutes(at'));
for(const [key,marker] of [
  ['dataStore','recoverInterruptedBackupCleanRewrite(observedAt:string,error:string)'],
  ['application','readonly observedAt:string;readonly error:string'],
  ['repositoryContract','readonly observedAt:string;readonly error:string']
])check(`${key} observedAt contract`,has(key,marker));
for(const marker of [
  'const observedAtMs=Date.parse(input.observedAt)',
  'automatic_failure_backoff_minutes',
  'const existingRun=runId?',
  'const persistedStartedAt=',
  'recoveryFloorMs=Math.max(recoveryFloorMs,parsed)',
  "const backoffMinutes=Number(trigger==='manual'?current.manual_failure_backoff_minutes:current.automatic_failure_backoff_minutes)",
  'const nextAttemptAt=new Date(recoveryFloorMs+backoffMinutes*60_000).toISOString()',
  "status='interrupted'",
  "state='backoff'",
  "next_attempt_at=NULL,in_progress_run_id=?"
])check(`repository ${marker}`,has('repository',marker));
for(const marker of [
  'cleanBackupRewriteRecoveryChronologySql',
  'trg_backup_clean_rewrite_policy_state_insert',
  'trg_backup_clean_rewrite_policy_state_update',
  'trg_backup_clean_rewrite_runs_retry_insert',
  'trg_backup_clean_rewrite_runs_retry_update',
  'running clean rewrite policy requires owner and start',
  'non-running clean rewrite policy cannot retain owner',
  'running or idle clean rewrite policy cannot retain next attempt',
  'non-idle clean rewrite policy requires next attempt',
  'clean rewrite policy next attempt precedes update',
  'non-success clean rewrite run requires next attempt',
  'clean rewrite run next attempt precedes completion',
  'REVISION-187-CLEAN-BACKUP-RECOVERY-CHRONOLOGY',
  "createMigrationDefinition(32, 'clean_backup_rewrite_recovery_chronology'"
])check(`migration ${marker}`,has('migration',marker));
check('DEC-077 propagated',has('decision','DEC-077'));
check('ADR-060 authority',has('authority','ADR-060'));
check('recovery chronology spec exists',has('spec','Kesinti Kurtarma Kronolojisi V1'));
check('ADR recovery chronology decision',has('adr','Yeniden Başlatmaya Dayanıklı Temiz Yedek Kurtarma Kronolojisi'));
for(const marker of ['DEC-077','cleanRewriteInterruptedRecoveryChronology','interruptedRecoveryBackoffFromSafeCompletion','runningClaimClearsPriorNextAttempt','sqliteRecoveryRetryTriggersRequired'])check(`machine policy ${marker}`,has('policy',marker));
for(const marker of ['build187-clean-rewrite-recovery-chronology-contract','build187-clean-rewrite-recovery-chronology-runtime','build187-clean-rewrite-recovery-chronology-sqlite-runtime','build187-clean-rewrite-recovery-chronology-syntax'])check(`preflight ${marker}`,has('preflight',marker));
for(const marker of ['build187-clean-rewrite-recovery-chronology-contract','build187-clean-rewrite-recovery-chronology-runtime','build187-clean-rewrite-recovery-chronology-sqlite-runtime','build187-clean-rewrite-recovery-chronology-syntax'])check(`attestation ${marker}`,has('attestation',marker));
for(const marker of ['verify:build187:clean-rewrite-recovery-chronology-contract','verify:build187:clean-rewrite-recovery-chronology-runtime','verify:build187:clean-rewrite-recovery-chronology-sqlite-runtime','verify:build187:clean-rewrite-recovery-chronology-syntax','create:build187:validation-boundary'])check(`package ${marker}`,has('package',marker));
for(const [key,marker] of [
  ['scope','Build 187 aktif kapsamı'],['technical','Build 187 teknik sınırı'],['security','Build 187 güvenlik sınırı'],
  ['test','Build 187 kabul sınırı'],['release','Build 187 sürüm planı'],['done','Build 187 tamamlanma ölçütü'],
  ['open','Build 187 sonrası açık test işleri'],['trace','Build 187 izlenebilirliği'],['status','Build 187 bağlayıcı güncellemesi'],
  ['catalog','Build 187 ürün kataloğu güncellemesi'],['ui','Build 187 UI/UX kararı'],['backup','Build 187 yedek güvenliği'],
  ['governance','Build 187 doğrulama yönetişimi'],['lifecycle','Build 187 bağlayıcı güncellemesi'],
  ['readme','Build 187 kesinti kurtarma kararı'],['contributing','Build 187 bağlayıcı katkı kuralı'],
  ['securityRoot','Build 187 kesinti kurtarma güvenliği'],['releaseNotes','DEC-077'],['buildStatus','Build 187 Durumu']
])check(`document ${key}`,has(key,marker));
for(const key of ['readme','start','delivery','verification']){
  check(`${key} Build 187 continuity`,has(key,'Build 187'));
}
const expectedChecks=81;if(checks.length!==expectedChecks)throw new Error(`Build 187 contract check count drifted: ${checks.length}/${expectedChecks}`);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:187,stage:'Bronze RC2 Active Development',scope:'Restart-safe clean-backup rewrite recovery and retry chronology',status:failures.length?'FAIL':'PASS',assertions:checks.length,checks,failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 187 clean rewrite recovery chronology contract: ${report.status} (${checks.length-failures.length}/${checks.length})`);if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}
