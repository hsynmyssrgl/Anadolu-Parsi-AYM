import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const failures = [];
let checks = 0;
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const [policy, registry, plan, governance, decisions, capacity] = await Promise.all([
  readJson('config/bronze-backlog-priority-policy.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('config/conversation-capacity-policy.json')
]);

const historicalSelection = policy.selectionHistory?.find((item) => item.step === '30-M')
  ?? (policy.currentSelection?.step === '30-M' ? policy.currentSelection : undefined);
const selected = registry.requirements.find((item) => item.id === historicalSelection?.requirementId);
const workStep = plan.steps.find((item) => item.id === '30-M');

check(policy.release === registry.release, 'priority policy release mismatch');
check(policy.authorityDecision === 'DEC-137', 'DEC-137 authority missing');
check(decisions.decisions.some((item) => item.id === 'DEC-137' && item.status === 'ACTIVE'), 'DEC-137 is not active');
check(policy.mode === 'FULL_AUTO_INCOMPLETE_BRONZE_EXECUTION', 'full-auto mode missing');
check(JSON.stringify(policy.startedWorkStatuses) === JSON.stringify(['PARTIAL', 'FOUNDATION_STARTED']), 'started-work ordering changed');
check(JSON.stringify(policy.unstartedWorkStatuses) === JSON.stringify(['NOT_IMPLEMENTED']), 'unstarted-work ordering changed');
check(JSON.stringify(policy.priorityOrder) === JSON.stringify(['P0', 'P1', 'P2']), 'priority ordering changed');
check(policy.externalBlockersDoNotBecomePass === true, 'external blocker could become PASS');
check(policy.externalBlockersDoNotBlockRunnableQueue === true, 'external blocker incorrectly blocks runnable queue');
check(policy.singleActiveWorkStep === true, 'single-active-step rule missing');
check(policy.persistentReceiptRequiredBeforeAdvance === true, 'persistent receipt advance gate missing');
check(Boolean(historicalSelection), '30-M selection history missing');
if (historicalSelection) {
  check(historicalSelection.requirementId === 'PPK-002', '30-M historical requirement mismatch');
  check(historicalSelection.selectionClass === 'STARTED_P0_DEPENDENCY_AND_SECURITY_UNBLOCKER', '30-M historical selection class mismatch');
}
check(Boolean(selected), 'selected requirement missing from registry');
if (selected) {
  check(selected.status === 'PARTIAL', 'selected requirement must be a started PARTIAL item');
  check(selected.priority === 'P0', 'selected requirement must be P0');
}
check(Boolean(workStep), '30-M work step missing');
if (workStep) {
  check(workStep.scopeRequirement === 'PPK-002', '30-M scope requirement mismatch');
  check(['IN_PROGRESS', 'COMPLETED'].includes(workStep.status), '30-M lifecycle state invalid');
  if (workStep.status === 'COMPLETED') {
    check(workStep.validationStatus === 'PASS', 'completed 30-M validation must be PASS');
    check(workStep.persistentReceiptStatus === 'PASS', 'completed 30-M receipt must be PASS');
    check(workStep.persistentReceiptPath === 'artifacts/checkpoints/30-M_LIBRARY_RECEIPT.json', 'completed 30-M receipt path mismatch');
  }
}
check(['30-M', '30-N'].includes(plan.currentStep), 'work plan must be at 30-M or its governed successor 30-N');
if (plan.currentStep === '30-M') {
  check(governance.activeMicroStep === '30-M' || governance.activeMicroStep === null, '30-M governance transition state invalid');
} else {
  check(governance.activeMicroStep === '30-N', '30-N must be active after 30-M durable completion');
  check(governance.nextOfficialTask.startsWith('30-N PPK-002'), '30-N must continue governed PPK-002 work');
  check(governance.supersessions.some((item) => item.id === 'GOV-SUP-30-M-002' && item.evidence === 'artifacts/checkpoints/30-M_COMPLETION_RECORD.json'), '30-M completion supersession missing');
}
check(policy.userConfiguredCreditStop.previousUsedPercent === 95, 'cancelled user threshold history missing');
check(policy.userConfiguredCreditStop.status === 'CANCELLED_BY_USER', 'user 95 percent stop was not cancelled');
check(capacity.actualMetricOnly === true, 'canonical capacity policy must remain actual-only');
check(capacity.hardStopUsedPercent === 90, 'canonical PR-172 hard stop changed without authority');
check(policy.preservedExternalBlockers.some((item) => item.requirementId === 'B2-01' && item.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'), 'B2-01 native blocker truth missing');

const report = {
  schemaVersion: 1,
  release: registry.release,
  step: '30-M',
  requirement: 'PPK-002',
  checks,
  passed: checks - failures.length,
  failed: failures.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  userConfiguredCreditStop95: 'CANCELLED',
  canonicalConversationCapacityPolicy: 'UNCHANGED_PLATFORM_ACTUAL_OR_UNAVAILABLE',
  nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/30-M-bronze-backlog-priority-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`30-M Bronze backlog priority contract: PASS (${checks}/${checks}).`);
