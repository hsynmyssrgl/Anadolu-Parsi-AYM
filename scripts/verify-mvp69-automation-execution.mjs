import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url); const read=p=>readFileSync(new URL(p,root),'utf8');
const ds=read('apps/desktop/src/main/data-store.ts'); const app=read('packages/application/src/automation-use-cases.ts'); const repo=read('packages/repositories/src/automation-repository.ts'); const adapter=read('apps/desktop/src/main/automation-application-adapter.ts');
const checks=[
 ['run use case',app.includes('class RunAutomationRulesUseCase')&&app.includes('Otomasyon zamanı geçersiz')],
 ['execution port',app.includes('executeDueRules')&&app.includes('AutomationExecutionIdentifiers')],
 ['enabled rules repository',repo.includes('listEnabledRules')&&repo.includes('WHERE enabled=1')],
 ['due source repository',repo.includes('listDueSources')&&repo.includes("sourceType === 'important_day'")&&repo.includes("sourceType === 'medication_plan'")],
 ['dedup repository',repo.includes('runExists')&&repo.includes('rule_id=? AND source_type=? AND source_id=?')],
 ['task owner repository',repo.includes('resolveTaskOwnerPersonId')&&repo.includes('JOIN people ON people.id=accounts.person_id')],
 ['transactional inserts',repo.includes('insertGeneratedTask')&&repo.includes('insertRun')],
 ['audit in transaction',adapter.includes('auditRepository.append')&&adapter.includes("action:'automation.executed'")],
 ['datastore use case wiring',ds.includes('#runAutomationRulesUseCase')&&ds.includes('new RunAutomationRulesUseCase')],
 ['direct execution sql removed',!ds.includes("SELECT id,title,source_type,days_before FROM automation_rules WHERE enabled=1")&&!ds.includes('INSERT INTO automation_runs')&&!ds.includes("INSERT INTO life_records (id,family_id,owner_person_id,category,title,status,privacy,due_at,notes,created_at)")]
];
for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)process.exitCode=1;} console.log(`${checks.filter(x=>x[1]).length}/${checks.length}`);
