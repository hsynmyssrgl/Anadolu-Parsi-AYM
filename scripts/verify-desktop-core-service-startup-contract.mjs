import { mkdir, readFile, writeFile } from 'node:fs/promises';

const noWrite = process.argv.includes('--no-write');
const failures=[];let checks=0;const check=(condition,message)=>{checks++;if(!condition)failures.push(message)};
const [main, connector, adapter] = await Promise.all([
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('apps/desktop/src/main/core-service-startup-connection.ts','utf8'),
  readFile('apps/desktop/src/main/core-service-application-adapter.ts','utf8')
]);
check(main.includes("| 'CORE_SERVICE_CONNECTION'"),'startup stage CORE_SERVICE_CONNECTION missing');
check(main.includes("startupStage = 'CORE_SERVICE_CONNECTION';"),'Core Service startup stage is not entered');
check(main.includes('coreServiceStartupConnection = await connectCoreServiceAtStartup({'),'Desktop startup does not await Core Service connection');
check(main.includes("join(runtime().config.paths.secrets, 'core-service-connection.pptsecret')"),'Core Service authority is not loaded from the protected secrets path');
check(main.indexOf("startupStage = 'CORE_SERVICE_CONNECTION';") < main.indexOf("startupStage = 'IPC_REGISTRATION';"),'Core Service connection must precede IPC registration');
check(main.indexOf("startupStage = 'CORE_SERVICE_CONNECTION';") < main.indexOf("startupStage = 'WINDOW_CREATION';"),'Core Service connection must precede window creation');
check(!main.includes('PPT_CORE_SERVICE_ADMIN_TOKEN'),'Desktop main must not read a Core Service authentication token from environment variables');
check(!connector.includes('process.env.PPT_CORE_SERVICE'),'startup connector must not read Core Service credentials from environment variables');
check(connector.includes("health.policyVersion !== authority.expectedPolicyVersion"),'policy version handshake mismatch is not rejected');
check(connector.includes("architecture.ownership.policyKernel !== 'core-service'"),'Core Service policy ownership mismatch is not rejected');
check(connector.includes('CORE_SERVICE_REQUIRED_DESKTOP_METHODS.some'),'required typed API methods are not verified at startup');
check(connector.includes('adapter.getFamilyDataStatus()'),'family-data ownership status is not requested at startup');
check(connector.includes('adapter.getDeviceSecretProtectionStatus()'),'device-secret protection status is not requested at startup');
check(connector.includes('adapter.getFamilyDataCutoverStatus()'),'family-data cutover status is not requested at startup');
check(connector.includes('adapter.getFamilyDataCutoverReadinessStatus()'),'family-data cutover readiness status is not requested at startup');
check(connector.includes('familyData.persistentPathExposed !== false'),'family-data path exposure is not rejected');
check(connector.includes('architecture.ownership.familyData !== familyData.owner'),'family-data ownership contradiction is not rejected');
check(connector.includes("familyData.owner === 'core-service'") && connector.includes('!familyData.protectedSessionAttached'),'unattached Core Service family-data ownership is not rejected');
check(connector.includes("familyData.owner === 'desktop-transition' && familyData.writable"),'writable Desktop transition is not rejected');
check(connector.includes('deviceSecretProtection.secretMaterialExposed !== false'),'device-secret material exposure is not rejected');
check(connector.includes('deviceSecretProtection.electronDependency !== false'),'Core Service Electron dependency is not rejected');
check(connector.includes('architecture.ownership.deviceSecretProtection !== deviceSecretProtection.owner'),'device-secret ownership contradiction is not rejected');
check(connector.includes("familyDataCutover.decision !== 'blocked'"),'non-blocked family-data cutover is not rejected');
check(connector.includes('familyDataCutover.realDataTransferAllowed !== false'),'real data transfer permission is not rejected');
check(connector.includes('familyDataCutover.writeOwnershipTransferAllowed !== false'),'write ownership transfer permission is not rejected');
check(connector.includes('familyDataCutover.cutoverAuthorityAttached !== false'),'unexpected cutover authority is not rejected');
check(connector.includes('familyDataCutover.requiredGates.some'),'cutover acceptance gate tampering is not rejected');
check(connector.includes('isSafeCoreServiceCutoverReadinessStatus'),'cutover-readiness evidence is not validated at startup');
check(connector.includes('canonicalizeCoreServiceCutoverReadinessEntry'),'cutover-readiness hash chain is not recomputed at startup');
check(connector.includes('status.headHash !== previousHash'),'cutover-readiness head hash tampering is not rejected');
check(connector.includes('status.cutoverAuthorityAttached !== false'),'cutover-readiness authority attachment is not rejected');
check(connector.includes("'ARCHITECTURE_MISMATCH'"),'architecture mismatch is not fail-closed');
check(connector.includes("health.lifecycle !== 'ready' && health.lifecycle !== 'degraded'"),'unsafe Core Service lifecycle is not rejected');
check(connector.includes("'AUTHORITY_UNAVAILABLE'"),'missing protected authority is not fail-closed');
check(connector.includes("'CONNECTION_FAILED'"),'connection failure is not fail-closed');
check(adapter.includes('new CoreServiceLocalAdminClient'),'Desktop adapter does not use the versioned local admin client');
check(adapter.includes('getArchitecture()'),'Desktop adapter does not expose the architecture manifest');
check(adapter.includes('getFamilyDataStatus()'),'Desktop adapter does not expose family-data ownership status');
check(adapter.includes('getDeviceSecretProtectionStatus()'),'Desktop adapter does not expose device-secret protection status');
check(adapter.includes('getFamilyDataCutoverStatus()'),'Desktop adapter does not expose family-data cutover status');
check(adapter.includes('getFamilyDataCutoverReadinessStatus()'),'Desktop adapter does not expose family-data cutover readiness status');
const report={schemaVersion:1,release:'Bronze 04.08.2026.29',checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
if (!noWrite) {
 await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/desktop-core-service-startup-contract.json',JSON.stringify(report,null,2)+'\n');
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Desktop Core Service Startup Contract: PASS (${checks} checks; write=${!noWrite}).`);
