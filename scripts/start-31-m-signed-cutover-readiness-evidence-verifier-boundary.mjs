import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json',
  scope: 'config/31-m-signed-cutover-readiness-evidence-verifier-boundary-scope.json',
  decision: 'docs/decisions/DEC-174-signed-cutover-readiness-evidence-verifier-boundary.md',
  predecessorDecision: 'docs/decisions/DEC-173-protected-cutover-readiness-journal-port.md',
  readinessDecision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutoverDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  predecessorCompletion: 'artifacts/checkpoints/31-L_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-L_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-M_SIGNED_EVIDENCE_VERIFIER_BOUNDARY_AUTHORITY.json',
  validation: 'artifacts/validation/31-M_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-M_EXECUTION_RECORD.json'
};
const queueStatePath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'CURRENT_QUEUE_STATE.json');
const stagingInventoryPath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'AFTER_31-K_8aa4ba50', 'STAGING_INVENTORY.json');
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [plan, ledger, registry, decisions, scope, completion, receipt, predecessorDecision, readinessDecision, cutoverDecision, queueState, stagingInventory] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.predecessorCompletion), readJson(paths.predecessorReceipt), readFile(full(paths.predecessorDecision), 'utf8'),
  readFile(full(paths.readinessDecision), 'utf8'), readFile(full(paths.cutoverDecision), 'utf8'),
  readFile(queueStatePath, 'utf8').then(JSON.parse), readFile(stagingInventoryPath, 'utf8').then(JSON.parse)
]);
await readFile(full(paths.decision), 'utf8');
const predecessor = plan.steps.find((item) => item.id === '31-L');
assert(plan.currentStep === '31-L' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-L is not completed');
assert(completion.status === 'PASS' && completion.persistentReceiptStatus === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-L persistent receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-L_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-L ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-M'), '31-M already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('production composition remains detached'), 'DEC-173 predecessor boundary is not active');
assert(readinessDecision.includes('Status: ACTIVE') && readinessDecision.includes('trusted evidence verifier'), 'DEC-172 readiness boundary is not active');
assert(cutoverDecision.includes('Status: ACTIVE') && cutoverDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 cutover block is not active');
assert(queueState.status === '31-L_APPLIED_COMPLETED_RECEIPT_PASS' && queueState.authoritativeSourceSha256 === 'aa4133f536ddbb00675d5cdb877fbd922d4173bed3f6494c5202948caf212ca2', '31-M queue source binding is not current');
assert(queueState.next?.id === '31-M' && queueState.next?.status === 'READY_FOR_GOVERNED_REVIEW_NOT_APPLIED', '31-M is not the authorized next staged package');
assert(stagingInventory.treeSha256 === '942d11a1b2e18cd0fa58dfb8d3897d62756153b7c45ad4870019705990a13127' && stagingInventory.fileCount === 39, '31-M staging inventory is not the reviewed handoff');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-M requirements are not open P0 work');
const checks = [
  ['31-L predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['DEC-173 remains active', scope.predecessorDecision === 'DEC-173'],
  ['DEC-172 remains active', scope.readinessDecision === 'DEC-172'],
  ['DEC-171 remains active', scope.cutoverDecision === 'DEC-171'],
  ['Ed25519 only', scope.targets.signatureAlgorithm === 'ED25519_ONLY'],
  ['public KeyObject only', scope.targets.publicKeyInput === 'PUBLIC_KEY_KEYOBJECT_ONLY_NO_PEM_OR_PRIVATE_KEY_INPUT'],
  ['key identity signed', scope.targets.keyIdentityBinding === 'KEY_ID_INCLUDED_IN_SIGNED_PAYLOAD'],
  ['exact claim and signature encoding', scope.targets.claimShape === 'EXACT_KEYS_ONLY_EXTRA_FIELDS_REJECTED' && scope.targets.signatureEncoding.includes('EXACT_64_BYTE')],
  ['no production authority or runtime wiring', scope.targets.productionKeyAuthority === 'NOT_ATTACHED' && scope.targets.runtimeIntegration === 'NOT_WIRED'],
  ['reviewed staging and queue', queueState.next.id === '31-M' && stagingInventory.treeSha256 === '942d11a1b2e18cd0fa58dfb8d3897d62756153b7c45ad4870019705990a13127'],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-M priority selection failed');

const generatedAt = new Date().toISOString();
scope.status = 'IN_PROGRESS';
scope.startedAt = generatedAt;
await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-M',
  status: 'PASS',
  authority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_M',
  decision: 'DEC-174',
  predecessorDecision: 'DEC-173',
  readinessDecision: 'DEC-172',
  cutoverDecision: 'DEC-171',
  predecessor: { step: '31-L', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  authoritativeSourceAtStart: { treeSha256: queueState.authoritativeSourceSha256, fileCount: queueState.authoritativeSourceFileCount },
  reviewedStaging: {
    path: stagingInventoryPath,
    treeSha256: stagingInventory.treeSha256,
    fileCount: stagingInventory.fileCount,
    draftSourceSha256: '846856f5859e54ecd35db0435039d0c55927ace7fd38e220b168e62521d38439',
    draftTestSha256: '5ffea2b7e9a79ecf2798d67b72e057feec9ef79da44b851912f52396242276ee'
  },
  securityAdaptation: {
    draftPemInputReplaced: 'PUBLIC_KEY_KEYOBJECT_ONLY',
    keyIdAddedToSignedPayload: true,
    exactClaimShapeRequired: true,
    canonicalBase64UrlRequired: true
  },
  primaryRequirement: scope.primaryRequirement,
  requirements: scope.requirements,
  selectedBoundary: 'ED25519_PUBLIC_KEY_ONLY_READINESS_EVIDENCE_VERIFIER_NO_RUNTIME_ATTACHMENT',
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-M',
  phase: 'SIGNED_EVIDENCE_VERIFIER_BOUNDARY_PRIORITY',
  status: 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length,
  failed: 0,
  checks,
  generatedAt
});
plan.steps.push({
  id: '31-M',
  title: scope.title,
  scopeRequirement: scope.primaryRequirement,
  status: 'IN_PROGRESS',
  validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution],
  persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-M';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-M adds only an Ed25519 public-KeyObject readiness-evidence verifier boundary. No PEM/private-key input, production key authority, signer, runtime wiring, real data, SQLite ownership transfer, or cutover authority is attached.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-M_SIGNED_EVIDENCE_VERIFIER_IN_PROGRESS_PREDECESSOR_31-L_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title;
ledger.activeMicroStep = '31-M';
ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-M-001',
  field: 'nextOfficialTask',
  previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-L_PERSISTENT_RECEIPT',
  effectiveValue: scope.title,
  evidence: paths.authority,
  historicalSourceFilesRewritten: false,
  status: 'RESOLVED_WITH_EXPLICIT_USER_CONTINUATION'
});
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) {
  for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
    if (!requirement.evidence) requirement.evidence = [];
    if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence);
  }
}
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-174')) decisions.decisions.push({
  id: 'DEC-174',
  date: '2026-08-11',
  acceptedAt: '2026-08-11',
  title: scope.title,
  status: 'ACTIVE',
  source: 'Explicit user instruction: 31 m uygula',
  document: paths.decision,
  requirements: scope.requirements,
  codeAreas: [
    'apps/core-service/src/signed-cutover-readiness-evidence-verifier.ts',
    'apps/core-service/src/index.ts',
    'apps/core-service/tests/signed-cutover-readiness-evidence-verifier.test.ts'
  ],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length;
await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-M',
  primaryRequirement: scope.primaryRequirement,
  requirements: scope.requirements,
  title: scope.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING',
  officialStepStatus: 'IN_PROGRESS',
  predecessorStatus: '31-L_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_M',
  targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  startedAt: generatedAt
});
console.log(`31-M signed evidence verifier start: PASS (${checks.length}/${checks.length}); public-key-only; runtime detached; DEC-171 blocked.`);
