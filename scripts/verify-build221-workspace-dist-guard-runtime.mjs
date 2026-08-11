import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const reportPath=process.argv[2]??'artifacts/validation/build221-workspace-dist-guard-runtime.json';
const temp=await mkdtemp(join(tmpdir(),'ppt-build221-dist-'));
const script=resolve('scripts/verify-build221-workspace-dist-prerequisite.mjs');
const packages=['core','contracts','config','logging','database','domain','events','repository-contracts','repositories','security','application','infrastructure','test-data'];
for(const name of packages){const d=join(temp,'packages',name,'dist');await mkdir(d,{recursive:true});await writeFile(join(d,'index.js'),'export {};\n');await writeFile(join(d,'index.d.ts'),'export {};\n');}
const run=()=>spawnSync(process.execPath,[script],{cwd:temp,encoding:'utf8'});
const valid=run();
await rm(join(temp,'packages','domain','dist','index.d.ts'));
const tamper=run();
const checks=[
 {id:'valid-fixture-accepted',status:valid.status===0?'PASS':'FAIL',details:{exitCode:valid.status,stdout:valid.stdout?.trim()}},
 {id:'missing-dist-rejected',status:tamper.status!==0?'PASS':'FAIL',details:{exitCode:tamper.status,stdout:tamper.stdout?.trim()}}
];
const status=checks.every(x=>x.status==='PASS')?'PASS':'FAIL';
await mkdir(resolve('artifacts/validation'),{recursive:true});
await writeFile(resolve(reportPath),`${JSON.stringify({schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'02.08.2026.221',build:221,status,checks:checks.length,passCount:checks.filter(x=>x.status==='PASS').length,results:checks,generatedAt:new Date().toISOString()},null,2)}\n`);
await rm(temp,{recursive:true,force:true});
console.log(`Build221 workspace dist guard runtime: ${status} (${checks.filter(x=>x.status==='PASS').length}/${checks.length}).`);
if(status!=='PASS')process.exitCode=1;
