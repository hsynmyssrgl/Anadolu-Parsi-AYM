import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build171-ipc-adaptive-budget-maintenance-reauthentication-persistence-contract.json'));
const [state,guard,main,renderer,pkg,ledger,adr,build170Contract]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-state.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/renderer/App.tsx','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8'),
  readFile('docs/adr/ADR-044-os-protected-maintenance-reauthentication-state.md','utf8'),
  readFile('scripts/verify-build170-ipc-adaptive-budget-maintenance-reauthentication-guard-contract.mjs','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(state.includes("import type { DeviceSecretProtector }"),'state store uses device secret protector contract');
verify(state.includes('protectedPayload'),'protected payload envelope');
verify(state.includes('payloadSha256'),'payload hash envelope');
verify(state.includes('protectionId'),'protector binding');
verify(state.includes('writerVersion'),'writer version evidence');
verify(state.includes("protector.protect(payload)"),'payload protected before persistence');
verify(state.includes("protector.unprotect(parsed.protectedPayload)"),'payload unprotected on restore');
verify(state.includes('timingSafeEqual'),'hash comparison is timing safe');
verify(state.includes('writeAtomicJson'),'atomic JSON writer');
verify(state.includes("openSync(temporaryPath, 'wx', 0o600)"),'exclusive restricted temporary file');
verify(state.includes('fsyncSync(descriptor)'),'durable file flush');
verify(state.includes('renameSync(temporaryPath, path)'),'atomic rename');
verify(state.includes('chmodSync(path, 0o600)'),'restricted final file mode');
verify(state.includes('DEFAULT_MAXIMUM_FILE_BYTES = 524_288'),'bounded state file size');
verify(state.includes('DEFAULT_MAXIMUM_QUARANTINE_FILES = 4'),'bounded quarantine default');
verify(state.includes("entry.name.endsWith('.rejected')"),'quarantine inventory filter');
verify(state.includes('files.slice(this.#maximumQuarantineFiles)'),'quarantine capacity pruning');
verify(state.includes("status: 'MISSING'"),'missing state classification');
verify(state.includes("status: 'RESTORED'"),'restored state classification');
verify(state.includes("status: 'REJECTED'"),'rejected state classification');
verify(state.includes('STATE_REJECTED_AND_QUARANTINED'),'rejected state reason');
verify(state.includes('exactKeys'),'strict envelope and payload fields');
verify(state.includes('CONTEXT_KEY_PATTERN'),'opaque context validation');
verify(state.includes('snapshot.attempts.length > maximumTrackedContexts'),'bounded restored context count');
verify(state.includes('keys.has(attempt.contextKey)'),'duplicate context rejection');
verify(!state.toLowerCase().includes('password'),'state store excludes password fields');
verify(!state.toLowerCase().includes('totp'),'state store excludes TOTP fields');
verify(!state.includes('rendererSessionId'),'state store excludes renderer session id');
verify(guard.includes('readonly persistence?: IpcAdaptiveBudgetMaintenanceReauthenticationPersistence'),'guard persistence option');
verify(guard.includes('restore(now = Date.now())'),'guard restore API');
verify(guard.includes("result.status === 'RESTORED'"),'guard restores protected attempts');
verify(guard.includes("result.status === 'REJECTED'"),'guard handles rejected state');
verify(guard.includes('this.#recoveryHoldUntil = now + this.#lockDurationMs'),'rejected state creates recovery hold');
verify(guard.includes('recoveryHoldUntil'),'recovery hold is durable');
verify(guard.includes('this.#persist(now)'),'guard persists mutations');
verify(guard.includes('recordFailure(contextKey'),'failure persistence path');
verify(guard.includes('recordSuccess(contextKey'),'success persistence path');
verify(guard.includes('if (this.#prune(now)) this.#persist(now)'),'expired state persisted after pruning');
verify(guard.includes('clearMemory(): void'),'memory-only shutdown cleanup');
verify(guard.includes('clearAll(now = Date.now())'),'explicit durable clear API');
verify(guard.includes('attempts: Object.freeze(attempts)'),'immutable durable snapshot');
verify(guard.includes('this.#persistence?.save(this.#snapshot(), now)'),'protected persistence integration');
verify(main.includes('IpcAdaptiveBudgetMaintenanceReauthenticationStateStore'),'main state store integration');
verify(main.includes("directoryPath: join(app.getPath('userData'), 'runtime-state')"),'state kept under userData runtime state');
verify(main.includes('protector: () => secretProtector()'),'OS protector provider wired');
verify(main.includes('persistence: ipcAdaptiveBudgetMaintenanceReauthenticationStateStore'),'guard persistence wired');
verify(main.includes('ipcAdaptiveBudgetMaintenanceReauthenticationGuard.restore(Date.now())'),'startup restore before IPC');
verify(main.includes("maintenance_reauthentication_state_restored"),'privacy-safe restore audit');
verify(main.includes('restoredContextCount'),'restore count audit');
verify(main.includes('recoveryHoldUntil'),'recovery hold audit');
verify(main.includes('quarantined:'),'quarantine boolean audit');
verify(!main.includes('quarantinePath: maintenanceReauthenticationRestore.quarantinePath'),'quarantine path not logged');
verify(main.includes('ipcAdaptiveBudgetMaintenanceReauthenticationGuard.clearMemory()'),'shutdown preserves durable state');
verify(renderer.includes('işletim sistemi korumasıyla şifrelenerek'),'renderer explains OS protection');
verify(renderer.includes('uygulama yeniden başlatmalarında korunur'),'renderer explains restart continuity');
verify(adr.includes('uygulamayı yeniden başlatmak'),'ADR restart bypass decision');
verify(adr.includes('safeStorage'),'ADR OS protection decision');
verify(adr.includes('en fazla dört karantina'),'ADR bounded quarantine');
verify(adr.includes('beş dakikalık güvenli toparlanma'),'ADR fail-closed recovery hold');
verify(build170Contract.includes("clearMemory()")&&build170Contract.includes("clearAll("),'Build 170 continuity accepts durable-safe shutdown');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1),featureEntry=versionLedger.entries?.find(entry=>entry.sequence===171);
verify(Number(current?.sequence)>=171,'feature evaluated on Build 171 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
verify(new RegExp(`^\\d{2}\\.07\\.2026\\.${current?.sequence}$`).test(current?.version ?? ''),'display version aligned');
verify(new RegExp(`^\\d{1,2}\\.7\\.2026-${current?.sequence}$`).test(current?.packageVersion ?? ''),'package version aligned');
verify(featureEntry?.milestone?.includes('persistent')||featureEntry?.milestone?.includes('protected'),'ledger milestone names protected persistence');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:171,stage:'Bronze RC2 Active Development',scope:'OS-protected persistent adaptive IPC maintenance reauthentication attempts, lockout and bounded recovery hold',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 171 maintenance reauthentication persistence contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 171 maintenance reauthentication persistence contract: PASS (${assertions}/${assertions}).`);
