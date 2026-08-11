import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2);const option=(name,fallback)=>{const i=args.indexOf(name);if(i<0)return fallback;const v=args[i+1];if(!v||v.startsWith('--'))throw new Error(`${name} requires a value.`);return v;};
const reportPath=resolve(option('--report','artifacts/validation/build212-validation-boundary.json'));
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const preflight=await readJson('artifacts/validation/build212-source-preflight-final.json');
const integrity=await readJson('artifacts/validation/build212-source-integrity.json');
const results=[
{id:'source-preflight',status:preflight.status},
{id:'source-integrity',status:integrity.status},
{id:'ui-visual-baseline',status:(await readJson('artifacts/validation/build212-ui-visual-baseline-provenance-contract.json')).status},
{id:'clean-npm-ci',status:'NOT_RUN',reason:'Build212 UI baseline correction did not rerun dependency installation; OPEN-002 remains open.'},
{id:'tsc-no-emit',status:'NOT_RUN'},
{id:'unit-tests',status:'NOT_RUN'},
{id:'electron-production-build',status:'NOT_RUN'},
{id:'smoke-tests',status:'NOT_RUN'},
{id:'windows-runtime',status:'NOT_RUN'}
];
const passCount=results.filter(x=>x.status==='PASS').length,failCount=results.filter(x=>x.status==='FAIL').length,notRunCount=results.filter(x=>x.status==='NOT_RUN').length;
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',build:212,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',passCount,failCount,notRunCount,results,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 212 validation boundary: INCOMPLETE — PASS ${passCount} / FAIL ${failCount} / NOT_RUN ${notRunCount}`);
