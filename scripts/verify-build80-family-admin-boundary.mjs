import { readFileSync } from 'node:fs';
const repo=readFileSync('packages/repositories/src/account-repository.ts','utf8');
const store=readFileSync('apps/desktop/src/main/data-store.ts','utf8');
const meta=readFileSync('packages/domain/src/app-meta.ts','utf8');
const checks=[
 ['repository method',repo.includes('ensureFamilyAdminExists')],
 ['repository owns update',repo.includes("SET role='family_admin'")],
 ['not exists guard',repo.includes("NOT EXISTS(SELECT 1 FROM accounts WHERE role='family_admin')")],
 ['datastore delegates',store.includes('this.#accountRepository.ensureFamilyAdminExists')],
 ['transaction boundary',store.includes('ensureAdminCorrelationId')&&store.includes('this.#transactionExecutor.execute(ensureAdminCorrelationId')],
 ['direct SQL removed',!store.includes("this.#database.exec(\"UPDATE accounts SET role='family_admin'")],
 ['error propagation',store.includes('ensureAdminResult.error.code')],
 ['version',meta.includes('24.07.2026.80')],
 ['active development',readFileSync('BUILD_STATUS_BRONZE_RC2_BUILD80.md','utf8').includes('RC2 Final: Hayır')],
 ['release notes',readFileSync('RELEASE_NOTES_BRONZE_RC2_BUILD80.md','utf8').includes('SqliteAccountRepository.ensureFamilyAdminExists')]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const passed=checks.filter(([,ok])=>ok).length; console.log(`${passed}/${checks.length} PASS`); if(passed!==checks.length) process.exit(1);
