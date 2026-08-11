import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(n,f)=>{const i=args.indexOf(n);return i<0?f:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build173-ipc-adaptive-budget-maintenance-lock-recovery-contract.json'));
const [recovery,authority,guard,state,main,preload,globalTypes,renderer,domain,adr,security,build172Contract]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-lock-recovery.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-authority.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-state.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/main/preload.ts','utf8'),
  readFile('apps/desktop/src/renderer/global.d.ts','utf8'),
  readFile('apps/desktop/src/renderer/App.tsx','utf8'),
  readFile('packages/domain/src/app-data.ts','utf8'),
  readFile('docs/adr/ADR-046-authorized-maintenance-lock-recovery.md','utf8'),
  readFile('SECURITY.md','utf8'),
  readFile('scripts/verify-build172-ipc-adaptive-budget-maintenance-reauthentication-state-lifecycle-contract.mjs','utf8')
]);
const failures=[];let assertions=0;const verify=(condition,message)=>{assertions+=1;if(!condition)failures.push(message);};
for(const [needle,label] of [
  ["IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION",'fixed recovery confirmation constant'],
  ["'BAKIM KİLİDİNİ SIFIRLA'",'Turkish explicit confirmation phrase'],
  ["RECOVERY_NOT_REQUIRED",'recovery not required reason'],
  ["RECOVERY_RATE_LIMITED",'separate recovery rate limit reason'],
  ["deriveIpcAdaptiveBudgetMaintenanceRecoveryContextKey",'separate recovery context derivation'],
  ["ipc-adaptive-budget-maintenance-recovery\\u0000",'domain separated recovery context material'],
  ["HASH_PATTERN.test(authFingerprint)",'strict primary fingerprint validation'],
  ["parseIpcAdaptiveBudgetMaintenanceRecoveryInput",'strict recovery input parser'],
  ["exactKeys(candidate, allowed)",'unexpected input fields rejected'],
  ["candidate.password.length > 4_096",'password input bounded'],
  ["candidate.code.length > 64",'second factor input bounded'],
  ["candidate.confirmation !== IPC_ADAPTIVE_BUDGET_MAINTENANCE_RECOVERY_CONFIRMATION",'confirmation checked exactly'],
  ["primaryAuthority.reason !== 'REAUTHENTICATION_LOCKED'",'recovery only when primary lock exists'],
  ["evaluateIpcAdaptiveBudgetMaintenanceAuthority(auth, now, recoveryThrottle)",'base authority reused with separate throttle'],
  ["recoveryThrottle.locked",'recovery throttle exposed'],
  ["remainingRecoveryAttempts",'remaining recovery attempts exposed'],
  ["maximumRecoveryAttempts",'maximum recovery attempts exposed'],
  ["explicitConfirmationRequired: true",'explicit confirmation contract'],
  ["trustedDeviceRequired: true",'trusted device retained'],
  ["strongReauthenticationRequired: true",'strong reauthentication retained']
]) verify(recovery.includes(needle),label);
for(const [needle,label] of [
  ["adaptiveMaintenanceRecoverySnapshot",'main recovery snapshot'],
  ["deriveIpcAdaptiveBudgetMaintenanceRecoveryContextKey(primary.fingerprint)",'main separate recovery key'],
  ["ipcAdaptiveBudgetMaintenanceReauthenticationGuard.status(recoveryFingerprint)",'recovery uses persistent guard'],
  ["evaluateIpcAdaptiveBudgetMaintenanceRecoveryAuthority",'main recovery authority evaluation'],
  ["system:getIpcAdaptiveBudgetMaintenanceRecoveryAuthority",'recovery authority IPC'],
  ["system:recoverIpcAdaptiveBudgetMaintenanceLock",'recovery mutation IPC'],
  ["parseIpcAdaptiveBudgetMaintenanceRecoveryInput(input)",'main strict input parsing'],
  ["adaptiveMaintenanceRecoveryContext()",'main fail-closed recovery authority'],
  ["dialog.showMessageBox",'native irreversible confirmation'],
  ["Kimliği doğrula ve kilidi temizle",'native confirmation action'],
  ["store().verifyStrongAuthentication",'strong authentication verified'],
  ["recordFailure(recoveryContext.recoveryFingerprint)",'separate recovery failures counted'],
  ["recordSuccess(recoveryContext.recoveryFingerprint)",'separate recovery success recorded'],
  ["ipcAdaptiveBudgetMaintenanceSessions.clearAll()",'outstanding maintenance sessions revoked'],
  ["ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearAll()",'persistent lock state cleared'],
  ["maintenance_lock_recovery_reauthentication_failed",'privacy-safe recovery failure audit'],
  ["maintenance_lock_recovered",'recovery success audit'],
  ["previousReason",'previous lock reason audited'],
  ["clearedContextCount",'cleared count audited'],
  ["explicitConfirmation: true",'confirmation fact audited without phrase']
]) verify(main.includes(needle),label);
for(const [needle,label] of [
  ["getIpcAdaptiveBudgetMaintenanceRecoveryAuthority",'preload recovery authority bridge'],
  ["recoverIpcAdaptiveBudgetMaintenanceLock",'preload recovery mutation bridge'],
  ["IpcAdaptiveBudgetMaintenanceRecoveryInput",'preload typed recovery input'],
  ["IpcAdaptiveBudgetMaintenanceRecoveryView",'preload typed recovery result']
]) verify(preload.includes(needle),label);
for(const [needle,label] of [
  ["getIpcAdaptiveBudgetMaintenanceRecoveryAuthority",'renderer global authority method'],
  ["recoverIpcAdaptiveBudgetMaintenanceLock",'renderer global recovery method'],
  ["IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView",'renderer global recovery type']
]) verify(globalTypes.includes(needle),label);
for(const [needle,label] of [
  ["ipcMaintenanceRecoveryAuthority",'renderer recovery authority state'],
  ["ipcMaintenanceRecoveryConfirmation",'renderer explicit confirmation state'],
  ["ipcMaintenanceRecoveryReady",'renderer recovery readiness'],
  ["recoverIpcAdaptiveBudgetMaintenanceLock",'renderer recovery action'],
  ["Bakım kilidini kurtar",'renderer recovery button'],
  ["Kurtarma onayı",'renderer confirmation input'],
  ["recoveryRetryAfterSeconds",'renderer recovery lock countdown'],
  ["remainingRecoveryAttempts",'renderer recovery attempts display'],
  ["2FA / kurtarma kodu",'renderer recovery code disclosure'],
  ["ipcMaintenanceCredentialsAvailable",'credentials enabled for normal or recovery path']
]) verify(renderer.includes(needle),label);
for(const [needle,label] of [
  ["IpcAdaptiveBudgetMaintenanceRecoveryAuthorityReason",'domain recovery authority reason'],
  ["IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView",'domain recovery authority view'],
  ["IpcAdaptiveBudgetMaintenanceRecoveryInput",'domain recovery input'],
  ["IpcAdaptiveBudgetMaintenanceRecoveryView",'domain recovery result'],
  ["confirmation:'BAKIM KİLİDİNİ SIFIRLA'",'domain literal confirmation']
]) verify(domain.includes(needle),label);
for(const [needle,label] of [
  ['ayrı deneme sayacı','ADR separate counter'],
  ['güçlü yeniden doğrulama','ADR strong reauthentication'],
  ['açık onay','ADR explicit confirmation'],
  ['yalnız kilit etkinse','ADR lock-only recovery'],
  ['geri alınamaz','ADR irreversible disclosure'],
  ['parola','ADR password boundary'],
  ['kurtarma kodu','ADR recovery code boundary']
]) verify(adr.toLowerCase().includes(needle.toLowerCase()),label);
for(const [needle,label] of [
  ['Build 173','security build marker'],
  ['ayrı kalıcı deneme sayacı','security separate persistent counter'],
  ['açık onay ifadesi','security explicit confirmation'],
  ['yalnız mevcut kilit','security lock-only scope']
]) verify(security.toLowerCase().includes(needle.toLowerCase()),label);
verify(authority.includes("auth.role !== 'family_admin'"),'family admin authority remains');
verify(authority.includes('auth.trustedDevice !== true'),'trusted device authority remains');
verify(guard.includes('clearAll(now = Date.now())'),'persistent clear-all capability retained');
verify(state.includes('secureEraseFile(this.#statePath'),'state clear uses bounded secure erase');
verify(build172Contract.includes('featureBuild:172'),'Build 172 contract preserved');
verify(!main.includes('metadata: { password'),'password not logged in main metadata');
verify(!main.includes('metadata: { code'),'second factor not logged in main metadata');
verify(!recovery.toLowerCase().includes('console.log'),'recovery module has no console secret exposure');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:173,stage:'Bronze RC2 Active Development',scope:'Authorized adaptive IPC maintenance lock recovery with independent persistent throttling, strong reauthentication, explicit confirmation, session revocation and privacy-safe auditing',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 173 maintenance lock recovery contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 173 maintenance lock recovery contract: PASS (${assertions}/${assertions}).`);
