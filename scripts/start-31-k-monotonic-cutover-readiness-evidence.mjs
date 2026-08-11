import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json',
  decisions: 'config/user-decision-ledger.json', scope: 'config/31-k-monotonic-cutover-readiness-evidence-scope.json',
  decision: 'docs/decisions/DEC-172-monotonic-cutover-readiness-evidence.md', predecessorDecision: 'docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md',
  predecessorCompletion: 'artifacts/checkpoints/31-J_COMPLETION_RECORD.json', predecessorReceipt: 'artifacts/checkpoints/31-J_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-K_MONOTONIC_CUTOVER_READINESS_AUTHORITY.json',
  validation: 'artifacts/validation/31-K_PRIORITY_SELECTION_VALIDATION.json', execution: 'artifacts/checkpoints/31-K_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [plan, ledger, registry, decisions, scope, completion, receipt, predecessorDecision] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.decisions), readJson(paths.scope),
  readJson(paths.predecessorCompletion), readJson(paths.predecessorReceipt), readFile(full(paths.predecessorDecision), 'utf8')
]);
await readFile(full(paths.decision), 'utf8');
const predecessor = plan.steps.find((item) => item.id === '31-J');
assert(plan.currentStep === '31-J' && predecessor?.status === 'COMPLETED' && predecessor.validationStatus === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '31-J is not completed');
assert(completion.status === 'PASS' && completion.persistentReceiptStatus === 'PASS' && receipt.status === 'PASS' && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-J persistent receipt chain is not PASS');
assert(ledger.libraryUploadStatus === '31-J_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null, '31-J ledger is not closed');
assert(!plan.steps.some((item) => item.id === '31-K'), '31-K already exists');
assert(predecessorDecision.includes('Status: ACTIVE') && predecessorDecision.includes('No API in 31-J can enable cutover'), 'DEC-171 predecessor boundary is not active');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), '31-K requirements are not open P0 work');
const checks = [
  ['31-J predecessor receipt', receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['DEC-171 remains active', scope.predecessorDecision === 'DEC-171'],
  ['evidence-only ledger', scope.targets.evidenceLedger === 'APPEND_ONLY_EXACT_EPOCH_SHA256_CHAIN'],
  ['trusted verifier default deny', scope.targets.acceptanceBoundary === 'TRUSTED_VERIFIER_REQUIRED_FOR_NEW_PASS'],
  ['trusted restore anchor', scope.targets.restoreBoundary === 'NON_EMPTY_JOURNAL_REQUIRES_MATCHING_TRUSTED_ANCHOR'],
  ['Desktop fail closed', scope.targets.desktopHandshake === 'RECOMPUTE_CHAIN_AND_FAIL_CLOSED_ON_TAMPER_OR_PERMISSION'],
  ['all gates still do not activate', scope.acceptanceRules.allGatesPassEffect === 'CUTOVER_STILL_BLOCKED_SEPARATE_VERSIONED_DECISION_REQUIRED'],
  ['privacy and no migration', scope.targets.apiPrivacy.includes('NO_PATH_SECRET_TOKEN_OR_FAMILY_DATA') && scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED'],
  ['no requirement or Build claim', scope.requirementCompletionClaimed === false && scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-K priority selection failed');
const generatedAt = new Date().toISOString();
scope.status = 'IN_PROGRESS'; scope.startedAt = generatedAt; await writeJson(paths.scope, scope);
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-K', status: 'PASS', authority: 'EXPLICIT_USER_CONTINUATION_MONOTONIC_READINESS_EVIDENCE',
  decision: 'DEC-172', predecessorDecision: 'DEC-171', predecessor: { step: '31-J', completion: paths.predecessorCompletion, receipt: paths.predecessorReceipt, status: 'PASS' },
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements, selectedBoundary: 'MONOTONIC_CUTOVER_READINESS_EVIDENCE_NO_CUTOVER',
  requirementCompletionClaimed: false, newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, { schemaVersion: 1, release: plan.release, step: '31-K', phase: 'MONOTONIC_CUTOVER_READINESS_PRIORITY', status: 'PASS', expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt });
plan.steps.push({ id: '31-K', title: scope.title, scopeRequirement: scope.primaryRequirement, status: 'IN_PROGRESS', validationStatus: 'PENDING', localEvidence: [paths.scope, paths.decision, paths.authority, paths.validation, paths.execution], persistentReceiptStatus: 'PENDING' });
plan.currentStep = '31-K'; plan.updatedAt = generatedAt; plan.segmentationNote = '31-K adds verifier-gated, exact-epoch, SHA-256 chained readiness evidence while DEC-171 and the Desktop-owned production data path remain authoritative. No real data or SQLite ownership transfer occurs.'; await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-K_MONOTONIC_READINESS_IN_PROGRESS_PREDECESSOR_31-J_RECEIPT_CHAIN_PASS'; ledger.nextOfficialTask = scope.title; ledger.activeMicroStep = '31-K'; ledger.updatedAt = generatedAt;
ledger.supersessions.push({ id: 'GOV-SUP-31-K-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-J_PERSISTENT_RECEIPT', effectiveValue: scope.title, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_CONTINUATION' }); await writeJson(paths.ledger, ledger);
for (const requirement of requirements) for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) { if (!requirement.evidence) requirement.evidence = []; if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence); }
await writeJson(paths.registry, registry);
if (!decisions.decisions.some((item) => item.id === 'DEC-172')) decisions.decisions.push({
  id: 'DEC-172', date: '2026-08-11', acceptedAt: '2026-08-11', title: 'Monotonic cutover-readiness evidence and tamper-evident acceptance state', status: 'ACTIVE',
  source: 'Explicit user continuation after verified 31-J handoff', document: paths.decision, requirements: scope.requirements,
  codeAreas: ['packages/core-service-contracts/src/index.ts', 'apps/core-service/src/family-data-cutover-readiness-ledger.ts', 'apps/core-service/src/core-service-runtime.ts', 'apps/desktop/src/main/core-service-startup-connection.ts'], evidence: [paths.authority, paths.validation]
});
decisions.decisionCount = decisions.decisions.length; await writeJson(paths.decisions, decisions);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-K', primaryRequirement: scope.primaryRequirement, requirements: scope.requirements, title: scope.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-J_COMPLETED_RECEIPT_PASS', priorityAuthority: 'EXPLICIT_USER_CONTINUATION_MONOTONIC_READINESS_EVIDENCE',
  targetSliceStatus: 'IMPLEMENTATION_IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, requirementCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-K monotonic cutover-readiness start: PASS (${checks.length}/${checks.length}); DEC-171 remains blocked.`);
