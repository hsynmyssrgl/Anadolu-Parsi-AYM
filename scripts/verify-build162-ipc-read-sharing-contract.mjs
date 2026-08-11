import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build162-ipc-read-sharing-contract.json'));
const [sharing,preload,runtime,main,pkg,ledger,releaseLedger]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-read-sharing.ts','utf8'),
  readFile('apps/desktop/src/main/preload.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-runtime.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8'),
  readFile('config/release-ledger.json','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(sharing.includes('export interface IpcReadSharingPolicy'),'sharing policy contract');
const sensitiveChannels=['data:getSnapshot','data:getSnapshotSections','dashboard:getOverview','largeData:timeline','timeline:listArchived'];
const sensitiveDeclaration=sharing.match(/export const IPC_POLICY_SENSITIVE_READ_CHANNELS = Object\.freeze\(\[([\s\S]*?)\]\s+as const\);/u)?.[1]??'';
const declaredSensitiveChannels=[...sensitiveDeclaration.matchAll(/'([^']+)'/gu)].map(([,channel])=>channel);
verify(JSON.stringify(declaredSensitiveChannels)===JSON.stringify(sensitiveChannels),'policy-sensitive channel list is exact');
verify(sharing.includes('const policySensitiveChannels = new Set<string>(IPC_POLICY_SENSITIVE_READ_CHANNELS)'),'policy-sensitive set derives from exact exported list');
verify(sharing.includes('if (policySensitiveChannels.has(channel)) return disabledPolicy;'),'policy-sensitive reads fail closed before cacheable classes');
verify(sharing.includes("'dashboard:getOverview'"),'dashboard is policy-sensitive');
verify(sharing.includes("'catalog:listPeople'"),'person catalog sharing policy');
verify(sharing.includes("'catalog:listEvents'"),'event catalog sharing policy');
verify(sharing.includes("'data:getSnapshotSections'"),'bounded snapshot is policy-sensitive');
verify(sharing.includes("'largeData:timeline'"),'large timeline is policy-sensitive');
verify(sharing.includes("'timeline:listArchived'"),'archived timeline is policy-sensitive');
verify(!sharing.includes("'dataLifecycle:runRevocationSync'"),'network sync excluded from sharing');
verify(sharing.includes('ttlMs: 160'),'short bounded non-sensitive interactive TTL');
verify(sharing.includes('maxResultBytes'),'result byte cap');
verify(sharing.includes('maxEntries'),'entry count cap');
verify(sharing.includes('createIpcReadSharingKey'),'content-bound sharing key');
verify(sharing.includes('rendererSessionId: input.rendererSessionId'),'renderer session in key');
verify(sharing.includes('sessionEpoch: input.sessionEpoch'),'session epoch in key');
verify(sharing.includes('revisions: input.revisions'),'revisions in key');
verify(sharing.includes('arguments: input.arguments'),'arguments in key');
verify(sharing.includes("createHash('sha256')"),'SHA-256 sharing key');
verify(sharing.includes('Object.keys(record).sort()'),'canonical object key order');
verify(sharing.includes('structuredClone'),'clone isolation');
verify(sharing.includes('class IpcReadSharingClient'),'preload coalescing client');
verify(sharing.includes('#inFlight'),'in-flight request registry');
verify(sharing.includes('#generation'),'client invalidation generation');
verify(sharing.includes('class IpcReadResultCacheRegistry'),'main result cache registry');
verify(sharing.includes('#generationBySender'),'main sender generation registry');
verify(sharing.includes('expectedGeneration !== this.generation(senderId)'),'stale read cannot repopulate cache');
verify(sharing.includes('invalidateSender(senderId: number)'),'sender cache invalidation');
verify(sharing.includes('shouldInvalidateIpcReadSharing'),'mutation invalidation classifier');
verify(preload.includes('const readSharing = new IpcReadSharingClient()'),'preload client singleton');
verify(preload.includes('readSharing.execute(key, sharingPolicy'),'preload coalesces equal reads');
verify(preload.includes('createIpcReadSharingKey({'),'preload creates scoped key');
verify(preload.includes('invalidateSharedReads'),'preload mutation invalidation');
verify(preload.includes("sendCancellation(request, 'superseded')"),'active shared reads cancelled before mutation');
verify(preload.includes('readSharing.invalidate()'),'session and mutation cache invalidation');
verify(runtime.includes('readResults: IpcReadResultCacheRegistry'),'runtime cache dependency');
verify(runtime.includes("event: 'ipc.read_cache.hit'"),'cache hit audit event');
verify(runtime.includes('input.readResults.lookup<TResult>'),'cache lookup before handler');
verify(runtime.includes('input.readResults.store'),'successful result cache store');
verify(runtime.includes('readCacheGeneration'),'cache generation captured before handler');
verify(runtime.includes('const authorizedCachedResult = input.policyEnforcement')&&runtime.includes('createIpcTransportResponseEnvelope(requestContext, correlationId, authorizedCachedResult)'),'cache hit remains request-bound and policy re-authorized');
verify(main.includes('const ipcReadResults = new IpcReadResultCacheRegistry()'),'main cache singleton');
verify(main.includes('readResults: ipcReadResults'),'all handlers use cache registry');
verify(main.includes('ipcReadResults.invalidateSender(primaryWebContentsId)'),'window close cache cleanup');
verify(main.includes('ipcReadResults.invalidateSender(window.webContents.id)'),'application exit cache cleanup');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1),officialRelease=JSON.parse(releaseLedger)?.current;
verify(Number(current?.sequence)>=162,'feature evaluated on Build 162 or later');
verify(packageJson.version===officialRelease?.packageVersion && officialRelease?.channel==='Bronze','package matches active official Bronze release authority');
verify(current?.stage==='RC2 Aktif Geliştirme','active stage preserved');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:162,stage:'Bronze RC2 Active Development',scope:'Revision-scoped IPC read coalescing and bounded result cache',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 162 IPC read sharing contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 162 IPC read sharing contract: PASS (${assertions}/${assertions}).`);
