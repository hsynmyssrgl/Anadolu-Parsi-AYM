import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd();
const tmp=join(root,'.tmp','build187-clean-rewrite-recovery-chronology-runtime');
const reportPath=resolve(process.argv[2]??'artifacts/validation/build187-clean-rewrite-recovery-chronology-runtime.json');
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const ts=(await import(pathToFileURL(join(globalRoot,'typescript','lib','typescript.js')).href)).default;
const source=await readFile('apps/desktop/src/main/automatic-clean-backup-rewrite-service.ts','utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
const modulePath=join(tmp,'service.mjs');await writeFile(modulePath,transpiled.outputText);
const {AutomaticCleanBackupRewriteService}=await import(pathToFileURL(modulePath).href);

const basePolicy=()=>({id:'default',enabled:true,retentionDays:30,manualFailureBackoffMinutes:60,automaticFailureBackoffMinutes:360,highLoadDeferMinutes:30,state:'idle',consecutiveFailures:0,lastOutcome:'never',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:'2026-07-01T00:00:00.000Z'});
class FakeStore{
  constructor(){this.policy=basePolicy();this.recoverCalls=[];this.diagnostics=[];}
  getBackupCleanRewriteStatus(at){return{policy:{...this.policy},pendingRecords:1,dueRecords:1,enabledTargets:1,adaptiveDeferred:false,checkedAt:at};}
  getBackupCleanRewritePolicy(){return{...this.policy};}
  listBackupCleanRewriteRuns(){return[];}
  updateBackupCleanRewritePolicy(){return this.getBackupCleanRewritePolicy();}
  claimBackupCleanRewrite(input){if(this.policy.state==='running'||(this.policy.nextAttemptAt&&this.policy.nextAttemptAt>input.startedAt))return null;this.policy={...this.policy,state:'running',lastTrigger:input.trigger,lastAttemptAt:input.startedAt,nextAttemptAt:undefined,inProgressRunId:input.runId,inProgressStartedAt:input.startedAt,updatedAt:input.startedAt};return this.getBackupCleanRewritePolicy();}
  completeBackupCleanRewrite(){throw new Error('not used');}
  recoverInterruptedBackupCleanRewrite(observedAt,error){
    this.recoverCalls.push({observedAt,error});
    if(this.policy.state!=='running')return this.getBackupCleanRewritePolicy();
    const startedAt=this.policy.inProgressStartedAt??observedAt;
    const recoveredAt=new Date(Math.max(Date.parse(observedAt),Date.parse(startedAt))).toISOString();
    const nextAttemptAt=new Date(Date.parse(recoveredAt)+360*60_000).toISOString();
    this.policy={...this.policy,state:'backoff',lastOutcome:'failed',consecutiveFailures:this.policy.consecutiveFailures+1,nextAttemptAt,lastError:error,inProgressRunId:undefined,inProgressStartedAt:undefined,updatedAt:recoveredAt};
    return this.getBackupCleanRewritePolicy();
  }
  propagatePurgedDataToManagedBackups(){throw new Error('not used');}
  recordDiagnostic(severity,code,message,details){this.diagnostics.push({severity,code,message,details});}
}
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
let store=new FakeStore();let service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T12:00:00.000Z');
check('idle recovery is a no-op',()=>assert.equal(service.recoverInterrupted().state,'idle'));
check('idle recovery does not call store',()=>assert.equal(store.recoverCalls.length,0));
check('idle recovery does not emit diagnostic',()=>assert.equal(store.diagnostics.length,0));

store=new FakeStore();store.policy={...basePolicy(),state:'running',inProgressRunId:'run-normal',inProgressStartedAt:'2026-07-30T12:00:00.000Z',updatedAt:'2026-07-30T12:00:00.000Z'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T12:05:00.000Z');const normal=service.recoverInterrupted();
check('normal recovery enters backoff',()=>assert.equal(normal.state,'backoff'));
check('normal recovery uses observed completion',()=>assert.equal(normal.updatedAt,'2026-07-30T12:05:00.000Z'));
check('normal recovery derives six-hour backoff',()=>assert.equal(normal.nextAttemptAt,'2026-07-30T18:05:00.000Z'));
check('normal recovery clears owner',()=>assert.equal(normal.inProgressRunId,undefined));
check('normal recovery passes only observed time and error',()=>assert.deepEqual(Object.keys(store.recoverCalls[0]).sort(),['error','observedAt']));
check('normal recovery diagnostic code',()=>assert.equal(store.diagnostics.at(-1).code,'backup.clean_rewrite_recovered'));

store=new FakeStore();store.policy={...basePolicy(),state:'running',inProgressRunId:'run-backward',inProgressStartedAt:'2026-07-30T12:00:00.000Z',updatedAt:'2026-07-30T12:00:00.000Z'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T10:00:00.000Z');const backward=service.recoverInterrupted();
check('backward clock recovery still exits running',()=>assert.equal(backward.state,'backoff'));
check('backward clock floors completion to persisted start',()=>assert.equal(backward.updatedAt,'2026-07-30T12:00:00.000Z'));
check('backward clock backoff starts from persisted start',()=>assert.equal(backward.nextAttemptAt,'2026-07-30T18:00:00.000Z'));
check('backward clock diagnostic is explicit',()=>assert.equal(store.diagnostics.at(-1).code,'backup.clean_rewrite_recovered_clock_adjusted'));
check('backward clock diagnostic includes observed time',()=>assert.match(store.diagnostics.at(-1).details,/2026-07-30T10:00:00.000Z/));
check('backward clock diagnostic includes persisted start',()=>assert.match(store.diagnostics.at(-1).details,/2026-07-30T12:00:00.000Z/));
check('second recovery after release is no-op',()=>{service.recoverInterrupted();assert.equal(store.recoverCalls.length,1);});

store=new FakeStore();store.policy={...basePolicy(),state:'running',inProgressRunId:'run-invalid-observed',inProgressStartedAt:'2026-07-30T12:00:00.000Z'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> 'invalid');
check('invalid observed time fails closed',()=>assert.throws(()=>service.recoverInterrupted(),/gözlem zamanı geçersiz/));
check('invalid observed time never calls store',()=>assert.equal(store.recoverCalls.length,0));

store=new FakeStore();store.policy={...basePolicy(),state:'running',inProgressRunId:'run-invalid-start',inProgressStartedAt:'invalid'};service=new AutomaticCleanBackupRewriteService(()=>store,()=> '2026-07-30T12:00:00.000Z');
check('invalid persisted start fails closed',()=>assert.throws(()=>service.recoverInterrupted(),/(?:kalıcı kronoloji|çalışma başlangıç) zamanı geçersiz/));
check('invalid persisted start never calls store',()=>assert.equal(store.recoverCalls.length,0));

assert.equal(checks.length,20);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:187,stage:'Bronze RC2 Active Development',scope:'Restart-safe clean-backup rewrite recovery chronology',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 187 clean rewrite recovery chronology runtime: PASS (${checks.length}/${checks.length})`);
