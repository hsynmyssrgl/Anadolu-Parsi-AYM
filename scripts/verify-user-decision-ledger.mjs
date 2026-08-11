import { mkdir, writeFile } from 'node:fs/promises';
import { exists, readJson } from './lib/governance-utils.mjs';

const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks++;
  if (!condition) failures.push(message);
};

const ledger = await readJson('config/user-decision-ledger.json');
const decisions = ledger.decisions ?? [];
const ids = new Set();

for (const decision of decisions) {
  check(/^DEC-\d{3}$/.test(decision.id), `invalid decision id ${decision.id}`);
  check(!ids.has(decision.id), `duplicate decision ${decision.id}`);
  ids.add(decision.id);
}

for (const decision of decisions) {
  check(
    decision.status === 'ACTIVE' || decision.status === 'SUPERSEDED',
    `${decision.id} has unsupported status ${decision.status}`,
  );
  if (decision.status === 'SUPERSEDED') {
    check(Boolean(decision.supersededBy), `${decision.id} supersededBy missing`);
    check(ids.has(decision.supersededBy), `${decision.id} supersededBy target missing ${decision.supersededBy}`);
    const successor = decisions.find((candidate) => candidate.id === decision.supersededBy);
    check(successor?.status === 'ACTIVE', `${decision.id} supersededBy target not ACTIVE ${decision.supersededBy}`);
  }
  check(Boolean(decision.title), `${decision.id} title missing`);
  if (decision.document) check(await exists(decision.document), `${decision.id} document missing ${decision.document}`);
  for (const path of decision.documents ?? []) {
    check(await exists(path), `${decision.id} affected document missing ${path}`);
  }
}

check(ledger.decisionCount === ids.size, `decisionCount ${ledger.decisionCount}/${ids.size}`);
for (let number = 123; number <= 128; number++) check(ids.has(`DEC-${number}`), `DEC-${number} missing`);

const report = {
  schemaVersion: 1,
  release: ledger.release,
  checks,
  decisions: ids.size,
  status: failures.length ? 'FAIL' : 'PASS',
  failures,
  generatedAt: new Date().toISOString(),
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/user-decision-ledger-gate.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`User Decision Ledger: PASS (${checks} checks / ${ids.size} decisions).`);
