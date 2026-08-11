import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
const testPath='config/.governed-preflight-tamper-test.json';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
try{
  await writeFile(testPath,'{"tamper":true}\n');
  const blocked=spawnSync(process.execPath,['scripts/require-current-governed-preflight.mjs'],{encoding:'utf8'});
  check(blocked.status!==0,'source mutation must invalidate preflight');
  check(`${blocked.stderr}${blocked.stdout}`.includes('governed source changed after preflight'),'mutation failure reason must be explicit');
}finally{await rm(testPath,{force:true})}
const restored=spawnSync(process.execPath,['scripts/require-current-governed-preflight.mjs'],{encoding:'utf8'});
check(restored.status===0,'preflight must become valid again when the unapproved mutation is removed');
const report={schemaVersion:1,checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/governed-preflight-tamper-runtime.json',JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`Governed Preflight Tamper Runtime: PASS (${checks} checks).`);
