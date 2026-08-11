import { readFile } from 'node:fs/promises';
import { calculateRuleSetHash, getRuleSetForBuild, readJson, validateLedger } from './lib/master-build-ledger.mjs';

const ledger = await readJson('config/master-build-ledger.json');
const policy = await readJson('config/master-build-ledger-policy.json');
const updateScript = await readFile('scripts/update-master-build-ledger.mjs', 'utf8');
const versionScript = await readFile('scripts/set-workspace-version.mjs', 'utf8');
const decision = await readFile('docs/decisions/DEC-097-conversation-context-capacity-handoff-gate.md', 'utf8');
const adr = await readFile('docs/adr/ADR-080-conversation-context-capacity-handoff-gate.md', 'utf8');

const checks = [];
const check = (condition, label) => checks.push({ label, status: condition ? 'PASS' : 'FAIL' });
const rules = getRuleSetForBuild(ledger, 207);
check(ledger.policyId === 'PPT-BUILD-LEDGER-CONTINUITY-V3', 'ledger policy V3');
check(policy.policyId === 'PPT-BUILD-LEDGER-CONTINUITY-V3', 'policy V3');
check(rules?.version === 'PROJECT-RULES-2026-08-01-V2', 'rule set V2 active');
check(rules?.effectiveBuild === 207, 'rule set effective at Build 207');
check(rules?.rules?.length === 111, '111 binding project rules');
check(rules?.sha256 === calculateRuleSetHash(rules), 'rule set SHA-256 valid');
for (let id = 106; id <= 111; id += 1) check(rules?.rules?.some((rule) => rule.id === `PR-${id}`), `PR-${id} present`);
check(policy.rules.conversationCapacityAssessmentRequiredAfterEveryBuild === true, 'capacity assessment required every build');
check(policy.rules.conversationCapacityWarningUsedPercent === 85, 'warning threshold 85');
check(policy.rules.conversationCapacityHardStopUsedPercent === 90, 'hard-stop threshold 90');
check(policy.rules.newBuildBlockedAtOrAboveHardStop === true, 'new build blocked at hard stop');
check(policy.rules.newChatHandoffPromptRequiredAtOrAboveHardStop === true, 'handoff prompt required');
check(policy.rules.conversationCapacityHardStopHasNoBuildStartException === true, 'hard stop exceptionless');
check(updateScript.includes("percentOption('--context-used-percent', true)"), 'completion requires context-used estimate');
check(updateScript.includes("level === 'HARD_STOP'"), 'completion recognizes HARD_STOP');
check(updateScript.includes('NEW_CHAT_HANDOFF_BUILD${build}.md'), 'handoff prompt file path generated');
check(updateScript.includes('blocked by exceptionless conversation hard stop'), 'standard build start hard-stop gate');
check(versionScript.includes('blocked by exceptionless conversation hard stop'), 'version-update hard-stop gate');
check(decision.includes('DEC-097') && decision.includes('%90'), 'DEC-097 documented');
check(adr.includes('ADR-080') && adr.includes('HARD_STOP'), 'ADR-080 documented');
const entry = ledger.builds.find((item) => item.build === 207);
check(entry?.status === 'COMPLETED', 'Build 207 completed');
check(entry?.conversationCapacityAssessment?.method === 'assistant_estimate', 'Build 207 capacity estimate recorded');
check(entry?.conversationCapacityAssessment?.estimatedUsedPercent === 5, 'Build 207 estimated used context is 5%');
check(entry?.conversationCapacityAssessment?.estimatedRemainingPercent === 95, 'Build 207 estimated remaining context is 95%');
check(entry?.conversationCapacityAssessment?.level === 'NORMAL', 'Build 207 capacity level NORMAL');
check(entry?.rulesAcknowledgement?.version === rules?.version, 'Build 207 acknowledges V2');
check(entry?.rulesAcknowledgement?.sha256 === rules?.sha256, 'Build 207 acknowledges V2 hash');
const base = validateLedger(ledger, policy, { requireCompleted: true });
check(base.failures.length === 0, `base ledger validation (${base.failures.join('; ') || 'clean'})`);

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, build: 207, checks: checks.length, passed: checks.length - failures.length, failed: failures.length, ruleSet: { version: rules?.version, sha256: rules?.sha256, count: rules?.rules?.length }, status: failures.length ? 'FAIL' : 'PASS', results: checks, generatedAt: new Date().toISOString() };
await import('node:fs/promises').then(({ mkdir, writeFile }) => mkdir('artifacts/validation', { recursive: true }).then(() => writeFile('artifacts/validation/build207-conversation-context-handoff-contract.json', `${JSON.stringify(report, null, 2)}\n`)));
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure.label}`);
  process.exit(1);
}
console.log(`Build 207 conversation-context/handoff contract: PASS (${checks.length}/${checks.length}); rules=${rules.rules.length}; sha256=${rules.sha256}`);
