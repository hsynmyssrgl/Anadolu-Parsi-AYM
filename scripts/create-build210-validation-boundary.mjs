import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2);const option=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;const v=args[i+1];if(!v||v.startsWith('--'))throw new Error(`${name} requires a value.`);return v;};
const reportPath=resolve(option('--report','artifacts/validation/build210-validation-boundary.json'));
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const preflight=await readJson('artifacts/validation/build210-source-preflight-final.json');
const integrity=await readJson('artifacts/validation/build210-source-integrity.json');
let clean={status:'NOT_RUN',classification:'NOT_RUN'};try{clean=await readJson('artifacts/validation/build210-clean-npm-ci.json')}catch{}
const results=[
{id:'source-preflight',status:preflight.status},
{id:'source-integrity',status:integrity.status},
{id:'clean-npm-ci',status:clean.status==='PASS'?'PASS':clean.status==='FAIL'?'FAIL':'NOT_RUN',reason:clean.classification??clean.reason??'not run'},
{id:'tsc-no-emit',status:'NOT_RUN'},
{id:'unit-tests',status:'NOT_RUN'},
{id:'electron-production-build',status:'NOT_RUN'},
{id:'smoke-tests',status:'NOT_RUN'},
{id:'windows-runtime',status:'NOT_RUN'}
];
const passCount=results.filter(x=>x.status==='PASS').length,failCount=results.filter(x=>x.status==='FAIL').length,notRunCount=results.filter(x=>x.status==='NOT_RUN').length;
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',build:210,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',passCount,failCount,notRunCount,results,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 210 validation boundary: INCOMPLETE — PASS ${passCount} / FAIL ${failCount} / NOT_RUN ${notRunCount}`);
