import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json', scope: 'config/31-j-family-data-coexistence-default-deny-cutover-gate-scope.json',
  decision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  predecessorCompletion: 'artifacts/checkpoints/31-I_COMPLETION_RECORD.json', predecessorReceipt: 'artifacts/checkpoints/31-I_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-J_MAIN_STRUCTURE_SECURITY_HARDENING_AUTHORITY.json',
  validation: 'artifacts/validation/31-J_PRIORITY_SELECTION_VALIDATION.json', execution: 'artifacts/checkpoints/31-J_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [plan, ledger, registry, decisions, scope, completion, receipt] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.predecessorCompletion), readJson(paths.predecessorReceipt)
]);
await readFile(full(paths.decision), 'utf8');
assert(plan.currentStep === '31-I' && plan.steps.find((item) => item.id === '31-I')?.status === 'COMPLETED', '31-I is not completed');
assert(completion.status === 'PASS' && completion.persistentReceiptStatus === 'PASS' && receipt.status === 'PASS', '31-I persistent receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-I_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-I ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-J'), '31-J already exists');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-J requirements are not open P0 work');
const checks = [
  ['31-I predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['security-hardening continuation', scope.decision === 'DEC-171' && scope.primaryRequirement === 'DHA-001'],
  ['legacy authority preserved', scope.targets.legacyAuthority === 'DESKTOP_VAULT_AND_ACTIVE_SQLITE_REMAIN_AUTHORITATIVE'],
  ['default-deny Core Service', scope.targets.coreServiceDefault === 'REAL_DATA_AND_WRITE_OWNERSHIP_CUTOVER_BLOCKED'],
  ['composition attachment fence', scope.targets.compositionFence === 'CORE_SERVICE_FAMILY_DATA_SESSION_ATTACHMENT_REJECTED'],
  ['automatic activation forbidden', scope.targets.automaticActivation === 'FORBIDDEN'],
  ['all future gates explicit', scope.requiredFutureGates.length === 5],
  ['no real migration or Build', scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED' && scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-J priority selection failed');
const generatedAt = new Date().toISOString();
scope.status = 'IN_PROGRESS'; scope.startedAt = generatedAt; await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-J', status: 'PASS', authority: 'EXPLICIT_USER_NEW_ARCHITECTURE_SECURITY_HARDENING',
  decision: 'DEC-171', predecessor: { step: '31-I', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  selectedBoundary: 'FAMILY_DATA_COEXISTENCE_DEFAULT_DENY_CUTOVER_GATE', requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-J', phase: 'MAIN_STRUCTURE_SECURITY_HARDENING_PRIORITY', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
plan.steps.push({
  id: '31-J', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-J'; plan.updatedAt = generatedAt;
plan.segmentationNote = '31-J strengthens the new architecture with a code-enforced coexistence and default-deny cutover gate. The existing Desktop vault remains authoritative and no real family-data or SQLite ownership transfer occurs.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-J_MAIN_STRUCTURE_SECURITY_HARDENING_IN_PROGRESS_PREDECESSOR_31-I_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title; ledger.activeMicroStep = '31-J'; ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-J-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-I_PERSISTENT_RECEIPT',
  effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_SECURITY_HARDENING'
});
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
  if (!requirement.evidence) requirement.evidence = [];
  if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence);
}
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-171')) decisions.decisions.push({
  id: 'DEC-171', date: '2026-08-10', acceptedAt: '2026-08-10', title: 'Family-data coexistence and default-deny cutover gate',
  status: 'ACTIVE', source: 'Explicit user instruction: Yeni yapıyı daha güçlü güvenli sağlam yapabiliriz', document: paths.decision,
  requirements: scope.requirements, codeAreas: ['packages/core-service-contracts/src/index.ts', 'apps/core-service/src/family-data-cutover-guard.ts', 'apps/core-service/src/core-service-runtime.ts', 'apps/desktop/src/main/core-service-startup-connection.ts'],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length; await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-J', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-I_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_NEW_ARCHITECTURE_SECURITY_HARDENING', targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-J security-hardening start: PASS (${checks.length}/${checks.length}); default-deny data cutover gate selected.`);
