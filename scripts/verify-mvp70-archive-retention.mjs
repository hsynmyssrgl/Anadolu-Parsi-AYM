import { readFileSync } from 'node:fs';
const root=new URL('../',import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),'utf8');
const ds=read('apps/desktop/src/main/data-store.ts');
const app=read('packages/application/src/archive-use-cases.ts');
const repo=read('packages/repositories/src/archive-repository.ts');
const adapter=read('apps/desktop/src/main/archive-application-adapter.ts');
const checks=[
 ['retention query use cases', app.includes('ListArchiveRetentionPoliciesUseCase') && app.includes('ListArchiveRetentionStatusUseCase')],
 ['retention command use cases', app.includes('CreateArchiveRetentionPolicyUseCase') && app.includes('AssignArchiveRetentionPolicyUseCase')],
 ['destruction split use cases', app.includes('PrepareArchiveDestructionUseCase') && app.includes('MarkArchiveDestroyedUseCase')],
 ['policy validation', app.includes('36500') && app.includes("resourceType:'archive_retention_policy'") && !app.includes("role!=='family_admin'") && adapter.includes('executeGoverned')],
 ['repository policy operations', repo.includes('listRetentionPolicies') && repo.includes('insertRetentionPolicy') && repo.includes('assignRetentionPolicy')],
 ['repository eligibility calculation', repo.includes('listRetentionStatus') && repo.includes('eligibleForDestruction')],
 ['repository destruction guard', repo.includes('getDestructionPlan') && repo.includes('Saklama süresi henüz dolmadı')],
 ['adapter authorization and transaction', adapter.includes('listRetentionStatus') && adapter.includes('markDestroyed') && adapter.includes('auditRepository.append')],
 ['datastore use case wiring', ds.includes('#prepareArchiveDestructionUseCase') && ds.includes('#markArchiveDestroyedUseCase')],
 ['direct retention sql removed', !ds.includes('SELECT id,name,retention_days,secure_destroy,created_at FROM archive_retention_policies') && !ds.includes('UPDATE archive_items SET retention_policy_id') && !ds.includes('UPDATE archive_items SET destroyed_at')]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1;}
console.log(`${checks.filter(([,ok])=>ok).length}/${checks.length}`);
