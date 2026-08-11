import { readJson } from './lib/governance-utils.mjs';
const plan=await readJson('config/work-segmentation-plan.json');
const supplied=process.env.PPT_WORK_STEP;
if(!supplied)throw new Error(`Work-step blocked: PPT_WORK_STEP is required; current step is ${plan.currentStep}`);
if(supplied!==plan.currentStep)throw new Error(`Work-step blocked: supplied ${supplied}, current ${plan.currentStep}`);
const current=plan.steps.find(s=>s.id===plan.currentStep);
if(!current||current.status!=='IN_PROGRESS')throw new Error(`Work-step blocked: ${plan.currentStep} is not IN_PROGRESS`);
const idx=plan.steps.indexOf(current);
for(let i=0;i<idx;i++){
 const p=plan.steps[i];
 if(p.status!=='COMPLETED'||p.validationStatus!=='PASS'||p.persistentReceiptStatus!=='PASS')throw new Error(`Work-step blocked: previous ${p.id} lacks completed PASS + persistent receipt`);
}
console.log(`Active work step: PASS (${plan.currentStep}).`);
