import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const writeJson = async (path, value) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  roadmap: 'config/remaining-scope-package-roadmap.json', predecessor: 'artifacts/checkpoints/33-M_LIBRARY_RECEIPT.json'
});
const [plan, ledger, roadmap, predecessor] = await Promise.all([readJson(paths.plan), readJson(paths.ledger), readJson(paths.roadmap), readJson(paths.predecessor)]);
assert(predecessor.step === '33-M' && predecessor.status === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '33-M predecessor is not PASS');
assert(plan.workflowStatus === 'COMPLETED' && plan.currentStep === null && plan.steps?.every((item) => item.status === 'COMPLETED'), 'Governed plan is not ready for 33-N activation');
assert(ledger.activeMicroStep === null && ledger.libraryUploadStatus === '33-M_COMPLETED_RECEIPT_PASS' && ledger.nextOfficialTask === '33-N_DEC-225_ACTIVATION', 'Governance ledger is not ready for 33-N');
const package33N = roadmap.packages?.find((item) => item.step === '33-N');
assert(package33N?.decision === 'DEC-225' && JSON.stringify(package33N.requirementIds) === JSON.stringify(['B3-02', 'B7-14', 'B7-15']) && package33N.status === 'READY_NEXT', '33-N roadmap entry drift');
assert(!plan.steps.some((item) => item.id === '33-N'), '33-N is already activated');
const activatedAt = new Date().toISOString();
const localEvidence = [
  'config/33-n-draft-async-state-ux-scope.json', 'config/33-n-draft-async-state-ux-inventory.json',
  'docs/decisions/DEC-225-draft-async-state-ux.md', 'docs/security/THREAT_MODEL_33_N_DRAFT_ASYNC_STATE_UX.md',
  'artifacts/validation/33-N-draft-async-state-ux-boundary.json', 'artifacts/validation/33-N-draft-async-state-ux-contract.json',
  'artifacts/validation/33-N-draft-async-state-ux-runtime.json', 'docs/audit/33-N_DRAFT_ASYNC_STATE_UX_UST_KAPANIS.md'
];
plan.steps.push({
  id: '33-N', title: 'Taslak, geri alma, canlı doğrulama ve bütünleşik ekran durumları', scopeRequirement: 'B3-02,B7-14,B7-15',
  status: 'IN_PROGRESS', validationStatus: 'PENDING', localEvidence, persistentReceiptStatus: 'PENDING', completionTransitionStatus: 'PENDING'
});
plan.workflowStatus = 'IN_PROGRESS';
plan.currentStep = '33-N';
plan.recoveryAuthority = 'USER_FULL_AUTO_2026-08-14';
plan.recoveryReason = '33-M persistent receipt and source protection PASS; user authorized automatic sequential execution of all remaining packages.';
plan.updatedAt = activatedAt;
plan.segmentationNote = '33-N / DEC-225 is the sole IN_PROGRESS step. It jointly closes B3-02, B7-14 and B7-15; 33-M remains immutable COMPLETED/PASS.';
ledger.preflightStatus = 'PENDING_33_N';
ledger.postflightStatus = 'NOT_RUN';
ledger.libraryUploadStatus = '33-N_PENDING';
ledger.nextOfficialTask = '33-N_DEC-225_IMPLEMENTATION_VALIDATION_AND_RECEIPT';
ledger.activeMicroStep = '33-N';
ledger.updatedAt = activatedAt;
package33N.status = 'IN_PROGRESS';
roadmap.updatedAt = activatedAt;
await Promise.all([writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.roadmap, roadmap)]);
console.log('33-N activation: PASS (DEC-225; B3-02+B7-14+B7-15).');
