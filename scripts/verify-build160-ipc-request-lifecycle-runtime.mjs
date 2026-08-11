import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd(),tmp=join(root,'.tmp','build160-ipc-request-lifecycle'),args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const reportPath=resolve(option('--report','artifacts/validation/build160-ipc-request-lifecycle-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
execFileSync(process.execPath,[
  'node_modules/typescript/lib/tsc.js','--ignoreConfig',
  'apps/desktop/src/main/ipc-transport-context.ts','apps/desktop/src/main/ipc-request-lifecycle.ts',
  '--target','es2022','--module','nodenext','--moduleResolution','nodenext',
  '--rootDir','apps/desktop/src/main','--outDir',tmp,'--types','node','--skipLibCheck'
],{stdio:'pipe'});
const transportPath=join(tmp,'ipc-transport-context.js');
const lifecyclePath=join(tmp,'ipc-request-lifecycle.js');
await import(pathToFileURL(transportPath).href);
const lifecycle=await import(pathToFileURL(lifecyclePath).href);
const {
  IpcRequestAbortedError,
  IpcRequestLifecycleRegistry,
  assertIpcRequestCancelMessage,
  createIpcRequestCancelAllMessage,
  createIpcRequestCancelMessage,
  resolveIpcRequestLifecyclePolicy
}=lifecycle;
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const asyncCheck=async(label,fn)=>{await fn();checks.push(label);};
const revisions={graph:0,timeline:0,personCatalog:0,eventCatalog:0,dashboard:0,notifications:0,archive:0};
const request=(overrides={})=>({schemaVersion:1,rendererSessionId:'11111111-1111-4111-8111-111111111111',requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionEpoch:0,requestSequence:1,channel:'catalog:listPeople',revisions,...overrides});

check('catalog reads are cancellable latest-wins',()=>assert.deepEqual(resolveIpcRequestLifecyclePolicy('catalog:listPeople'),{cancellable:true,latestWins:true,timeoutMs:30000}));
check('mutations are non-cancellable by default',()=>assert.deepEqual(resolveIpcRequestLifecyclePolicy('family:createMember'),{cancellable:false,latestWins:false,timeoutMs:0}));
check('network sync has bounded timeout',()=>assert.deepEqual(resolveIpcRequestLifecyclePolicy('dataLifecycle:runRevocationSync'),{cancellable:true,latestWins:true,timeoutMs:45000}));
const cancel=createIpcRequestCancelMessage(request(),'superseded');
check('request cancellation message validates',()=>assert.equal(assertIpcRequestCancelMessage(cancel).reason,'superseded'));
check('unknown cancellation fields fail closed',()=>assert.throws(()=>assertIpcRequestCancelMessage({...cancel,extra:true})));

const registry=new IpcRequestLifecycleRegistry();
const first=registry.begin(7,request(),{cancellable:true,latestWins:true,timeoutMs:1000});
check('active request is registered',()=>assert.equal(registry.activeCount(7),1));
const firstRun=first.run(new Promise(resolve=>setTimeout(()=>resolve('late'),80)));
check('mismatched renderer session cannot cancel',()=>assert.equal(registry.cancel(7,{...cancel,rendererSessionId:'22222222-2222-4222-8222-222222222222'}),false));
check('matching request cancellation accepted',()=>assert.equal(registry.cancel(7,cancel),true));
await asyncCheck('cancelled operation rejects with typed error',async()=>assert.rejects(firstRun,error=>error instanceof IpcRequestAbortedError&&error.kind==='cancelled'&&error.reason==='superseded'));
first.complete();
check('completed request is removed',()=>assert.equal(registry.activeCount(7),0));

const timeoutRequest=request({requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',requestSequence:2});
const timeoutLease=registry.begin(7,timeoutRequest,{cancellable:true,latestWins:true,timeoutMs:20});
await asyncCheck('request timeout rejects with typed timeout',async()=>assert.rejects(timeoutLease.run(new Promise(resolve=>setTimeout(resolve,80))),error=>error instanceof IpcRequestAbortedError&&error.kind==='timeout'&&error.reason==='timeout'));
timeoutLease.complete();

const one=request({requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',requestSequence:3});
const two=request({requestId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',requestSequence:4,channel:'catalog:listEvents'});
const leaseOne=registry.begin(7,one,{cancellable:true,latestWins:true,timeoutMs:1000});
const leaseTwo=registry.begin(7,two,{cancellable:true,latestWins:true,timeoutMs:1000});
const runOne=leaseOne.run(new Promise(resolve=>setTimeout(resolve,80)));
const runTwo=leaseTwo.run(new Promise(resolve=>setTimeout(resolve,80)));
check('wrong epoch cancel-all affects nothing',()=>assert.equal(registry.cancelAll(7,createIpcRequestCancelAllMessage(one.rendererSessionId,1,'session-changed')),0));
check('matching epoch cancel-all cancels both reads',()=>assert.equal(registry.cancelAll(7,createIpcRequestCancelAllMessage(one.rendererSessionId,0,'session-changed')),2));
await asyncCheck('cancel-all rejects first request',async()=>assert.rejects(runOne));
await asyncCheck('cancel-all rejects second request',async()=>assert.rejects(runTwo));
leaseOne.complete();leaseTwo.complete();

const mutation=request({requestId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',requestSequence:5,channel:'family:createMember'});
const mutationLease=registry.begin(7,mutation,{cancellable:false,latestWins:false,timeoutMs:0});
check('non-cancellable mutation ignores request cancellation',()=>assert.equal(registry.cancel(7,createIpcRequestCancelMessage(mutation,'manual')),false));
await asyncCheck('non-cancellable mutation result completes',async()=>assert.equal(await mutationLease.run(Promise.resolve('ok')),'ok'));
mutationLease.complete();

const closeRequest=request({requestId:'ffffffff-ffff-4fff-8fff-ffffffffffff',requestSequence:6});
const closeLease=registry.begin(9,closeRequest,{cancellable:true,latestWins:true,timeoutMs:1000});
const closeRun=closeLease.run(new Promise(resolve=>setTimeout(resolve,80)));
check('sender cleanup aborts active cancellable requests',()=>assert.equal(registry.clearSender(9),1));
await asyncCheck('sender cleanup rejects active request',async()=>assert.rejects(closeRun,error=>error instanceof IpcRequestAbortedError&&error.reason==='window-closed'));
closeLease.complete();
check('all lifecycle records are cleaned',()=>assert.equal(registry.activeCount(),0));

const fakeEvent={sender:{id:3}};
const bound=registry.begin(3,request({requestId:'12345678-1234-4234-8234-123456789abc',requestSequence:7}),{cancellable:true,latestWins:true,timeoutMs:1000});
registry.bindEvent(fakeEvent,bound.signal,bound.request);
check('event signal is exposed for cooperative handlers',()=>assert.equal(lifecycle.getIpcRequestAbortSignal(fakeEvent),bound.signal));
check('event request context is exposed for request-bound handlers',()=>assert.equal(lifecycle.getIpcRequestContext(fakeEvent),bound.request));
registry.unbindEvent(fakeEvent);bound.complete();
check('event signal is removed after completion',()=>assert.equal(lifecycle.getIpcRequestAbortSignal(fakeEvent),undefined));
check('event request context is removed after completion',()=>assert.equal(lifecycle.getIpcRequestContext(fakeEvent),undefined));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:160,stage:'Bronze RC2 Active Development',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 160 IPC request lifecycle runtime: PASS (${checks.length}/${checks.length}).`);
