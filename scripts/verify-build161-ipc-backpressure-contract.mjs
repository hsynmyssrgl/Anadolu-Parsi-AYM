import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=option('--report','artifacts/validation/build161-ipc-backpressure-contract.json');
const [lifecycle,runtime,pkg,ledger]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-request-lifecycle.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-runtime.ts','utf8'),
  readFile('package.json','utf8'),
  readFile('artifacts/manifests/VERSION_LEDGER.json','utf8')
]);
let assertions=0;const failures=[];const verify=(condition,label)=>{assertions+=1;if(!condition)failures.push(label);};
verify(lifecycle.includes("IpcRequestAdmissionPriority = 'interactive' | 'standard' | 'background'"),'three admission priorities');
verify(lifecycle.includes('maxConcurrentPerSender'),'sender concurrency budget');
verify(lifecycle.includes('maxConcurrentPerChannel'),'channel concurrency budget');
verify(lifecycle.includes('maxQueuedPerSender'),'bounded sender queue');
verify(lifecycle.includes('queueTimeoutMs'),'bounded queue wait');
verify(lifecycle.includes("priorityWeight: 100"),'interactive priority weight');
verify(lifecycle.includes("priorityWeight: 60"),'standard priority weight');
verify(lifecycle.includes("priorityWeight: 20"),'background priority weight');
verify(lifecycle.includes("dashboard:getOverview"),'dashboard admission policy');
verify(lifecycle.includes("catalog:listPeople"),'person catalog admission policy');
verify(lifecycle.includes("largeData:timeline"),'large timeline admission policy');
verify(lifecycle.includes("dataLifecycle:runRevocationSync"),'network admission policy');
verify(lifecycle.includes("IpcRequestAdmissionErrorKind = 'queue-full' | 'queue-timeout'"),'typed admission failures');
verify(lifecycle.includes('public acquire('),'async admission acquisition');
verify(lifecycle.includes('#runningAdmissionsBySender'),'running admission registry');
verify(lifecycle.includes('#queuedAdmissionsBySender'),'queued admission registry');
verify(lifecycle.includes('#canStart(senderId'),'budget gate');
verify(lifecycle.includes('#sortQueue(queue'),'priority queue ordering');
verify(lifecycle.includes('priorityWeight - left.admissionPolicy.priorityWeight'),'descending priority ordering');
verify(lifecycle.includes('left.request.requestSequence - right.request.requestSequence'),'FIFO sequence tiebreaker');
verify(lifecycle.includes("new IpcRequestAdmissionError('queue-full'"),'queue full rejection');
verify(lifecycle.includes("new IpcRequestAdmissionError('queue-timeout'"),'queue timeout rejection');
verify(lifecycle.includes('const queued = this.#findQueued'),'queued cancellation lookup');
verify(lifecycle.includes('public queuedCount('),'queue metrics');
verify(runtime.includes('await input.requestLifecycles.acquire('),'runtime waits for admission');
verify(runtime.includes("ipc.request.backpressure_rejected"),'backpressure rejection audit');
verify(runtime.includes("ipc.request.queue_timed_out"),'queue timeout audit');
verify(runtime.includes('admissionQueued: requestLease.admission.queued'),'admission queued telemetry');
verify(runtime.includes('admissionWaitMs: requestLease.admission.waitMs'),'admission wait telemetry');
verify(runtime.includes('admissionPriority: requestLease.admission.priority'),'admission priority telemetry');
verify(runtime.includes('queuedCount: input.requestLifecycles.queuedCount'),'queue depth telemetry');
const packageJson=JSON.parse(pkg),versionLedger=JSON.parse(ledger),current=versionLedger.entries?.at(-1);
verify(Number(current?.sequence)>=161,'feature evaluated on Build 161 or later');
verify(packageJson.version===current?.packageVersion,'package and ledger aligned');
verify(current?.stage==='RC2 Aktif Geliştirme','stage preserved');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:161,stage:'Bronze RC2 Active Development',scope:'Priority-aware bounded IPC admission and backpressure',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 161 IPC backpressure contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 161 IPC backpressure contract: PASS (${assertions}/${assertions}).`);
