import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const expectedRoot = resolve('C:\\PPT\\AYM', '06_KOD', 'app');
if (root !== expectedRoot) throw new Error(`Unsafe source root: ${root}`);

const paths = {
  completion30Z: 'artifacts/checkpoints/30-Z_COMPLETION_RECORD.json',
  receipt30Z: 'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  scopeRegistry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-159-ppk-002-timeline-event-policy-official-checkpoint.md',
  scope: 'config/31-a-timeline-event-policy-enforcement-scope.json',
  authority: 'artifacts/authority/31-A_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-A_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-A_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(dirname(full(path)), { recursive: true });
  await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [completion30Z, receipt30Z, plan, ledger, registry, scope] = await Promise.all([
  readJson(paths.completion30Z), readJson(paths.receipt30Z), readJson(paths.plan),
  readJson(paths.ledger), readJson(paths.scopeRegistry), readJson(paths.scope)
]);
await readFile(full(paths.decision), 'utf8');

assert(completion30Z.status === 'PASS' && completion30Z.officialStepStatus === 'COMPLETED', '30-Z completion is not authoritative PASS');
assert(completion30Z.persistentReceiptStatus === 'PASS' && receipt30Z.status === 'PASS', '30-Z persistent receipt chain is not PASS');
const step30Z = plan.steps.find((step) => step.id === '30-Z');
assert(step30Z?.status === 'COMPLETED' && step30Z.persistentReceiptStatus === 'PASS', '30-Z work-plan predecessor is not complete');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not the started P0 partial requirement');
assert(scope.step === '31-A' && scope.status === 'IN_PROGRESS', '31-A scope is invalid');

const generatedAt = new Date().toISOString();
const selectionChecks = [
  ['30-Z official completion', completion30Z.officialStepStatus === 'COMPLETED'],
  ['30-Z persistent receipt', completion30Z.persistentReceiptStatus === 'PASS'],
  ['no active predecessor work', plan.steps.filter((step) => step.status === 'IN_PROGRESS').length === 0 || plan.currentStep === '31-A'],
  ['started P0 requirement', ppk002.priority === 'P0' && ppk002.status === 'PARTIAL'],
  ['timeline boundary remains open', completion30Z.PPK002 === 'PARTIAL'],
  ['DEC-156 implementation evidence exists', ppk002.evidence.includes('docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md')],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(selectionChecks.every((item) => item.status === 'PASS'), '31-A priority selection failed');

const authority = {
  schemaVersion: 1,
  release: plan.release,
  step: '31-A',
  requirement: 'PPK-002',
  status: 'PASS',
  selectionClass: 'CONTINUING_STARTED_P0_TIMELINE_EVENT_POLICY_ENFORCEMENT',
  predecessor: { step: '30-Z', status: 'COMPLETED', persistentReceiptStatus: 'PASS', receipt: paths.receipt30Z },
  selectedOpenFinding: 'TIMELINE_EVENT_POLICY_ENFORCEMENT_VERTICAL_SLICE',
  decision: 'DEC-159',
  scope: paths.scope,
  nextSeparateSlice: 'FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION_AND_MULTI_RECEIPT_BATCH',
  PPK002: 'PARTIAL',
  newBuildIssued: false,
  generatedAt
};
await writeJson(paths.authority, authority);
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-A', phase: 'AUTO_PRIORITY_SELECTION',
  status: 'PASS', expected: selectionChecks.length, executed: selectionChecks.length,
  passed: selectionChecks.length, failed: 0, checks: selectionChecks, generatedAt
});

let step31A = plan.steps.find((step) => step.id === '31-A');
if (!step31A) {
  step31A = {
    id: '31-A',
    title: 'Governed timeline-event Policy Enforcement official checkpoint',
    scopeRequirement: 'PPK-002',
    status: 'IN_PROGRESS',
    validationStatus: 'PENDING',
    localEvidence: [
      paths.completion30Z, paths.receipt30Z, paths.authority, paths.validation, paths.decision, paths.scope,
      'docs/decisions/DEC-156-ppk-002-timeline-event-policy-local-continuation.md',
      'artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json',
      'artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json', paths.execution
    ],
    persistentReceiptStatus: 'PENDING'
  };
  plan.steps.push(step31A);
} else {
  Object.assign(step31A, { status: 'IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING' });
}
plan.currentStep = '31-A';
plan.updatedAt = generatedAt;
plan.segmentationNote = '30-Z is immutable COMPLETED/PASS with its D: external receipt. 31-A is the sole IN_PROGRESS step and promotes the already implemented timeline-event Policy Enforcement local continuation to an official checkpoint. PPK-002 remains PARTIAL; no new Build is issued.';
await writeJson(paths.plan, plan);

ledger.libraryUploadStatus = '31-A_IN_PROGRESS_PREDECESSOR_30-Z_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-A PPK-002 governed timeline-event Policy Enforcement official checkpoint';
ledger.activeMicroStep = '31-A';
ledger.updatedAt = generatedAt;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-A-001')) {
  ledger.supersessions.push({
    id: 'GOV-SUP-31-A-001', field: 'nextOfficialTask',
    previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_30-Z_PERSISTENT_RECEIPT',
    effectiveValue: ledger.nextOfficialTask, evidence: paths.authority,
    historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EVIDENCE'
  });
}
await writeJson(paths.ledger, ledger);

for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) {
  if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence);
}
await writeJson(paths.scopeRegistry, registry);

await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-A', requirement: 'PPK-002',
  title: step31A.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS',
  predecessorStatus: '30-Z_COMPLETED_RECEIPT_PASS', targetSliceStatus: 'IMPLEMENTED_LOCAL_EVIDENCE_PRESENT',
  validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false,
  PPK002: 'PARTIAL', newBuildIssued: false, startedAt: generatedAt
});

console.log(`31-A official start: PASS (${selectionChecks.length}/${selectionChecks.length}); PPK-002 timeline-event Policy Enforcement selected.`);
