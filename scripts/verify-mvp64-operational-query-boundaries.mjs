import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../packages/application/src/operational-health-use-cases.ts',import.meta.url),'utf8');
const repo=readFileSync(new URL('../packages/repositories/src/diagnostic-repository.ts',import.meta.url),'utf8');
const adapter=readFileSync(new URL('../apps/desktop/src/main/operational-health-application-adapter.ts',import.meta.url),'utf8');
const store=readFileSync(new URL('../apps/desktop/src/main/data-store.ts',import.meta.url),'utf8');
const checks=[
 ['health since port',app.includes('listSystemHealthHistorySince(context: OperationalHealthApplicationContext, since: string)')],
 ['maintenance search port',app.includes('searchMaintenanceHistory(context: OperationalHealthApplicationContext, input: MaintenanceHistoryFilterInput)')],
 ['health since use case',app.includes('class ListSystemHealthHistorySinceUseCase')],
 ['maintenance search use case',app.includes('class SearchMaintenanceHistoryUseCase')],
 ['health repository query',repo.includes("WHERE captured_at>=? ORDER BY captured_at")],
 ['maintenance repository filtering',repo.includes('public searchMaintenanceHistory')&&repo.includes("where.push('operation=?')")],
 ['adapter health connection',adapter.includes('listSystemHealthHistorySince(c:OperationalHealthApplicationContext')],
 ['adapter maintenance connection',adapter.includes('searchMaintenanceHistory(c:OperationalHealthApplicationContext')],
 ['DataStore health use case',store.includes("#listSystemHealthHistorySinceUseCase.execute")&&!store.includes("prepare('SELECT score,captured_at FROM system_health_history")],
 ['DataStore maintenance use case',store.includes("#searchMaintenanceHistoryUseCase.execute")&&!store.includes("prepare('SELECT * FROM maintenance_history ORDER BY started_at DESC LIMIT ?')")]
];
let passed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(ok)passed++;}
console.log(`${passed}/${checks.length} başarılı`);if(passed!==checks.length)process.exit(1);
