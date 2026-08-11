import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  scope: 'config/31-e-user-visible-release-boundary-scope.json',
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  predecessor: 'artifacts/checkpoints/31-D_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-D_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-E_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  validation: 'artifacts/validation/31-E_PRIORITY_SELECTION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-E_EXECUTION_RECORD.json'
};
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(full(path)), { recursive: true }); await writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const [scope, plan, ledger, registry, predecessor, predecessorReceipt] = await Promise.all([
  readJson(paths.scope), readJson(paths.plan), readJson(paths.ledger), readJson(paths.registry), readJson(paths.predecessor), readJson(paths.predecessorReceipt)
]);
const b002 = registry.requirements.find((item) => item.id === 'B0-02');
const checks = [
  ['31-D completion', predecessor.status === 'PASS' && predecessor.officialStepStatus === 'COMPLETED'],
  ['31-D receipt', predecessorReceipt.status === 'PASS' && predecessorReceipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'],
  ['no active work', plan.steps.every((item) => item.status !== 'IN_PROGRESS')],
  ['current predecessor', plan.currentStep === '31-D'],
  ['B0-02 priority', b002?.priority === 'P0'],
  ['B0-02 partial', b002?.status === 'PARTIAL'],
  ['scope identity', scope.step === '31-E' && scope.decision === 'DEC-165']
].map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
if (checks.some((item) => item.status === 'FAIL')) throw new Error(`31-E priority selection failed: ${checks.filter((item) => item.status === 'FAIL').map((item) => item.name).join(', ')}`);
const now = new Date().toISOString();
await writeJson(paths.authority, {
  schemaVersion: 1, release: plan.release, step: '31-E', requirement: 'B0-02', status: 'PASS',
  selectionClass: 'NEXT_STARTED_P0_DEC137', predecessor: { step: '31-D', status: 'COMPLETED', persistentReceiptStatus: 'PASS' },
  selectedOpenFinding: 'USER_VISIBLE_RELEASE_METADATA_BOUNDARY', decision: 'DEC-165',
  supportedBoundary: 'PUBLIC_DTO_UI_AND_DELIVERY_FILENAME', historicalEvidenceRewritten: false, newBuildIssued: false, generatedAt: now
});
await writeJson(paths.validation, {
  schemaVersion: 1, release: plan.release, step: '31-E', phase: 'AUTO_PRIORITY_SELECTION', status: 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length, failed: 0, checks, generatedAt: now
});
plan.steps.push({
  id: '31-E', title: scope.title, scopeRequirement: 'B0-02', status: 'IN_PROGRESS', validationStatus: 'PENDING',
  localEvidence: [paths.predecessor, paths.predecessorReceipt, paths.authority, paths.validation, 'docs/decisions/DEC-165-b0-02-user-visible-release-metadata-boundary.md', paths.scope, paths.execution],
  persistentReceiptStatus: 'PENDING'
});
plan.currentStep = '31-E'; plan.updatedAt = now;
plan.segmentationNote = '31-D remains immutable COMPLETED/PASS. 31-E is the sole IN_PROGRESS B0-02 public release metadata boundary. Internal release identity remains preserved; historical RC/MVP/Build evidence is immutable; no new Build is issued.';
ledger.libraryUploadStatus = '31-E_IN_PROGRESS_PREDECESSOR_31-D_RECEIPT_CHAIN_PASS';
ledger.nextOfficialTask = '31-E B0-02 user-visible release metadata and delivery filename boundary';
ledger.activeMicroStep = '31-E'; ledger.updatedAt = now;
if (!ledger.supersessions.some((item) => item.id === 'GOV-SUP-31-E-001')) ledger.supersessions.push({
  id: 'GOV-SUP-31-E-001', field: 'nextOfficialTask', previousValue: 'AUTO_PRIORITY_SELECTION_AFTER_31-D_PERSISTENT_RECEIPT',
  effectiveValue: ledger.nextOfficialTask, evidence: paths.authority
});
for (const evidence of [paths.authority, paths.validation, 'docs/decisions/DEC-165-b0-02-user-visible-release-metadata-boundary.md', paths.scope]) {
  if (!b002.evidence.includes(evidence)) b002.evidence.push(evidence);
}
await writeJson(paths.plan, plan); await writeJson(paths.ledger, ledger); await writeJson(paths.registry, registry);
await writeJson(paths.execution, {
  schemaVersion: 1, release: plan.release, step: '31-E', requirement: 'B0-02', title: scope.title,
  status: 'IN_PROGRESS_VALIDATION_PENDING', officialStepStatus: 'IN_PROGRESS', predecessorStatus: '31-D_COMPLETED_RECEIPT_PASS',
  targetSliceStatus: 'IMPLEMENTATION_PENDING', validationStatus: 'PENDING', persistentReceiptStatus: 'PENDING',
  officialCompletionClaimed: false, newBuildIssued: false, startedAt: now
});
console.log(`31-E official start: PASS (${checks.length}/${checks.length}); B0-02 public release boundary selected.`);
