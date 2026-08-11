import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd(),tmp=join(root,'.tmp','build161-ipc-backpressure'),args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const reportPath=resolve(option('--report','artifacts/validation/build161-ipc-backpressure-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const transpile=async(sourcePath,outputName)=>{const source=await readFile(sourcePath,'utf8');const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});const errors=(output.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);if(errors.length)throw new Error(`${sourcePath} transpilation failed.`);const outputPath=join(tmp,outputName);await writeFile(outputPath,output.outputText);return outputPath;};
await transpile('apps/desktop/src/main/ipc-transport-context.ts','ipc-transport-context.mjs');
let lifecycleSource=await readFile('apps/desktop/src/main/ipc-request-lifecycle.ts','utf8');
lifecycleSource=lifecycleSource.replace("from './ipc-transport-context.js'","from './ipc-transport-context.mjs'");
const output=ts.transpileModule(lifecycleSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
if((output.diagnostics??[]).some(item=>item.category===ts.DiagnosticCategory.Error))throw new Error('Backpressure lifecycle transpilation failed.');
const lifecyclePath=join(tmp,'ipc-request-lifecycle.mjs');await writeFile(lifecyclePath,output.outputText);
const lifecycle=await import(pathToFileURL(lifecyclePath).href);
const {IpcRequestAbortedError,IpcRequestAdmissionError,IpcRequestLifecycleRegistry,createIpcRequestCancelAllMessage,createIpcRequestCancelMessage,resolveIpcRequestAdmissionPolicy}=lifecycle;
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};const asyncCheck=async(label,fn)=>{await fn();checks.push(label);};
const revisions={graph:0,timeline:0,personCatalog:0,eventCatalog:0,dashboard:0,notifications:0,archive:0};
const ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9'];
const request=(index,channel='catalog:listPeople',overrides={})=>({schemaVersion:1,rendererSessionId:'11111111-1111-4111-8111-111111111111',requestId:ids[index],sessionEpoch:0,requestSequence:index+1,channel,revisions,...overrides});
const life={cancellable:true,latestWins:true,timeoutMs:1000};
const admission=(overrides={})=>({enabled:true,priority:'standard',priorityWeight:60,maxConcurrentPerSender:1,maxConcurrentPerChannel:1,maxQueuedPerSender:4,queueTimeoutMs:1000,...overrides});

check('interactive policy has highest priority',()=>assert.equal(resolveIpcRequestAdmissionPolicy('dashboard:getOverview').priorityWeight,100));
check('large data policy has standard priority',()=>assert.equal(resolveIpcRequestAdmissionPolicy('largeData:timeline').priorityWeight,60));
check('network policy has background priority',()=>assert.equal(resolveIpcRequestAdmissionPolicy('dataLifecycle:runRevocationSync').priorityWeight,20));
check('ordinary mutation bypasses admission queue',()=>assert.equal(resolveIpcRequestAdmissionPolicy('family:createMember').enabled,false));

const priorityRegistry=new IpcRequestLifecycleRegistry();
const first=await priorityRegistry.acquire(1,request(0),life,admission());
const lowPromise=priorityRegistry.acquire(1,request(1,'largeData:timeline'),life,admission({priority:'background',priorityWeight:20}));
const highPromise=priorityRegistry.acquire(1,request(2,'dashboard:getOverview'),life,admission({priority:'interactive',priorityWeight:100}));
check('two saturated requests are queued',()=>assert.equal(priorityRegistry.queuedCount(1),2));
first.complete();
const high=await highPromise;
check('higher priority request leaves queue first',()=>assert.equal(high.request.requestId,ids[2]));
check('admitted high priority request reports queue wait',()=>assert.equal(high.admission.queued,true));
let lowResolved=false;void lowPromise.then(()=>{lowResolved=true;});await new Promise(resolve=>setTimeout(resolve,0));
check('lower priority request remains queued',()=>assert.equal(lowResolved,false));
high.complete();const low=await lowPromise;
check('lower priority request runs after capacity release',()=>assert.equal(low.request.requestId,ids[1]));
low.complete();

const channelRegistry=new IpcRequestLifecycleRegistry();
const policyTwo=admission({maxConcurrentPerSender:2});
const sameOne=await channelRegistry.acquire(2,request(3,'catalog:listPeople'),life,policyTwo);
const sameTwoPromise=channelRegistry.acquire(2,request(4,'catalog:listPeople'),life,policyTwo);
const other=await channelRegistry.acquire(2,request(5,'catalog:listEvents'),life,policyTwo);
check('per-channel cap queues same channel',()=>assert.equal(channelRegistry.queuedCount(2),1));
check('different channel uses remaining sender capacity',()=>assert.equal(other.admission.queued,false));
sameOne.complete();const sameTwo=await sameTwoPromise;sameTwo.complete();other.complete();

const fullRegistry=new IpcRequestLifecycleRegistry();
const fullPolicy=admission({maxQueuedPerSender:1});
const fullActive=await fullRegistry.acquire(3,request(6),life,fullPolicy);
const fullQueued=fullRegistry.acquire(3,request(7,'largeData:tree'),life,fullPolicy);
await asyncCheck('queue overflow rejects with typed backpressure error',async()=>assert.rejects(fullRegistry.acquire(3,request(8,'largeData:archive'),life,fullPolicy),error=>error instanceof IpcRequestAdmissionError&&error.kind==='queue-full'));
fullActive.complete();(await fullQueued).complete();

const timeoutRegistry=new IpcRequestLifecycleRegistry();
const timeoutActive=await timeoutRegistry.acquire(4,request(0),life,admission());
await asyncCheck('queued request timeout is typed and bounded',async()=>assert.rejects(timeoutRegistry.acquire(4,request(1,'largeData:timeline'),life,admission({queueTimeoutMs:20})),error=>error instanceof IpcRequestAdmissionError&&error.kind==='queue-timeout'));
check('timed out request leaves queue',()=>assert.equal(timeoutRegistry.queuedCount(4),0));timeoutActive.complete();

const cancelRegistry=new IpcRequestLifecycleRegistry();
const cancelActive=await cancelRegistry.acquire(5,request(2),life,admission());
const cancelRequest=request(3,'largeData:timeline');
const cancelQueued=cancelRegistry.acquire(5,cancelRequest,life,admission());
check('queued request accepts matching cancellation',()=>assert.equal(cancelRegistry.cancel(5,createIpcRequestCancelMessage(cancelRequest,'manual')),true));
await asyncCheck('cancelled queued request rejects before handler starts',async()=>assert.rejects(cancelQueued,error=>error instanceof IpcRequestAbortedError&&error.reason==='manual'));
cancelActive.complete();

const allRegistry=new IpcRequestLifecycleRegistry();
const allOneRequest=request(4);const allTwoRequest=request(5,'largeData:timeline');
const allOne=await allRegistry.acquire(6,allOneRequest,life,admission());
const allRun=allOne.run(new Promise(resolve=>setTimeout(resolve,80)));
const allTwoPromise=allRegistry.acquire(6,allTwoRequest,life,admission());
check('cancel-all counts active and queued work',()=>assert.equal(allRegistry.cancelAll(6,createIpcRequestCancelAllMessage(allOneRequest.rendererSessionId,0,'session-changed')),2));
await asyncCheck('cancel-all aborts active work',async()=>assert.rejects(allRun));
await asyncCheck('cancel-all rejects queued work',async()=>assert.rejects(allTwoPromise));
allOne.complete();

const isolated=new IpcRequestLifecycleRegistry();
const senderOne=await isolated.acquire(10,request(6),life,admission());
const senderTwo=await isolated.acquire(11,request(7),life,admission());
check('sender budgets are isolated',()=>assert.equal(senderTwo.admission.queued,false));
senderOne.complete();senderTwo.complete();
const bypass=await isolated.acquire(12,request(8,'family:createMember'),{cancellable:false,latestWins:false,timeoutMs:0});
check('non-admitted channel reports immediate standard admission',()=>assert.deepEqual(bypass.admission,{queued:false,waitMs:0,priority:'standard'}));bypass.complete();
check('all admissions are cleaned',()=>assert.equal(isolated.activeCount()+isolated.queuedCount(),0));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:161,stage:'Bronze RC2 Active Development',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 161 IPC backpressure runtime: PASS (${checks.length}/${checks.length}).`);
