import { readFileSync } from 'node:fs';
const file = new URL('../apps/desktop/src/main/data-store.ts', import.meta.url);
const source = readFileSync(file, 'utf8');
const checks = [
  ['currentAccount exists', source.includes('#currentAccount():')],
  ['repository findById used', source.includes('this.#accountRepository.findById')],
  ['transaction executor used', source.includes('this.#transactionExecutor.execute(correlationId')],
  ['repository context transaction', source.includes('transaction: transaction.database')],
  ['active status preserved', source.includes("account.status !== 'active'")],
  ['startsAt validation preserved', source.includes('new Date(account.startsAt).getTime() > now')],
  ['endsAt validation preserved', source.includes('new Date(account.endsAt).getTime() < now')],
  ['AI context reuses currentAccount', source.includes('#aiConsentApplicationContext(prefix:string) { const accountId=this.#requireAuth(); const account=this.#currentAccount();')],
  ['AI direct account SQL removed', !source.includes("SELECT role,person_id FROM accounts WHERE id=?")],
  ['currentAccount direct SQL removed', !source.includes("SELECT id,role,person_id,status,starts_at,ends_at FROM accounts WHERE id=?")]
];
let passed=0;
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) passed++; }
console.log(`Result: ${passed} / ${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
