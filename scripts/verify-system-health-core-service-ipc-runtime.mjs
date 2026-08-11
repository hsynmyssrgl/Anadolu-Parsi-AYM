import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PlatformPolicyKernel } from '@ppt/platform-policy';
import { CoreServiceRuntime } from '../apps/core-service/src/core-service-runtime.ts';
import { CoreServiceLocalAdminServer } from '../apps/core-service/src/local-admin-server.ts';
import { CoreServiceApplicationAdapter } from '../apps/desktop/src/main/core-service-application-adapter.ts';
import { evaluateIpcIntegrationPolicy } from '../apps/desktop/src/main/ipc-integration-policy.ts';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const root=await mkdtemp(join(tmpdir(),'ppt-core-health-ipc-'));const endpoint=process.platform==='win32'?'\\\\.\\pipe\\ppt-core-health-ipc-'+process.pid+'-'+Date.now():join(root,'health.sock');const token=randomBytes(48).toString('base64url');const policyVersion='PPT-PLATFORM-POLICY-2026-08-04-V1';
const kernel=new PlatformPolicyKernel({policyVersion,signingKey:randomBytes(32),applicationVersions:{'windows-desktop':'v1','windows-core-service':'v1'},applicationCapabilities:{'windows-desktop':['family.read'],'windows-core-service':['health.read']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete']});
const runtime=new CoreServiceRuntime({policyKernel:kernel,policyVersion});runtime.markReady('leader');const server=new CoreServiceLocalAdminServer({endpoint,authenticationToken:token,runtime});await server.start();
try{
 const adapter=new CoreServiceApplicationAdapter({endpoint,authenticationToken:token});
 const ready=await adapter.getHealth();check(ready.lifecycle==='ready','initial health lifecycle must be ready');check(ready.role==='leader','initial health role must be leader');check(ready.writable===true,'leader must report writable');check(ready.safeMode===false,'ready leader must not report safe mode');
 runtime.enterSafeMode('QUORUM_LOST');
 const degraded=await adapter.getHealth();check(degraded.lifecycle==='degraded','health query must reflect runtime transition, not startup cache');check(degraded.writable===false,'safe-mode health must be read-only');check(degraded.safeMode===true,'safe-mode flag missing');check(degraded.reasons.includes('QUORUM_LOST'),'safe-mode reason missing');
 const zero=evaluateIpcIntegrationPolicy('system:getCoreServiceHealth',[]);check(zero.accepted===true,'zero-argument Core Service health IPC must be accepted');const extra=evaluateIpcIntegrationPolicy('system:getCoreServiceHealth',[{}]);check(extra.accepted===false,'Core Service health IPC must reject unexpected arguments');
} finally {await server.stop();await rm(root,{recursive:true,force:true});}
const {mkdir,writeFile}=await import('node:fs/promises');const report={schemaVersion:1,release:'Bronze 04.08.2026.29',checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/system-health-core-service-ipc-runtime.json',JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`System Health Core Service IPC Runtime: PASS (${checks} checks).`);
