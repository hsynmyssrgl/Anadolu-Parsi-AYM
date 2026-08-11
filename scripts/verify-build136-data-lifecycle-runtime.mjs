import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build136-data-lifecycle-runtime');
const reportPath=resolve(process.argv[2]??'artifacts/validation/build136-data-lifecycle-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const source=await readFile(join(root,'packages/application/src/data-lifecycle-use-cases.ts'),'utf8');
const body=source.slice(source.indexOf('export interface DataLifecycleApplicationContext'));
const prelude=`
const ERROR_CODES={CORE_INVALID_ARGUMENT:'CORE_INVALID_ARGUMENT',AUTHORIZATION_DENIED:'AUTHORIZATION_DENIED',RESOURCE_NOT_FOUND:'RESOURCE_NOT_FOUND',RESOURCE_CONFLICT:'RESOURCE_CONFLICT'};
const asIsoDateTime=(value)=>value;
const createAppError=(input)=>input;
const err=(error)=>({ok:false,error});
const ok=(value)=>({ok:true,value});
type AppError=any; type CorrelationId=string; type EventId=string; type FamilyId=string; type IsoDateTime=string; type PersonId=string; type Result<T,E>=({ok:true,value:T}|{ok:false,error:E}); type UserId=string;
type ArchiveDataResourceInput=any; type CancelDataPurgeInput=any; type CreateDataRetentionPolicyInput=any; type DataLifecycleRecordView=any; type DataLifecycleResourceType=any; type DataRetentionPolicyView=any; type ExecuteDataPurgeInput=any; type FamilyRole=any; type RecordPrivacy=any; type RequestDataPurgeInput=any; type RestoreDataResourceInput=any; type SetDataLegalHoldInput=any; type DomainEvent<T>=any; type AuthorizationAction=any;
`;
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const transpiled=ts.transpileModule(prelude+body,{fileName:'data-lifecycle-use-cases.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
const diagnostics=(transpiled.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
if(diagnostics.length)throw new Error(diagnostics.map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n')).join('\n'));
const modulePath=join(tmp,'data-lifecycle-use-cases.mjs');await writeFile(modulePath,transpiled.outputText);
const lifecycle=await import(pathToFileURL(modulePath).href);

let now='2026-07-28T00:00:00.000Z';
const policies=new Map();const records=new Map();const resources=new Map();const audits=[];const events=[];let authChecks=0;let purges=0;let authorized=true;
const key=(type,id)=>`${type}:${id}`;
resources.set(key('finance_record','finance-1'),{resourceType:'finance_record',resourceId:'finance-1',title:'Aile birikimi',ownerPersonId:'person-1',privacy:'private'});
const context={familyId:'family-main',actor:{userId:'account-1',role:'family_admin',personId:'person-1'},correlationId:'corr-136'};
const scope={
  get occurredAt(){return now;},
  findResource:(type,id)=>({ok:true,value:resources.get(key(type,id))??null}),
  findPolicy:(id)=>({ok:true,value:policies.get(id)??null}),
  findLifecycle:(type,id)=>({ok:true,value:records.get(key(type,id))??null}),
  authorize:()=>({ok:true,value:authorized}),
  insertPolicy:(policy)=>{policies.set(policy.id,policy);return {ok:true,value:undefined};},
  upsertLifecycle:(record)=>{records.set(key(record.resourceType,record.resourceId),record);return {ok:true,value:undefined};},
  purgeResource:(type,id)=>{const exists=resources.delete(key(type,id));if(exists)purges+=1;return {ok:true,value:exists};},
  appendAudit:(entry)=>{audits.push(entry);return {ok:true,value:entry.id};},
  enqueueEvent:(event)=>{events.push(event);return {ok:true,value:undefined};}
};
const unit={execute:(_context,operation)=>operation(scope)};
const strongAuth={verify:(_context,input)=>{authChecks+=1;return input.password==='correct-password'?{ok:true,value:undefined}:{ok:false,error:{message:'bad credentials'}};}};
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const expectOk=(result)=>{assert.equal(result.ok,true);return result.value;};
const expectFail=(result)=>assert.equal(result.ok,false);

const createPolicy=new lifecycle.CreateDataRetentionPolicyUseCase(unit);
const archive=new lifecycle.ArchiveDataResourceUseCase(unit);
const restore=new lifecycle.RestoreDataResourceUseCase(unit);
const requestPurge=new lifecycle.RequestDataPurgeUseCase(unit,strongAuth);
const cancelPurge=new lifecycle.CancelDataPurgeUseCase(unit);
const executePurge=new lifecycle.ExecuteDataPurgeUseCase(unit,strongAuth);
const legalHold=new lifecycle.SetDataLegalHoldUseCase(unit,strongAuth);

check('invalid policy rejected',()=>expectFail(createPolicy.execute({context,command:{name:'x',resourceTypes:[],retentionDays:0,graceDays:0},identifiers:{policyId:'p0',auditId:'a0'}})));
const policy=expectOk(createPolicy.execute({context,command:{name:'Finans saklama',resourceTypes:['finance_record'],retentionDays:10,graceDays:3,requiresStrongAuth:true},identifiers:{policyId:'policy-1',auditId:'audit-policy'}}));
check('policy created',()=>assert.equal(policy.id,'policy-1'));
check('policy audit written',()=>assert.equal(audits.at(-1).action,'data.retention_policy_created'));
const archived=expectOk(archive.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',policyId:'policy-1'},identifiers:{auditId:'audit-archive',outboxEventId:'event-archive'}}));
check('record archived',()=>assert.equal(archived.state,'archived'));
check('retention eligibility calculated',()=>assert.equal(archived.purgeEligibleAt,'2026-08-07T00:00:00.000Z'));
check('archive event queued',()=>assert.equal(events.at(-1).eventType,'data.resource.archived'));
const restored=expectOk(restore.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1'},identifiers:{auditId:'audit-restore',outboxEventId:'event-restore'}}));
check('archived record restored',()=>assert.equal(restored.state,'active'));
check('restore clears archive timestamp',()=>assert.equal('archivedAt' in restored,false));
expectOk(archive.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',policyId:'policy-1'},identifiers:{auditId:'audit-archive-2',outboxEventId:'event-archive-2'}}));
check('request before retention rejected',()=>expectFail(requestPurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'KALICI İMHA finance_record/finance-1'},identifiers:{auditId:'audit-request-early'}})));
now='2026-08-08T00:00:00.000Z';
const authBeforeWrong=authChecks;
check('incorrect confirmation rejected before strong auth',()=>expectFail(requestPurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'yanlış'},identifiers:{auditId:'audit-request-wrong'}})));
check('wrong confirmation did not invoke authentication',()=>assert.equal(authChecks,authBeforeWrong));
const scheduled=expectOk(requestPurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'KALICI İMHA finance_record/finance-1'},identifiers:{auditId:'audit-request'}}));
check('purge request scheduled',()=>assert.equal(scheduled.state,'purge_scheduled'));
check('grace window calculated',()=>assert.equal(scheduled.purgeExecuteAfter,'2026-08-11T00:00:00.000Z'));
check('strong authentication used for request',()=>assert.equal(authChecks,authBeforeWrong+1));
check('execution before grace rejected',()=>expectFail(executePurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'GERİ ALINAMAZ İMHA finance_record/finance-1'},identifiers:{auditId:'audit-execute-early',outboxEventId:'event-execute-early'}})));
const cancelled=expectOk(cancelPurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1'},identifiers:{auditId:'audit-cancel'}}));
check('scheduled purge cancelled',()=>assert.equal(cancelled.state,'archived'));
check('cancel clears execution timestamp',()=>assert.equal('purgeExecuteAfter' in cancelled,false));
const held=expectOk(legalHold.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',enabled:true,reason:'Mahkeme kararı bekleniyor',password:'correct-password'},identifiers:{auditId:'audit-hold'}}));
check('legal hold enabled',()=>assert.equal(held.legalHold,true));
check('legal hold blocks purge request',()=>expectFail(requestPurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'KALICI İMHA finance_record/finance-1'},identifiers:{auditId:'audit-held-request'}})));
const unheld=expectOk(legalHold.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',enabled:false,reason:'',password:'correct-password'},identifiers:{auditId:'audit-unhold'}}));
check('legal hold disabled without fake reason',()=>assert.equal(unheld.legalHold,false));
check('disabled hold removes reason',()=>assert.equal('holdReason' in unheld,false));
expectOk(requestPurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'KALICI İMHA finance_record/finance-1'},identifiers:{auditId:'audit-request-final'}}));
now='2026-08-12T00:00:00.000Z';
authorized=false;
check('object authorization still blocks purge',()=>expectFail(executePurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'GERİ ALINAMAZ İMHA finance_record/finance-1'},identifiers:{auditId:'audit-denied',outboxEventId:'event-denied'}})));
authorized=true;
const purged=expectOk(executePurge.execute({context,command:{resourceType:'finance_record',resourceId:'finance-1',password:'correct-password',confirmation:'GERİ ALINAMAZ İMHA finance_record/finance-1'},identifiers:{auditId:'audit-purged',outboxEventId:'event-purged'}}));
check('live resource permanently removed',()=>assert.equal(resources.has(key('finance_record','finance-1')),false));
check('purge called exactly once',()=>assert.equal(purges,1));
check('purged tombstone retained',()=>assert.equal(purged.state,'purged'));
check('tombstone retains owner for authorization',()=>assert.equal(purged.ownerPersonId,'person-1'));
check('tombstone retains privacy',()=>assert.equal(purged.privacy,'private'));
check('backup propagation warning set',()=>assert.equal(purged.backupPropagationPending,true));
check('purge event queued',()=>assert.equal(events.at(-1).eventType,'data.resource.purged'));
check('purge audit written',()=>assert.equal(audits.at(-1).action,'data.resource_purged'));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:136,applicationVersion:'28.07.2026.136',packageVersion:'28.7.2026-136',stage:'Bronze RC2 Active Development',scope:'Recoverable archive, retention eligibility, reversible purge scheduling, legal hold, exact confirmations, strong authentication, authorization and purge tombstone governance',status:'PASS',assertions:checks.length,scenarios:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 136 data lifecycle runtime: PASS (${checks.length}/${checks.length})`);
