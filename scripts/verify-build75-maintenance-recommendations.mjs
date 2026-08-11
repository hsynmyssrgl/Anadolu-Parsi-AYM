import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const app=fs.readFileSync(path.join(root,'packages/application/src/operational-health-use-cases.ts'),'utf8');
const ds=fs.readFileSync(path.join(root,'apps/desktop/src/main/data-store.ts'),'utf8');
const checks=[
 ['use case exists',app.includes('class GetMaintenanceRecommendationsUseCase')],
 ['failed backup query through port',app.includes("countFailedBackupsSince(c, '1970-01-01T00:00:00.000Z')")],
 ['vacuum threshold',app.includes('536_870_912')],
 ['analyze threshold',app.includes('104_857_600')],
 ['disk threshold',app.includes('2_147_483_648')],
 ['healthy fallback',app.includes("code:'system.healthy'")],
 ['datastore wiring',ds.includes('new GetMaintenanceRecommendationsUseCase(operationalHealthAdapter)')],
 ['datastore delegates',ds.includes("maintenance-recommendations")],
 ['direct failed backup SQL removed',!ds.includes("SELECT COUNT(*) c FROM backup_runs WHERE status='failed'")],
 ['result copied',ds.includes('return [...result.value]')]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const passed=checks.filter(([,ok])=>ok).length;
console.log(`${passed}/${checks.length}`);
if(passed!==checks.length) process.exit(1);
