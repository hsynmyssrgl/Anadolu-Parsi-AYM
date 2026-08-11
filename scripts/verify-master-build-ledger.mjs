import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DOCUMENT_PATH, LEDGER_PATH, POLICY_PATH, getRuleSetForBuild, readJson, renderLedgerMarkdown, validateLedger } from './lib/master-build-ledger.mjs';

const args = process.argv.slice(2);
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : 'artifacts/validation/master-build-ledger.json';
if (!reportPath) throw new Error('--report requires a value.');
const ledger = await readJson(LEDGER_PATH);
const policy = await readJson(POLICY_PATH);
const { failures, currentEntry, firstOpen } = validateLedger(ledger, policy, { requireCompleted: true });
const expectedDocument = `${renderLedgerMarkdown(ledger)}\n`;
const actualDocument = await readFile(DOCUMENT_PATH, 'utf8');
if (actualDocument !== expectedDocument) failures.push(`${DOCUMENT_PATH} is stale or manually changed; regenerate from ${LEDGER_PATH}`);

const currentRuleSet = getRuleSetForBuild(ledger, ledger.currentBuild);
const evidence = {
  schemaVersion: 1,
  policyId: policy.policyId,
  product: ledger.product,
  currentBuild: ledger.currentBuild,
  currentVersion: ledger.currentVersion,
  projectRuleSet: currentRuleSet ? { version: currentRuleSet.version, sha256: currentRuleSet.sha256, ruleCount: currentRuleSet.rules.length } : null,
  completedBuilds: ledger.builds.filter((entry) => entry.status === 'COMPLETED').length,
  buildEntries: ledger.builds.length,
  remainingWorkItems: ledger.remainingWork.length,
  nextAction: firstOpen ? { id: firstOpen.id, title: firstOpen.title, plannedBuild: firstOpen.plannedBuild ?? null } : null,
  currentSummary: currentEntry?.summary ?? null,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Master build ledger verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Master build ledger verified: ${evidence.completedBuilds}/${evidence.buildEntries} completed; next=${evidence.nextAction?.id}.`);
