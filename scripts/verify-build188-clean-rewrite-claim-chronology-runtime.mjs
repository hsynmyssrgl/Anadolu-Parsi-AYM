import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build188-clean-rewrite-claim-chronology-runtime');
const reportPath=resolve(process.argv[2]??'artifacts/validation/build188-clean-rewrite-claim-chronology-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/automatic-clean-backup-rewrite-service.ts','utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const modulePath=join(tmp,'service.mjs');await writeFile(modulePath,transpiled.outputText);
const {AutomaticCleanBackupRewriteService}=await import(pathToFileURL(modulePath).href);

const basePolicy=()=>({id:'default',enabled:true,retentionDays:30,manualFailureBackoffMinutes:60,automaticFailureBackoffMinutes:360,highLoadDeferMinutes:30,state:'idle',consecutiveFailures:0,lastOutcome:'success',lastAttemptAt:'2026-07-30T12:00:00.000Z',lastSuccessAt:'2026-07-30T12:00:00.000Z',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-30T12:00:00.000Z'});
class FakeStore{
  constructor(){this.policy=basePolicy();this.statusCalls=[];this.claimCalls=[];this.completeCalls=[];this.diagnostics=[];this.statusFactory=(at)=>({policy:{...this.policy},pendingRecords:1,dueRecords:1,enabledTargets:1,adaptiveDeferred:false,checkedAt:at});this.propagation={id:'prop-188',status:'success',pendingRecords:1,targetCount:1,refreshedTargets:1,quarantinedArtifacts:1,pendingRemaining:0,manualBackupWarning:false,targetResults:[],startedAt:'2026-07-30T12:00:00.000Z',completedAt:'2026-07-30T12:05:00.000Z'};}
  getBackupCleanRewriteStatus(at){this.statusCalls.push(at);return this.statusFactory(at);}
  getBackupCleanRewritePolicy(){return{...this.policy};}
  listBackupCleanRewriteRuns(){return[];}
  updateBackupCleanRewritePolicy(){return this.getBackupCleanRewritePolicy();}
  claimBackupCleanRewrite(input){this.claimCalls.push(input);if(this.policy.state==='running'||(this.policy.nextAttemptAt&&this.policy.nextAttemptAt>input.startedAt))return null;this.policy={...this.policy,state:'running',lastTrigger:input.trigger,lastAttemptAt:input.startedAt,nextAttemptAt:undefined,inProgressRunId:input.runId,inProgressStartedAt:input.startedAt,updatedAt:input.startedAt};return this.getBackupCleanRewritePolicy();}
  completeBackupCleanRewrite(input){this.completeCalls.push(input);this.policy={...this.policy,state:input.state,lastOutcome:input.outcome,nextAttemptAt:input.nextAttemptAt,lastError:input.error,inProgressRunId:undefined,inProgressStartedAt:undefined,updatedAt:input.completedAt,...(input.success?{lastSuccessAt:input.completedAt}:{} )};return{policy:this.getBackupCleanRewritePolicy(),run:{id:input.runId,trigger:'automatic',status:input.runStatus,retentionCutoff:'2026-06-30T12:00:00.000Z',dueRecords:1,enabledTargets:1,...(input.propagationRunId?{propagationRunId:input.propagationRunId}:{}),...(input.nextAttemptAt?{nextAttemptAt:input.nextAttemptAt}:{}),...(input.error?{error:input.error}:{}),startedAt:this.claimCalls.at(-1).startedAt,completedAt:input.completedAt,updatedAt:input.completedAt}};}
  recoverInterruptedBackupCleanRewrite(){throw new Error('not used');}
  propagatePurgedDataToManagedBackups(){const startedAt=this.claimCalls.at(-1)?.startedAt??this.propagation.startedAt;return{...this.propagation,startedAt,completedAt:new Date(Date.parse(startedAt)+5*60_000).toISOString()};}
  recordDiagnostic(severity,code,message,details){this.diagnostics.push({severity,code,message,details});}
}
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
let store=new FakeStore();let nowValues=['2026-07-30T12:10:00.000Z'];let service=new AutomaticCleanBackupRewriteService(()=>store,()=>nowValues[0]);let result=service.runAutomaticCycle();
check('normal claim succeeds',()=>assert.equal(result.status,'success'));
check('normal claim uses observed time',()=>assert.equal(store.claimCalls[0].startedAt,'2026-07-30T12:10:00.000Z'));
check('normal claim uses one status snapshot',()=>assert.deepEqual(store.statusCalls,['2026-07-30T12:10:00.000Z']));
check('normal claim cutoff follows observed safe start',()=>assert.equal(store.claimCalls[0].retentionCutoff,'2026-06-30T12:10:00.000Z'));
check('normal claim emits no clock adjustment diagnostic',()=>assert.equal(store.diagnostics.some(x=>x.code==='backup.clean_rewrite_claim_clock_adjusted'),false));

store=new FakeStore();store.statusFactory=(at)=>({policy:{...store.policy},pendingRecords:1,dueRecords:at==='2026-07-30T12:00:00.000Z'?1:0,enabledTargets:1,adaptiveDeferred:false,checkedAt:at});service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');result=service.runAutomaticCycle();
check('backward clock claim still succeeds',()=>assert.equal(result.status,'success'));
check('backward clock recalculates status at safe floor',()=>assert.deepEqual(store.statusCalls,['2026-07-30T10:00:00.000Z','2026-07-30T12:00:00.000Z']));
check('backward clock claim is floored to persisted chronology',()=>assert.equal(store.claimCalls[0].startedAt,'2026-07-30T12:00:00.000Z'));
check('backward clock cutoff uses safe claim time',()=>assert.equal(store.claimCalls[0].retentionCutoff,'2026-06-30T12:00:00.000Z'));
check('backward clock result exposes safe checked time',()=>assert.equal(result.checkedAt,'2026-07-30T12:05:00.000Z'));
check('backward clock diagnostic is explicit',()=>assert.equal(store.diagnostics.find(x=>x.code==='backup.clean_rewrite_claim_clock_adjusted')?.severity,'warning'));
check('backward clock diagnostic includes observed and safe times',()=>{const d=store.diagnostics.find(x=>x.code==='backup.clean_rewrite_claim_clock_adjusted');assert.match(d.details,/2026-07-30T10:00:00.000Z/);assert.match(d.details,/2026-07-30T12:00:00.000Z/);});

store=new FakeStore();store.policy={...basePolicy(),updatedAt:'2026-07-30T11:00:00.000Z',lastAttemptAt:'2026-07-30T13:00:00.000Z',lastSuccessAt:'2026-07-30T12:30:00.000Z'};store.propagation={...store.propagation,startedAt:'2026-07-30T13:00:00.000Z',completedAt:'2026-07-30T13:05:00.000Z'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');service.runAutomaticCycle();
check('last attempt dominates policy update and success floor',()=>assert.equal(store.claimCalls[0].startedAt,'2026-07-30T13:00:00.000Z'));

store=new FakeStore();store.policy={...basePolicy(),updatedAt:'2026-07-30T11:00:00.000Z',lastAttemptAt:'2026-07-30T12:00:00.000Z',lastSuccessAt:'2026-07-30T14:00:00.000Z'};store.propagation={...store.propagation,startedAt:'2026-07-30T14:00:00.000Z',completedAt:'2026-07-30T14:05:00.000Z'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');service.runAutomaticCycle();
check('last success dominates claim floor',()=>assert.equal(store.claimCalls[0].startedAt,'2026-07-30T14:00:00.000Z'));

store=new FakeStore();store.policy={...basePolicy(),state:'backoff',nextAttemptAt:'2026-07-30T18:00:00.000Z'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');result=service.runAutomaticCycle();
check('clock floor does not bypass future backoff',()=>assert.equal(result.status,'skipped'));
check('backoff claim is attempted only at policy floor',()=>assert.equal(store.claimCalls[0].startedAt,'2026-07-30T12:00:00.000Z'));
check('failed claim emits no clock adjustment diagnostic',()=>assert.equal(store.diagnostics.some(x=>x.code==='backup.clean_rewrite_claim_clock_adjusted'),false));

store=new FakeStore();store.policy={...basePolicy(),updatedAt:'invalid'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');
check('invalid persisted policy update fails closed',()=>assert.throws(()=>service.runAutomaticCycle(),/politika güncelleme zamanı geçersiz/));
check('invalid persisted policy update never claims',()=>assert.equal(store.claimCalls.length,0));

store=new FakeStore();store.policy={...basePolicy(),lastAttemptAt:'invalid'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');
check('invalid last attempt fails closed',()=>assert.throws(()=>service.runAutomaticCycle(),/son deneme zamanı geçersiz/));

store=new FakeStore();store.policy={...basePolicy(),lastSuccessAt:'invalid'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');
check('invalid last success fails closed',()=>assert.throws(()=>service.runAutomaticCycle(),/son başarı zamanı geçersiz/));

store=new FakeStore();store.policy={...basePolicy(),updatedAt:'2026-07-30T12:00:00.000Z'};store.statusFactory=(at)=>({policy:{...store.policy},pendingRecords:1,dueRecords:1,enabledTargets:1,adaptiveDeferred:true,adaptiveReason:'yüksek yük',checkedAt:at});let sequence=['2026-07-30T10:00:00.000Z','2026-07-30T09:00:00.000Z'];service=new AutomaticCleanBackupRewriteService(()=>store,()=>sequence.shift()??'2026-07-30T09:00:00.000Z');result=service.runAutomaticCycle();
check('deferred completion is floored to safe claim start',()=>assert.equal(store.completeCalls[0].completedAt,'2026-07-30T12:00:00.000Z'));
check('deferred retry starts from safe claim completion',()=>assert.equal(store.completeCalls[0].nextAttemptAt,'2026-07-30T12:30:00.000Z'));
check('deferred result exposes safe checked time',()=>assert.equal(result.checkedAt,'2026-07-30T12:00:00.000Z'));

assert.equal(checks.length,24);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:188,stage:'Bronze RC2 Active Development',scope:'Rollback-safe clean-backup rewrite claim chronology',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 188 clean rewrite claim chronology runtime: PASS (${checks.length}/${checks.length})`);
