import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json',
  scope: 'config/31-p-synthetic-rollback-recovery-drill-scope.json',
  decision: 'docs/decisions/DEC-177-synthetic-rollback-recovery-drill-boundary.md',
  predecessorDecision: 'docs/decisions/DEC-176-synthetic-key-lifecycle-proof-harness-boundary.md',
  readinessDecision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutoverDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  predecessorCompletion: 'artifacts/checkpoints/31-O_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-O_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-P_SYNTHETIC_ROLLBACK_RECOVERY_DRILL_AUTHORITY.json',
  validation: 'artifacts/validation/31-P_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-P_EXECUTION_RECORD.json'
};
const prepRoot = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'PREPARED_AFTER_31-O_87806d9b', '31-P_SYNTHETIC_ROLLBACK_RECOVERY_DRILL');
const queuePath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'CURRENT_QUEUE_STATE.json');
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const readPrepJson = async (path) => JSON.parse(await readFile(resolve(prepRoot, path), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [plan, ledger, registry, decisions, scope, completion, receipt, predecessorDecision, readinessDecision, cutoverDecision, queue, inventory, prepValidation] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.predecessorCompletion), readJson(paths.predecessorReceipt), readFile(full(paths.predecessorDecision), 'utf8'),
  readFile(full(paths.readinessDecision), 'utf8'), readFile(full(paths.cutoverDecision), 'utf8'),
  readFile(queuePath, 'utf8').then(JSON.parse), readPrepJson('APPLY_INVENTORY.json'), readPrepJson('PREPARATION_VALIDATION.json')
]);
await readFile(full(paths.decision), 'utf8');
const inventoryBytes = await readFile(resolve(prepRoot, 'APPLY_INVENTORY.json'));
const validationBytes = await readFile(resolve(prepRoot, 'PREPARATION_VALIDATION.json'));
const predecessor = plan.steps.find((item) => item.id === '31-O');
assert(plan.currentStep === '31-O' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-O is not completed');
assert(completion.status === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-O receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-O_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-O ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-P'), '31-P already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('does not attach it to device-secret runtime'), 'DEC-176 predecessor boundary is not active');
assert(readinessDecision.includes('Status: ACTIVE') && readinessDecision.includes('trusted evidence verifier'), 'DEC-172 readiness boundary is not active');
assert(cutoverDecision.includes('Status: ACTIVE') && cutoverDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 cutover block is not active');
assert(queue.status === '31-O_APPLIED_COMPLETED_RECEIPT_PASS' && queue.authoritativeSourceSha256 === '87806d9b9c0fde676cbd280e151e6fa6ae5951662171d3e7183f99a5981d6318' && queue.authoritativeSourceFileCount === 4297, '31-P queue source binding is not current');
assert(queue.next?.id === '31-P' && queue.next?.status === 'PREPARED_VALIDATED_NOT_APPLIED', '31-P is not the authorized prepared package');
assert(sha256(inventoryBytes) === queue.next.preparationInventorySha256 && sha256(validationBytes) === queue.next.preparationValidationSha256, '31-P preparation sidecars do not bind exact files');
assert(inventory.payloadCount === 5 && prepValidation.status === 'PASS' && prepValidation.applicationStatus === 'NOT_APPLIED', '31-P preparation is not clean and detached');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-P requirements are not open P0 work');
const checks = [
  ['31-O predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['DEC-176 remains active', scope.predecessorDecision === 'DEC-176'],
  ['DEC-172 remains active', scope.readinessDecision === 'DEC-172'],
  ['DEC-171 remains blocked', scope.cutoverDecision === 'DEC-171'],
  ['pure synthetic drill', scope.targets.stateMachine === 'PURE_SYNTHETIC_ROLLBACK_RECOVERY_ONLY'],
  ['exact input shape', scope.targets.inputShape === 'EXACT_KEYS_ONLY_EXTRA_FIELDS_REJECTED'],
  ['proof digest never reused', scope.targets.proofRule === 'LOWERCASE_SHA256_NON_GENESIS_NEVER_REUSED'],
  ['Desktop-only writer', scope.targets.writerInvariant === 'DESKTOP_ONLY_CORE_SERVICE_NEVER_WRITABLE'],
  ['synthetic failure only', scope.targets.failureMode === 'SYNTHETIC_EVENT_ONLY_NO_PROCESS_CRASH'],
  ['no real backup restore', scope.targets.recoveryMode === 'MODELED_ONLY_NO_BACKUP_RESTORE'],
  ['rejection atomicity', scope.targets.rejectionAtomicity === 'FAILED_TRANSITION_LEAVES_STATE_UNCHANGED'],
  ['non-submittable modeled gate', scope.targets.candidateClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_NON_SUBMITTABLE'],
  ['no runtime or real gate', scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realRollbackDrillGate === 'NOT_SATISFIED'],
  ['prepared payload exact', inventory.payloadCount === 5 && prepValidation.cleanValidation.vitest.tests === 8],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-P priority selection failed');

const generatedAt = new Date().toISOString();
Object.assign(scope, { status: 'IN_PROGRESS', startedAt: generatedAt });
await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-P', status: 'PASS',
  authority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_P', decision: 'DEC-177', predecessorDecision: 'DEC-176',
  readinessDecision: 'DEC-172', cutoverDecision: 'DEC-171',
  predecessor: { step: '31-O', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  authoritativeSourceAtStart: { treeSha256: queue.authoritativeSourceSha256, fileCount: queue.authoritativeSourceFileCount },
  preparedPackage: { path: prepRoot, inventorySha256: sha256(inventoryBytes), validationSha256: sha256(validationBytes), payloadCount: inventory.payloadCount },
  securityAdaptation: { productionGateIdRemoved: true, exactInputShape: true, proofDigestNeverReused: true, desktopOnlyWriter: true, realCrashAndRestoreExcluded: true, nonSubmittableCandidate: true },
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  selectedBoundary: 'PURE_SYNTHETIC_ROLLBACK_RECOVERY_DRILL_NO_PRODUCTION_ATTACHMENT',
  requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-P', phase: 'SYNTHETIC_ROLLBACK_RECOVERY_DRILL_PRIORITY',
  status: 'PASS', expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
plan.steps.push({
  id: '31-P', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-P';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-P adds only a pure synthetic, non-submittable rollback/recovery drill. No runtime wiring, process crash, real backup restore, real gate PASS, real data, SQLite ownership transfer, or cutover authority is attached.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-P_SYNTHETIC_ROLLBACK_RECOVERY_DRILL_IN_PROGRESS_PREDECESSOR_31-O_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title;
ledger.activeMicroStep = '31-P';
ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-P-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-O_PERSISTENT_RECEIPT',
  effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_CONTINUATION'
});
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) {
  for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
    if (!requirement.evidence) requirement.evidence = [];
    if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence);
  }
}
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-177')) decisions.decisions.push({
  id: 'DEC-177', date: '2026-08-11', acceptedAt: '2026-08-11', title: scope.title, status: 'ACTIVE',
  source: 'Explicit user continuation: Devam', document: paths.decision, requirements: scope.requirements,
  codeAreas: ['apps/core-service/src/synthetic-rollback-recovery-drill.ts', 'apps/core-service/src/index.ts', 'apps/core-service/tests/synthetic-rollback-recovery-drill.test.ts'],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length;
await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-P', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-O_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_P', targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS', validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-P synthetic rollback recovery drill start: PASS (${checks.length}/${checks.length}); synthetic only; runtime detached; DEC-171 blocked.`);
