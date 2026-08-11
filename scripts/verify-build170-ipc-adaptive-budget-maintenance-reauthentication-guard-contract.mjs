import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build170-ipc-adaptive-budget-maintenance-reauthentication-guard-contract.json'));
const [guard,authority,main,renderer,globalTypes,domain,pkg,ledger,adr]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-authority.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/renderer/App.tsx','utf8'),
  readFile('apps/desktop/src/renderer/global.d.ts','utf8'),
  readFile('packages/domain/src/app-data.ts','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8'),
  readFile('docs/adr/ADR-043-bounded-maintenance-reauthentication-attempts.md','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(guard.includes('DEFAULT_MAXIMUM_FAILED_ATTEMPTS = 5'),'five-attempt default');
verify(guard.includes('DEFAULT_LOCK_DURATION_MS = 5 * 60_000'),'five-minute lock default');
verify(guard.includes('DEFAULT_FAILURE_WINDOW_MS = 10 * 60_000'),'ten-minute failure window');
verify(guard.includes('DEFAULT_MAXIMUM_TRACKED_CONTEXTS = 256'),'bounded tracked contexts');
verify(guard.includes('CONTEXT_KEY_PATTERN'),'bounded opaque context key');
verify(guard.includes('readonly locked: boolean'),'lock status view');
verify(guard.includes('readonly failedAttempts: number'),'failed attempt view');
verify(guard.includes('readonly remainingAttempts: number'),'remaining attempt view');
verify(guard.includes('readonly retryAfterSeconds?: number'),'retry-after view');
verify(guard.includes('readonly lockedUntil?: string'),'lock expiry view');
verify(guard.includes('recordFailure(contextKey'),'failure recording API');
verify(guard.includes('recordSuccess(contextKey'),'success clears failures');
verify(guard.includes('clearMemory()')||guard.includes('clearAll('),'shutdown cleanup API');
verify(guard.includes('trackedContextCount'),'bounded registry observability');
verify(guard.includes('Math.min(this.#maximumFailedAttempts'),'attempt count capped');
verify(guard.includes('now + this.#lockDurationMs'),'temporary lock calculation');
verify(guard.includes('now - state.lastFailureAt >= this.#failureWindowMs'),'stale failure reset');
verify(guard.includes('while (this.#attempts.size > this.#maximumTrackedContexts)'),'capacity enforcement');
verify(guard.includes('Object.freeze'),'immutable throttle views');
verify(!guard.includes('password'),'guard excludes password material');
verify(!guard.includes('totp'),'guard excludes TOTP material');
verify(!guard.includes('code:'),'guard excludes credential code fields');
verify(authority.includes("'REAUTHENTICATION_LOCKED'"),'authority lock reason');
verify(authority.includes('reauthenticationLocked: boolean'),'authority lock state');
verify(authority.includes('remainingReauthenticationAttempts: number'),'authority remaining attempts');
verify(authority.includes('maximumReauthenticationAttempts: number'),'authority maximum attempts');
verify(authority.includes('reauthenticationRetryAfterSeconds?: number'),'authority retry-after');
verify(authority.includes('reauthenticationLockedUntil?: string'),'authority lock expiry');
verify(authority.includes('if (throttle.locked)'),'authority fail-closed lock check');
verify(main.includes('IpcAdaptiveBudgetMaintenanceReauthenticationGuard'),'main guard integration');
verify(main.includes('maximumFailedAttempts: 5'),'main five-attempt policy');
verify(main.includes('lockDurationMs: 5 * 60_000'),'main five-minute lock policy');
verify(main.includes('failureWindowMs: 10 * 60_000'),'main failure window policy');
verify(main.includes('maximumTrackedContexts: 256'),'main bounded context policy');
verify(main.includes('ipcAdaptiveBudgetMaintenanceReauthenticationGuard.status(fingerprint)'),'authority reads throttle status');
verify(main.includes('evaluateIpcAdaptiveBudgetMaintenanceAuthority(auth, Date.now(), throttle)'),'authority receives throttle');
verify(main.includes('countedMaintenanceReauthenticationFailureCode'),'counted failure classifier');
verify(main.includes("'AUTH_INVALID_CREDENTIALS' | 'AUTH_SECOND_FACTOR_INVALID'"),'only invalid credential failures counted');
verify(main.includes('recordFailure(authContext.fingerprint)'),'failed verification recorded');
verify(main.includes('recordSuccess(authContext.fingerprint)'),'successful verification resets counter');
verify(main.includes("maintenance_reauthentication_failed"),'privacy-safe failure audit');
verify(main.includes('remainingAttempts: throttle.remainingAttempts'),'audit exposes safe remaining count');
verify(main.includes('retryAfterSeconds: throttle.retryAfterSeconds ?? 0'),'audit exposes safe retry delay');
verify(main.includes('[AUTH_RATE_LIMITED]'),'explicit rate limit error');
verify(main.includes('ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearMemory()')||main.includes('ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearAll()'),'shutdown clears transient guard memory without erasing durable lock state');
const failureAuditStart=main.indexOf("event: 'ipc.adaptive_budget.maintenance_reauthentication_failed'");
const failureAuditEnd=main.indexOf('});',failureAuditStart);
const failureAudit=failureAuditStart>=0&&failureAuditEnd>failureAuditStart?main.slice(failureAuditStart,failureAuditEnd):'';
verify(!failureAudit.includes('password'),'failure audit excludes password');
verify(!failureAudit.includes('reauthentication.code'),'failure audit excludes TOTP code');
verify(renderer.includes('remainingReauthenticationAttempts'),'renderer shows remaining attempts');
verify(renderer.includes('maximumReauthenticationAttempts'),'renderer shows attempt ceiling');
verify(renderer.includes('reauthenticationLocked'),'renderer shows lock state');
verify(renderer.includes('reauthenticationRetryAfterSeconds'),'renderer shows retry delay');
verify(renderer.includes('Başarısız denemeler sınırlıdır'),'renderer communicates bounded attempts');
verify(renderer.includes('await refreshIpcMaintenanceAuthority()'),'renderer refreshes authority after attempt');
verify(renderer.includes('ipcMaintenanceAuthority?.allowed!==true'),'locked controls remain fail-closed');
verify(domain.includes("'REAUTHENTICATION_LOCKED'"),'domain lock reason');
verify(domain.includes('remainingReauthenticationAttempts:number'),'domain remaining attempts');
verify(domain.includes('maximumReauthenticationAttempts:number'),'domain maximum attempts');
verify(domain.includes('reauthenticationRetryAfterSeconds?:number'),'domain retry-after');
verify(globalTypes.includes('getIpcAdaptiveBudgetMaintenanceAuthority()'),'renderer authority API preserved');
verify(adr.includes('beş başarısız deneme'),'ADR attempt decision');
verify(adr.includes('beş dakika'),'ADR lock duration decision');
verify(adr.includes('yeniden başlatma'),'ADR runtime-scoped limitation disclosed');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=170,'feature evaluated on Build 170 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
verify(new RegExp(`^\\d{2}\\.07\\.2026\\.${current?.sequence}$`).test(current?.version ?? ''),'display version aligned');
verify(new RegExp(`^\\d{1,2}\\.7\\.2026-${current?.sequence}$`).test(current?.packageVersion ?? ''),'package version aligned');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:170,stage:'Bronze RC2 Active Development',scope:'Bounded adaptive IPC maintenance reauthentication failures and temporary runtime lockout',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 170 maintenance reauthentication guard contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 170 maintenance reauthentication guard contract: PASS (${assertions}/${assertions}).`);
