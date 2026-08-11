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
  scope: 'config/31-r-explicit-user-approval-receipt-boundary-scope.json',
  decision: 'docs/decisions/DEC-179-explicit-user-approval-receipt-boundary.md',
  predecessorDecision: 'docs/decisions/DEC-178-end-to-end-security-evidence-aggregator-boundary.md',
  readinessDecision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutoverDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  predecessorCompletion: 'artifacts/checkpoints/31-Q_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-Q_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-R_EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY_AUTHORITY.json',
  validation: 'artifacts/validation/31-R_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-R_EXECUTION_RECORD.json'
};
const prepRoot = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'PREPARED_AFTER_31-Q_e236b374', '31-R_EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY');
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
  readFile(full(paths.readinessDecision), 'utf8'), readFile(full(paths.cutoverDecision), 'utf8'), readFile(queuePath, 'utf8').then(JSON.parse),
  readPrepJson('APPLY_INVENTORY.json'), readPrepJson('PREPARATION_VALIDATION.json')
]);
await readFile(full(paths.decision), 'utf8');
const inventoryBytes = await readFile(resolve(prepRoot, 'APPLY_INVENTORY.json'));
const validationBytes = await readFile(resolve(prepRoot, 'PREPARATION_VALIDATION.json'));
const validationSidecar = (await readFile(resolve(prepRoot, 'PREPARATION_VALIDATION.json.sha256'), 'utf8')).trim().split(/\s+/u)[0];
const predecessor = plan.steps.find((item) => item.id === '31-Q');

assert(plan.currentStep === '31-Q' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-Q is not completed');
assert(completion.status === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-Q receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-Q_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-Q ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-R'), '31-R already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('does not attach it to family-data runtime'), 'DEC-178 predecessor boundary is not active');
assert(readinessDecision.includes('Status: ACTIVE') && readinessDecision.includes('trusted evidence verifier'), 'DEC-172 readiness boundary is not active');
assert(cutoverDecision.includes('Status: ACTIVE') && cutoverDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 cutover block is not active');
assert(queue.status === '31-R_PREPARED_NOT_APPLIED_31-Q_LAST_COMPLETED_PASS', '31-R queue status is not current');
assert(queue.authoritativeSourceSha256 === 'e236b374b54e0bdee8aefc45eedd487ff25a354215c1def88f9b07dafab2dde8' && queue.authoritativeSourceFileCount === 4365, '31-R source binding is not current');
assert(queue.next?.id === '31-R' && queue.next?.status === 'PREPARED_NOT_APPLIED', '31-R is not the authorized prepared package');
assert(sha256(inventoryBytes) === queue.next.applyInventorySha256 && sha256(validationBytes) === validationSidecar, '31-R preparation records do not bind exact files');
assert(inventory.payloadCount === 5 && prepValidation.status === 'PASS' && prepValidation.applicationStatus === 'NOT_APPLIED', '31-R preparation is not clean and detached');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-R requirements are not open P0 work');

const checks = [
  ['31-Q predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['DEC-178 remains active', scope.predecessorDecision === 'DEC-178'],
  ['DEC-172 remains active', scope.readinessDecision === 'DEC-172'],
  ['DEC-171 remains blocked', scope.cutoverDecision === 'DEC-171'],
  ['pure receipt intake boundary', scope.targets.receiptBoundary === 'PURE_EXPLICIT_USER_APPROVAL_RECEIPT_INTAKE_ONLY'],
  ['exact four technical gates', scope.targets.technicalGateSet === 'EXACT_FOUR_CANONICAL_TECHNICAL_GATES'],
  ['technical gates before verifier', scope.targets.technicalGatePrecondition === 'ALL_FOUR_EXACT_DISTINCT_PASS_BEFORE_VERIFIER'],
  ['default verifier detached', scope.targets.defaultVerifier === 'NOT_ATTACHED_DEFAULT_DENY'],
  ['exact plain-data receipt shape', scope.targets.receiptShape === 'EXACT_PLAIN_DATA_KEYS_ONLY_ACCESSORS_AND_EXTRA_FIELDS_REJECTED'],
  ['source and ledger bindings', scope.targets.sourceBinding === 'LOWERCASE_SHA256_NON_GENESIS_EXACT_MATCH' && scope.targets.ledgerBinding === 'LOWERCASE_SHA256_NON_GENESIS_EXACT_MATCH'],
  ['bounded live timestamp', scope.targets.timeRule === 'CANONICAL_LIVE_INTERVAL_MAX_FIFTEEN_MINUTES'],
  ['fail-closed verifier and clock', scope.targets.verifierFailureRule === 'REJECTION_EXCEPTION_NON_BOOLEAN_AND_CLOCK_FAILURE_DEFAULT_DENY'],
  ['digest binds receipt without exposure', scope.targets.digestRule === 'ALL_RECEIPT_FIELDS_BOUND_RAW_RECEIPT_NOT_EXPOSED'],
  ['modeled gate only', scope.targets.evaluationClassification === 'MODELED_GATE_ONLY_NO_GATE_ID_LEDGER_ELIGIBILITY_ONLY'],
  ['no receipt, ledger submission, or successor decision', scope.targets.receiptCreation === 'NOT_PERFORMED' && scope.targets.readinessLedgerSubmission === 'NOT_PERFORMED' && scope.targets.successorDecision === 'NOT_CREATED'],
  ['no runtime, real gate, activation, or cutover', scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.realExplicitUserApprovalGate === 'NOT_SATISFIED' && scope.targets.automaticActivation === 'NOT_ALLOWED'],
  ['prepared payload exact', inventory.payloadCount === 5 && prepValidation.cleanValidation.vitest.tests === 11],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-R priority selection failed');

const generatedAt = new Date().toISOString();
Object.assign(scope, { status: 'IN_PROGRESS', startedAt: generatedAt });
await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-R',
  status: 'PASS',
  authority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_R_BOUNDARY_ONLY_NOT_CUTOVER_CONSENT',
  decision: 'DEC-179',
  predecessorDecision: 'DEC-178',
  readinessDecision: 'DEC-172',
  cutoverDecision: 'DEC-171',
  predecessor: { step: '31-Q', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  authoritativeSourceAtStart: { treeSha256: queue.authoritativeSourceSha256, fileCount: queue.authoritativeSourceFileCount },
  preparedPackage: { path: prepRoot, inventorySha256: sha256(inventoryBytes), validationSha256: sha256(validationBytes), payloadCount: inventory.payloadCount },
  securityAdaptation: {
    technicalGatesBeforeVerifier: true,
    defaultVerifierDetached: true,
    exactPlainDataReceiptShape: true,
    nonGenesisSourceAndLedgerBindings: true,
    boundedLiveInterval: true,
    failClosedVerifierAndClock: true,
    productionGateIdRemoved: true,
    rawReceiptNotExposed: true,
    noSubmissionOrConsumption: true
  },
  primaryRequirement: scope.primaryRequirement,
  requirements: scope.requirements,
  selectedBoundary: 'PURE_EXPLICIT_USER_APPROVAL_RECEIPT_INTAKE_NO_PRODUCTION_ATTACHMENT',
  realUserCutoverConsentGranted: false,
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-R', phase: 'EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY_PRIORITY',
  status: 'PASS', expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});

plan.steps.push({
  id: '31-R', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-R';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-R adds only a detached, default-deny explicit user approval receipt intake. It creates no user consent, production verifier, readiness-ledger submission, runtime wiring, automatic activation, real gate PASS, real data transfer, SQLite transfer, or cutover authority.';
await writeJson(paths.plan, plan);

ledger.libraryUploadStatus = '31-R_EXPLICIT_USER_APPROVAL_RECEIPT_BOUNDARY_IN_PROGRESS_PREDECESSOR_31-Q_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title;
ledger.activeMicroStep = '31-R';
ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-R-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-Q_PERSISTENT_RECEIPT',
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
if (!decisions.decisions.some((item) => item.id === 'DEC-179')) {
  decisions.decisions.push({
    id: 'DEC-179', date: '2026-08-11', acceptedAt: '2026-08-11', title: scope.title, status: 'ACTIVE',
    source: 'Explicit user instruction: Uygula (31-R code boundary only; not cutover consent)', document: paths.decision,
    requirements: scope.requirements,
    codeAreas: ['apps/core-service/src/explicit-user-cutover-approval-receipt.ts', 'apps/core-service/src/index.ts', 'apps/core-service/tests/explicit-user-cutover-approval-receipt.test.ts'],
    evidence: [paths.authority, paths.validation]
  });
}
decisions.decisionCount = decisions.decisions.length;
await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-R', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-Q_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_R_BOUNDARY_ONLY_NOT_CUTOVER_CONSENT', targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS',
  validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, realUserCutoverConsentGranted: false,
  requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-R explicit user approval receipt boundary start: PASS (${checks.length}/${checks.length}); verifier detached; no consent created; DEC-171 blocked.`);
