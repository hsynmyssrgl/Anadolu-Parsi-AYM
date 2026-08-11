import { readFileSync } from 'node:fs';
const repo=readFileSync('packages/repositories/src/audit-repository.ts','utf8');
const store=readFileSync('apps/desktop/src/main/data-store.ts','utf8');
const meta=readFileSync('packages/domain/src/app-meta.ts','utf8');
const checks=[
 ['repository method',repo.includes('backfillMissingChain')],
 ['repository owns legacy select',repo.includes('FROM audit_log ORDER BY rowid ASC')],
 ['repository owns legacy update',repo.includes('UPDATE audit_log SET actor_id=?,prev_hash=?,entry_hash=?,sequence_no=?,hash_version=1')],
 ['v1 hash preserved',repo.includes('computeAuditEntryHashV1')],
 ['datastore delegates',store.includes('this.#auditRepository.backfillMissingChain')],
 ['transaction boundary',store.includes('auditBackfillCorrelationId')&&store.includes('this.#transactionExecutor.execute(auditBackfillCorrelationId')],
 ['datastore method removed',!store.includes('#backfillAuditChain(): void')],
 ['error propagation',store.includes('auditBackfillResult.error.code')],
 ['version',meta.includes('24.07.2026.81')&&meta.includes('Build 81')],
 ['active development',readFileSync('BUILD_STATUS_BRONZE_RC2_BUILD81.md','utf8').includes('RC2 Final: Hayır')]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const passed=checks.filter(([,ok])=>ok).length; console.log(`${passed}/${checks.length} PASS`); if(passed!==checks.length) process.exit(1);
