import { readFileSync } from 'node:fs';
const repo=readFileSync('packages/repositories/src/bootstrap-repository.ts','utf8');
const app=readFileSync('packages/application/src/bootstrap-use-cases.ts','utf8');
const adapter=readFileSync('apps/desktop/src/main/bootstrap-application-adapter.ts','utf8');
const store=readFileSync('apps/desktop/src/main/data-store.ts','utf8');
const meta=readFileSync('packages/domain/src/app-meta.ts','utf8');
const checks=[
 ['use case exists',app.includes('class SeedDefaultFamilyUseCase')],
 ['repository owns seed SQL',repo.includes('seedIfEmpty')&&repo.includes('INSERT INTO families')&&repo.includes('INSERT INTO events')],
 ['idempotent empty check',repo.includes('SELECT COUNT(*) AS total FROM families')&&repo.includes('return false')],
 ['adapter transaction boundary',adapter.includes('RepositoryBackedBootstrapApplicationUnitOfWork')&&adapter.includes('transactionExecutor.execute')],
 ['datastore delegates',store.includes('this.#seedDefaultFamilyUseCase.execute')],
 ['manual transaction removed',!store.includes("this.#database.exec('BEGIN IMMEDIATE')")&&!store.includes("this.#database.exec('ROLLBACK')")],
 ['seed SQL removed from datastore',!store.includes('INSERT INTO families (id, name, created_at)')&&!store.includes('const insertPerson = this.#database.prepare')],
 ['audit in use case',app.includes("action: 'database.seeded'")&&app.includes('scope.appendAudit')],
 ['version',meta.includes('24.07.2026.82')&&meta.includes('Build 82')],
 ['active development',readFileSync('BUILD_STATUS_BRONZE_RC2_BUILD82.md','utf8').includes('RC2 Final: Hayır')]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const passed=checks.filter(([,ok])=>ok).length; console.log(`${passed}/${checks.length} PASS`); if(passed!==checks.length) process.exit(1);
