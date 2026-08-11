import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp=join(process.cwd(),'.tmp','build191-clean-rewrite-trigger-aware-backoff-runtime');
const out=resolve(process.argv[2]??'artifacts/validation/build191-clean-rewrite-trigger-aware-backoff-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/automatic-clean-backup-rewrite-service.ts','utf8');
const modulePath=join(tmp,'service.mjs');
await writeFile(modulePath,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {AutomaticCleanBackupRewriteService}=await import(pathToFileURL(modulePath).href);

const start='2026-07-31T04:00:00.000Z';
const basePolicy=()=>({id:'default',enabled:true,retentionDays:30,manualFailureBackoffMinutes:60,automaticFailureBackoffMinutes:360,highLoadDeferMinutes:30,state:'idle',consecutiveFailures:0,lastOutcome:'never',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:start});
class FakeStore{
  constructor({targets=1,partial=false,throwError=false,deferred=false}={}){this.policy=basePolicy();this.targets=targets;this.partial=partial;this.throwError=throwError;this.deferred=deferred;this.runs=[];this.diagnostics=[];}
  getBackupCleanRewriteStatus(at){return{policy:{...this.policy},pendingRecords:1,dueRecords:1,enabledTargets:this.targets,adaptiveDeferred:this.deferred,...(this.deferred?{adaptiveReason:'CPU %92'}:{}),checkedAt:at};}
  getBackupCleanRewritePolicy(){return{...this.policy};}
  listBackupCleanRewriteRuns(limit=20){return this.runs.slice(0,limit).map(item=>({...item}));}
  updateBackupCleanRewritePolicy(input){this.policy={...this.policy,enabled:input.enabled,retentionDays:input.retentionDays};return this.getBackupCleanRewritePolicy();}
  claimBackupCleanRewrite(input){if(this.policy.state==='running')return null;this.policy={...this.policy,state:'running',lastTrigger:input.trigger,lastAttemptAt:input.startedAt,inProgressRunId:input.runId,inProgressStartedAt:input.startedAt,updatedAt:input.startedAt,nextAttemptAt:undefined};const run={id:input.runId,trigger:input.trigger,status:'running',retentionCutoff:input.retentionCutoff,dueRecords:input.dueRecords,enabledTargets:input.enabledTargets,startedAt:input.startedAt,updatedAt:input.startedAt};this.runs.unshift(run);return this.getBackupCleanRewritePolicy();}
  completeBackupCleanRewrite(input){if(this.policy.inProgressRunId!==input.runId)return null;const index=this.runs.findIndex(item=>item.id===input.runId&&item.status==='running');if(index<0)return null;this.policy={...this.policy,state:input.state,lastOutcome:input.outcome,nextAttemptAt:input.nextAttemptAt,lastError:input.error,inProgressRunId:undefined,inProgressStartedAt:undefined,updatedAt:input.completedAt};const run={...this.runs[index],status:input.runStatus,nextAttemptAt:input.nextAttemptAt,error:input.error,propagationRunId:input.propagationRunId,completedAt:input.completedAt,updatedAt:input.completedAt};this.runs[index]=run;return{policy:this.getBackupCleanRewritePolicy(),run:{...run}};}
  recoverInterruptedBackupCleanRewrite(observedAt,error){return this.policy;}
  propagatePurgedDataToManagedBackups(){if(this.throwError)throw new Error('disk failure');return{id:'prop-191',status:this.partial?'attention':'success',pendingRecords:1,targetCount:1,refreshedTargets:this.partial?0:1,quarantinedArtifacts:0,pendingRemaining:this.partial?1:0,manualBackupWarning:false,targetResults:[],...(this.partial?{error:'partial target failure'}:{}),startedAt:'2026-07-31T04:00:01.000Z',completedAt:'2026-07-31T04:00:10.000Z'};}
  recordDiagnostic(severity,code,message,details){this.diagnostics.push({severity,code,message,details});}
}
const mono=(values)=>{let i=0;return()=>values[Math.min(i++,values.length-1)];};
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let store=new FakeStore({targets:0});let service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([100,5100]));let result=service.runManual();
check('manual no-target returns attention',()=>assert.equal(result.status,'attention'));
check('manual no-target completion is monotonic',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:05.000Z'));
check('manual no-target retry is sixty minutes',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T05:00:05.000Z'));
check('manual no-target ledger trigger retained',()=>assert.equal(result.rewriteRun.trigger,'manual'));

store=new FakeStore({targets:0});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([200,6200]));result=service.runAutomaticCycle();
check('automatic no-target returns attention',()=>assert.equal(result.status,'attention'));
check('automatic no-target completion is monotonic',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:06.000Z'));
check('automatic no-target retry is six hours',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T10:00:06.000Z'));
check('automatic no-target ledger trigger retained',()=>assert.equal(result.rewriteRun.trigger,'automatic'));

store=new FakeStore({partial:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([300]));result=service.runManual();
check('manual partial returns failed surface state',()=>assert.equal(result.status,'failed'));
check('manual partial completion remains propagation authoritative',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:10.000Z'));
check('manual partial retry is sixty minutes',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T05:00:10.000Z'));

store=new FakeStore({partial:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([400]));result=service.runAutomaticCycle();
check('automatic partial completion remains propagation authoritative',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:10.000Z'));
check('automatic partial retry is six hours',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T10:00:10.000Z'));

store=new FakeStore({throwError:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([500,7500]));result=service.runManual();
check('manual failure completion is monotonic',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:07.000Z'));
check('manual failure retry is sixty minutes',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T05:00:07.000Z'));

store=new FakeStore({throwError:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([600,8600]));result=service.runAutomaticCycle();
check('automatic failure completion is monotonic',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:08.000Z'));
check('automatic failure retry is six hours',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T10:00:08.000Z'));

store=new FakeStore({deferred:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([700,9700]));result=service.runManual();
check('manual deferred uses high-load policy',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T04:30:09.000Z'));
check('deferred delay is trigger independent',()=>assert.equal(Date.parse(result.policy.nextAttemptAt)-Date.parse(result.rewriteRun.completedAt),30*60_000));

store=new FakeStore();service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([800]));result=service.runManual();
check('success has no retry',()=>assert.equal(result.policy.nextAttemptAt,undefined));
check('success completion remains propagation authoritative',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T04:00:10.000Z'));

assert.equal(checks.length,21);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:191,stage:'Bronze RC2 Active Development',scope:'Trigger-aware clean-backup rewrite retry policy for manual and automatic runs',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 191 clean rewrite trigger-aware backoff runtime: PASS (${checks.length}/${checks.length})`);
