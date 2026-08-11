import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build165-ipc-adaptive-budget-state-contract.json'));
const [state,budget,main,renderer,domain,pkg,ledger,docs,adr]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-resource-budget-state.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-resource-budget.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/renderer/App.tsx','utf8'),
  readFile('packages/domain/src/app-data.ts','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8'),
  readFile('docs/IPC_ADAPTIVE_BUDGET_DURABLE_STATE_V1.md','utf8'),
  readFile('docs/adr/ADR-040-crash-safe-adaptive-budget-state-and-decision-journal.md','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(state.includes('class IpcAdaptiveResourceBudgetStateStore'),'durable state store');
verify(state.includes("'ipc-adaptive-budget-state.json'"),'atomic state file');
verify(state.includes("'ipc-adaptive-budget-decisions.jsonl'"),'append-only decision journal');
verify(state.includes("const ZERO_HASH = '0'.repeat(64)"),'journal chain root');
verify(state.includes('computeEntryHash'),'journal entry hashing');
verify(state.includes('previousHash'),'journal previous hash binding');
verify(state.includes('stateSha256'),'state digest binding');
verify(state.includes('policyFingerprint'),'policy fingerprint binding');
verify(state.includes('applicationVersion'),'application version binding');
verify(state.includes('maximumStateAgeMs'),'bounded state freshness');
verify(state.includes('JOURNAL_CHAIN_INVALID'),'chain tamper classification');
verify(state.includes('POLICY_FINGERPRINT_MISMATCH'),'policy mismatch classification');
verify(state.includes('APPLICATION_VERSION_MISMATCH'),'version mismatch classification');
verify(state.includes('STATE_STALE'),'stale state classification');
verify(state.includes('JOURNAL_RECOVERY'),'journal-only crash recovery');
verify(state.includes('.rejected-'),'invalid state quarantine');
verify(state.includes('writeAtomicJson'),'atomic state write');
verify(state.includes('fsyncSync'),'durable fsync');
verify(state.includes('maximumJournalEntries'),'bounded journal entry count');
verify(state.includes('maximumJournalBytes'),'bounded journal byte count');
verify(state.includes('compactedThroughHash'),'compaction continuity anchor');
verify(!/requestId|rendererSessionId|arguments: readonly unknown|payload:/u.test(state),'journal excludes request identity and payload');
verify(budget.includes('IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT'),'policy fingerprint export');
verify(budget.includes('IpcAdaptiveResourceBudgetStatePersistence'),'controller persistence port');
verify(budget.includes("restored.status === 'RESTORED'"),'verified restore path');
verify(budget.includes("'restore-rejected'"),'rejected restore reason');
verify(budget.includes("'persistence-failure'"),'write failure visibility');
verify(budget.includes("#persist('evaluation'"),'evaluation persistence');
verify(budget.includes('Number.isFinite(this.#lastRefreshAt)'),'non-finite clock normalization');
verify(budget.includes('clear(options:'),'non-destructive shutdown clear option');
verify(budget.includes('persistence: Object.freeze'),'health snapshot persistence view');
verify(main.includes('new IpcAdaptiveResourceBudgetStateStore'),'main durable state integration');
verify(main.includes("directoryPath: join(app.getPath('userData'), 'runtime-state')"),'userData scoped runtime state');
verify(main.includes('applicationVersion: APP_META.version'),'state bound to app version');
verify(main.includes('policyFingerprint: IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT'),'state bound to policy');
verify(main.includes('clear({ persist: false })'),'graceful shutdown preserves durable state');
verify(renderer.includes('kalıcılık'),'system health persistence visibility');
verify(renderer.includes('adaptiveBudget.persistence.status'),'renderer persistence status');
verify(domain.includes('IpcAdaptiveResourceBudgetPersistenceView'),'domain persistence view');
verify(domain.includes("'recovered'|'rejected'|'write-failed'"),'domain persistence states');
verify(docs.includes('SHA-256'),'durable state documentation');
verify(docs.includes('15 dakika'),'state freshness documentation');
verify(adr.includes('ADR-040'),'architecture decision record');
verify(adr.includes('fail-closed'),'ADR fail-closed decision');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=165,'feature evaluated on Build 165 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
verify(new RegExp(`^\\d{2}\\.07\\.2026\\.${current?.sequence}$`).test(current?.version ?? ''),'display version aligned to sequence');
verify(new RegExp(`^\\d{1,2}\\.7\\.2026-${current?.sequence}$`).test(current?.packageVersion ?? ''),'package version aligned to sequence');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:165,stage:'Bronze RC2 Active Development',scope:'Crash-safe adaptive IPC budget state with tamper-evident bounded decision journal',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 165 IPC adaptive budget state contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 165 IPC adaptive budget state contract: PASS (${assertions}/${assertions}).`);
