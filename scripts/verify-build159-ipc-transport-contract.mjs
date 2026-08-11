import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const read=(path)=>readFile(path,'utf8');
const [transport,runtime,main,preload,pkg,ledger]=await Promise.all([
  read('apps/desktop/src/main/ipc-transport-context.ts'),
  read('apps/desktop/src/main/ipc-runtime.ts'),
  read('apps/desktop/src/main/main.ts'),
  read('apps/desktop/src/main/preload.ts'),
  read('package.json'),
  read('artifacts/manifests/VERSION_LEDGER.json')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions++;if(!condition)failures.push(label);};
verify(transport.includes('export class IpcTransportSessionRegistry'),'transport session registry');
verify(transport.includes('rendererSessionId'),'renderer session identity');
verify(transport.includes('requestId'),'request identity');
verify(transport.includes('sessionEpoch'),'session epoch');
verify(transport.includes('requestSequence'),'request sequence');
verify(transport.includes('revisions: IpcTransportRevisions'),'revision context');
verify(transport.includes("'DUPLICATE_REQUEST_ID'"),'duplicate request rejection code');
verify(transport.includes("'STALE_SESSION_EPOCH'"),'stale epoch rejection code');
verify(transport.includes('createIpcTransportResponseEnvelope'),'response envelope');
verify(transport.includes('unwrapIpcTransportResponse'),'response envelope validation');
verify(transport.includes('sameIpcTransportRequest'),'response request binding');
verify(transport.includes('Math.max(current[key], revisions[key])'),'monotonic transport revision merge');
verify(runtime.includes('input.transportSessions.accept'),'main validates request context');
verify(runtime.includes('const handlerArguments = rawArguments.slice(1)'),'transport context removed before handler arguments');
verify(runtime.includes('evaluateIpcIntegrationPolicy(input.channel, handlerArguments)'),'integration policy sees original application arguments');
verify(runtime.includes('createIpcTransportResponseEnvelope(requestContext, correlationId, result)'),'main returns bound response envelope');
verify(runtime.includes("event: 'ipc.transport_context.rejected'"),'transport rejection audit event');
verify(main.includes('const ipcTransportSessions = new IpcTransportSessionRegistry()'),'shared main transport registry');
verify(main.includes('transportSessions: ipcTransportSessions'),'all registered handlers use transport registry');
verify(main.includes('ipcTransportSessions.clearSender(primaryWebContentsId)'),'closed renderer transport state cleared');
verify(preload.includes('const rendererSessionId = randomUUID()'),'preload session id');
verify(preload.includes('requestId: randomUUID()'),'preload request id');
verify(preload.includes('sessionBoundaryChannels'),'session boundary channel set');
verify(preload.includes("'auth:login'"),'login advances transport session');
verify(preload.includes("'auth:logout'"),'logout advances transport session');
verify(preload.includes('unwrapIpcTransportResponse<TResult>'),'preload validates response envelope');
verify(preload.includes('currentSessionEpoch: transportSessionEpoch'),'preload rejects old epoch response');
verify(preload.includes('mergeIpcTransportRevisions'),'preload carries revision context forward');
verify(!preload.includes('=>ipcRenderer.invoke('),'public APIs do not bypass transport wrapper');
const mainChannels=[...main.matchAll(/registerIpcHandler\(\s*['"]([^'"]+)/g)].map(match=>match[1]);
const preloadChannels=[...preload.matchAll(/\binvoke(?:<[^>]+>)?\(\s*['"]([^'"]+)/g)].map(match=>match[1]);
const preloadUnique=[...new Set(preloadChannels)];
const preloadDuplicates=preloadChannels.filter((channel,index)=>preloadChannels.indexOf(channel)!==index);
verify(mainChannels.length>=183,'main channel count preserved or expanded');
verify(preloadUnique.length===mainChannels.length,'preload channel count matches main');
verify(new Set(mainChannels).size===mainChannels.length,'main channels remain unique');
verify(preloadDuplicates.every(channel=>channel==='system:beginIpcAdaptiveBudgetMaintenanceSession'),'preload duplicate use is limited to maintenance-session begin');
verify(mainChannels.every(channel=>preloadUnique.includes(channel)),'main/preload channel parity');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=159,'feature evaluated on Build 159 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','stage preserved');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:159,stage:'Bronze RC2 Active Development',scope:'End-to-end request/session/revision-bound IPC transport envelopes',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
const reportPath='artifacts/validation/build159-ipc-transport-contract.json';await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 159 IPC transport contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 159 IPC transport contract: PASS (${assertions}/${assertions}).`);
