import { mkdir, writeFile } from 'node:fs/promises';
import { readJson } from './lib/governance-utils.mjs';
const policy=await readJson('config/conversation-capacity-policy.json');
const raw=process.env.PPT_CHAT_CONTEXT_USED_PERCENT;
let status='UNAVAILABLE', actualUsedPercent=null, handoff='NOT_REQUIRED_WITHOUT_ACTUAL_HARD_STOP', exit=0;
if(raw!==undefined&&raw!==''){
  const n=Number(raw);if(!Number.isFinite(n)||n<0||n>100){console.error('PPT_CHAT_CONTEXT_USED_PERCENT must be 0..100');process.exit(1)}
  actualUsedPercent=n;
  if(n>=policy.hardStopUsedPercent){status='HARD_STOP';handoff='REQUIRED';exit=2}
  else if(n>=policy.warningUsedPercent){status='WARNING';handoff='PREPARE_WHEN_HARD_STOP'}
  else status='OK';
}
const report={schemaVersion:1,method:raw===undefined?'unavailable':'platform_actual',actualUsedPercent,status,handoff,assistantEstimateUsed:false,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/conversation-capacity.json',JSON.stringify(report,null,2)+'\n');console.log(`Conversation Capacity: ${status}${actualUsedPercent===null?'':` (${actualUsedPercent}% used)`}.`);process.exit(exit);
