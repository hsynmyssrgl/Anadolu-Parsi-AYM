import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  oldScope: 'config/31-g-family-import-governed-rollback-receipt-fence-scope.json',
  scope: 'config/31-g-main-structure-core-service-api-foundation-scope.json',
  decision: 'docs/decisions/DEC-168-main-structure-first-core-service-api-foundation.md',
  authority: 'artifacts/authority/31-G_MAIN_STRUCTURE_PRIORITY_AUTHORITY.json',
  validation: 'artifacts/validation/31-G_MAIN_STRUCTURE_PRIORITY_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-G_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [plan, ledger, registry, oldScope, scope] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.oldScope), readJson(paths.scope)
]);
await readFile(full(paths.decision), 'utf8');
const step = plan.steps.find((item) => item.id === '31-G');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
assert(step?.status === 'IN_PROGRESS' && plan.currentStep === '31-G', '31-G is not the active uncompleted step');
assert(ledger.activeMicroStep === '31-G' && ledger.libraryUploadStatus.startsWith('31-G_IN_PROGRESS'), '31-G ledger is not active');
assert(oldScope.status === 'SUPERSEDED_BY_DEC_168' && oldScope.supersededBy === 'DEC-168', 'Original 31-G selection is not explicitly superseded');
assert(scope.status === 'IN_PROGRESS' && scope.primaryRequirement === 'DHA-001', 'Main-structure scope is invalid');
assert(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), 'Main-structure requirements are not open P0 work');
const checks = [
  ['user priority supersedes narrow slice', oldScope.supersededBy === 'DEC-168'],
  ['single active step retained', plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1],
  ['headless core service selected', scope.targets.processBoundary.includes('HEADLESS_CORE_SERVICE')],
  ['typed method map selected', scope.targets.typedMethodMap.includes('COMPILE_TIME')],
  ['central fail-closed dispatcher selected', scope.targets.dispatch.includes('FAIL_CLOSED')],
  ['desktop startup handshake selected', scope.targets.desktopHandshake.includes('STARTUP')],
  ['approval-bound service installation remains open', scope.openBoundaries.windowsServiceInstallation === 'APPROVAL_BOUND_NOT_RUN_NOT_PASS'],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-G main-structure priority validation failed');
const generatedAt = new Date().toISOString();
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-G', status: 'PASS', authority: 'EXPLICIT_USER_MAIN_STRUCTURE_FIRST',
  decision: 'DEC-168', supersedesDecision: 'DEC-167', priorSelectionPreservedAt: 'artifacts/authority/31-G_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  primaryRequirement: scope.primaryRequirement, requirements: scope.requirements,
  selectedBoundary: 'CORE_SERVICE_TYPED_API_AND_OWNERSHIP_FOUNDATION', newBuildIssued: false, generatedAt
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-G', phase: 'USER_PRIORITY_SUPERSESSION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt
});
Object.assign(step, {
  title: scope.title,
  scopeRequirement: scope.primaryRequirement,
  validationStatus: 'PENDING',
  persistentReceiptStatus: 'PENDING'
});
for (const evidence of [paths.oldScope, paths.scope, paths.decision, paths.authority, paths.validation, paths.execution]) {
  if (!step.localEvidence.includes(evidence)) step.localEvidence.push(evidence);
}
plan.updatedAt = generatedAt;
plan.segmentationNote = 'Explicit user priority superseded the unimplemented narrow rollback selection. 31-G remains the sole IN_PROGRESS step and now establishes the Core Service typed API and ownership foundation before feature-detail slices; no new Build is issued.';
await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-G_MAIN_STRUCTURE_IN_PROGRESS_PREDECESSOR_31-F_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-G main structure Core Service typed API and ownership foundation';
ledger.activeMicroStep = '31-G';
ledger.updatedAt = generatedAt;
ledger.supersessions.push({
  id: 'GOV-SUP-31-G-002', field: 'nextOfficialTask',
  previousValue: '31-G PPK-002 family import governed rollback exact delete receipt fence',
  effectiveValue: ledger.nextOfficialTask, evidence: paths.authority,
  historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EXPLICIT_USER_PRIORITY'
});
await writeJson(paths.ledger, ledger);
for (const requirement of requirements) {
  for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
    if (!requirement.evidence) requirement.evidence = [];
    if (!requirement.evidence.includes(evidence)) requirement.evidence.push(evidence);
  }
}
await writeJson(paths.registry, registry);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-G', primaryRequirement: scope.primaryRequirement,
  requirements: scope.requirements, title: scope.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS',
  predecessorStatus: '31-F_COMPLETED_RECEIPT_PASS', priorityAuthority: 'EXPLICIT_USER_MAIN_STRUCTURE_FIRST',
  targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, newBuildIssued: false, startedAt: generatedAt
});
console.log(`31-G main-structure start: PASS (${checks.length}/${checks.length}); typed Core Service API foundation selected.`);
