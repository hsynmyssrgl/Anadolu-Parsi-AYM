import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build167-ipc-adaptive-budget-maintenance-session-contract.json'));
const [session,main,preload,renderer,globalTypes,domain,policy,pkg,ledger]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-session.ts','utf8'),
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
verify(session.includes("'reset' | 'diagnostics-export'"),'operation-specific sessions');
verify(session.includes('readonly senderId: number'),'sender binding');
verify(session.includes('readonly rendererSessionId: string'),'renderer session binding');
verify(session.includes('readonly authFingerprint: string'),'auth context binding');
verify(session.includes('DEFAULT_TTL_MS = 90_000'),'90 second default ttl');
verify(session.includes('maximumSessionsPerSender'),'bounded sessions per sender');
verify(session.includes('SESSION_ALREADY_USED'),'single-use rejection');
verify(session.includes('SESSION_EXPIRED'),'expiry rejection');
verify(session.includes('SENDER_MISMATCH'),'sender mismatch rejection');
verify(session.includes('RENDERER_SESSION_MISMATCH'),'renderer mismatch rejection');
verify(session.includes('AUTH_CONTEXT_MISMATCH'),'auth mismatch rejection');
verify(session.includes('OPERATION_MISMATCH'),'operation mismatch rejection');
verify(session.includes('clearSender(senderId'),'sender cleanup API');
verify(session.includes('clearAll()'),'global cleanup API');
verify(session.includes('prune(now'),'expired session pruning');
verify(session.includes("createHash('sha256')"),'maintenance session fingerprint');
verify(!session.includes('displayName'),'session registry excludes display name');
verify(main.includes('IpcAdaptiveBudgetMaintenanceSessionRegistry'),'main registry integration');
verify(main.includes('adaptiveMaintenanceAuthFingerprint'),'auth fingerprint helper');
verify(main.includes("system:beginIpcAdaptiveBudgetMaintenanceSession"),'begin session IPC');
verify(main.includes('dialog.showMessageBox'),'operator confirmation before session issue');
verify(main.includes('consumeAdaptiveMaintenanceSession'),'single consume boundary');
verify(main.includes("maintenance_session_opened"),'session open audit event');
verify(main.includes("maintenance_session_consumed"),'session consume audit event');
verify(main.includes("maintenance_session_rejected"),'session rejection audit event');
verify(main.includes('ipcAdaptiveBudgetMaintenanceSessions.clearSender(primaryWebContentsId)'),'window-close cleanup');
verify(main.includes('ipcAdaptiveBudgetMaintenanceSessions.clearAll()'),'application shutdown cleanup');
verify(main.includes("consumeAdaptiveMaintenanceSession(event.sender.id, authorization, 'reset')"),'reset requires reset session');
verify(main.includes("consumeAdaptiveMaintenanceSession(event.sender.id, authorization, 'diagnostics-export')"),'export requires export session');
verify(preload.includes("system:beginIpcAdaptiveBudgetMaintenanceSession"),'preload begins maintenance session');
verify(preload.includes("operation:'reset'"),'preload reset authorization');
verify(preload.includes("operation:'diagnostics-export'"),'preload export authorization');
verify(preload.includes('rendererSessionId'),'preload binds renderer identity');
verify(renderer.includes('Bütçeyi sıfırla'),'renderer reset control preserved');
verify(renderer.includes('Tanı paketini dışa aktar'),'renderer export control preserved');
verify(globalTypes.includes('resetIpcAdaptiveBudget('),'renderer reset API remains session mediated');
verify(globalTypes.includes('exportIpcAdaptiveBudgetDiagnostics('),'renderer export API remains session mediated');
verify(domain.includes('IpcAdaptiveBudgetMaintenanceOperation'),'domain operation type');
verify(domain.includes('IpcAdaptiveBudgetMaintenanceSessionView'),'domain session view');
verify(domain.includes('IpcAdaptiveBudgetMaintenanceAuthorizationInput'),'domain authorization input');
verify(policy.includes("case 'system:beginIpcAdaptiveBudgetMaintenanceSession'"),'begin integration policy');
verify(policy.includes("case 'system:resetIpcAdaptiveBudget'"),'reset integration policy');
verify(policy.includes("case 'system:exportIpcAdaptiveBudgetDiagnostics'"),'export integration policy');
verify(policy.includes("args.length === 2")||policy.includes("args.length === 3"),'begin policy argument boundary supports secure extensions');
verify(policy.includes("args.length === 1"),'consume policy argument boundary');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=167,'feature evaluated on Build 167 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
verify(new RegExp(`^\\d{2}\\.07\\.2026\\.${current?.sequence}$`).test(current?.version ?? ''),'display version aligned');
verify(new RegExp(`^\\d{1,2}\\.7\\.2026-${current?.sequence}$`).test(current?.packageVersion ?? ''),'package version aligned');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:167,stage:'Bronze RC2 Active Development',scope:'Single-use, operation-bound, authenticated adaptive IPC maintenance sessions',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 167 IPC adaptive budget maintenance session contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 167 IPC adaptive budget maintenance session contract: PASS (${assertions}/${assertions}).`);
