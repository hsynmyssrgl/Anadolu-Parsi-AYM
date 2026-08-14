import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const writeJson = async (path, value) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const requirements = Object.freeze(['B6-02', 'PPK-028', 'AUD-COM-006', 'EXT-036', 'EXT-037', 'EXT-038', 'EXT-040', 'EXT-041', 'EXT-042']);
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  predecessor: 'artifacts/checkpoints/33-N_LIBRARY_RECEIPT.json'
});
const [plan, ledger, roadmap, predecessor] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.roadmap), readJson(paths.predecessor)
]);
assert(predecessor.step === '33-N' && predecessor.status === 'PASS' && predecessor.persistentReceiptStatus === 'PASS', '33-N predecessor is not PASS');
assert(plan.workflowStatus === 'COMPLETED' && plan.currentStep === null && plan.steps?.every((item) => item.status === 'COMPLETED'), 'Governed plan is not ready for 33-O activation');
assert(ledger.activeMicroStep === null && ledger.libraryUploadStatus === '33-N_COMPLETED_RECEIPT_PASS'
  && ledger.nextOfficialTask === '33-O_DEC-226_ACTIVATION', 'Governance ledger is not ready for 33-O');
const package33O = roadmap.packages?.find((item) => item.step === '33-O');
assert(package33O?.decision === 'DEC-226' && JSON.stringify(package33O.requirementIds) === JSON.stringify(requirements)
  && package33O.status === 'READY_NEXT', '33-O roadmap entry drift');
assert(!plan.steps.some((item) => item.id === '33-O'), '33-O is already activated');

const activatedAt = new Date().toISOString();
const localEvidence = [
  'config/33-o-privacy-ownership-data-rights-incident-control-scope.json',
  'config/33-o-privacy-ownership-data-rights-incident-control-inventory.json',
  'docs/decisions/DEC-226-privacy-ownership-data-rights-incident-control.md',
  'docs/security/THREAT_MODEL_33_O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL.md',
  'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-boundary.json',
  'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-contract.json',
  'artifacts/validation/33-O-privacy-ownership-data-rights-incident-control-runtime.json',
  'docs/audit/33-O_PRIVACY_OWNERSHIP_DATA_RIGHTS_INCIDENT_CONTROL_UST_KAPANIS.md'
];
plan.steps.push({
  id: '33-O',
  title: 'Gizlilik, sahiplik, veri hakları ve olay kontrol merkezi',
  scopeRequirement: requirements.join(','),
  status: 'IN_PROGRESS',
  validationStatus: 'PENDING',
  localEvidence,
  persistentReceiptStatus: 'PENDING',
  completionTransitionStatus: 'PENDING'
});
plan.workflowStatus = 'IN_PROGRESS';
plan.currentStep = '33-O';
plan.recoveryAuthority = 'USER_FULL_AUTO_2026-08-14';
plan.recoveryReason = '33-N persistent receipt, source protection and Git remote equality PASS; user authorized automatic sequential execution of all remaining packages.';
plan.updatedAt = activatedAt;
plan.segmentationNote = '33-O / DEC-226 is the sole IN_PROGRESS step. It jointly closes nine privacy, ownership, data-rights and incident-control requirements; 33-N remains immutable COMPLETED/PASS.';
ledger.preflightStatus = 'PENDING_33_O';
ledger.postflightStatus = 'NOT_RUN';
ledger.libraryUploadStatus = '33-O_PENDING';
ledger.nextOfficialTask = '33-O_DEC-226_IMPLEMENTATION_VALIDATION_AND_RECEIPT';
ledger.activeMicroStep = '33-O';
ledger.updatedAt = activatedAt;
package33O.status = 'IN_PROGRESS';
roadmap.updatedAt = activatedAt;
await Promise.all([writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.roadmap, roadmap)]);
console.log('33-O activation: PASS (DEC-226; 9 requirements).');
