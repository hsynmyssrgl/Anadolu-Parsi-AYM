import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp=join(process.cwd(),'.tmp','build190-clean-rewrite-terminal-chronology-runtime');
const out=resolve(process.argv[2]??'artifacts/validation/build190-clean-rewrite-terminal-chronology-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/automatic-clean-backup-rewrite-service.ts','utf8');
const modulePath=join(tmp,'service.mjs');
await writeFile(modulePath,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {AutomaticCleanBackupRewriteService}=await import(pathToFileURL(modulePath).href);

const start='2026-07-31T03:00:00.000Z';
const basePolicy=()=>({id:'default',enabled:true,retentionDays:30,manualFailureBackoffMinutes:60,automaticFailureBackoffMinutes:360,highLoadDeferMinutes:30,state:'idle',consecutiveFailures:0,lastOutcome:'never',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:start});
class FakeStore{
  constructor({deferred=false,targets=1,throwError=false,partial=false}={}){this.policy=basePolicy();this.deferred=deferred;this.targets=targets;this.throwError=throwError;this.partial=partial;this.runs=[];this.diagnostics=[];this.claimCount=0;this.completeCount=0;}
  getBackupCleanRewriteStatus(at){return{policy:{...this.policy},pendingRecords:1,dueRecords:1,enabledTargets:this.targets,adaptiveDeferred:this.deferred,...(this.deferred?{adaptiveReason:'CPU %91'}:{}),checkedAt:at};}
  getBackupCleanRewritePolicy(){return{...this.policy};}
  listBackupCleanRewriteRuns(limit=20){return this.runs.slice(0,limit).map(item=>({...item}));}
  updateBackupCleanRewritePolicy(input){this.policy={...this.policy,enabled:input.enabled,retentionDays:input.retentionDays};return this.getBackupCleanRewritePolicy();}
  claimBackupCleanRewrite(input){this.claimCount+=1;if(this.policy.state==='running')return null;this.policy={...this.policy,state:'running',lastTrigger:input.trigger,lastAttemptAt:input.startedAt,inProgressRunId:input.runId,inProgressStartedAt:input.startedAt,updatedAt:input.startedAt};this.runs.unshift({id:input.runId,trigger:input.trigger,status:'running',retentionCutoff:input.retentionCutoff,dueRecords:input.dueRecords,enabledTargets:input.enabledTargets,startedAt:input.startedAt,updatedAt:input.startedAt});return this.getBackupCleanRewritePolicy();}
  completeBackupCleanRewrite(input){this.completeCount+=1;if(this.policy.inProgressRunId!==input.runId)return null;const index=this.runs.findIndex(item=>item.id===input.runId&&item.status==='running');if(index<0)return null;this.policy={...this.policy,state:input.state,lastOutcome:input.outcome,nextAttemptAt:input.nextAttemptAt,lastError:input.error,inProgressRunId:undefined,inProgressStartedAt:undefined,updatedAt:input.completedAt};const run={...this.runs[index],status:input.runStatus,nextAttemptAt:input.nextAttemptAt,error:input.error,propagationRunId:input.propagationRunId,completedAt:input.completedAt,updatedAt:input.completedAt};this.runs[index]=run;return{policy:this.getBackupCleanRewritePolicy(),run:{...run}};}
  recoverInterruptedBackupCleanRewrite(observedAt,error){if(this.policy.state==='running'){const run=this.runs.find(item=>item.id===this.policy.inProgressRunId);const floor=Math.max(Date.parse(observedAt),Date.parse(this.policy.updatedAt),Date.parse(run?.updatedAt??observedAt));const recoveredAt=new Date(floor).toISOString();const nextAttemptAt=new Date(floor+360*60_000).toISOString();if(run)Object.assign(run,{status:'interrupted',nextAttemptAt,error,completedAt:recoveredAt,updatedAt:recoveredAt});this.policy={...this.policy,state:'backoff',lastOutcome:'failed',nextAttemptAt,lastError:error,inProgressRunId:undefined,inProgressStartedAt:undefined,updatedAt:recoveredAt};}return this.getBackupCleanRewritePolicy();}
  propagatePurgedDataToManagedBackups(){if(this.throwError)throw new Error('simulated propagation failure');return{id:'prop-190',status:this.partial?'attention':'success',pendingRecords:1,targetCount:1,refreshedTargets:this.partial?0:1,quarantinedArtifacts:0,pendingRemaining:this.partial?1:0,manualBackupWarning:false,targetResults:[],...(this.partial?{error:'partial'}:{}),startedAt:'2026-07-31T03:00:01.000Z',completedAt:'2026-07-31T03:00:09.000Z'};}
  recordDiagnostic(severity,code,message,details){this.diagnostics.push({severity,code,message,details});}
}
const sequence=(values)=>{let i=0;const fn=()=>{const value=values[Math.min(i,values.length-1)];i+=1;if(value instanceof Error)throw value;return value;};fn.calls=()=>i;return fn;};
const wall=(values)=>{let i=0;const fn=()=>{const value=values[Math.min(i,values.length-1)];i+=1;return value;};fn.calls=()=>i;return fn;};
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let store=new FakeStore({deferred:true});let now=wall([start,'2036-01-01T00:00:00.000Z']);let mono=sequence([1000,4000]);let service=new AutomaticCleanBackupRewriteService(()=>store,now,mono);let result=service.runAutomaticCycle();
check('deferred result',()=>assert.equal(result.status,'deferred'));
check('deferred completion uses monotonic elapsed',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T03:00:03.000Z'));
check('deferred retry anchors to monotonic completion',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T03:30:03.000Z'));
check('deferred ignores forward wall jump',()=>assert.equal(now.calls(),1));

store=new FakeStore({targets:0});now=wall([start,'2020-01-01T00:00:00.000Z']);mono=sequence([2000,7000]);service=new AutomaticCleanBackupRewriteService(()=>store,now,mono);result=service.runAutomaticCycle();
check('attention result',()=>assert.equal(result.status,'attention'));
check('attention completion uses elapsed five seconds',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T03:00:05.000Z'));
check('attention retry uses monotonic completion',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T09:00:05.000Z'));
check('attention ignores backward wall jump',()=>assert.equal(now.calls(),1));

store=new FakeStore({throwError:true});now=wall([start,'2040-01-01T00:00:00.000Z']);mono=sequence([3000,10000]);service=new AutomaticCleanBackupRewriteService(()=>store,now,mono);result=service.runManual();
check('manual failure result',()=>assert.equal(result.status,'failed'));
check('manual failure completion uses elapsed seven seconds',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T03:00:07.000Z'));
check('manual failure retry is sixty minutes after monotonic completion',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T04:00:07.000Z'));

store=new FakeStore({throwError:true});mono=sequence([5000,14000]);service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono);result=service.runAutomaticCycle();
check('automatic failure completion uses elapsed nine seconds',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T03:00:09.000Z'));
check('automatic failure retry is six hours after completion',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T09:00:09.000Z'));

store=new FakeStore();mono=sequence([100,999999]);service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono);result=service.runAutomaticCycle();
check('success remains linked to propagation completion',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T03:00:09.000Z'));
check('success does not consume terminal monotonic read',()=>assert.equal(mono.calls(),1));

store=new FakeStore({partial:true});mono=sequence([100,999999]);service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono);result=service.runAutomaticCycle();
check('partial remains linked to propagation completion',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T03:00:09.000Z'));
check('partial retry anchors to propagation completion',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T09:00:09.000Z'));
check('partial does not consume terminal monotonic read',()=>assert.equal(mono.calls(),1));

for(const [label,value] of [['NaN',Number.NaN],['negative',-1]]){
  store=new FakeStore({deferred:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,()=>value);
  assert.throws(()=>service.runAutomaticCycle(),/monotonik zamanı geçersizdir/);checks.push(`${label} monotonic start denied`);
  check(`${label} start does not claim`,()=>assert.equal(store.claimCount,0));
  check(`${label} start diagnostic`,()=>assert.equal(store.diagnostics.at(-1).code,'backup.clean_rewrite_monotonic_start_invalid'));
}
store=new FakeStore({deferred:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,()=>{throw new Error('clock unavailable');});assert.throws(()=>service.runAutomaticCycle(),/clock unavailable/);checks.push('throwing monotonic start denied');check('throwing start does not claim',()=>assert.equal(store.claimCount,0));

store=new FakeStore({deferred:true});mono=sequence([1000,999,999]);service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono);assert.throws(()=>service.runAutomaticCycle(),/geriye gidemez/);checks.push('backward terminal monotonic denied');check('backward terminal leaves durable running owner',()=>assert.equal(store.policy.state,'running'));check('backward terminal prevents completion',()=>assert.equal(store.completeCount,0));check('backward terminal diagnostic',()=>assert.equal(store.diagnostics.at(-1).code,'backup.clean_rewrite_terminal_chronology_invalid'));const recovered=service.recoverInterrupted();check('interrupted recovery clears monotonic failure owner',()=>assert.equal(recovered.state,'backoff'));

store=new FakeStore({targets:0});mono=sequence([1000,Number.NaN,Number.NaN]);service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono);assert.throws(()=>service.runAutomaticCycle(),/monotonik zamanı geçersizdir/);checks.push('NaN terminal monotonic denied');check('NaN terminal prevents completion',()=>assert.equal(store.completeCount,0));

assert.equal(checks.length,33);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:190,stage:'Bronze RC2 Active Development',scope:'Monotonic terminal chronology for deferred, attention and failed clean-backup rewrite paths',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});console.log(`Build 190 clean rewrite terminal chronology runtime: PASS (${checks.length}/${checks.length})`);
