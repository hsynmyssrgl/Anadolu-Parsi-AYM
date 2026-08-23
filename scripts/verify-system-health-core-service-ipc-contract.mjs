import { mkdir, readFile, writeFile } from 'node:fs/promises';
const failures=[];let checks=0;const check=(c,m)=>{checks++;if(!c)failures.push(m)};
const [main,preload,globalTypes,policy,app,rootPackageSource]=await Promise.all([
 readFile('apps/desktop/src/main/main.ts','utf8'),readFile('apps/desktop/src/main/preload.ts','utf8'),readFile('apps/desktop/src/renderer/global.d.ts','utf8'),readFile('apps/desktop/src/main/ipc-integration-policy.ts','utf8'),readFile('apps/desktop/src/renderer/App.tsx','utf8'),readFile('package.json','utf8')
]);
const rootVersion=JSON.parse(rootPackageSource).version;
const release=`Bronze ${String(rootVersion).replace(/^(\d+)\.(\d+)\.(\d+)-(\d+)$/,(_match,day,month,year,build)=>`${day.padStart(2,'0')}.${month.padStart(2,'0')}.${year}.${build}`)}`;
check(main.includes("registerIpcHandler('system:getCoreServiceHealth', () => coreServiceConnection().adapter.getHealth())"),'Core Service health IPC does not query the Core Service adapter');
check(!main.includes("registerIpcHandler('system:getCoreServiceHealth', () => store().getSystemHealth())"),'Core Service health IPC incorrectly uses the Desktop datastore');
check(preload.includes("getCoreServiceHealth:():Promise<CoreServiceHealthContract>=>invoke('system:getCoreServiceHealth')"),'preload Core Service health bridge missing');
check(globalTypes.includes('getCoreServiceHealth():Promise<CoreServiceHealthContract>'),'renderer Core Service health type contract missing');
check(policy.includes("case 'system:getCoreServiceHealth':"),'IPC integration policy does not explicitly classify Core Service health');
check(app.includes('window.pardus!.getCoreServiceHealth()')||app.includes('window.pardus.getCoreServiceHealth()'),'System Management screen does not request Core Service health');
check(app.includes('setCoreServiceHealth(coreHealth)'),'System Management screen does not retain Core Service health state');
check(app.includes("language==='tr'?'Temel Hizmet':'Core Service'"),'System Management screen does not render localized Core Service status');
check(app.includes("coreServiceHealth.writable?(language==='tr'?'Yazılabilir':'Writable')"),'Core Service writable/read-only status is not localized');
check(app.includes("coreServiceHealth.safeMode?(language==='tr'?'Güvenli mod':'Safe mode')"),'Core Service safe-mode status is not localized');
const report={schemaVersion:1,release,checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};await mkdir('artifacts/validation',{recursive:true});await writeFile('artifacts/validation/system-health-core-service-ipc-contract.json',JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log(`System Health Core Service IPC Contract: PASS (${checks} checks).`);
