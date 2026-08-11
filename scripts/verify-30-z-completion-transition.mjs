import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const verifyExternal = process.argv.slice(2).includes('--external');
const APP_ROOT = resolve(process.cwd());
const LIBRARY_ROOT = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\30-Z_PPK-002_Location_Policy_Enforcement';
const EXPECTED_UPLOAD_BUNDLE_SHA256 = '1daa9c35949ba78c81c03736809d253940fa114706cfdfbd274d96717219eb54';
const EXPECTED_PATHS = Object.freeze({
  receipt: 'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/30-Z_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/30-Z_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/30-Z_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/30-Z_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/30-Z_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/30-Z_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/30-Z_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/30-Z_SCOPE_AND_STATUS_REPORT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json'
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (relativePath) => JSON.parse((await readFile(resolve(APP_ROOT, relativePath))).toString('utf8'));
const checks = [];
const check = (condition, name, detail = undefined) => checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(condition || detail === undefined ? {} : { detail }) });

const documents = {};
for (const [name, path] of Object.entries(EXPECTED_PATHS)) {
  try {
    documents[name] = await readJson(path);
    check(true, `${name} is readable JSON`);
  } catch (error) {
    check(false, `${name} is readable JSON`, String(error));
  }
}

for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
  const path = EXPECTED_PATHS[key];
  try {
    const subjectBytes = await readFile(resolve(APP_ROOT, path));
    const sidecar = (await readFile(resolve(APP_ROOT, `${path}.sha256`), 'utf8')).trim().split(/\s+/u)[0]?.toLowerCase();
    check(sidecar === sha256(subjectBytes), `${key} local sidecar binds exact bytes`);
  } catch (error) {
    check(false, `${key} local sidecar binds exact bytes`, String(error));
  }
}

const { receipt, readback, receiptReadback, persistence, inventory, completion, transition, execution, scope, plan, ledger } = documents;
check(receipt?.step === '30-Z' && receipt.status === 'PASS', 'receipt is 30-Z PASS');
check(receipt?.persistentReceiptStatus === 'PASS' && receipt.officialCompletionClaimed === true, 'receipt authorizes official 30-Z completion');
check(receipt?.libraryPath === LIBRARY_ROOT && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', 'receipt binds D: external USB Library');
check(String(receipt?.libraryPath ?? '').toUpperCase().startsWith('D:\\AYM_LIBRARY\\'), '30-Z receipt uses the D: Library path');
check(receipt?.artifacts?.length === 20 && receipt.roundTripVerification?.matched === 20 && receipt.roundTripVerification?.failed === 0, 'receipt binds 20/20 frozen files');
check(receipt?.singleUploadBundle?.sha256 === EXPECTED_UPLOAD_BUNDLE_SHA256, 'receipt binds expected upload bundle SHA-256');
check(receipt?.evidenceBoundary?.PPK002 === 'PARTIAL' && receipt.evidenceBoundary?.requirementCompletionClaimed === false, 'receipt preserves PPK-002 PARTIAL boundary');
check(receipt?.currentAuthoritativeSource?.externalProtectionStatus?.startsWith('PENDING_'), 'receipt separates current C: source external protection');
check(receipt?.newBuildIssued === false, 'receipt issues no new Build');

check(readback?.status === 'PASS' && readback.expected === 20 && readback.executed === 20 && readback.matched === 20 && readback.failed === 0, 'base Library readback is 20/20 PASS');
check(readback?.sidecarExpected === 10 && readback.sidecarExecuted === 10 && readback.sidecarFailed === 0, 'base sidecar readback is 10/10 PASS');
check(receiptReadback?.status === 'PASS' && receiptReadback.expected === 4 && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'receipt first-stage readback is 4/4 PASS');
check(persistence?.status === 'PASS' && persistence.expected === 2 && persistence.matched === 2 && persistence.failed === 0, 'receipt persistence readback is 2/2 PASS');
check(inventory?.status === 'PASS' && inventory.actualFilesBeforeInventory === 28 && inventory.finalExpectedFilesIncludingInventoryPair === 30, 'final inventory binds exact 30-file layout');

check(completion?.status === 'PASS' && completion.officialStepStatus === 'COMPLETED', 'completion record is PASS/COMPLETED');
check(completion?.persistentReceiptStatus === 'PASS' && completion.persistentReceiptPath === EXPECTED_PATHS.receipt, 'completion record binds persistent receipt');
check(completion?.PPK002 === 'PARTIAL' && completion.requirementCompletionClaimed === false && completion.newBuildIssued === false, 'completion preserves scope and Build boundaries');
check(transition?.status === 'PASS' && transition.failed === 0 && transition.passed === transition.expected, 'completion transition validation is clean PASS');

const step30Z = plan?.steps?.find((step) => step.id === '30-Z');
const activeSteps = plan?.steps?.filter((step) => step.status === 'IN_PROGRESS') ?? [];
const successor31AActive = plan?.currentStep === '31-A'
  && activeSteps.length === 1
  && activeSteps[0]?.id === '31-A'
  && activeSteps[0]?.persistentReceiptStatus === 'PENDING';
const step31A = plan?.steps?.find((step) => step.id === '31-A');
const successor31ACompleted = plan?.currentStep === '31-A'
  && activeSteps.length === 0
  && step31A?.status === 'COMPLETED'
  && step31A?.persistentReceiptStatus === 'PASS';
const step31B = plan?.steps?.find((step) => step.id === '31-B');
const successor31BActive = plan?.currentStep === '31-B' && activeSteps.length === 1 && activeSteps[0]?.id === '31-B' && activeSteps[0]?.persistentReceiptStatus === 'PENDING';
const successor31BCompleted = plan?.currentStep === '31-B' && activeSteps.length === 0 && step31B?.status === 'COMPLETED' && step31B?.persistentReceiptStatus === 'PASS';
const step31C = plan?.steps?.find((step) => step.id === '31-C');
const successor31CActive = plan?.currentStep === '31-C' && activeSteps.length === 1 && activeSteps[0]?.id === '31-C' && activeSteps[0]?.persistentReceiptStatus === 'PENDING' && step31B?.status === 'COMPLETED';
const successor31CCompleted = plan?.currentStep === '31-C' && activeSteps.length === 0 && step31B?.status === 'COMPLETED' && step31C?.status === 'COMPLETED' && step31C?.persistentReceiptStatus === 'PASS';
const step31D = plan?.steps?.find((step) => step.id === '31-D');
const successor31DCompleted = plan?.currentStep === '31-D' && activeSteps.length === 0 && step31C?.status === 'COMPLETED' && step31D?.status === 'COMPLETED' && step31D?.persistentReceiptStatus === 'PASS';
const step31E = plan?.steps?.find((step) => step.id === '31-E');
const successor31ECompleted = plan?.currentStep === '31-E' && activeSteps.length === 0 && step31D?.status === 'COMPLETED' && step31E?.status === 'COMPLETED' && step31E?.persistentReceiptStatus === 'PASS';
const step31F = plan?.steps?.find((step) => step.id === '31-F');
const successor31FCompleted = plan?.currentStep === '31-F' && activeSteps.length === 0 && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F?.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });
check(step30Z?.status === 'COMPLETED' && ((plan?.currentStep === '30-Z' && activeSteps.length === 0) || successor31AActive || successor31ACompleted || successor31BActive || successor31BCompleted || successor31CActive || successor31CCompleted || successor31DCompleted || successor31ECompleted || successor31FCompleted || laterSuccessor.planValid), 'work plan preserves completed 30-Z through authorized successors');
check(step30Z?.validationStatus === 'PASS' && step30Z?.persistentReceiptStatus === 'PASS' && step30Z?.persistentReceiptPath === EXPECTED_PATHS.receipt, 'work plan binds 30-Z validation and receipt PASS');
check(
  (ledger?.libraryUploadStatus === '30-Z_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || (successor31AActive && ledger?.libraryUploadStatus === '31-A_IN_PROGRESS_PREDECESSOR_30-Z_RECEIPT_CHAIN_PASS' && ledger?.activeMicroStep === '31-A')
  || (successor31ACompleted && ledger?.libraryUploadStatus === '31-A_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || (successor31BActive && ['31-B_IN_PROGRESS_PREDECESSOR_31-A_RECEIPT_CHAIN_PASS', '31-B_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger?.libraryUploadStatus) && ledger?.activeMicroStep === '31-B')
  || (successor31BCompleted && ledger?.libraryUploadStatus === '31-B_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || (successor31CActive && ['31-C_IN_PROGRESS_PREDECESSOR_31-B_RECEIPT_CHAIN_PASS', '31-C_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger?.libraryUploadStatus) && ledger?.activeMicroStep === '31-C')
  || (successor31CCompleted && ledger?.libraryUploadStatus === '31-C_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || (successor31DCompleted && ledger?.libraryUploadStatus === '31-D_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || (successor31ECompleted && ledger?.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || (successor31FCompleted && ledger?.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS' && ledger?.activeMicroStep === null)
  || laterSuccessor.ledgerValid,
  'active ledger preserves the completed 30-Z receipt chain'
);
check(
  ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_30-Z_PERSISTENT_RECEIPT'
  || (successor31AActive && String(ledger?.nextOfficialTask ?? '').startsWith('31-A'))
  || (successor31ACompleted && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT')
  || (successor31BActive && String(ledger?.nextOfficialTask ?? '').startsWith('31-B'))
  || (successor31BCompleted && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT')
  || (successor31CActive && String(ledger?.nextOfficialTask ?? '').startsWith('31-C'))
  || (successor31CCompleted && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-C_PERSISTENT_RECEIPT')
  || (successor31DCompleted && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-D_PERSISTENT_RECEIPT')
  || (successor31ECompleted && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-E_PERSISTENT_RECEIPT')
  || (successor31FCompleted && ledger?.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-F_PERSISTENT_RECEIPT')
  || laterSuccessor.nextTaskValid,
  'active ledger either awaits or records an authorized successor'
);
check(ledger?.externalLibraryAuthority?.path === LIBRARY_ROOT && ledger.externalLibraryAuthority?.frozenCheckpointOnly === true, 'active ledger binds frozen checkpoint authority only');
check(execution?.officialStepStatus === 'COMPLETED' && execution?.persistentReceiptStatus === 'PASS' && execution?.officialCompletionClaimed === true, 'execution record reflects official completion');
check(scope?.officialStepStatus === 'COMPLETED' && scope?.persistentReceiptStatus === 'PASS' && scope?.officialCompletionClaimed === true, 'scope report reflects official completion');
check(scope?.PPK002 === 'PARTIAL' && scope?.openBoundaries?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope report keeps PPK-002 open boundary');

if (verifyExternal) {
  try {
    const names = (await readdir(LIBRARY_ROOT, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    check(names.length === 30, 'D: external Library contains exactly 30 files', `found=${names.length}`);
    const expectedNames = [
      ...receipt.artifacts.map((item) => item.name),
      ...['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory'].flatMap((key) => [basename(EXPECTED_PATHS[key]), `${basename(EXPECTED_PATHS[key])}.sha256`])
    ].sort();
    check(JSON.stringify(names) === JSON.stringify(expectedNames), 'D: external Library file set is exact');
    for (const artifact of receipt.artifacts) {
      const bytes = await readFile(join(LIBRARY_ROOT, artifact.name));
      check(bytes.length === artifact.sizeBytes && sha256(bytes) === artifact.sha256, `D: base artifact exact: ${artifact.name}`);
    }
    for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
      const localBytes = await readFile(resolve(APP_ROOT, EXPECTED_PATHS[key]));
      const externalBytes = await readFile(join(LIBRARY_ROOT, basename(EXPECTED_PATHS[key])));
      check(localBytes.length === externalBytes.length && sha256(localBytes) === sha256(externalBytes), `D: supplemental artifact exact: ${key}`);
    }
  } catch (error) {
    check(false, 'D: external Library is readable', String(error));
  }
}

const failures = checks.filter((item) => item.status === 'FAIL');
if (failures.length > 0) {
  console.error(`30-Z completion transition: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ''}`);
  process.exit(1);
}

console.log(`30-Z completion transition: PASS (${checks.length}/${checks.length}${verifyExternal ? '; D: external readback included' : '; durable local evidence'}).`);
console.log('30-Z: COMPLETED; persistent receipt: PASS; PPK-002: PARTIAL; new Build: false.');
