import { mkdir, stat, writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const plan=await readJson('config/work-segmentation-plan.json');
const release=(await readJson('config/canonical-rule-registry.json')).effectiveRelease;
check(plan.release===release,'work segmentation release mismatch');
check(plan.rule==='PR-171','work segmentation must enforce PR-171');
check(plan.policy==='ONE_IN_PROGRESS_PREVIOUS_MUST_HAVE_PASS_AND_PERSISTENT_RECEIPT','work segmentation policy mismatch');
const ids=new Set();let inProgress=0;let seenNotCompleted=false;
for(const [idx,s] of (plan.steps??[]).entries()){
  check(!ids.has(s.id),`duplicate step ${s.id}`);ids.add(s.id);
  check(['PENDING','IN_PROGRESS','COMPLETED','BLOCKED'].includes(s.status),`${s.id} invalid status ${s.status}`);
  if(s.status==='IN_PROGRESS')inProgress++;
  if(s.status!=='COMPLETED')seenNotCompleted=true;
  if(s.status==='COMPLETED'){
    check(!seenNotCompleted || idx===0,`${s.id} completed out of order`);
    check(s.validationStatus==='PASS',`${s.id} completed without PASS validation`);
    check(s.persistentReceiptStatus==='PASS',`${s.id} completed without persistent Library receipt`);
    check(Boolean(s.persistentReceiptPath),`${s.id} persistent receipt path missing`);
    for(const p of s.localEvidence??[]){try{await stat(p);check(true,`${s.id} evidence ${p}`)}catch{check(false,`${s.id} missing evidence ${p}`)}}
    if(s.persistentReceiptPath){try{await stat(s.persistentReceiptPath);check(true,`${s.id} receipt ${s.persistentReceiptPath}`)}catch{check(false,`${s.id} receipt file missing ${s.persistentReceiptPath}`)}}
  }
}
check(inProgress<=1,`only one step may be IN_PROGRESS; found ${inProgress}`);
const current=plan.steps.find(s=>s.id===plan.currentStep);check(Boolean(current),'currentStep missing');
if(current){check(current.status==='IN_PROGRESS'||current.status==='BLOCKED'||current.status==='COMPLETED',`currentStep ${current.id} invalid active status ${current.status}`);const idx=plan.steps.indexOf(current);for(let i=0;i<idx;i++){const p=plan.steps[i];check(p.status==='COMPLETED',`${current.id} cannot start before ${p.id} COMPLETED`);check(p.validationStatus==='PASS',`${current.id} cannot start before ${p.id} PASS`);check(p.persistentReceiptStatus==='PASS',`${current.id} cannot start before ${p.id} persistent receipt PASS`)}}
const report={schemaVersion:1,release,checks,currentStep:plan.currentStep,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/step-checkpoint-gate.json',JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`Step Checkpoint Gate: PASS (${checks} checks / current ${plan.currentStep}).`);
