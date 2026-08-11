import { LEDGER_PATH, POLICY_PATH, readJson, validateLedger, writeLedgerDocument } from './lib/master-build-ledger.mjs';

const ledger = await readJson(LEDGER_PATH);
const policy = await readJson(POLICY_PATH);
const { failures } = validateLedger(ledger, policy, { requireCompleted: false });
if (failures.length > 0) {
  console.error(`Master build ledger generation blocked by ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
await writeLedgerDocument(ledger);
console.log(`Master build ledger document generated: ${ledger.builds.length} builds / ${ledger.remainingWork.length} work items.`);
