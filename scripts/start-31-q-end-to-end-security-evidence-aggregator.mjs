import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json', decisions: 'config/user-decision-ledger.json',
  scope: 'config/31-q-end-to-end-security-evidence-aggregator-scope.json', decision: 'docs/decisions/DEC-178-end-to-end-security-evidence-aggregator-boundary.md',
  predecessorDecision: 'docs/decisions/DEC-177-synthetic-rollback-recovery-drill-boundary.md', readinessDecision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutoverDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md', predecessorCompletion: 'artifacts/checkpoints/31-P_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-P_LIBRARY_RECEIPT.json', authority: 'artifacts/authority/31-Q_END_TO_END_SECURITY_EVIDENCE_AGGREGATOR_AUTHORITY.json',
  validation: 'artifacts/validation/31-Q_PRIORITY_SELECTION_VALIDATION.json', execution: 'artifacts/checkpoints/31-Q_EXECUTION_RECORD.json'
};
const prepRoot = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'PREPARED_AFTER_31-P_269a8d6e', '31-Q_END_TO_END_SECURITY_EVIDENCE_AGGREGATOR');
const queuePath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'CURRENT_QUEUE_STATE.json');
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const readPrepJson = async (path) => JSON.parse(await readFile(resolve(prepRoot, path), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [plan, ledger, registry, decisions, scope, completion, receipt, predecessorDecision, readinessDecision, cutoverDecision, queue, inventory, prepValidation] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.predecessorCompletion), readJson(paths.predecessorReceipt), readFile(full(paths.predecessorDecision), 'utf8'), readFile(full(paths.readinessDecision), 'utf8'),
  readFile(full(paths.cutoverDecision), 'utf8'), readFile(queuePath, 'utf8').then(JSON.parse), readPrepJson('APPLY_INVENTORY.json'), readPrepJson('PREPARATION_VALIDATION.json')
]);
await readFile(full(paths.decision), 'utf8');
const inventoryBytes = await readFile(resolve(prepRoot, 'APPLY_INVENTORY.json'));
const validationBytes = await readFile(resolve(prepRoot, 'PREPARATION_VALIDATION.json'));
const predecessor = plan.steps.find((item) => item.id === '31-P');
assert(plan.currentStep === '31-P' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-P is not completed');
assert(completion.status === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-P receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-P_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-P ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-Q'), '31-Q already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('does not attach it to family-data runtime'), 'DEC-177 predecessor boundary is not active');
assert(readinessDecision.includes('Status: ACTIVE') && readinessDecision.includes('trusted evidence verifier'), 'DEC-172 readiness boundary is not active');
assert(cutoverDecision.includes('Status: ACTIVE') && cutoverDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 cutover block is not active');
assert(queue.status === '31-P_APPLIED_COMPLETED_RECEIPT_PASS' && queue.authoritativeSourceSha256 === '269a8d6e93a8e9fcaeaa70c1d8d32cc00feafcbcc37ba1afd7d9478f7629803d' && queue.authoritativeSourceFileCount === 4331, '31-Q queue source binding is not current');
assert(queue.next?.id === '31-Q' && queue.next?.status === 'PREPARED_VALIDATED_NOT_APPLIED', '31-Q is not the authorized prepared package');
assert(sha256(inventoryBytes) === queue.next.preparationInventorySha256 && sha256(validationBytes) === queue.next.preparationValidationSha256, '31-Q preparation sidecars do not bind exact files');
assert(inventory.payloadCount === 5 && prepValidation.status === 'PASS' && prepValidation.applicationStatus === 'NOT_APPLIED', '31-Q preparation is not clean and detached');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-Q requirements are not open P0 work');
const checks = [
  ['31-P predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'], ['DEC-177 remains active', scope.predecessorDecision === 'DEC-177'],
  ['DEC-172 remains active', scope.readinessDecision === 'DEC-172'], ['DEC-171 remains blocked', scope.cutoverDecision === 'DEC-171'],
  ['pure synthetic aggregator', scope.targets.aggregator === 'PURE_SYNTHETIC_END_TO_END_SECURITY_AGGREGATOR_ONLY'],
  ['exact seven controls', scope.targets.controlSet === 'EXACT_SEVEN_CANONICAL_CONTROLS'],
  ['exact observation shape', scope.targets.observationShape === 'EXACT_KEYS_ONLY_EXTRA_FIELDS_REJECTED'],
  ['verifier binding required', scope.targets.verifierBinding === 'TRUE_REQUIRED_UNBOUND_REJECTED'],
  ['globally unique digest', scope.targets.digestRule === 'LOWERCASE_SHA256_NON_GENESIS_GLOBALLY_UNIQUE'],
  ['monotonic observations', scope.targets.monotonicity === 'ONE_OBSERVATION_PER_CONTROL_NO_REPLACEMENT'],
  ['all seven PASS required', scope.targets.completionRule === 'ALL_SEVEN_CONTROLS_PASS_REQUIRED'],
  ['canonical order', scope.targets.canonicalization === 'FIXED_CONTROL_ORDER_INSERTION_INDEPENDENT'],
  ['non-submittable modeled gate', scope.targets.candidateClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_NON_SUBMITTABLE'],
  ['no real exercise or process proof', scope.targets.realSecurityExercises === 'NOT_PERFORMED' && scope.targets.independentProcessEvidence === 'NOT_VERIFIED'],
  ['no runtime, real gate, or activation', scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realEndToEndSecurityGate === 'NOT_SATISFIED' && scope.targets.automaticActivation === 'NOT_ALLOWED'],
  ['prepared payload exact', inventory.payloadCount === 5 && prepValidation.cleanValidation.vitest.tests === 8],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-Q priority selection failed');
const generatedAt = new Date().toISOString();
Object.assign(scope, { status: 'IN_PROGRESS', startedAt: generatedAt }); await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-Q', status: 'PASS', authority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_Q', decision: 'DEC-178', predecessorDecision: 'DEC-177',
  readinessDecision: 'DEC-172', cutoverDecision: 'DEC-171', predecessor: { step: '31-P', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  authoritativeSourceAtStart: { treeSha256: queue.authoritativeSourceSha256, fileCount: queue.authoritativeSourceFileCount },
  preparedPackage: { path: prepRoot, inventorySha256: sha256(inventoryBytes), validationSha256: sha256(validationBytes), payloadCount: inventory.payloadCount },
  securityAdaptation: { productionGateIdRemoved: true, exactObservationShape: true, verifierBindingRequired: true, digestGloballyUnique: true, monotonicControls: true, canonicalCandidate: true, nonSubmittableCandidate: true },
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements, selectedBoundary: 'PURE_SYNTHETIC_END_TO_END_SECURITY_AGGREGATOR_NO_PRODUCTION_ATTACHMENT',
  requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, { schemaVersion: 1, release: plan.release, step: '31-Q', phase: 'END_TO_END_SECURITY_EVIDENCE_AGGREGATOR_PRIORITY', status: 'PASS', expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt });
plan.steps.push({ id: '31-Q', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING', localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING' });
plan.currentStep = '31-Q'; plan.updatedAt = generatedAt;
plan.segmentationNote = '31-Q adds only a pure synthetic, non-submittable security evidence aggregator. No security exercise, independent process proof, runtime wiring, automatic activation, real gate PASS, real data, SQLite transfer, or cutover authority is attached.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-Q_END_TO_END_SECURITY_AGGREGATOR_IN_PROGRESS_PREDECESSOR_31-P_RECEIPT_CHAIN_PASS'; ledger.nextOfficialTask = scope.title; ledger.activeMicroStep = '31-Q'; ledger.updatedAt = generatedAt;
ledger.supersessions.push({ id: 'GOV-SUP-31-Q-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-P_PERSISTENT_RECEIPT', effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_CONTINUATION' });
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) { if (!requirement.evidence) requirement.evidence = []; if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence); }
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-178')) decisions.decisions.push({ id: 'DEC-178', date: '2026-08-11', acceptedAt: '2026-08-11', title: scope.title, status: 'ACTIVE', source: 'Explicit user instruction: Uygula', document: paths.decision, requirements: scope.requirements, codeAreas: ['apps/core-service/src/end-to-end-security-evidence-aggregator.ts', 'apps/core-service/src/index.ts', 'apps/core-service/tests/end-to-end-security-evidence-aggregator.test.ts'], evidence: [paths.authority, paths.validation] });
decisions.decisionCount = decisions.decisions.length; await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, { schemaVersion: 1, release: plan.release, step: '31-Q', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements, title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-P_COMPLETED_RECEIPT_PASS', priorityAuthority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_Q', targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt });
console.log(`31-Q end-to-end security evidence aggregator start: PASS (${checks.length}/${checks.length}); synthetic only; runtime detached; DEC-171 blocked.`);
