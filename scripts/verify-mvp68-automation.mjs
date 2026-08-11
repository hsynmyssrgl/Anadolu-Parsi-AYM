import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const ds=read('apps/desktop/src/main/data-store.ts');
const app=read('packages/application/src/automation-use-cases.ts');
const repo=read('packages/repositories/src/automation-repository.ts');
const adapter=read('apps/desktop/src/main/automation-application-adapter.ts');
const checks=[
 ['repository',repo.includes('class SqliteAutomationRepository')],
 ['list rules',repo.includes('listRules')],
 ['insert rule',repo.includes('insertRule')],
 ['toggle',repo.includes('setRuleEnabled')],
 ['list runs',repo.includes('listRuns')],
 ['use cases',app.includes('CreateAutomationRuleUseCase')&&app.includes('ListAutomationRunsUseCase')],
 ['validation',app.includes('0-365')&&app.includes('title.trim()')],
 ['adapter',adapter.includes('class RepositoryBackedAutomationAdapter')],
 ['datastore wiring',ds.includes('#listAutomationRulesUseCase')&&ds.includes('#automationApplicationContext')],
 ['direct sql removed',!ds.includes("prepare('SELECT id,title,source_type,days_before,enabled,created_at FROM automation_rules")&&!ds.includes("prepare('INSERT INTO automation_rules")&&!ds.includes("prepare('UPDATE automation_rules SET enabled")&&!ds.includes("prepare('SELECT id,rule_id,source_type,source_id,title,due_at,status,generated_task_id,created_at FROM automation_runs")]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(x=>x[1]).length}/${checks.length}`);
