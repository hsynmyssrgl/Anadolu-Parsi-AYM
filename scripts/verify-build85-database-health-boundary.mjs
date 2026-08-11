import { readFileSync, existsSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const ds=read('apps/desktop/src/main/data-store.ts');
const app=read('packages/application/src/database-health-use-cases.ts');
const adapter=read('apps/desktop/src/main/database-health-application-adapter.ts');
const db=read('packages/database/src/health.ts');
const meta=JSON.parse(read('repository-metadata.json'));
const checks=[
 ['application use case exists',app.includes('InspectDatabaseRuntimeHealthUseCase')],
 ['query port exists',app.includes('DatabaseRuntimeHealthQueryPort')],
 ['desktop adapter exists',adapter.includes('SqliteDatabaseRuntimeHealthQueryPort')],
 ['database probe exists',db.includes('inspectSqliteRuntimeHealth')],
 ['integrity pragma owned by database package',db.includes("PRAGMA integrity_check")],
 ['journal pragma owned by database package',db.includes("PRAGMA journal_mode")],
 ['datastore delegates to use case',ds.includes('#inspectDatabaseRuntimeHealthUseCase.execute')],
 ['datastore health method has no direct integrity pragma',!ds.slice(ds.indexOf('public getSystemHealth()'),ds.indexOf('#nextBackupRun')).includes('PRAGMA integrity_check')],
 ['version is build85',meta.versionSequence===85&&meta.revision==='BUILD-85'],
 ['release notes exist',existsSync(new URL('RELEASE_NOTES_BRONZE_RC2_BUILD85.md',root))]
];
for(const [n,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${n}`);
if(checks.some(([,ok])=>!ok)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);
