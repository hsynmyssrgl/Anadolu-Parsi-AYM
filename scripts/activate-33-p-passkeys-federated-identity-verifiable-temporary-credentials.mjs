import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
if (process.argv.length !== 2) throw new Error('33-P activator accepts no arguments');

const requirements = Object.freeze(['B2-02', 'B6-06', 'B6-07', 'EXT-070', 'EXT-071', 'EXT-072', 'EXT-073', 'EXT-074']);
const acceptance = Object.freeze({
  'B2-02': 'Kayıt, assertion, silme, birden çok anahtar, kayıp anahtar kurtarma ve audit var.',
  'B6-06': 'Yapılandırılmamış sağlayıcı görünmez; canlı hesapla test edilmeden PASS yok.',
  'B6-07': 'Windows tek ana veri kaynağı; çatışma ve cihaz iptali sözleşmesi.',
  'EXT-070': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-071': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-072': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-073': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.',
  'EXT-074': 'Tam karar-kod-ekran-test-belge-kanıt zinciri.'
});
const paths = Object.freeze({
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  registry: 'config/accepted-scope-registry.json',
  scope: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  inventory: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  decision: 'docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md',
  threat: 'docs/security/THREAT_MODEL_33_P_PASSKEYS_FEDERATED_IDENTITY_VERIFIABLE_TEMPORARY_CREDENTIALS.md',
  predecessor: 'artifacts/checkpoints/33-O_LIBRARY_RECEIPT.json'
});
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const writeJson = async (path, value) => writeFile(full(path), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sidecarExact = async (path) => {
  const bytes = await readFile(full(path));
  return await readFile(full(`${path}.sha256`), 'utf8') === `${sha256(bytes)}  ${basename(path)}\n`;
};
const markActive = (document, label) => {
  assert(document.includes('- Durum: READY_FOR_ACTIVATION'), `${label} is not ready for activation`);
  assert(document.includes('- Doğrulama: NOT_RUN'), `${label} validation truth drift`);
  return document.replace('- Durum: READY_FOR_ACTIVATION', '- Durum: IN_PROGRESS');
};

const [plan, ledger, roadmap, registry, scope, inventory, predecessor, decisionDocument, threatModel] = await Promise.all([
  readJson(paths.plan), readJson(paths.ledger), readJson(paths.roadmap), readJson(paths.registry), readJson(paths.scope),
  readJson(paths.inventory), readJson(paths.predecessor), readFile(full(paths.decision), 'utf8'), readFile(full(paths.threat), 'utf8')
]);

assert(predecessor.step === '33-O' && predecessor.decision === 'DEC-226' && predecessor.status === 'PASS'
  && predecessor.persistentReceiptStatus === 'PASS' && predecessor.nextOfficialStep === '33-P'
  && predecessor.nextOfficialDecision === 'DEC-227' && await sidecarExact(paths.predecessor),
  '33-O predecessor receipt is not exact PASS for 33-P');
assert(plan.workflowStatus === 'COMPLETED' && plan.currentStep === null
  && plan.steps?.length > 0 && plan.steps.every((item) => item.status === 'COMPLETED'),
  'Governed plan is not ready for 33-P activation');
const predecessorStep = plan.steps.find((item) => item.id === '33-O');
assert(predecessorStep?.validationStatus === 'PASS' && predecessorStep.persistentReceiptStatus === 'PASS',
  '33-O plan step is not immutable COMPLETED/PASS');
assert(ledger.activeMicroStep === null && ledger.libraryUploadStatus === '33-O_COMPLETED_RECEIPT_PASS'
  && ledger.nextOfficialTask === '33-P_DEC-227_ACTIVATION' && ledger.postflightStatus === 'PASS',
  'Governance ledger is not ready for 33-P');
const package33P = roadmap.packages?.find((item) => item.step === '33-P');
assert(package33P?.decision === 'DEC-227' && exact(package33P.requirementIds, requirements)
  && exact(package33P.dependsOn, ['33-O']) && package33P.status === 'READY_NEXT',
  '33-P roadmap entry drift');
assert(!plan.steps.some((item) => item.id === '33-P'), '33-P is already activated');
assert(scope.id === '33-P-PASSKEYS-FEDERATED-IDENTITY-VERIFIABLE-TEMPORARY-CREDENTIALS'
  && scope.decision === 'DEC-227' && exact(scope.requirements, requirements)
  && exact(scope.canonicalAcceptance, acceptance) && scope.status === 'READY_FOR_ACTIVATION'
  && scope.validation?.status === 'NOT_RUN' && scope.validation?.countsAsRequirementPass === false,
  '33-P scope is not an exact activation-ready governance draft');
assert(inventory.step === '33-P' && inventory.decision === 'DEC-227' && exact(inventory.requirements, requirements)
  && inventory.status === 'READY_FOR_ACTIVATION' && inventory.implementationStatus === 'NOT_STARTED'
  && exact(inventory.openRequirements, requirements) && inventory.implementedPaths?.length === 0,
  '33-P inventory is not an exact activation-ready governance draft');
for (const id of requirements) {
  const item = registry.requirements?.find((candidate) => candidate.id === id);
  assert(item && item.status !== 'COMPLETE' && item.acceptance === acceptance[id], `33-P registry acceptance drift: ${id}`);
}
const finalDecisionDocument = markActive(decisionDocument, 'DEC-227');
const finalThreatModel = markActive(threatModel, '33-P threat model');

const activatedAt = new Date().toISOString();
const localEvidence = [
  paths.scope, paths.inventory, paths.decision, paths.threat,
  'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-boundary.json',
  'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-contract.json',
  'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-runtime.json'
];
plan.steps.push({
  id: '33-P',
  title: 'Passkey, federated kimlik ve doğrulanabilir geçici yetki belgeleri',
  scopeRequirement: requirements.join(','),
  status: 'IN_PROGRESS',
  validationStatus: 'PENDING',
  localEvidence,
  persistentReceiptStatus: 'PENDING',
  completionTransitionStatus: 'PENDING'
});
plan.workflowStatus = 'IN_PROGRESS';
plan.currentStep = '33-P';
plan.recoveryAuthority = 'USER_FULL_AUTO_2026-08-14';
plan.recoveryReason = '33-O persistent receipt, source protection and Git remote equality PASS; user authorized automatic sequential execution.';
plan.updatedAt = activatedAt;
plan.segmentationNote = '33-P / DEC-227 is the sole IN_PROGRESS step. Governance is active; implementation, live provider, real authenticator and runtime evidence remain NOT_RUN.';
ledger.preflightStatus = 'PENDING_33_P';
ledger.postflightStatus = 'NOT_RUN';
ledger.libraryUploadStatus = '33-P_PENDING';
ledger.nextOfficialTask = '33-P_DEC-227_IMPLEMENTATION_VALIDATION_AND_RECEIPT';
ledger.activeMicroStep = '33-P';
ledger.updatedAt = activatedAt;
package33P.status = 'IN_PROGRESS';
roadmap.updatedAt = activatedAt;
scope.status = 'IN_PROGRESS';
scope.governancePhase = 'ACTIVATED_IMPLEMENTATION_NOT_STARTED';
inventory.status = 'IN_PROGRESS';

await Promise.all([
  writeJson(paths.plan, plan), writeJson(paths.ledger, ledger), writeJson(paths.roadmap, roadmap),
  writeJson(paths.scope, scope), writeJson(paths.inventory, inventory),
  writeFile(full(paths.decision), finalDecisionDocument, 'utf8'), writeFile(full(paths.threat), finalThreatModel, 'utf8')
]);
console.log('33-P activation: PASS (DEC-227; 8 requirements; implementation remains NOT_RUN).');
