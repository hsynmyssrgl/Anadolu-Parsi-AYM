import { writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';
const target=process.argv[2];if(!target)throw new Error('Usage: node scripts/advance-work-step.mjs <next-step-id>');
const plan=await readJson('config/work-segmentation-plan.json');const currentIndex=plan.steps.findIndex(s=>s.id===plan.currentStep);const targetIndex=plan.steps.findIndex(s=>s.id===target);
if(currentIndex<0||targetIndex<0)throw new Error('Unknown current or target step');
if(targetIndex!==currentIndex+1)throw new Error(`Step advance blocked: ${target} is not the immediate next step after ${plan.currentStep}`);
const current=plan.steps[currentIndex];if(current.status!=='COMPLETED'||current.validationStatus!=='PASS'||current.persistentReceiptStatus!=='PASS')throw new Error(`Step advance blocked: ${current.id} lacks COMPLETED + PASS + persistent receipt PASS`);
for(let i=0;i<targetIndex;i++){const s=plan.steps[i];if(s.status!=='COMPLETED'||s.validationStatus!=='PASS'||s.persistentReceiptStatus!=='PASS')throw new Error(`Step advance blocked: prior ${s.id} is not durably complete`)}
const next=plan.steps[targetIndex];if(next.status!=='PENDING')throw new Error(`Step advance blocked: ${next.id} is ${next.status}, expected PENDING`);
next.status='IN_PROGRESS';plan.currentStep=target;await writeFile('config/work-segmentation-plan.json',JSON.stringify(plan,null,2)+'\n');console.log(`Work step advanced: ${current.id} -> ${target}`);
