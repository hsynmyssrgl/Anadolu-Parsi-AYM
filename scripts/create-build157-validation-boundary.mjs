import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2);
const option=(name,fallback)=>{const index=args.indexOf(name);if(index<0)return fallback;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;};
const reportPath=resolve(option('--report','artifacts/validation/build157-validation-boundary.json'));
const readJson=async(path)=>JSON.parse(await readFile(path,'utf8'));
const [sourcePreflight,sourceIntegrity,contract,runtime,bridgeSyntax,packageSourceTypes,desktopMainTypes,requestCreation,responseStatus]=await Promise.all([
 readJson('artifacts/validation/build157-source-preflight-final.json'),
 readJson('artifacts/validation/build157-source-integrity-final.json'),
 readJson('artifacts/validation/build157-bounded-mutation-contract.json'),
 readJson('artifacts/validation/build157-mutation-revision-runtime.json'),
 readJson('artifacts/validation/build157-renderer-bridge-syntax.json'),
 readJson('artifacts/validation/package-source-typecheck.json'),
 readJson('artifacts/validation/desktop-main-source-typecheck.json'),
 readJson('artifacts/validation/build154-handoff-request-creation.json'),
 readJson('artifacts/validation/build154-handoff-response-status.json')
]);
if(sourcePreflight.status!=='PASS')throw new Error('Build 157 source preflight must be PASS.');
if(sourceIntegrity.status!=='PASS')throw new Error('Build 157 source integrity must be PASS.');
if(contract.status!=='PASS'||contract.assertions!==54)throw new Error('Build 157 bounded mutation contract must be PASS 54/54.');
if(runtime.status!=='PASS'||runtime.checks!==10)throw new Error('Build 157 mutation runtime must be PASS 10/10.');
if(bridgeSyntax.status!=='PASS'||bridgeSyntax.fileCount!==7||bridgeSyntax.channelParity?.status!=='PASS'||bridgeSyntax.channelParity?.mainChannelCount!==183)throw new Error('Build 157 syntax/parity must be PASS 7 files and 183 channels.');
if(packageSourceTypes.status!=='PASS'||desktopMainTypes.status!=='PASS')throw new Error('Build 157 controlled TypeScript checks must be PASS.');
if(requestCreation.status!=='PASS'||requestCreation.verificationStatus!=='PASS')throw new Error('Build 154 dependency request evidence must remain PASS.');
if(responseStatus.status!=='WAITING'||responseStatus.classification!=='BOUND_RESPONSE_NOT_PRESENT'||responseStatus.requestId!==requestCreation.requestId)throw new Error('Bound dependency response must remain WAITING for the same request.');
const results=[
 {id:'source-preflight',status:'PASS',evidence:'artifacts/validation/build157-source-preflight-final.json'},
 {id:'source-integrity',status:'PASS',evidence:'artifacts/validation/build157-source-integrity-final.json'},
 {id:'clean-npm-ci',status:'NOT_RUN',reason:'BOUND_HANDOFF_RESPONSE_NOT_RETURNED',requestId:requestCreation.requestId,blockedEvidence:'artifacts/validation/build154-handoff-response-status.json'},
 {id:'tsc-no-emit',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'unit-tests',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'electron-production-build',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'smoke-tests',status:'NOT_RUN',blockedBy:'clean-npm-ci'},
 {id:'windows-runtime',status:'NOT_RUN',reason:`Platform ${process.platform} is not Windows and the bound dependency response has not returned.`}
];
const counts=Object.fromEntries(['PASS','FAIL','NOT_RUN'].map(status=>[status,results.filter(item=>item.status===status).length]));
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion:'29.07.2026.157',packageVersion:'29.7.2026-157',build:157,stage:'Bronze RC2 Active Development',overallStatus:'INCOMPLETE',requestId:requestCreation.requestId,requestArchivePath:requestCreation.archivePath,expectedResponseFileName:responseStatus.expectedResponseFileName,counts,results,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`Build 157 validation boundary: ${report.overallStatus} — ${counts.PASS} PASS / ${counts.FAIL} FAIL / ${counts.NOT_RUN} NOT_RUN.`);
