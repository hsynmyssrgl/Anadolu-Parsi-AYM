import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json', decisions: 'config/user-decision-ledger.json',
  scope: 'config/31-s-versioned-cutover-decision-preflight-scope.json', decision: 'docs/decisions/DEC-180-versioned-cutover-decision-preflight-boundary.md',
  predecessorDecision: 'docs/decisions/DEC-179-explicit-user-approval-receipt-boundary.md', readinessDecision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutoverDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md', predecessorCompletion: 'artifacts/checkpoints/31-R_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-R_LIBRARY_RECEIPT.json', authority: 'artifacts/authority/31-S_VERSIONED_CUTOVER_DECISION_PREFLIGHT_AUTHORITY.json',
  validation: 'artifacts/validation/31-S_PRIORITY_SELECTION_VALIDATION.json', execution: 'artifacts/checkpoints/31-S_EXECUTION_RECORD.json'
};
const prepRoot = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'PREPARED_AFTER_31-R_c946f9c0', '31-S_VERSIONED_CUTOVER_DECISION_PREFLIGHT');
const queuePath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'CURRENT_QUEUE_STATE.json');
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const readPrepJson = async (path) => JSON.parse(await readFile(resolve(prepRoot, path), 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [plan, ledger, registry, decisions, scope, completion, receipt, predecessorDecision, readinessDecision, cutoverDecision, queue, inventory, prepValidation] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope), readJson(paths.predecessorCompletion),
  readJson(paths.predecessorReceipt), readFile(full(paths.predecessorDecision), 'utf8'), readFile(full(paths.readinessDecision), 'utf8'),
  readFile(full(paths.cutoverDecision), 'utf8'), readFile(queuePath, 'utf8').then(JSON.parse), readPrepJson('APPLY_INVENTORY.json'), readPrepJson('PREPARATION_VALIDATION.json')
]);
await readFile(full(paths.decision), 'utf8');
const inventoryBytes = await readFile(resolve(prepRoot, 'APPLY_INVENTORY.json'));
const validationBytes = await readFile(resolve(prepRoot, 'PREPARATION_VALIDATION.json'));
const validationSidecar = (await readFile(resolve(prepRoot, 'PREPARATION_VALIDATION.json.sha256'), 'utf8')).trim().split(/\s+/u)[0];
const predecessor = plan.steps.find((item) => item.id === '31-R');

assert(plan.currentStep === '31-R' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-R is not completed');
assert(completion.status === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-R receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-R_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-R ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-S'), '31-S already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('creates no approval receipt and records no real user consent'), 'DEC-179 predecessor boundary is not active');
assert(readinessDecision.includes('Status: ACTIVE') && readinessDecision.includes('trusted evidence verifier'), 'DEC-172 readiness boundary is not active');
assert(cutoverDecision.includes('Status: ACTIVE') && cutoverDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 cutover block is not active');
assert(queue.status === '31-S_PREPARED_NOT_APPLIED_31-R_LAST_COMPLETED_PASS', '31-S queue status is not current');
assert(queue.authoritativeSourceSha256 === 'c946f9c031d76e16e199a649b500134800c54cbef074c6e760aecfce2d4649fd' && queue.authoritativeSourceFileCount === 4399, '31-S source binding is not current');
assert(queue.next?.id === '31-S' && queue.next?.status === 'PREPARED_NOT_APPLIED', '31-S is not the authorized prepared package');
assert(sha256(inventoryBytes) === queue.next.applyInventorySha256 && sha256(validationBytes) === validationSidecar, '31-S preparation records do not bind exact files');
assert(inventory.payloadCount === 5 && prepValidation.status === 'PASS' && prepValidation.applicationStatus === 'NOT_APPLIED', '31-S preparation is not clean and detached');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-S requirements are not open P0 work');

const checks = [
  ['31-R predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['DEC-179 remains active', scope.predecessorDecision === 'DEC-179'],
  ['DEC-172 remains active', scope.readinessDecision === 'DEC-172'],
  ['DEC-171 remains blocked', scope.cutoverDecision === 'DEC-171'],
  ['pure read-only preflight', scope.targets.preflightBoundary === 'PURE_READ_ONLY_VERSIONED_SUCCESSOR_DECISION_PREFLIGHT_ONLY'],
  ['exact five gates', scope.targets.gateSet === 'EXACT_FIVE_CANONICAL_READINESS_GATES'],
  ['exact plain-data input', scope.targets.inputShape === 'EXACT_PLAIN_DATA_KEYS_ONLY_ACCESSORS_AND_EXTRA_FIELDS_REJECTED'],
  ['gate state and uniqueness', scope.targets.gateStateRule === 'PASS_NON_GENESIS_SHA256_PENDING_NULL' && scope.targets.uniquenessRule === 'GATE_IDS_AND_EVIDENCE_DIGESTS_GLOBALLY_UNIQUE'],
  ['ledger counter consistency', scope.targets.ledgerCounterRule === 'EPOCH_ENTRY_COUNT_AND_PASS_COUNT_EXACT_MATCH'],
  ['source and ledger seals', scope.targets.sourceBinding === 'EXPECTED_OBSERVED_NON_GENESIS_SHA256_EXACT_MATCH' && scope.targets.ledgerHeadBinding === 'NON_GENESIS_LOWERCASE_SHA256_REQUIRED'],
  ['integrity and anchor eligibility', scope.targets.ledgerEligibility === 'INTEGRITY_AND_TRUSTED_ANCHOR_BOTH_REQUIRED'],
  ['canonical redacted output', scope.targets.canonicalization === 'FIXED_GATE_ORDER_INSERTION_INDEPENDENT' && scope.targets.outputRedaction === 'RAW_EVIDENCE_SOURCE_SEALS_AND_LEDGER_HEAD_NOT_EXPOSED'],
  ['DEC-171 blocked classification', scope.targets.preflightClassification === 'READ_ONLY_NON_AUTHORITATIVE_DEC_171_BLOCKED'],
  ['no successor decision or submission', scope.targets.successorDecision === 'NOT_CREATED' && scope.targets.versionedDecisionSubmission === 'NOT_PERFORMED'],
  ['no runtime, independent verification, or activation', scope.targets.runtimeIntegration === 'NOT_WIRED' && scope.targets.independentEvidenceVerification === 'NOT_PERFORMED' && scope.targets.automaticActivation === 'NOT_ALLOWED'],
  ['prepared payload exact', inventory.payloadCount === 5 && prepValidation.cleanValidation.vitest.tests === 12],
  ['preparation failure accounting truthful', prepValidation.failedAttemptsNotCountedAsPass.length === 1 && prepValidation.failedAttemptsNotCountedAsPass.every((item) => item.countsAsPass === false)],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-S priority selection failed');

const generatedAt = new Date().toISOString();
Object.assign(scope, { status: 'IN_PROGRESS', startedAt: generatedAt });
await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-S', status: 'PASS',
  authority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_S_BOUNDARY_ONLY_NOT_SUCCESSOR_DECISION', decision: 'DEC-180', predecessorDecision: 'DEC-179',
  readinessDecision: 'DEC-172', cutoverDecision: 'DEC-171',
  predecessor: { step: '31-R', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  authoritativeSourceAtStart: { treeSha256: queue.authoritativeSourceSha256, fileCount: queue.authoritativeSourceFileCount },
  preparedPackage: { path: prepRoot, inventorySha256: sha256(inventoryBytes), validationSha256: sha256(validationBytes), payloadCount: inventory.payloadCount },
  securityAdaptation: {
    exactPlainDataInput: true, exactFiveGateSet: true, nonGenesisUniqueEvidence: true, ledgerCountersBoundToPassCount: true,
    sourceAndLedgerSealsBound: true, integrityAndTrustedAnchorRequired: true, canonicalRedactedDigest: true,
    successorDecisionNotCreated: true, versionedDecisionSubmissionNotPerformed: true, productionGateIdRemoved: true
  },
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  selectedBoundary: 'PURE_READ_ONLY_VERSIONED_CUTOVER_DECISION_PREFLIGHT_NO_PRODUCTION_ATTACHMENT',
  successorDecisionCreated: false, realUserCutoverConsentGranted: false, requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-S', phase: 'VERSIONED_CUTOVER_DECISION_PREFLIGHT_PRIORITY', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
plan.steps.push({
  id: '31-S', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-S'; plan.updatedAt = generatedAt;
plan.segmentationNote = '31-S adds only a detached read-only successor-decision preflight. It creates no successor decision, user consent, evidence authority, runtime wiring, automatic activation, real gate PASS, real data transfer, SQLite transfer, or cutover authority.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-S_VERSIONED_CUTOVER_DECISION_PREFLIGHT_IN_PROGRESS_PREDECESSOR_31-R_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title; ledger.activeMicroStep = '31-S'; ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-S-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-R_PERSISTENT_RECEIPT',
  effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_CONTINUATION'
});
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
  if (!requirement.evidence) requirement.evidence = [];
  if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence);
}
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-180')) decisions.decisions.push({
  id: 'DEC-180', date: '2026-08-11', acceptedAt: '2026-08-11', title: scope.title, status: 'ACTIVE',
  source: 'Explicit user instruction: Uygula (31-S code boundary only; not a successor cutover decision)', document: paths.decision,
  requirements: scope.requirements,
  codeAreas: ['apps/core-service/src/versioned-cutover-decision-preflight.ts', 'apps/core-service/src/index.ts', 'apps/core-service/tests/versioned-cutover-decision-preflight.test.ts'],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length; await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-S', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-R_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_S_BOUNDARY_ONLY_NOT_SUCCESSOR_DECISION', targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS',
  validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, successorDecisionCreated: false,
  realUserCutoverConsentGranted: false, requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-S versioned cutover decision preflight start: PASS (${checks.length}/${checks.length}); read-only; no successor decision; DEC-171 blocked.`);
