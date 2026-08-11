import { mkdir, readFile, writeFile } from 'node:fs/promises';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const [main,preload,globalTypes,policy,app]=await Promise.all([
 readFile('apps/desktop/src/main/main.ts','utf8'),readFile('apps/desktop/src/main/preload.ts','utf8'),readFile('apps/desktop/src/renderer/global.d.ts','utf8'),readFile('apps/desktop/src/main/ipc-integration-policy.ts','utf8'),readFile('apps/desktop/src/renderer/App.tsx','utf8')
]);
check(main.includes("registerIpcHandler('system:getCoreServiceHealth', () => coreServiceConnection().adapter.getHealth())"),'Core Service health IPC does not query the Core Service adapter');
check(!main.includes("registerIpcHandler('system:getCoreServiceHealth', () => store().getSystemHealth())"),'Core Service health IPC incorrectly uses the Desktop datastore');
check(preload.includes("getCoreServiceHealth:():Promise<CoreServiceHealthContract>=>invoke('system:getCoreServiceHealth')"),'preload Core Service health bridge missing');
check(globalTypes.includes('getCoreServiceHealth():Promise<CoreServiceHealthContract>'),'renderer Core Service health type contract missing');
check(policy.includes("case 'system:getCoreServiceHealth':"),'IPC integration policy does not explicitly classify Core Service health');
check(app.includes('window.pardus.getCoreServiceHealth().catch(()=>undefined)'),'System Management screen does not request Core Service health');
check(app.includes('setCoreServiceHealth(coreHealth)'),'System Management screen does not retain Core Service health state');
check(app.includes('Core Service</small>'),'System Management screen does not render Core Service status');
check(app.includes("coreServiceHealth.writable?'Yazılabilir':'Salt-okunur'"),'Core Service writable/read-only status is not shown');
check(app.includes("coreServiceHealth.safeMode?'Güvenli mod':'Normal'"),'Core Service safe-mode status is not shown');
const report={schemaVersion:1,release:'Bronze 04.08.2026.29',checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/system-health-core-service-ipc-contract.json',JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`System Health Core Service IPC Contract: PASS (${checks} checks).`);
