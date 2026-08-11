import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build166-ipc-adaptive-budget-operator-contract.json'));
const [state,budget,main,preload,renderer,globalTypes,domain,policy,pkg,ledger]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-resource-budget-state.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-resource-budget.ts','utf8'),
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
verify(state.includes('maximumQuarantineFiles'),'bounded quarantine file count');
verify(state.includes('maximumQuarantineAgeMs'),'bounded quarantine age');
verify(state.includes("join(options.directoryPath, 'quarantine')"),'dedicated quarantine directory');
verify(state.includes('pruneQuarantine('),'quarantine retention API');
verify(state.includes('exportDiagnosticBundle('),'diagnostic bundle export API');
verify(state.includes('containsUserIdentity: false'),'identity exclusion declaration');
verify(state.includes('containsSessionOrRequestIdentifiers: false'),'session and request exclusion declaration');
verify(state.includes('containsIpcArgumentsOrPayloads: false'),'payload exclusion declaration');
verify(state.includes('containsAbsoluteRuntimePaths: false'),'absolute path exclusion declaration');
verify(state.includes('writeAtomicJson(destinationPath'),'atomic diagnostic export');
verify(state.includes("const checksumPath = `${destinationPath}.sha256`"),'diagnostic checksum sidecar');
verify(state.includes("createHash('sha256').update(bytes)"),'diagnostic SHA-256');
verify(state.includes('journalEntryCount'),'journal summary count');
verify(state.includes('quarantineFileCount'),'quarantine summary count');
verify(state.includes('basename(destinationPath)'),'checksum excludes absolute target path');
verify(state.includes("name.startsWith('ipc-adaptive-budget-')"),'quarantine scope constrained');
verify(state.includes('randomBytes(4)'),'collision-resistant quarantine name');
verify(budget.includes('public manualReset('),'manual reset controller API');
verify(budget.includes("this.#reason = 'manual-reset'"),'explicit manual reset reason');
verify(budget.includes("this.#persist('manual-clear'"),'manual reset journal persistence');
verify(main.includes('ipcAdaptiveResourceBudgetStateStore'),'shared main-process state store');
verify(main.includes("system:resetIpcAdaptiveBudget"),'manual reset IPC handler');
verify(main.includes("system:exportIpcAdaptiveBudgetDiagnostics"),'diagnostic export IPC handler');
verify(main.includes('ipcReadResults.clearAll()'),'manual reset clears read cache');
verify(main.includes('ipcPerformanceTelemetry.clear()'),'manual reset clears telemetry');
verify(main.includes('ipcAdaptiveResourceBudget.manualReset()'),'manual reset applies baseline');
verify(main.includes('dialog.showMessageBox'),'manual reset confirmation');
verify(main.includes('dialog.showSaveDialog'),'diagnostic destination picker');
verify(main.includes('adaptiveMaintenanceAuthFingerprint')&&(main.includes('if (!auth.authenticated)')||main.includes('if (!snapshot.authority.allowed)')),'operator actions require authenticated session');
verify(preload.includes('resetIpcAdaptiveBudget'),'preload reset bridge');
verify(preload.includes('exportIpcAdaptiveBudgetDiagnostics'),'preload export bridge');
verify(globalTypes.includes('resetIpcAdaptiveBudget('),'renderer reset type supports secure authorization extensions');
verify(globalTypes.includes('exportIpcAdaptiveBudgetDiagnostics('),'renderer export type supports secure authorization extensions');
verify(renderer.includes('Bütçeyi sıfırla'),'operator reset control');
verify(renderer.includes('Tanı paketini dışa aktar'),'operator export control');
verify(domain.includes('IpcAdaptiveBudgetResetView'),'domain reset result');
verify(domain.includes('IpcAdaptiveBudgetDiagnosticExportView'),'domain export result');
verify(domain.includes("'manual-reset'"),'domain manual reset reason');
verify(policy.includes("case 'system:resetIpcAdaptiveBudget'"),'reset integration policy');
verify(policy.includes("case 'system:exportIpcAdaptiveBudgetDiagnostics'"),'export integration policy');
verify(!/requestId\s*:|rendererSessionId\s*:|arguments\s*:|payload\s*:/u.test(state),'diagnostic implementation excludes request identity and payload fields');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=166,'feature evaluated on Build 166 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
verify(new RegExp(`^\\d{2}\\.07\\.2026\\.${current?.sequence}$`).test(current?.version ?? ''),'display version aligned');
verify(new RegExp(`^\\d{1,2}\\.7\\.2026-${current?.sequence}$`).test(current?.packageVersion ?? ''),'package version aligned');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:166,stage:'Bronze RC2 Active Development',scope:'Authenticated manual baseline reset, privacy-safe diagnostic export and bounded quarantine retention',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 166 IPC adaptive budget operator contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 166 IPC adaptive budget operator contract: PASS (${assertions}/${assertions}).`);
