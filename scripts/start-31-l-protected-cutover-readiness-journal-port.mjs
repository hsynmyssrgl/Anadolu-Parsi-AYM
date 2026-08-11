import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json',
  scope: 'config/31-l-protected-cutover-readiness-journal-port-scope.json',
  decision: 'docs/decisions/DEC-173-protected-cutover-readiness-journal-port.md',
  predecessorDecision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md',
  cutoverDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  predecessorCompletion: 'artifacts/checkpoints/31-K_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-K_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-L_PROTECTED_READINESS_JOURNAL_PORT_AUTHORITY.json',
  validation: 'artifacts/validation/31-L_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-L_EXECUTION_RECORD.json'
};
const stagingInventoryPath = resolve(root, '..', '..', '11_FUTURE_PATCHES', 'AFTER_31-K_8aa4ba50', 'STAGING_INVENTORY.json');
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [plan, ledger, registry, decisions, scope, completion, receipt, predecessorDecision, cutoverDecision, stagingInventory] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.predecessorCompletion), readJson(paths.predecessorReceipt), readFile(full(paths.predecessorDecision), 'utf8'),
  readFile(full(paths.cutoverDecision), 'utf8'), readFile(stagingInventoryPath, 'utf8').then(JSON.parse)
]);
await readFile(full(paths.decision), 'utf8');
const predecessor = plan.steps.find((item) => item.id === '31-K');
assert(plan.currentStep === '31-K' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-K is not completed');
assert(completion.status === 'PASS' && completion.persistentReceiptStatus === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-K persistent receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-K_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-K ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-L'), '31-L already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('durable protected readiness journal are not attached'), 'DEC-172 predecessor boundary is not active');
assert(cutoverDecision.includes('Status: ACTIVE') && cutoverDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 cutover block is not active');
assert(stagingInventory.treeSha256 === '942d11a1b2e18cd0fa58dfb8d3897d62756153b7c45ad4870019705990a13127' && stagingInventory.fileCount === 39, '31-L staging inventory is not the reviewed handoff');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-L requirements are not open P0 work');
const checks = [
  ['31-K predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['DEC-172 remains active', scope.predecessorDecision === 'DEC-172'],
  ['DEC-171 remains active', scope.cutoverDecision === 'DEC-171'],
  ['port-only boundary', scope.targets.journalPort === 'ASYNC_LOAD_COMPARE_AND_SWAP_SEAL_BOUNDARY'],
  ['detached default deny', scope.targets.defaultComposition === 'DETACHED_UNAVAILABLE_FAIL_CLOSED'],
  ['unavailable load cannot look empty', scope.targets.unavailableLoad === 'REJECT_JOURNAL_UNAVAILABLE_NOT_EMPTY_SUCCESS'],
  ['no production adapter or runtime wiring', scope.targets.productionAdapter === 'NOT_ATTACHED' && scope.targets.runtimeIntegration === 'NOT_WIRED'],
  ['privacy and no migration', scope.targets.apiPrivacy.includes('NO_PATH_SECRET_TOKEN_KEY_OR_FAMILY_DATA') && scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED'],
  ['reviewed staging inventory', stagingInventory.treeSha256 === '942d11a1b2e18cd0fa58dfb8d3897d62756153b7c45ad4870019705990a13127'],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-L priority selection failed');

const generatedAt = new Date().toISOString();
scope.status = 'IN_PROGRESS';
scope.startedAt = generatedAt;
await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-L',
  status: 'PASS',
  authority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_L',
  decision: 'DEC-173',
  predecessorDecision: 'DEC-172',
  cutoverDecision: 'DEC-171',
  predecessor: { step: '31-K', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  reviewedStaging: { path: stagingInventoryPath, treeSha256: stagingInventory.treeSha256, fileCount: stagingInventory.fileCount },
  primaryRequirement: scope.primaryRequirement,
  requirements: scope.requirements,
  selectedBoundary: 'PROTECTED_READINESS_JOURNAL_PORT_DETACHED_DEFAULT_DENY_NO_ADAPTER',
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-L',
  phase: 'PROTECTED_READINESS_JOURNAL_PORT_PRIORITY',
  status: 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length,
  failed: 0,
  checks,
  generatedAt
});
plan.steps.push({
  id: '31-L',
  title: scope.title,
  scopeRequirement: scope.primaryRequirement,
  status: 'IN_PROGRESS',
  validationStatus: 'PENDING',
  localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution],
  persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-L';
plan.updatedAt = generatedAt;
plan.segmentationNote = '31-L adds only a protected readiness-journal persistence port and detached default-deny implementation. No production adapter, path, key, real data, SQLite ownership transfer, or cutover authority is attached.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-L_PROTECTED_READINESS_JOURNAL_PORT_IN_PROGRESS_PREDECESSOR_31-K_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = scope.title;
ledger.activeMicroStep = '31-L';
ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-L-001',
  field: 'nextOfficialTask',
  previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-K_PERSISTENT_RECEIPT',
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
if (!decisions.decisions.some((item) => item.id === 'DEC-173')) decisions.decisions.push({
  id: 'DEC-173',
  date: '2026-08-11',
  acceptedAt: '2026-08-11',
  title: scope.title,
  status: 'ACTIVE',
  source: 'Explicit user instruction: 31-L yi uygula',
  document: paths.decision,
  requirements: scope.requirements,
  codeAreas: [
    'apps/core-service/src/protected-cutover-readiness-journal-port.ts',
    'apps/core-service/src/index.ts',
    'apps/core-service/tests/protected-cutover-readiness-journal-port.test.ts'
  ],
  evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length;
await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1,
  release: plan.release,
  step: '31-L',
  primaryRequirement: scope.primaryRequirement,
  requirements: scope.requirements,
  title: scope.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING',
  officialStepStatus: 'IN_PROGRESS',
  predecessorStatus: '31-K_COMPLETED_RECEIPT_PASS',
  priorityAuthority: 'EXPLICIT_USER_CONTINUATION_APPLY_31_L',
  targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS',
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false,
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  startedAt: generatedAt
});
console.log(`31-L protected readiness journal port start: PASS (${checks.length}/${checks.length}); production adapter detached; DEC-171 blocked.`);
