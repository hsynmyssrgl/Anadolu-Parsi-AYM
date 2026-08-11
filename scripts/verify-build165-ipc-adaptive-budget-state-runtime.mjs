import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root=process.cwd(),tmp=join(root,'.tmp','build165-ipc-adaptive-budget-state'),args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build165-ipc-adaptive-budget-state-runtime.json'));
await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});await writeFile(join(tmp,'package.json'),'\n{"type":"module"}\n');
const ts=(await import(pathToFileURL(join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript','lib','typescript.js')).href)).default;
for(const file of ['ipc-transport-context.ts','ipc-request-lifecycle.ts','ipc-read-sharing.ts','ipc-adaptive-resource-budget-state.ts','ipc-adaptive-resource-budget.ts']){
  const source=await readFile(join('apps/desktop/src/main',file),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:file});
  const errors=(output.diagnostics??[]).filter(item=>item.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw new Error(`${file} transpilation failed: ${errors.length}`);
  await writeFile(join(tmp,file.replace(/\.ts$/,'.js')),output.outputText);
}
const stateModule=await import(pathToFileURL(join(tmp,'ipc-adaptive-resource-budget-state.js')).href);
const budgetModule=await import(pathToFileURL(join(tmp,'ipc-adaptive-resource-budget.js')).href);
const {IpcAdaptiveResourceBudgetStateStore}=stateModule;
const {IpcAdaptiveResourceBudgetController,IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT}=budgetModule;
const checks=[];const check=(label,fn)=>{fn();checks.push(label);};
const healthy=(overrides={})=>({totalSamples:64,activeRequests:1,queuedRequests:0,cacheEntries:2,alerts:[],...overrides});
const createStore=(directoryPath,overrides={})=>new IpcAdaptiveResourceBudgetStateStore({directoryPath,applicationVersion:'29.07.2026.165',policyFingerprint:IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT,maximumStateAgeMs:600_000,maximumJournalEntries:16,maximumJournalBytes:131_072,...overrides});
const paths=(dir)=>({state:join(dir,'ipc-adaptive-budget-state.json'),journal:join(dir,'ipc-adaptive-budget-decisions.jsonl')});

let now=100_000;const primaryDir=join(tmp,'primary');const primaryStore=createStore(primaryDir);
let controller=new IpcAdaptiveResourceBudgetController({persistence:primaryStore,now:()=>now});
let view=controller.snapshot();
check('missing state starts from baseline',()=>assert.equal(view.mode,'baseline'));
check('missing state creates verified persistence',()=>assert.equal(view.persistence.status,'verified'));
const startupStateText=await readFile(paths(primaryDir).state,'utf8');
check('startup state file is created',()=>assert.ok(startupStateText.includes('journalHeadHash')));
now+=6_000;controller.refresh(healthy({alerts:[{severity:'warning',code:'duration-p95'}]}),now);view=controller.snapshot();
check('warning pressure persists guarded mode',()=>assert.equal(view.mode,'guarded'));
now+=6_000;controller.refresh(healthy({alerts:[{severity:'critical',code:'global-pressure'}]}),now);view=controller.snapshot();
check('critical pressure persists restricted mode',()=>assert.equal(view.mode,'restricted'));
check('generation is persisted before restart',()=>assert.equal(view.generation,2));
const primaryPaths=paths(primaryDir);
const startupJournal=await readFile(primaryPaths.journal,'utf8');
check('journal contains multiple decisions',()=>assert.ok(startupJournal.trim().split(/\r?\n/u).length>=3));
check('journal excludes request identifiers',()=>assert.equal(/requestId|rendererSessionId|arguments|payload/u.test(startupJournal),false));

now+=1_000;controller=new IpcAdaptiveResourceBudgetController({persistence:createStore(primaryDir),now:()=>now});view=controller.snapshot();
check('verified restart restores restricted mode',()=>assert.equal(view.mode,'restricted'));
check('verified restart marks restored reason',()=>assert.equal(view.reason,'restored'));
check('verified restart keeps generation',()=>assert.equal(view.generation,2));
check('verified restart reports verified persistence',()=>assert.equal(view.persistence.status,'verified'));

await unlink(primaryPaths.state);now+=1_000;controller=new IpcAdaptiveResourceBudgetController({persistence:createStore(primaryDir),now:()=>now});view=controller.snapshot();
check('missing state file recovers mode from valid journal',()=>assert.equal(view.mode,'restricted'));
check('journal-only recovery is visible',()=>assert.equal(view.persistence.status,'recovered'));
const recoveredStateText=await readFile(primaryPaths.state,'utf8');
check('journal-only recovery recreates state file',()=>assert.ok(recoveredStateText.includes('journalHeadHash')));

const tamperDir=join(tmp,'tamper');let tamperNow=200_000;let tamperController=new IpcAdaptiveResourceBudgetController({persistence:createStore(tamperDir),now:()=>tamperNow});
tamperNow+=6_000;tamperController.refresh(healthy({alerts:[{severity:'critical',code:'critical'}]}),tamperNow);
const tamperPaths=paths(tamperDir);const tamperedLines=(await readFile(tamperPaths.journal,'utf8')).trim().split(/\r?\n/u);const tampered=JSON.parse(tamperedLines[0]);tampered.state.sampleCount=999;tamperedLines[0]=JSON.stringify(tampered);await writeFile(tamperPaths.journal,`${tamperedLines.join('\n')}\n`);
tamperNow+=1_000;tamperController=new IpcAdaptiveResourceBudgetController({persistence:createStore(tamperDir),now:()=>tamperNow});view=tamperController.snapshot();
check('tampered journal is rejected to baseline',()=>assert.equal(view.mode,'baseline'));
check('tampered journal rejection is explicit',()=>assert.equal(view.reason,'restore-rejected'));
check('tampered journal persistence status is rejected',()=>assert.equal(view.persistence.status,'rejected'));
const tamperFiles=await readdir(tamperDir);const tamperQuarantine=await readdir(join(tamperDir,'quarantine'));
check('tampered files are quarantined',()=>assert.ok(tamperQuarantine.some(name=>name.includes('.rejected-'))));
check('clean replacement journal is created after rejection',()=>assert.ok(tamperFiles.includes('ipc-adaptive-budget-decisions.jsonl')));

const staleDir=join(tmp,'stale');let staleNow=300_000;let staleController=new IpcAdaptiveResourceBudgetController({persistence:createStore(staleDir,{maximumStateAgeMs:60_000}),now:()=>staleNow});
staleNow+=6_000;staleController.refresh(healthy({alerts:[{severity:'warning',code:'warning'}]}),staleNow);
staleNow+=120_000;staleController=new IpcAdaptiveResourceBudgetController({persistence:createStore(staleDir,{maximumStateAgeMs:60_000}),now:()=>staleNow});view=staleController.snapshot();
check('stale persisted state is rejected',()=>assert.equal(view.mode,'baseline'));
check('stale rejection is visible',()=>assert.equal(view.persistence.status,'rejected'));

const bindingDir=join(tmp,'binding');let bindingNow=500_000;new IpcAdaptiveResourceBudgetController({persistence:createStore(bindingDir),now:()=>bindingNow});
bindingNow+=1_000;const mismatchedPolicy='f'.repeat(64)===IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT?'e'.repeat(64):'f'.repeat(64);
let bindingController=new IpcAdaptiveResourceBudgetController({persistence:createStore(bindingDir,{policyFingerprint:mismatchedPolicy}),now:()=>bindingNow});view=bindingController.snapshot();
check('policy fingerprint mismatch rejects restore',()=>assert.equal(view.persistence.status,'rejected'));
const versionDir=join(tmp,'version');new IpcAdaptiveResourceBudgetController({persistence:createStore(versionDir),now:()=>bindingNow});
bindingNow+=1_000;bindingController=new IpcAdaptiveResourceBudgetController({persistence:createStore(versionDir,{applicationVersion:'29.07.2026.166'}),now:()=>bindingNow});view=bindingController.snapshot();
check('application version mismatch rejects restore',()=>assert.equal(view.persistence.status,'rejected'));

const compactDir=join(tmp,'compact');let compactNow=700_000;const compactStore=createStore(compactDir);const compactController=new IpcAdaptiveResourceBudgetController({persistence:compactStore,now:()=>compactNow});
for(let index=0;index<24;index+=1){compactNow+=6_000;compactController.refresh(healthy(index%2===0?{alerts:[{severity:'warning',code:'warning'}]}:{}),compactNow);}
const compactLines=(await readFile(paths(compactDir).journal,'utf8')).trim().split(/\r?\n/u);const compactFirst=JSON.parse(compactLines[0]);
check('journal compaction bounds entry count',()=>assert.ok(compactLines.length<=16));
check('journal compaction preserves prior head anchor',()=>assert.match(compactFirst.compactedThroughHash,/^[a-f0-9]{64}$/u));
check('compacted journal restarts chain from zero hash',()=>assert.equal(compactFirst.previousHash,'0'.repeat(64)));
compactNow+=1_000;const compactRestored=new IpcAdaptiveResourceBudgetController({persistence:createStore(compactDir),now:()=>compactNow});
check('compacted journal remains restorable',()=>assert.ok(['baseline','guarded','restricted'].includes(compactRestored.snapshot().mode)));

const failurePersistence={load:()=>({status:'MISSING',reason:'TEST'}),persist:()=>{throw new Error('DISK_WRITE_FAILED');}};
const failureController=new IpcAdaptiveResourceBudgetController({persistence:failurePersistence,now:()=>900_000});view=failureController.snapshot();
check('write failure is explicit',()=>assert.equal(view.persistence.status,'write-failed'));
check('write failure does not crash controller',()=>assert.equal(view.mode,'baseline'));
check('write failure reason is bounded',()=>assert.ok(view.persistence.reason.length<=160));

const primaryFiles=await readdir(primaryDir);
check('atomic persistence leaves no temporary files',()=>assert.equal(primaryFiles.some(name=>name.endsWith('.tmp')),false));
check('policy fingerprint is sha256',()=>assert.match(IPC_ADAPTIVE_RESOURCE_BUDGET_POLICY_FINGERPRINT,/^[a-f0-9]{64}$/u));

const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:165,stage:'Bronze RC2 Active Development',status:'PASS',checks:checks.length,checkLabels:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);await rm(join(tmp,'ipc-transport-context.js'),{force:true});
console.log(`Build 165 IPC adaptive budget state runtime: PASS (${checks.length}/${checks.length}).`);
