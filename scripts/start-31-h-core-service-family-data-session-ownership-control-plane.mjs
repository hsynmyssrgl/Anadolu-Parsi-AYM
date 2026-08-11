import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json', scope: 'config/31-h-core-service-family-data-session-ownership-control-plane-scope.json',
  decision: 'docs/decisions/DEC-169-core-service-protected-family-data-session-ownership-control-plane.md',
  predecessorCompletion: 'artifacts/checkpoints/31-G_COMPLETION_RECORD.json', predecessorReceipt: 'artifacts/checkpoints/31-G_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-H_MAIN_STRUCTURE_PRIORITY_AUTHORITY.json',
  validation: 'artifacts/validation/31-H_PRIORITY_SELECTION_VALIDATION.json', execution: 'artifacts/checkpoints/31-H_EXECUTION_RECORD.json'
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
assert(plan.currentStep === '31-G' && plan.steps.find((item) => item.id === '31-G')?.status === 'COMPLETED', '31-G is not completed');
assert(completion.status === 'PASS' && completion.persistentReceiptStatus === 'PASS' && receipt.status === 'PASS', '31-G persistent receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-G_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-G ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-H'), '31-H already exists');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-H requirements are not open P0 work');
const checks = [
  ['31-G predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['main-structure continuation', scope.decision === 'DEC-169' && scope.primaryRequirement === 'DHA-001'],
  ['real attachment before ownership', scope.targets.ownershipTruth.includes('REAL_SESSION_PORT_ATTACHMENT')],
  ['monotonic fail-closed lifecycle', scope.targets.ownershipStateMachine.includes('MONOTONIC_EPOCH_FAIL_CLOSED')],
  ['path privacy', scope.targets.pathPrivacy === 'NO_DATABASE_PATH_EXPOSED_OVER_CLIENT_PROTOCOL'],
  ['vault handoff remains open', scope.openBoundaries.protectedVaultSessionHandoff === 'NOT_COMPLETE'],
  ['service installation approval boundary', scope.openBoundaries.windowsServiceInstallation === 'APPROVAL_BOUND_NOT_RUN_NOT_PASS'],
  ['no false completion or Build', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-H priority selection failed');
const generatedAt = new Date().toISOString();
scope.status = 'IN_PROGRESS'; scope.startedAt = generatedAt; await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-H', status: 'PASS', authority: 'EXPLICIT_USER_MAIN_STRUCTURE_CONTINUATION',
  decision: 'DEC-169', predecessor: { step: '31-G', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  selectedBoundary: 'PROTECTED_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE', requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-H', phase: 'MAIN_STRUCTURE_PRIORITY_CONTINUATION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
plan.steps.push({
  id: '31-H', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-H'; plan.updatedAt = generatedAt;
plan.segmentationNote = '31-H continues the main structure with a fail-closed protected family-data session ownership control plane. Actual vault handoff, SQLite ownership, family APIs and Windows service installation remain open; no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-H_MAIN_STRUCTURE_IN_PROGRESS_PREDECESSOR_31-G_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title; ledger.activeMicroStep = '31-H'; ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-H-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-G_PERSISTENT_RECEIPT',
  effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_CONTINUATION'
});
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
  if (!requirement.evidence) requirement.evidence = [];
  if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence);
}
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-169')) decisions.decisions.push({
  id: 'DEC-169', date: '2026-08-10', acceptedAt: '2026-08-10', title: 'Core Service protected family-data session ownership control plane',
  status: 'ACTIVE', source: 'Explicit user instruction to continue the main-structure-first implementation', document: paths.decision,
  requirements: scope.requirements, codeAreas: ['packages/core-service-contracts/src/index.ts', 'apps/core-service/src/core-service-runtime.ts', 'apps/desktop/src/main/core-service-startup-connection.ts'],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length; await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-H', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-G_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_MAIN_STRUCTURE_CONTINUATION', targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-H main-structure start: PASS (${checks.length}/${checks.length}); protected family-data ownership control plane selected.`);
