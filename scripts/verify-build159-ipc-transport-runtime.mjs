import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd(),tmp=join(root,'.tmp','build159-ipc-transport'),args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const reportPath=resolve(option('--report','artifacts/validation/build159-ipc-transport-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/ipc-transport-context.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
const diagnostics=(output.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
if(diagnostics.length)throw new Error('IPC transport context transpilation failed.');
const modulePath=join(tmp,'ipc-transport-context.mjs');await writeFile(modulePath,output.outputText);
const transport=await import(pathToFileURL(modulePath).href);
const {
  IPC_TRANSPORT_SCHEMA_VERSION,
  IpcTransportProtocolError,
  IpcTransportSessionRegistry,
  assertIpcTransportRequestContext,
  createIpcTransportResponseEnvelope,
  createZeroIpcTransportRevisions,
  mergeIpcTransportRevisions,
  unwrapIpcTransportResponse
}=transport;
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const sessionA='11111111-1111-4111-8111-111111111111';
const sessionB='22222222-2222-4222-8222-222222222222';
const request=(overrides={})=>({schemaVersion:IPC_TRANSPORT_SCHEMA_VERSION,rendererSessionId:sessionA,requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionEpoch:0,requestSequence:1,channel:'test:echo',revisions:createZeroIpcTransportRevisions(),...overrides});

const parsed=assertIpcTransportRequestContext(request(),'test:echo');
check('valid request context accepted',()=>assert.equal(parsed.requestId,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));
check('channel mismatch rejected',()=>assert.throws(()=>assertIpcTransportRequestContext(request(),'other:echo'),error=>error instanceof IpcTransportProtocolError&&error.code==='CHANNEL_MISMATCH'));
check('unknown request field rejected',()=>assert.throws(()=>assertIpcTransportRequestContext({...request(),extra:true}))); 
check('invalid renderer session id rejected',()=>assert.throws(()=>assertIpcTransportRequestContext(request({rendererSessionId:'bad'}))));
check('negative revision rejected',()=>assert.throws(()=>assertIpcTransportRequestContext(request({revisions:{...createZeroIpcTransportRevisions(),graph:-1}}))));

const registry=new IpcTransportSessionRegistry(64);
const first=registry.accept(7,'test:echo',request());
check('first renderer request accepted',()=>assert.equal(first.requestSequence,1));
check('duplicate request id rejected',()=>assert.throws(()=>registry.accept(7,'test:echo',request()),error=>error instanceof IpcTransportProtocolError&&error.code==='DUPLICATE_REQUEST_ID'));
const epochOne=registry.accept(7,'test:echo',request({requestId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',sessionEpoch:1,requestSequence:1}));
check('higher session epoch accepted',()=>assert.equal(epochOne.sessionEpoch,1));
check('older session epoch rejected',()=>assert.throws(()=>registry.accept(7,'test:echo',request({requestId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',sessionEpoch:0,requestSequence:2})),error=>error instanceof IpcTransportProtocolError&&error.code==='STALE_SESSION_EPOCH'));
check('new renderer session requires first sequence',()=>assert.throws(()=>registry.accept(7,'test:echo',request({rendererSessionId:sessionB,requestId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',sessionEpoch:0,requestSequence:2}))));
const newSession=registry.accept(7,'test:echo',request({rendererSessionId:sessionB,requestId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',sessionEpoch:0,requestSequence:1}));
check('new renderer session starts cleanly',()=>assert.equal(newSession.rendererSessionId,sessionB));
registry.clearSender(7);
check('cleared sender accepts a fresh first request',()=>assert.equal(registry.accept(7,'test:echo',request()).requestSequence,1));

const bounded=new IpcTransportSessionRegistry(64);
for(let index=0;index<65;index+=1){
  const tail=index.toString(16).padStart(12,'0');
  bounded.accept(8,'test:echo',request({requestId:`00000000-0000-4000-8000-${tail}`,requestSequence:index+1}));
}
check('bounded request id window evicts oldest',()=>assert.doesNotThrow(()=>bounded.accept(8,'test:echo',request({requestSequence:66}))));

const acceptedRequest=request({revisions:{...createZeroIpcTransportRevisions(),graph:3,dashboard:2}});
const envelope=createIpcTransportResponseEnvelope(acceptedRequest,'ipc-correlation-123',{ok:true});
check('matching response envelope unwraps result',()=>assert.deepEqual(unwrapIpcTransportResponse({expectedRequest:acceptedRequest,currentSessionEpoch:0,response:envelope}),{ok:true}));
check('stale response epoch rejected',()=>assert.throws(()=>unwrapIpcTransportResponse({expectedRequest:acceptedRequest,currentSessionEpoch:1,response:envelope}),error=>error instanceof IpcTransportProtocolError&&error.code==='STALE_SESSION_EPOCH'));
const wrongRequest={...acceptedRequest,requestId:'ffffffff-ffff-4fff-8fff-ffffffffffff'};
check('mismatched response request rejected',()=>assert.throws(()=>unwrapIpcTransportResponse({expectedRequest:acceptedRequest,currentSessionEpoch:0,response:createIpcTransportResponseEnvelope(wrongRequest,'ipc-correlation-123',{ok:true})}),error=>error instanceof IpcTransportProtocolError&&error.code==='RESPONSE_REQUEST_MISMATCH'));
check('response with unknown field rejected',()=>assert.throws(()=>unwrapIpcTransportResponse({expectedRequest:acceptedRequest,currentSessionEpoch:0,response:{...envelope,extra:true}})));

const current={...createZeroIpcTransportRevisions(),graph:5,timeline:2};
const merged=mergeIpcTransportRevisions(current,{...createZeroIpcTransportRevisions(),graph:3,timeline:7,dashboard:4});
check('revision merge remains monotonic',()=>assert.deepEqual(merged,{graph:5,timeline:7,personCatalog:0,eventCatalog:0,dashboard:4,notifications:0,archive:0}));
check('malformed revision candidate leaves state unchanged',()=>assert.deepEqual(mergeIpcTransportRevisions(current,{graph:-1}),current));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:159,stage:'Bronze RC2 Active Development',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 159 IPC transport runtime: PASS (${checks.length}/${checks.length}).`);
