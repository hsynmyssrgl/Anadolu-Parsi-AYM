import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PlatformPolicyKernel } from '@ppt/platform-policy';
import { CoreServiceRuntime } from '../apps/core-service/src/core-service-runtime.ts';
import { CoreServiceLocalAdminServer } from '../apps/core-service/src/local-admin-server.ts';
import { connectCoreServiceAtStartup, CoreServiceStartupConnectionError } from '../apps/desktop/src/main/core-service-startup-connection.ts';

const noWrite = process.argv.includes('--no-write');
const failures=[];let checks=0;const check=(condition,message)=>{checks++;if(!condition)failures.push(message)};
const expectCode=async(fn,code,label)=>{try{await fn();check(false,`${label}: expected ${code}`)}catch(error){check(error instanceof CoreServiceStartupConnectionError,`${label}: wrong error type`);check(error?.code===code,`${label}: expected ${code}, got ${String(error?.code)}`)}};
const root=await mkdtemp(join(tmpdir(),'ppt-desktop-core-startup-'));
const endpoint=process.platform==='win32'?'\\\\.\\pipe\\ppt-desktop-core-startup-'+process.pid+'-'+Date.now():join(root,'core.sock');
const token=randomBytes(48).toString('base64url');
const policyVersion='PPT-PLATFORM-POLICY-2026-08-04-V1';
const kernel=new PlatformPolicyKernel({policyVersion,signingKey:randomBytes(32),applicationVersions:{'windows-desktop':'v1','windows-core-service':'v1'},applicationCapabilities:{'windows-desktop':['family.read'],'windows-core-service':['health.read']},applicationRuntimeCapabilities:{'windows-desktop':['camera.access','file.access','microphone.access','network.access','ocr.process'],'windows-core-service':['file.access','network.access']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const runtime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});runtime.markReady('standalone');
const server=new CoreServiceLocalAdminServer({endpoint,authenticationToken:token,runtime});
await server.start();
try{
 const authority={schemaVersion:1,endpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 const reader={readText:()=>JSON.stringify(authority)};
 const connection=await connectCoreServiceAtStartup({authorityPath:'/protected/core-service.pptsecret',authorityReader:reader,platform:process.platform});
 check(connection.health.lifecycle==='ready','ready Core Service handshake did not return ready lifecycle');
 check(connection.health.policyVersion===policyVersion,'ready Core Service handshake returned wrong policy version');
 check(connection.health.policyPackage.payload.applicationManifests['windows-desktop']?.runtimeCapabilities.join('|')==='camera.access|file.access|microphone.access|network.access|ocr.process','startup did not preserve exact signed Desktop runtime capability coverage');
 check(connection.health.writable===true,'standalone ready Core Service should be writable');
 check(connection.apiBoundary.enforcement==='fail-closed'&&connection.apiBoundary.apiVersion==='v1','startup did not verify the versioned API posture');
 check(connection.apiBoundary.serverApplicationId==='windows-core-service'&&connection.apiBoundary.allowedClientApplicationIds.length===1&&connection.apiBoundary.allowedClientApplicationIds[0]==='windows-desktop','startup did not bind Core Service and Desktop application identities');
 check(connection.apiBoundary.exactEnvelopeRequired===true&&connection.apiBoundary.applicationVersionBindingRequired===true&&connection.apiBoundary.freshnessRequired===true&&connection.apiBoundary.replayProtection==='in-memory-per-process-fail-closed','startup API safety controls are incomplete');
 check(connection.apiBoundary.directCoreServiceImportAllowed===false&&connection.apiBoundary.directImportExceptionCount===0&&connection.apiBoundary.persistentPathExposed===false&&connection.apiBoundary.secretMaterialExposed===false&&connection.apiBoundary.cutoverAuthorityAttached===false,'startup API boundary exposes an unsafe capability');
 check(connection.architecture.processBoundary==='headless-core-service','startup did not verify headless process ownership');
 check(connection.architecture.ownership.policyKernel==='core-service','startup did not verify policy ownership');
 check(connection.architecture.supportedMethods.includes('architecture.get'),'startup architecture method registry is incomplete');
 check(connection.architecture.supportedMethods.includes('family-data.status'),'startup family-data method registry is incomplete');
	 check(connection.architecture.supportedMethods.includes('device-secret-protection.status'),'startup device-secret protection method registry is incomplete');
	 check(connection.architecture.supportedMethods.includes('family-data-cutover.status'),'startup family-data cutover method registry is incomplete');
	 check(connection.architecture.supportedMethods.includes('family-data-cutover-readiness.status'),'startup cutover-readiness method registry is incomplete');
 check(connection.familyData.owner==='desktop-transition'&&connection.familyData.lifecycle==='detached','startup did not preserve detached family-data truth');
 check(connection.familyData.writable===false&&connection.familyData.protectedSessionAttached===false,'startup detached family-data status is unsafe');
 check(connection.familyData.persistentPathExposed===false,'startup exposed a family-data path');
 check(connection.architecture.ownership.familyData===connection.familyData.owner,'startup ownership sources disagree');
 check(connection.deviceSecretProtection.owner==='detached'&&connection.deviceSecretProtection.lifecycle==='detached','startup did not preserve detached device-secret truth');
 check(connection.deviceSecretProtection.secretMaterialExposed===false&&connection.deviceSecretProtection.electronDependency===false,'startup device-secret status is unsafe');
	 check(connection.architecture.ownership.deviceSecretProtection===connection.deviceSecretProtection.owner,'startup device-secret ownership sources disagree');
	 check(connection.familyDataCutover.decision==='blocked'&&connection.familyDataCutover.mode==='coexistence-no-cutover','startup did not preserve default-deny cutover truth');
	 check(connection.familyDataCutover.legacyDesktopDataActive===true&&connection.familyDataCutover.realDataTransferAllowed===false&&connection.familyDataCutover.writeOwnershipTransferAllowed===false,'startup family-data cutover permissions are unsafe');
	 check(connection.familyDataCutover.automaticActivationAllowed===false&&connection.familyDataCutover.cutoverAuthorityAttached===false,'startup accepted an automatic or unauthorized cutover');
	 check(connection.familyDataCutover.persistentPathExposed===false&&connection.familyDataCutover.secretMaterialExposed===false,'startup cutover status exposed sensitive material');
	 check(connection.familyDataCutover.requiredGates.length===5&&connection.familyDataCutover.requiredGates.every((gate)=>gate.status==='pending'),'startup cutover gate set is incomplete');
	 check(connection.architecture.safety.familyDataCutover===connection.familyDataCutover.decision,'startup cutover safety sources disagree');
	 check(connection.familyDataCutoverReadiness.mode==='monotonic-evidence-no-cutover'&&connection.familyDataCutoverReadiness.decision==='blocked','startup did not preserve cutover-readiness default-deny truth');
	 check(connection.familyDataCutoverReadiness.ledgerEpoch===0&&connection.familyDataCutoverReadiness.entryCount===0&&connection.familyDataCutoverReadiness.entries.length===0,'startup cutover-readiness genesis is inconsistent');
	 check(connection.familyDataCutoverReadiness.requiredGates.length===5&&connection.familyDataCutoverReadiness.requiredGates.every((gate)=>gate.status==='pending'),'startup cutover-readiness gate set is incomplete');
	 check(connection.familyDataCutoverReadiness.allRequiredGatesPass===false&&connection.familyDataCutoverReadiness.cutoverAuthorityAttached===false&&connection.familyDataCutoverReadiness.automaticActivationAllowed===false,'startup accepted cutover authority from readiness evidence');
 const second=await connection.adapter.getHealth();check(second.role==='standalone','adapter is not usable after startup handshake');
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/core-service.pptsecret',authorityReader:{readText:()=>JSON.stringify({...authority,expectedPolicyVersion:'PPT-PLATFORM-POLICY-WRONG'})},platform:process.platform}),'POLICY_VERSION_MISMATCH','policy mismatch');
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/missing.pptsecret',authorityReader:{readText:()=>{throw new Error('missing')}},platform:process.platform}),'AUTHORITY_UNAVAILABLE','missing authority');
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/invalid.pptsecret',authorityReader:{readText:()=>JSON.stringify({...authority,authenticationToken:'too-short'})},platform:process.platform}),'AUTHORITY_INVALID','invalid authority');
} finally {await server.stop();}
const apiBoundaryMismatchEndpoint=process.platform==='win32'?'\\\\.\\pipe\\ppt-desktop-core-api-boundary-mismatch-'+process.pid+'-'+Date.now():join(root,'api-boundary-mismatch.sock');
const apiBoundaryMismatchRuntime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});apiBoundaryMismatchRuntime.markReady('standalone');
const validApiBoundaryStatus=apiBoundaryMismatchRuntime.clientApiBoundaryStatus.bind(apiBoundaryMismatchRuntime);
apiBoundaryMismatchRuntime.clientApiBoundaryStatus=()=>Object.freeze({...validApiBoundaryStatus(),directCoreServiceImportAllowed:true,directImportExceptionCount:1});
const apiBoundaryMismatchServer=new CoreServiceLocalAdminServer({endpoint:apiBoundaryMismatchEndpoint,authenticationToken:token,runtime:apiBoundaryMismatchRuntime});await apiBoundaryMismatchServer.start();
try{
 const apiBoundaryMismatchAuthority={schemaVersion:1,endpoint:apiBoundaryMismatchEndpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/api-boundary-mismatch.pptsecret',authorityReader:{readText:()=>JSON.stringify(apiBoundaryMismatchAuthority)},platform:process.platform}),'API_BOUNDARY_MISMATCH','versioned API boundary mismatch');
} finally {await apiBoundaryMismatchServer.stop();}
const mismatchEndpoint=process.platform==='win32'?'\\\\.\\pipe\\ppt-desktop-core-architecture-mismatch-'+process.pid+'-'+Date.now():join(root,'architecture-mismatch.sock');
const mismatchRuntime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});mismatchRuntime.markReady('standalone');
const validArchitecture=mismatchRuntime.architecture.bind(mismatchRuntime);
mismatchRuntime.architecture=()=>{const architecture=validArchitecture();return {...architecture,ownership:{...architecture.ownership,policyKernel:'desktop'}}};
const mismatchServer=new CoreServiceLocalAdminServer({endpoint:mismatchEndpoint,authenticationToken:token,runtime:mismatchRuntime});await mismatchServer.start();
try{
 const mismatchAuthority={schemaVersion:1,endpoint:mismatchEndpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/mismatch.pptsecret',authorityReader:{readText:()=>JSON.stringify(mismatchAuthority)},platform:process.platform}),'ARCHITECTURE_MISMATCH','architecture ownership mismatch');
} finally {await mismatchServer.stop();}
const familyMismatchEndpoint=process.platform==='win32'?'\\\\.\\pipe\\ppt-desktop-core-family-mismatch-'+process.pid+'-'+Date.now():join(root,'family-mismatch.sock');
const familyMismatchRuntime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});familyMismatchRuntime.markReady('standalone');
familyMismatchRuntime.familyDataStatus=()=>Object.freeze({schemaVersion:1,owner:'core-service',lifecycle:'ready',mode:'read-write',writable:true,epoch:2,protectedSessionAttached:true,persistentPathExposed:false,reasons:Object.freeze([]),observedAt:new Date().toISOString()});
const familyMismatchServer=new CoreServiceLocalAdminServer({endpoint:familyMismatchEndpoint,authenticationToken:token,runtime:familyMismatchRuntime});await familyMismatchServer.start();
try{
 const familyMismatchAuthority={schemaVersion:1,endpoint:familyMismatchEndpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/family-mismatch.pptsecret',authorityReader:{readText:()=>JSON.stringify(familyMismatchAuthority)},platform:process.platform}),'ARCHITECTURE_MISMATCH','family-data ownership mismatch');
} finally {await familyMismatchServer.stop();}
const cutoverMismatchEndpoint=familyMismatchEndpoint+'-cutover';
const cutoverMismatchRuntime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});cutoverMismatchRuntime.markReady('standalone');
const validCutoverStatus=cutoverMismatchRuntime.familyDataCutoverStatus.bind(cutoverMismatchRuntime);
cutoverMismatchRuntime.familyDataCutoverStatus=()=>Object.freeze({...validCutoverStatus(),decision:'allowed',realDataTransferAllowed:true,writeOwnershipTransferAllowed:true});
const cutoverMismatchServer=new CoreServiceLocalAdminServer({endpoint:cutoverMismatchEndpoint,authenticationToken:token,runtime:cutoverMismatchRuntime});await cutoverMismatchServer.start();
try{
 const cutoverMismatchAuthority={schemaVersion:1,endpoint:cutoverMismatchEndpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/cutover-mismatch.pptsecret',authorityReader:{readText:()=>JSON.stringify(cutoverMismatchAuthority)},platform:process.platform}),'ARCHITECTURE_MISMATCH','family-data cutover permission mismatch');
} finally {await cutoverMismatchServer.stop();}
const readinessMismatchEndpoint=familyMismatchEndpoint+'-readiness';
const readinessMismatchRuntime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});readinessMismatchRuntime.markReady('standalone');
const validReadinessStatus=readinessMismatchRuntime.familyDataCutoverReadinessStatus.bind(readinessMismatchRuntime);
readinessMismatchRuntime.familyDataCutoverReadinessStatus=()=>Object.freeze({...validReadinessStatus(),ledgerEpoch:1,allRequiredGatesPass:true,acceptanceState:'all-gates-pass-cutover-still-blocked',cutoverAuthorityAttached:true,headHash:'f'.repeat(64)});
const readinessMismatchServer=new CoreServiceLocalAdminServer({endpoint:readinessMismatchEndpoint,authenticationToken:token,runtime:readinessMismatchRuntime});await readinessMismatchServer.start();
try{
 const readinessMismatchAuthority={schemaVersion:1,endpoint:readinessMismatchEndpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/readiness-mismatch.pptsecret',authorityReader:{readText:()=>JSON.stringify(readinessMismatchAuthority)},platform:process.platform}),'ARCHITECTURE_MISMATCH','cutover-readiness tamper mismatch');
} finally {await readinessMismatchServer.stop();}
const stoppedEndpoint=process.platform==='win32'?'\\\\.\\pipe\\ppt-desktop-core-stopped-'+process.pid+'-'+Date.now():join(root,'stopped.sock');
const stoppedRuntime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});stoppedRuntime.beginShutdown();stoppedRuntime.finishShutdown();
const stoppedServer=new CoreServiceLocalAdminServer({endpoint:stoppedEndpoint,authenticationToken:token,runtime:stoppedRuntime});await stoppedServer.start();
try{
 const stoppedAuthority={schemaVersion:1,endpoint:stoppedEndpoint,authenticationToken:token,expectedPolicyVersion:policyVersion,issuedAt:new Date().toISOString()};
 await expectCode(()=>connectCoreServiceAtStartup({authorityPath:'/protected/stopped.pptsecret',authorityReader:{readText:()=>JSON.stringify(stoppedAuthority)},platform:process.platform}),'SERVICE_NOT_READY','stopped service');
} finally {await stoppedServer.stop();await rm(root,{recursive:true,force:true});}
const report={schemaVersion:1,release:'Bronze 04.08.2026.29',checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
if (!noWrite) {
 const {mkdir,writeFile}=await import('node:fs/promises');await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/desktop-core-service-startup-runtime.json',JSON.stringify(report,null,2)+'\n');
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Desktop Core Service Startup Runtime: PASS (${checks} checks; write=${!noWrite}).`);
