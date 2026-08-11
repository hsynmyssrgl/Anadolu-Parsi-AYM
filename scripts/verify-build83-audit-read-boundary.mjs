import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const app=read('packages/application/src/audit-read-use-cases.ts');
const repo=read('packages/repositories/src/audit-repository.ts');
const adapter=read('apps/desktop/src/main/audit-read-application-adapter.ts');
const store=read('apps/desktop/src/main/data-store.ts');
const meta=read('packages/domain/src/app-meta.ts');
const checks=[
 ['use case exists',app.includes('GetLatestAuditOccurredAtUseCase')],
 ['query port exists',app.includes('AuditReadQueryPort')],
 ['repository method exists',repo.includes('latestOccurredAt(context')],
 ['repository owns SQL',repo.includes('SELECT occurred_at FROM audit_log ORDER BY occurred_at DESC LIMIT 1')],
 ['adapter exists',adapter.includes('RepositoryBackedAuditReadQueryPort')],
 ['transaction executor used',adapter.includes('transactionExecutor.execute')],
 ['datastore delegates',store.includes('#getLatestAuditOccurredAtUseCase.execute')],
 ['direct snapshot SQL removed',!store.includes("const audit = this.#database.prepare(\n      'SELECT occurred_at FROM audit_log ORDER BY occurred_at DESC LIMIT 1'")],
 ['version updated',meta.includes("version: '24.07.2026.83'")],
 ['active development',meta.includes('Aktif Geliştirme')]
];
let passed=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok)passed++;}
console.log(`RESULT ${passed}/${checks.length}`); if(passed!==checks.length)process.exit(1);
