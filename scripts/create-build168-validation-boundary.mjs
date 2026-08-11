import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2);const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build168-validation-boundary.json'));
const readJson=async(path)=>JSON.parse(await readFile(path,'utf8'));
const [sourcePreflight,sourceIntegrity,contract,runtime,syntax,build167Contract,build167Runtime,packageSourceTypes,desktopMainTypes,requestCreation,responseStatus]=await Promise.all([
 readJson('artifacts/validation/build168-source-preflight-final.json'),readJson('artifacts/validation/build168-source-integrity-final.json'),readJson('artifacts/validation/build168-ipc-adaptive-budget-maintenance-authority-contract.json'),readJson('artifacts/validation/build168-ipc-adaptive-budget-maintenance-authority-runtime.json'),readJson('artifacts/validation/build168-ipc-adaptive-budget-maintenance-authority-syntax.json'),readJson('artifacts/validation/build168-build167-maintenance-session-continuity.json'),readJson('artifacts/validation/build168-build167-maintenance-session-runtime-continuity.json'),readJson('artifacts/validation/package-source-typecheck.json'),readJson('artifacts/validation/desktop-main-source-typecheck.json'),readJson('artifacts/validation/build154-handoff-request-creation.json'),readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if(sourcePreflight.status!=='PASS'||sourcePreflight.results?.length!==121)throw new Error('Build 168 source preflight must be PASS 121/121.');
if(sourceIntegrity.status!=='PASS')throw new Error('Build 168 source integrity must be PASS.');
if(contract.status!=='PASS'||contract.assertions!==32)throw new Error('Build 168 maintenance authority contract must be PASS 32/32.');
if(runtime.status!=='PASS'||runtime.checks!==12)throw new Error('Build 168 maintenance authority runtime must be PASS 12/12.');
if(syntax.status!=='PASS'||syntax.fileCount!==8)throw new Error('Build 168 maintenance authority syntax must be PASS 8/8.');
if(build167Contract.status!=='PASS'||build167Contract.assertions!==50)throw new Error('Build 167 contract continuity must be PASS 50/50.');
if(build167Runtime.status!=='PASS'||build167Runtime.checks!==29)throw new Error('Build 167 runtime continuity must be PASS 29/29.');
if(packageSourceTypes.status!=='PASS'||desktopMainTypes.status!=='PASS')throw new Error('Controlled TypeScript checks must be PASS.');
if(requestCreation.status!=='PASS'||requestCreation.verificationStatus!=='PASS')throw new Error('Build 154 dependency request evidence must remain PASS.');
if(responseStatus.status!=='WAITING'||responseStatus.classification!=='BOUND_RESPONSE_NOT_PRESENT'||responseStatus.requestId!==requestCreation.requestId)throw new Error('Bound dependency response must remain WAITING for the same request.');
const results=[
 {id:'source-preflight',status:'PASS',evidence:'artifacts/validation/build168-source-preflight-final.json'},
 {id:'source-integrity',status:'PASS',evidence:'artifacts/validation/build168-source-integrity-final.json'},
 {id:'clean-npm-ci',status:'NOT_RUN',reason:'BOUND_HANDOFF_RESPONSE_NOT_RETURNED',requestId:requestCreation.requestId,blockedEvidence:'artifacts/validation/build154-handoff-response-status.json'},
 {id:'tsc-no-emit',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'unit-tests',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'electron-production-build',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'smoke-tests',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'windows-runtime',status:'NOT_RUN',reason:`Platform ${process.platform} is not Windows and the bound dependency response has not returned.`}
];
const counts=Object.fromEntries(['PASS','FAIL','NOT_RUN'].map(status=>[status,results.filter(item=>item.status===status).length]));
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'29.07.2026.168',packageVersion:'29.7.2026-168',build:168,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',requestId:requestCreation.requestId,requestArchivePath:requestCreation.archivePath,expectedResponseFileName:responseStatus.expectedResponseFileName,counts,results,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 168 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
