import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=option('--report','artifacts/validation/build160-ipc-request-lifecycle-contract.json');
const [lifecycle,transport,runtime,preload,main,fetcher,sync,pkg,ledger]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-request-lifecycle.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-transport-context.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-runtime.ts','utf8'),
  readFile('apps/desktop/src/main/preload.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/main/secure-revocation-list-fetcher.ts','utf8'),
  readFile('apps/desktop/src/main/secure-revocation-sync-service.ts','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(lifecycle.includes("IPC_REQUEST_CANCEL_CHANNEL = 'transport:cancel'"),'request cancel channel');
verify(lifecycle.includes("IPC_REQUEST_CANCEL_ALL_CHANNEL = 'transport:cancelAll'"),'cancel-all channel');
verify(lifecycle.includes("'superseded'"),'superseded reason');
verify(lifecycle.includes("'timeout'"),'timeout reason');
verify(lifecycle.includes("'session-changed'"),'session change reason');
verify(lifecycle.includes("'renderer-unloaded'"),'renderer unload reason');
verify(lifecycle.includes("'window-closed'"),'window close reason');
verify(lifecycle.includes('assertIpcRequestCancelMessage'),'cancel message validation');
verify(lifecycle.includes('assertIpcRequestCancelAllMessage'),'cancel-all validation');
verify(lifecycle.includes('hasExactKeys'),'exact key validation');
verify(lifecycle.includes('resolveIpcRequestLifecyclePolicy'),'central lifecycle policy');
verify(lifecycle.includes("'catalog:listPeople'"),'person catalog latest-wins');
verify(lifecycle.includes("'largeData:timeline'"),'timeline latest-wins');
verify(lifecycle.includes("'dataLifecycle:runRevocationSync'"),'network sync cancellable');
verify(lifecycle.includes('class IpcRequestLifecycleRegistry'),'request lifecycle registry');
verify(lifecycle.includes('AbortController'),'abort controller');
verify(lifecycle.includes('Promise.race'),'abort race');
verify(lifecycle.includes('clearSender(senderId: number)'),'sender cleanup');
verify(lifecycle.includes('getIpcRequestAbortSignal'),'cooperative abort signal');
verify(transport.includes("| 'REQUEST_TIMEOUT'"),'transport timeout error code');
verify(transport.includes("| 'REQUEST_CANCELLED'"),'transport cancellation error code');
verify(runtime.includes('requestLifecycles: IpcRequestLifecycleRegistry'),'runtime lifecycle dependency');
verify(runtime.includes('resolveIpcRequestLifecyclePolicy(input.channel)'),'main lifecycle policy applied');
verify(runtime.includes('requestLease.run(operation)'),'handler raced against cancellation');
verify(runtime.includes("'ipc.request.timed_out'"),'timeout audit event');
verify(runtime.includes("'ipc.request.cancelled'"),'cancellation audit event');
verify(runtime.includes('registerIpcCancellationHandlers'),'trusted cancellation handlers');
verify(preload.includes('activeRequests = new Map'),'preload active request registry');
verify(preload.includes('latestRequestByChannel = new Map'),'preload latest-wins registry');
verify(preload.includes("sendCancellation(previous, 'superseded')"),'superseded read cancellation');
verify(preload.includes("sendCancellation(request, 'timeout')"),'preload timeout cancellation');
verify(preload.includes("cancelCurrentEpoch('session-changed')"),'session boundary cancellation');
verify(preload.includes("cancelCurrentEpoch('renderer-unloaded')"),'renderer unload cancellation');
verify(preload.includes('Promise.race([invocation, timed])'),'preload timeout race');
verify(main.includes('const ipcRequestLifecycles = new IpcRequestLifecycleRegistry()'),'shared lifecycle registry');
verify(main.includes('registerIpcCancellationHandlers({'),'cancellation handlers registered');
verify(main.includes('ipcRequestLifecycles.clearSender(primaryWebContentsId)'),'window close cleanup');
verify(main.includes('getIpcRequestAbortSignal(event)'),'cooperative handler signal');
verify(fetcher.includes('readonly signal?:AbortSignal'),'fetch input abort signal');
verify(fetcher.includes('signal:input.signal'),'https request abort signal');
verify(/'user-agent':'Pardus-Aile\/Build(?:16[0-9]|1[7-9][0-9]|[2-9][0-9]{2,})'/.test(fetcher),'current secure fetch identity is Build 160 or later');
verify(sync.includes('runDue(forceEndpointId?: string, signal?: AbortSignal)'),'sync service abort signature');
verify(sync.includes('if (signal?.aborted)'),'sync loop abort checkpoints');
verify(sync.includes('...(signal ? { signal } : {})'),'sync forwards signal to fetcher');
verify(sync.includes('if (signal?.aborted) throw'),'cancel does not become backoff failure');
verify(!preload.includes('=>ipcRenderer.invoke('),'public APIs cannot bypass wrapper');
const mainChannels=[...main.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)/g)].map(m=>m[1]);
const preloadChannels=[...preload.matchAll(/\binvoke(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)].map(m=>m[1]);
const preloadUnique=[...new Set(preloadChannels)];
const preloadDuplicates=preloadChannels.filter((channel,index)=>preloadChannels.indexOf(channel)!==index);
verify(mainChannels.length>=183,'main channel count preserved or expanded');
verify(preloadUnique.length===mainChannels.length,'preload channel count matches main');
verify(new Set(mainChannels).size===mainChannels.length,'main channels unique');
verify(preloadDuplicates.every(channel=>channel==='system:beginIpcAdaptiveBudgetMaintenanceSession'),'preload duplicate use limited to maintenance session begin');
verify(mainChannels.every(channel=>preloadUnique.includes(channel)),'channel parity');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=160,'feature evaluated on Build 160 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','stage preserved');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:160,stage:'Bronze RC2 Active Development',scope:'Bounded cancellable IPC request lifecycle and cooperative main-process abort propagation',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 160 IPC request lifecycle contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 160 IPC request lifecycle contract: PASS (${assertions}/${assertions}).`);
