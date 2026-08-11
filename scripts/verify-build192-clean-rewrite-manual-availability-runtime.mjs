import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tmp=join(process.cwd(),'.tmp','build192-clean-rewrite-manual-availability-runtime');
const out=resolve(process.argv[2]??'artifacts/validation/build192-clean-rewrite-manual-availability-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/automatic-clean-backup-rewrite-service.ts','utf8');
const modulePath=join(tmp,'service.mjs');
await writeFile(modulePath,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {AutomaticCleanBackupRewriteService}=await import(pathToFileURL(modulePath).href);

const start='2026-07-31T05:00:00.000Z';
const basePolicy=(enabled=false)=>({id:'default',enabled,retentionDays:30,manualFailureBackoffMinutes:60,automaticFailureBackoffMinutes:360,highLoadDeferMinutes:30,state:'idle',consecutiveFailures:0,lastOutcome:'never',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:start});
class FakeStore{
  constructor({enabled=false,targets=1,deferred=false,throwError=false,nextAttemptAt}={}){this.policy={...basePolicy(enabled),...(nextAttemptAt?{state:'backoff',lastOutcome:'failed',lastTrigger:'manual',nextAttemptAt}: {})};this.targets=targets;this.deferred=deferred;this.throwError=throwError;this.runs=[];this.claims=0;this.diagnostics=[];}
  getBackupCleanRewriteStatus(at){return{policy:{...this.policy},pendingRecords:1,dueRecords:1,enabledTargets:this.targets,adaptiveDeferred:this.deferred,...(this.deferred?{adaptiveReason:'CPU %91'}:{}),checkedAt:at};}
  getBackupCleanRewritePolicy(){return{...this.policy};}
  listBackupCleanRewriteRuns(limit=20){return this.runs.slice(0,limit).map(run=>({...run}));}
  updateBackupCleanRewritePolicy(input){this.policy={...this.policy,enabled:input.enabled,retentionDays:input.retentionDays};return this.getBackupCleanRewritePolicy();}
  claimBackupCleanRewrite(input){this.claims++;if(input.trigger==='automatic'&&!this.policy.enabled)return null;if(this.policy.state==='running')return null;if(this.policy.nextAttemptAt&&Date.parse(this.policy.nextAttemptAt)>Date.parse(input.startedAt))return null;this.policy={...this.policy,state:'running',lastTrigger:input.trigger,lastAttemptAt:input.startedAt,nextAttemptAt:undefined,lastError:undefined,inProgressRunId:input.runId,inProgressStartedAt:input.startedAt,updatedAt:input.startedAt};const run={id:input.runId,trigger:input.trigger,status:'running',retentionCutoff:input.retentionCutoff,dueRecords:input.dueRecords,enabledTargets:input.enabledTargets,startedAt:input.startedAt,updatedAt:input.startedAt};this.runs.unshift(run);return this.getBackupCleanRewritePolicy();}
  completeBackupCleanRewrite(input){if(this.policy.inProgressRunId!==input.runId)return null;const index=this.runs.findIndex(run=>run.id===input.runId&&run.status==='running');if(index<0)return null;this.policy={...this.policy,state:input.state,lastOutcome:input.outcome,nextAttemptAt:input.nextAttemptAt,lastError:input.error,inProgressRunId:undefined,inProgressStartedAt:undefined,updatedAt:input.completedAt};const run={...this.runs[index],status:input.runStatus,nextAttemptAt:input.nextAttemptAt,error:input.error,propagationRunId:input.propagationRunId,completedAt:input.completedAt,updatedAt:input.completedAt};this.runs[index]=run;return{policy:this.getBackupCleanRewritePolicy(),run:{...run}};}
  recoverInterruptedBackupCleanRewrite(){return this.getBackupCleanRewritePolicy();}
  propagatePurgedDataToManagedBackups(){if(this.throwError)throw new Error('disk failure');return{id:'prop-192',status:'success',pendingRecords:1,targetCount:1,refreshedTargets:1,quarantinedArtifacts:0,pendingRemaining:0,manualBackupWarning:false,targetResults:[],startedAt:'2026-07-31T05:00:01.000Z',completedAt:'2026-07-31T05:00:10.000Z'};}
  recordDiagnostic(severity,code,message,details){this.diagnostics.push({severity,code,message,details});}
}
const mono=(values)=>{let i=0;return()=>values[Math.min(i++,values.length-1)];};
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};

let monotonicCalls=0;let store=new FakeStore({enabled:false});let service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,()=>{monotonicCalls++;return 100;});let result=service.runAutomaticCycle();
check('disabled automatic cycle is skipped',()=>assert.equal(result.status,'skipped'));
check('disabled automatic cycle explains automatic policy',()=>assert.match(result.reason,/Otomatik temiz yedek/));
check('disabled automatic cycle never claims',()=>assert.equal(store.claims,0));
check('disabled automatic cycle never reads monotonic clock',()=>assert.equal(monotonicCalls,0));

store=new FakeStore({enabled:false});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([100]));result=service.runManual();
check('disabled policy permits manual success',()=>assert.equal(result.status,'success'));
check('manual success keeps automatic policy disabled',()=>assert.equal(result.policy.enabled,false));
check('manual success ledger trigger retained',()=>assert.equal(result.rewriteRun.trigger,'manual'));
check('manual success has no retry',()=>assert.equal(result.policy.nextAttemptAt,undefined));
check('manual success uses propagation completion',()=>assert.equal(result.rewriteRun.completedAt,'2026-07-31T05:00:10.000Z'));

store=new FakeStore({enabled:false,targets:0});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([200,5200]));result=service.runManual();
check('disabled policy permits manual attention',()=>assert.equal(result.status,'attention'));
check('manual attention keeps automatic policy disabled',()=>assert.equal(result.policy.enabled,false));
check('manual attention backs off sixty minutes',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T06:00:05.000Z'));

store=new FakeStore({enabled:false,deferred:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([300,6300]));result=service.runManual();
check('disabled policy permits manual high-load defer',()=>assert.equal(result.status,'deferred'));
check('manual defer keeps automatic policy disabled',()=>assert.equal(result.policy.enabled,false));
check('manual defer remains thirty minutes',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T05:30:06.000Z'));

store=new FakeStore({enabled:false,throwError:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([400,7400]));result=service.runManual();
check('disabled policy permits manual failure ledger',()=>assert.equal(result.status,'failed'));
check('manual failure keeps automatic policy disabled',()=>assert.equal(result.policy.enabled,false));
check('manual failure backs off sixty minutes',()=>assert.equal(result.policy.nextAttemptAt,'2026-07-31T06:00:07.000Z'));

store=new FakeStore({enabled:false,nextAttemptAt:'2026-07-31T06:00:00.000Z'});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([500]));result=service.runManual();
check('disabled manual run still respects backoff',()=>assert.equal(result.status,'skipped'));
check('backoff denial preserves policy state',()=>assert.equal(result.policy.state,'backoff'));

store=new FakeStore({enabled:true});service=new AutomaticCleanBackupRewriteService(()=>store,()=>start,mono([600]));result=service.runAutomaticCycle();
check('enabled automatic cycle remains available',()=>assert.equal(result.status,'success'));
check('enabled automatic ledger trigger retained',()=>assert.equal(result.rewriteRun.trigger,'automatic'));

assert.equal(checks.length,22);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:192,stage:'Bronze RC2 Active Development',scope:'Manual clean-backup rewrite availability while automatic scheduling is disabled',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,`${JSON.stringify(report,null,2)}\n`);await rm(tmp,{recursive:true,force:true});
console.log(`Build 192 clean rewrite manual availability runtime: PASS (${checks.length}/${checks.length})`);
