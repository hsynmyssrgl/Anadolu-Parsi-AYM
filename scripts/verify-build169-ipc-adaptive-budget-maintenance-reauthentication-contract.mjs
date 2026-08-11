import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build169-ipc-adaptive-budget-maintenance-reauthentication-contract.json'));
const [authority,dataStore,strongAuthAdapter,main,preload,renderer,globalTypes,domain,policy,pkg,ledger]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-authority.ts','utf8'),
  readFile('apps/desktop/src/main/data-store.ts','utf8'),
  readFile('apps/desktop/src/main/data-lifecycle-application-adapter.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/main/preload.ts','utf8'),
  readFile('apps/desktop/src/renderer/App.tsx','utf8'),
  readFile('apps/desktop/src/renderer/global.d.ts','utf8'),
  readFile('packages/domain/src/app-data.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-integration-policy.ts','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(authority.includes('readonly twoFactorEnabled?: boolean'),'authority auth state carries two-factor status');
verify(authority.includes('readonly strongReauthenticationRequired: true'),'authority exposes mandatory strong reauthentication');
verify(authority.includes('readonly twoFactorRequired: boolean'),'authority exposes conditional two-factor requirement');
verify(authority.includes('strongReauthenticationRequired: true as const'),'authority always requires step-up verification');
verify(authority.includes('twoFactorRequired: auth.twoFactorEnabled === true'),'authority maps account two-factor state');
verify(domain.includes('IpcAdaptiveBudgetMaintenanceReauthenticationInput'),'domain reauthentication input');
verify(domain.includes('password:string'),'domain password input');
verify(domain.includes('code?:string'),'domain optional TOTP input');
verify(domain.includes('strongReauthenticationRequired:true'),'domain strong reauthentication view');
verify(domain.includes('twoFactorRequired:boolean'),'domain two-factor view');
verify(dataStore.includes('readonly #strongAuthentication: StrongAuthenticationPort'),'data store retains strong authentication port');
verify(dataStore.includes('this.#strongAuthentication = strongAuthentication'),'data store strong authentication assignment');
verify(dataStore.includes('public verifyStrongAuthentication'),'data store explicit step-up API');
verify(dataStore.includes("ipc-adaptive-budget-maintenance-reauthentication"),'maintenance-specific correlation scope');
verify(dataStore.includes('this.#strongAuthentication.verify(context'),'existing password and TOTP verifier reuse');
verify(strongAuthAdapter.includes('Kritik işlem için parola doğrulanamadı.'),'generic critical-operation password failure');
verify(strongAuthAdapter.includes('Kritik işlem için iki aşamalı doğrulama kodu gereklidir.'),'generic critical-operation TOTP requirement');
verify(main.includes('IpcAdaptiveBudgetMaintenanceReauthenticationInput'),'main typed reauthentication input');
verify(main.includes('store().verifyStrongAuthentication(reauthentication);'),'main verifies credentials before session issue');
verify(main.indexOf('store().verifyStrongAuthentication(reauthentication);') < main.indexOf('dialog.showMessageBox',main.indexOf("system:beginIpcAdaptiveBudgetMaintenanceSession")),'strong auth precedes native confirmation/session issue');
verify(main.includes('maintenance_reauthentication_succeeded'),'reauthentication success audit event');
verify(main.includes('twoFactorRequired: authContext.authority.twoFactorRequired'),'audit records requirement without credential material');
verify(main.includes('strongReauthentication: true'),'session-open audit marks step-up verification');
verify(main.includes('ipcAdaptiveBudgetMaintenanceSessions.begin'),'single-use session remains after step-up');
verify(preload.includes('IpcAdaptiveBudgetMaintenanceReauthenticationInput'),'preload typed reauthentication input');
verify(preload.includes('resetIpcAdaptiveBudget:async(reauthentication'),'preload reset requires credentials');
verify(preload.includes('exportIpcAdaptiveBudgetDiagnostics:async(reauthentication'),'preload export requires credentials');
verify(preload.includes("rendererSessionId,reauthentication"),'preload forwards credentials only to session-begin channel');
verify(!preload.includes('localStorage'),'preload does not persist credentials');
verify(policy.includes('args.length === 3'),'begin channel exact argument count');
verify(policy.includes("key === 'password' || key === 'code'"),'credential object unknown-field rejection');
verify(policy.includes('boundedString(args[2].password, 1024)'),'password payload bound');
verify(policy.includes('optionalBoundedString(args[2].code, 16)'),'TOTP payload bound');
verify(policy.includes('boundedString(args[1], 64)'),'renderer session id bound');
verify(renderer.includes('ipcMaintenancePassword'),'renderer ephemeral password state');
verify(renderer.includes('ipcMaintenanceCode'),'renderer ephemeral TOTP state');
verify(renderer.includes('ipcMaintenanceCredentialsReady'),'renderer fail-closed readiness');
verify(renderer.includes('ipcMaintenanceAuthority.twoFactorRequired'),'renderer enforces TOTP when enabled');
verify(renderer.includes('clearIpcMaintenanceCredentials'),'renderer credential clearing');
verify(renderer.includes("setIpcMaintenancePassword('')"),'renderer clears password');
verify(renderer.includes("setIpcMaintenanceCode('')"),'renderer clears TOTP');
verify(renderer.includes('parola ve 2FA kodu kaydedilmez'),'renderer privacy notice');
verify(renderer.includes('strongReauthenticationRequired'),'renderer shows step-up requirement');
verify(globalTypes.includes('IpcAdaptiveBudgetMaintenanceReauthenticationInput'),'renderer global input import');
verify(globalTypes.includes('resetIpcAdaptiveBudget(input:IpcAdaptiveBudgetMaintenanceReauthenticationInput)'),'renderer reset signature requires input');
verify(globalTypes.includes('exportIpcAdaptiveBudgetDiagnostics(input:IpcAdaptiveBudgetMaintenanceReauthenticationInput)'),'renderer export signature requires input');
const reauthAuditStart=main.indexOf("event: 'ipc.adaptive_budget.maintenance_reauthentication_succeeded'");
const reauthAuditEnd=main.indexOf('});',reauthAuditStart);
const reauthAudit=reauthAuditStart>=0&&reauthAuditEnd>reauthAuditStart?main.slice(reauthAuditStart,reauthAuditEnd):'';
verify(!reauthAudit.includes('password'),'reauth audit excludes password');
verify(!reauthAudit.includes('code'),'reauth audit excludes TOTP code');
const rendererMaintenanceStart=renderer.indexOf('const [ipcMaintenancePassword');
const rendererMaintenanceEnd=renderer.indexOf("const bytes=",rendererMaintenanceStart);
const rendererMaintenance=rendererMaintenanceStart>=0&&rendererMaintenanceEnd>rendererMaintenanceStart?renderer.slice(rendererMaintenanceStart,rendererMaintenanceEnd):'';
verify(!rendererMaintenance.includes('localStorage'),'renderer maintenance credentials are not persisted');
verify(!rendererMaintenance.includes('sessionStorage'),'renderer maintenance credentials are not session-persisted');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=169,'feature evaluated on Build 169 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
verify(new RegExp(`^\\d{2}\\.07\\.2026\\.${current?.sequence}$`).test(current?.version ?? ''),'display version aligned');
verify(new RegExp(`^\\d{1,2}\\.7\\.2026-${current?.sequence}$`).test(current?.packageVersion ?? ''),'package version aligned');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:169,stage:'Bronze RC2 Active Development',scope:'Strong password and conditional TOTP reauthentication before adaptive IPC maintenance sessions',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 169 maintenance reauthentication contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 169 maintenance reauthentication contract: PASS (${assertions}/${assertions}).`);
