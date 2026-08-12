import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const verifyExternal = process.argv.slice(2).includes('--external');
const libraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\31-D_PPK-002_Family_Import_Reused_Location_Read_Receipt';
const paths = {
  receipt: 'artifacts/checkpoints/31-D_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-D_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-D_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/31-D_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-D_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-D_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-D_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-D_EXECUTION_RECORD.json',
  scope: 'artifacts/inventory/31-D_SCOPE_AND_STATUS_REPORT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const checks = [];
const check = (condition, name, detail) => checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(!condition && detail ? { detail } : {}) });
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
  const bytes = await readFile(resolve(root, paths[key]));
  const declared = (await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8')).trim().split(/\s+/u)[0];
  check(declared === sha256(bytes), `${key} local sidecar binds exact bytes`);
}
const { receipt, readback, receiptReadback, persistence, inventory, completion, transition, execution, scope, plan, ledger } = docs;
const step31D = plan.steps?.find((item) => item.id === '31-D');
const step31E = plan.steps?.find((item) => item.id === '31-E');
const step31F = plan.steps?.find((item) => item.id === '31-F');
const active = plan.steps?.filter((item) => item.status === 'IN_PROGRESS') ?? [];
const successor31ECompleted = plan.currentStep === '31-E' && active.length === 0 && step31E?.status === 'COMPLETED' && step31E.persistentReceiptStatus === 'PASS';
const successor31FCompleted = plan.currentStep === '31-F' && active.length === 0 && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });
check(receipt.status === 'PASS' && receipt.officialStepStatus === 'COMPLETED' && receipt.persistentReceiptStatus === 'PASS', '31-D receipt is official PASS');
check(receipt.libraryPath === libraryRoot && receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-D receipt binds D: USB Library');
check(receipt.PPK002 === 'PARTIAL' && receipt.requirementCompletionClaimed === false && receipt.newBuildIssued === false, 'receipt preserves scope and Build boundaries');
check(receipt.openBoundaries.newlyCreatedLocationLinkedEventImport === 'NEXT_SEPARATE_SLICE_FAIL_CLOSED', 'new-location-linked event import remains fail-closed');
check(receipt.openBoundaries.governedImportRollbackReceiptFence === 'NOT_COMPLETE', 'governed import rollback remains open');
check(readback.status === 'PASS' && readback.failed === 0 && readback.matched === readback.expected, 'base package readback is PASS');
check(receiptReadback.status === 'PASS' && receiptReadback.matched === 4 && receiptReadback.failed === 0, 'receipt readback is 4/4 PASS');
check(persistence.status === 'PASS' && persistence.matched === 2 && persistence.failed === 0, 'receipt persistence is 2/2 PASS');
check(inventory.status === 'PASS' && inventory.actualFilesBeforeInventory === inventory.expectedFilesBeforeInventory, 'final inventory is exact');
check(completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED' && completion.persistentReceiptStatus === 'PASS', 'completion record is PASS');
check(transition.status === 'PASS' && transition.failed === 0 && transition.passed === transition.expected, 'completion transition is PASS');
check(execution.officialStepStatus === 'COMPLETED' && execution.officialCompletionClaimed === true, 'execution record is completed');
check(scope.officialStepStatus === 'COMPLETED' && scope.PPK002 === 'PARTIAL', 'scope report is completed with PPK-002 partial');
check(step31D?.status === 'COMPLETED' && step31D.persistentReceiptStatus === 'PASS' && (active.length === 0 || laterSuccessor.planValid), 'work plan preserves completed 31-D through an authorized active successor');
check((['31-D_COMPLETED_RECEIPT_PASS', '31-E_COMPLETED_RECEIPT_PASS', '31-F_COMPLETED_RECEIPT_PASS'].includes(ledger.libraryUploadStatus) && ledger.activeMicroStep === null) || laterSuccessor.ledgerValid, 'ledger records completed receipt chain');
check(laterSuccessor.nextTaskValid || ledger.nextOfficialTask === (successor31FCompleted ? 'AUTO_PRIORITY_SELECTION_AFTER_31-F_PERSISTENT_RECEIPT' : successor31ECompleted ? 'AUTO_PRIORITY_SELECTION_AFTER_31-E_PERSISTENT_RECEIPT' : 'AUTO_PRIORITY_SELECTION_AFTER_31-D_PERSISTENT_RECEIPT'), 'ledger requires next priority selection');

if (verifyExternal) {
  const list = async (directory) => {
    const files = [];
    const visit = async (current) => {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile()) files.push(relative(directory, path).split(sep).join('/'));
      }
    };
    await visit(directory);
    return files.sort();
  };
  try {
    const names = await list(libraryRoot);
    check(names.length === inventory.finalExpectedFilesIncludingInventoryPair, 'D: final recursive file count is exact', `found=${names.length}`);
    for (const artifact of readback.artifacts) {
      const bytes = await readFile(resolve(libraryRoot, artifact.path));
      check(bytes.length === artifact.sourceSizeBytes && sha256(bytes) === artifact.sourceSha256, `D: base artifact exact: ${artifact.path}`);
    }
    for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
      const localBytes = await readFile(resolve(root, paths[key]));
      const externalBytes = await readFile(resolve(libraryRoot, paths[key]));
      check(localBytes.length === externalBytes.length && sha256(localBytes) === sha256(externalBytes), `D: supplemental artifact exact: ${basename(paths[key])}`);
    }
  } catch (error) {
    check(false, 'D: 31-D Library is readable', String(error));
  }
}
const failures = checks.filter((item) => item.status === 'FAIL');
if (failures.length) {
  console.error(`31-D completion transition: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}${item.detail ? `: ${item.detail}` : ''}`);
  process.exit(1);
}
console.log(`31-D completion transition: PASS (${checks.length}/${checks.length}${verifyExternal ? '; D: external readback included' : '; durable local evidence'}).`);
console.log('31-D: COMPLETED; persistent receipt: PASS; PPK-002: PARTIAL; new Build: false.');
