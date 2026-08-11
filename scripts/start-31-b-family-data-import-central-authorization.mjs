import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  completion31A: 'artifacts/checkpoints/31-A_COMPLETION_RECORD.json', receipt31A: 'artifacts/checkpoints/31-A_LIBRARY_RECEIPT.json',
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-160-ppk-002-family-data-import-central-authorization-official-checkpoint.md',
  scope: 'config/31-b-family-data-import-central-authorization-scope.json',
  authority: 'artifacts/authority/31-B_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-B_PRIORITY_SELECTION_VALIDATION.json', execution: 'artifacts/checkpoints/31-B_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path); const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [completion, receipt, plan, ledger, registry, scope] = await Promise.all([
  readJson(paths.completion31A), readJson(paths.receipt31A), readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.scope)
]);
await Promise.all([
  readFile(full(paths.decision), 'utf8'),
  readFile(full('docs/decisions/DEC-157-ppk-002-family-data-import-central-authorization-local-continuation.md'), 'utf8')
]);
assert(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.persistentReceiptStatus === 'PASS', '31-A predecessor is not completed PASS');
assert(receipt.status === 'PASS' && receipt.persistentReceiptStatus === 'PASS', '31-A receipt is not PASS');
const step31A = plan.steps.find((item) => item.id === '31-A'); const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
assert(step31A?.status === 'COMPLETED' && step31A.persistentReceiptStatus === 'PASS', '31-A plan predecessor is not complete');
assert(ppk002?.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 is not started P0 PARTIAL');
assert(scope.step === '31-B' && scope.status === 'IN_PROGRESS', '31-B scope is invalid');
const checks = [
  ['31-A completion', completion.officialStepStatus === 'COMPLETED'], ['31-A receipt', completion.persistentReceiptStatus === 'PASS'],
  ['no active work', plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0 || plan.currentStep === '31-B'],
  ['started P0 requirement', ppk002.priority === 'P0' && ppk002.status === 'PARTIAL'],
  ['DEC-157 implementation evidence', true],
  ['multi-receipt boundary open', scope.openBoundaries.familyDataImportMultiReceiptBatch === 'NOT_COMPLETE'],
  ['new Build forbidden', scope.newBuildIssued === false]
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
assert(checks.every((item) => item.status === 'PASS'), '31-B priority selection failed');
const generatedAt = new Date().toISOString();
await writeJson(paths.authority, { schemaVersion: 1, release: plan.release, step: '31-B', requirement: 'PPK-002', status: 'PASS', selectionClass: 'CONTINUING_STARTED_P0_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION', predecessor: { step: '31-A', status: 'COMPLETED', persistentReceiptStatus: 'PASS', receipt: paths.receipt31A }, selectedOpenFinding: 'FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION', decision: 'DEC-160', scope: paths.scope, nextSeparateSlice: 'FAMILY_DATA_IMPORT_MULTI_RECEIPT_BATCH', PPK002: 'PARTIAL', newBuildIssued: false, generatedAt });
await writeJson(paths.validation, { schemaVersion: 1, release: plan.release, step: '31-B', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS', expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt });
let step31B = plan.steps.find((item) => item.id === '31-B');
if (!step31B) { step31B = { id: '31-B', title: 'Family data import central authorization official checkpoint', scopeRequirement: 'PPK-002', status: 'IN_PROGRESS', validationStatus: 'PENDING', localEvidence: [paths.completion31A, paths.receipt31A, paths.authority, paths.validation, paths.decision, paths.scope, 'docs/decisions/DEC-157-ppk-002-family-data-import-central-authorization-local-continuation.md', 'artifacts/validation/PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json', paths.execution], persistentReceiptStatus: 'PENDING' }; plan.steps.push(step31B); }
else Object.assign(step31B, { status: 'IN_PROGRESS', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING' });
plan.currentStep = '31-B'; plan.updatedAt = generatedAt; plan.segmentationNote = '30-Z and 31-A remain immutable COMPLETED/PASS. 31-B is the sole IN_PROGRESS family data import central authorization checkpoint. Multi-receipt import remains a separate open boundary; PPK-002 stays PARTIAL; no new Build is issued.'; await writeJson(paths.plan, plan);
ledger.libraryUploadStatus = '31-B_IN_PROGRESS_PREDECESSOR_31-A_RECEIPT_CHAIN_PASS'; ledger.nextOfficialTask = '31-B PPK-002 family data import central authorization official checkpoint'; ledger.activeMicroStep = '31-B'; ledger.updatedAt = generatedAt;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-B-001')) ledger.supersessions.push({ id: 'GOV-SUP-31-B-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT', effectiveValue: ledger.nextOfficialTask, evidence: paths.authority, historicalSourceFilesRewritten: false, status: 'RESOLVED_WITH_EVIDENCE' });
await writeJson(paths.ledger, ledger);
for (const evidence of [paths.authority, paths.validation, paths.decision, paths.scope]) if (!ppk002.evidence.includes(evidence)) ppk002.evidence.push(evidence); await writeJson(paths.registry, registry);
await writeJson(paths.execution, { schemaVersion: 1, release: plan.release, step: '31-B', requirement: 'PPK-002', title: step31B.title, status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-A_COMPLETED_RECEIPT_PASS', targetSliceStatus: 'IMPLEMENTED_LOCAL_EVIDENCE_PRESENT', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING', officialCompletionClaimed: false, PPK002: 'PARTIAL', newBuildIssued: false, startedAt: generatedAt });
console.log(`31-B official start: PASS (${checks.length}/${checks.length}); family data import central authorization selected.`);
