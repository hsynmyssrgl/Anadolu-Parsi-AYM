import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=resolve(process.cwd());
if(root!==resolve('C:\\PPT\\AYM','06_KOD','app'))throw new Error(`Unsafe source root: ${root}`);
const noWrite=process.argv.includes('--no-write');const node=process.execPath;
const npmCli=process.env.npm_execpath??resolve(root,'.tmp','npm-10.9.2','package','bin','npm-cli.js');const npmArgs=args=>[npmCli,...args];
const run=(name,command,args)=>{const result=spawnSync(command,args,{cwd:root,encoding:'utf8',stdio:'pipe',maxBuffer:32*1024*1024});
  const output=`${result.error?.stack??''}${result.stdout??''}${result.stderr??''}`;return {name,status:result.status===0?'PASS':'FAIL',
    exitCode:result.status??1,output:output.slice(-12000)};};
const results=[];
results.push(run('boundary',node,['scripts/verify-34-f-family-meetings-decisions-consent-minutes-boundary.mjs','--no-write']));
results.push(run('contract',node,['scripts/verify-34-f-family-meetings-decisions-consent-minutes-contract.mjs','--no-write']));
results.push(run('targeted 6 files 32 tests',node,npmArgs(['run','verify:34-f:targeted'])));
for(const workspace of ['@ppt/domain','@ppt/repository-contracts','@ppt/application','@ppt/database','@ppt/repositories','@ppt/desktop'])
  results.push(run(`typecheck ${workspace}`,node,npmArgs(['run','typecheck','--workspace',workspace])));
results.push(run('migration verifier',node,npmArgs(['run','verify:migrations'])));
results.push(run('data store smoke',node,npmArgs(['run','verify:data-store-smoke'])));
results.push(run('PPK-019 boundary',node,npmArgs(['run','verify:ppk019:propagation-boundary'])));
results.push(run('PPK-021 runtime',node,npmArgs(['run','verify:ppk021:runtime'])));
results.push(run('PPK-022 runtime',node,npmArgs(['run','verify:ppk022:runtime'])));
results.push(run('PPK-015 current runtime',node,npmArgs(['run','verify:ppk015:egress:runtime'])));
const failures=results.filter(item=>item.status==='FAIL');
const report={schemaVersion:1,step:'34-F',decision:'DEC-243',status:failures.length?'FAIL':'PASS',governanceState:'PLANNED',
  countsAsRequirementPass:false,targetedTestFiles:6,targetedTests:32,checkCount:results.length,
  passed:results.length-failures.length,failed:failures.length,checks:results,generatedAt:new Date().toISOString()};
if(!noWrite){await mkdir(resolve(root,'artifacts/validation'),{recursive:true});await writeFile(resolve(root,
  'artifacts/validation/34-F-family-meetings-decisions-consent-minutes-runtime.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');}
if(failures.length){console.error(`34-F runtime: FAIL (${failures.length}/${results.length}).`);
  for(const item of failures)console.error(`${item.name}: exit ${item.exitCode}`);process.exit(1);}
console.log(`34-F runtime: PASS (${results.length}/${results.length}; 6 files/32 tests; requirement PASS=false; write=${!noWrite}).`);
