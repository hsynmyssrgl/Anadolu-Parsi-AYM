import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2);const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build169-validation-boundary.json'));
const readJson=async(path)=>JSON.parse(await readFile(path,'utf8'));
const [sourcePreflight,sourceIntegrity,contract,runtime,syntax,build168Contract,build168Runtime,build167Contract,build167Runtime,packageSourceTypes,desktopMainTypes,requestCreation,responseStatus]=await Promise.all([
 readJson('artifacts/validation/build169-source-preflight-final.json'),readJson('artifacts/validation/build169-source-integrity-final.json'),readJson('artifacts/validation/build169-ipc-adaptive-budget-maintenance-reauthentication-contract.json'),readJson('artifacts/validation/build169-ipc-adaptive-budget-maintenance-reauthentication-runtime.json'),readJson('artifacts/validation/build169-ipc-adaptive-budget-maintenance-reauthentication-syntax.json'),readJson('artifacts/validation/build169-build168-maintenance-authority-continuity.json'),readJson('artifacts/validation/build169-build168-maintenance-authority-runtime-continuity.json'),readJson('artifacts/validation/build169-build167-maintenance-session-continuity.json'),readJson('artifacts/validation/build169-build167-maintenance-session-runtime-continuity.json'),readJson('artifacts/validation/package-source-typecheck.json'),readJson('artifacts/validation/desktop-main-source-typecheck.json'),readJson('artifacts/validation/build154-handoff-request-creation.json'),readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if(sourcePreflight.status!=='PASS'||sourcePreflight.results?.length!==124)throw new Error('Build 169 source preflight must be PASS 124/124.');
if(sourceIntegrity.status!=='PASS')throw new Error('Build 169 source integrity must be PASS.');
if(contract.status!=='PASS'||contract.assertions!==55)throw new Error('Build 169 maintenance reauthentication contract must be PASS 55/55.');
if(runtime.status!=='PASS'||runtime.checks!==19)throw new Error('Build 169 maintenance reauthentication runtime must be PASS 19/19.');
if(syntax.status!=='PASS'||syntax.fileCount!==10)throw new Error('Build 169 maintenance reauthentication syntax must be PASS 10/10.');
if(build168Contract.status!=='PASS'||build168Contract.assertions!==32)throw new Error('Build 168 contract continuity must be PASS 32/32.');
if(build168Runtime.status!=='PASS'||build168Runtime.checks!==12)throw new Error('Build 168 runtime continuity must be PASS 12/12.');
if(build167Contract.status!=='PASS'||build167Contract.assertions!==50)throw new Error('Build 167 contract continuity must be PASS 50/50.');
if(build167Runtime.status!=='PASS'||build167Runtime.checks!==29)throw new Error('Build 167 runtime continuity must be PASS 29/29.');
if(packageSourceTypes.status!=='PASS'||desktopMainTypes.status!=='PASS')throw new Error('Controlled TypeScript checks must be PASS.');
if(requestCreation.status!=='PASS'||requestCreation.verificationStatus!=='PASS')throw new Error('Build 154 dependency request evidence must remain PASS.');
if(responseStatus.status!=='WAITING'||responseStatus.classification!=='BOUND_RESPONSE_NOT_PRESENT'||responseStatus.requestId!==requestCreation.requestId)throw new Error('Bound dependency response must remain WAITING for the same request.');
const results=[
 {id:'source-preflight',status:'PASS',evidence:'artifacts/validation/build169-source-preflight-final.json'},
 {id:'source-integrity',status:'PASS',evidence:'artifacts/validation/build169-source-integrity-final.json'},
 {id:'clean-npm-ci',status:'NOT_RUN',reason:'BOUND_HANDOFF_RESPONSE_NOT_RETURNED',requestId:requestCreation.requestId,blockedEvidence:'artifacts/validation/build154-handoff-response-status.json'},
 {id:'tsc-no-emit',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'unit-tests',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'electron-production-build',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'smoke-tests',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'windows-runtime',status:'NOT_RUN',reason:`Platform ${process.platform} is not Windows and the bound dependency response has not returned.`}
];
const counts=Object.fromEntries(['PASS','FAIL','NOT_RUN'].map(status=>[status,results.filter(item=>item.status===status).length]));
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'29.07.2026.169',packageVersion:'29.7.2026-169',build:169,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',requestId:requestCreation.requestId,requestArchivePath:requestCreation.archivePath,expectedResponseFileName:responseStatus.expectedResponseFileName,counts,results,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`Build 169 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
