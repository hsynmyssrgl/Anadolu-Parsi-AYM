import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2);const option=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;const v=args[i+1];if(!v||v.startsWith('--'))throw new Error(`${name} requires a value.`);return v;};
const reportPath=resolve(option('--report','artifacts/validation/build213-validation-boundary.json'));const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const results=[
{id:'source-preflight',status:(await readJson('artifacts/validation/build213-source-preflight-final.json')).status},
{id:'source-integrity',status:(await readJson('artifacts/validation/build213-source-integrity.json')).status},
{id:'in-use-data-protection-contract',status:(await readJson('artifacts/validation/build213-in-use-data-protection-contract.json')).status},
{id:'volatile-user-data-runtime',status:(await readJson('artifacts/validation/build213-volatile-user-data-runtime.json')).status},
{id:'windows-efs-runtime',status:'NOT_RUN',reason:'Requires real Windows packaged runtime; non-Windows harness cannot prove EFS.'},
{id:'clean-npm-ci',status:'NOT_RUN',reason:'OPEN-002 remains open; Build211 established external dependency access unavailable.'},
{id:'tsc-no-emit',status:'NOT_RUN'},
{id:'unit-tests',status:'NOT_RUN'},
{id:'electron-production-build',status:'NOT_RUN'},
{id:'smoke-tests',status:'NOT_RUN'},
{id:'windows-runtime',status:'NOT_RUN'}];
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',build:213,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',passCount:results.filter(x=>x.status==='PASS').length,failCount:results.filter(x=>x.status==='FAIL').length,notRunCount:results.filter(x=>x.status==='NOT_RUN').length,results,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(`Build 213 validation boundary: INCOMPLETE — PASS ${report.passCount} / FAIL ${report.failCount} / NOT_RUN ${report.notRunCount}`);
