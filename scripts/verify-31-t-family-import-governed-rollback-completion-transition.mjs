import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const external = process.argv.includes('--external');
const paths = {
  receipt: 'artifacts/checkpoints/31-T_LIBRARY_RECEIPT.json', readback: 'artifacts/validation/31-T_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-T_RECEIPT_READBACK_VERIFICATION.json', persistence: 'artifacts/validation/31-T_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-T_LIBRARY_FINAL_INVENTORY_VERIFICATION.json', completion: 'artifacts/checkpoints/31-T_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-T_COMPLETION_TRANSITION_VALIDATION.json', execution: 'artifacts/checkpoints/31-T_EXECUTION_RECORD.json',
  scopeReport: 'artifacts/inventory/31-T_SCOPE_AND_STATUS_REPORT.json', scope: 'config/31-t-family-import-governed-rollback-receipt-fence-scope.json',
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
const checks = []; const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
  const bytes = await readFile(resolve(root, paths[key])); const declared = (await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8')).trim().split(/\s+/u)[0];
  check(sha256(bytes) === declared, `${key} sidecar binds exact bytes`);
}
const step = docs.plan.steps.find((item) => item.id === '31-T'); const requirement = docs.registry.requirements.find((item) => item.id === 'PPK-002');
check(docs.receipt.status === 'PASS' && docs.receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE' && docs.receipt.libraryPath === docs.completion.libraryPath, 'D: receipt path and backend PASS');
check(docs.receipt.basePackage.status === 'PASS' && docs.receipt.basePackage.expected === docs.receipt.basePackage.matched && docs.receipt.basePackage.failed === 0, 'base package receipt PASS');
for (const key of ['readback', 'receiptReadback', 'persistence']) check(docs[key].status === 'PASS' && docs[key].failed === 0, `${key} PASS`);
check(docs.inventory.status === 'PASS' && docs.inventory.finalExpectedFilesIncludingInventoryPair > 0, 'inventory PASS');
check(docs.completion.status === 'PASS' && docs.completion.officialStepStatus === 'COMPLETED' && docs.completion.persistentReceiptStatus === 'PASS', 'completion PASS');
check(docs.transition.status === 'PASS' && docs.transition.failed === 0, 'transition PASS');
check(docs.execution.status === 'PASS' && docs.execution.officialStepStatus === 'COMPLETED' && docs.execution.persistentReceiptStatus === 'PASS', 'execution complete');
check(docs.scopeReport.status === 'PASS' && docs.scopeReport.officialStepStatus === 'COMPLETED' && docs.scopeReport.persistentReceiptStatus === 'PASS', 'scope report complete');
check(docs.scope.status === 'COMPLETED' && docs.scope.targetSliceStatus === 'PASS' && docs.scope.persistentReceiptStatus === 'PASS', 'scope config complete');
check(step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS', 'work plan complete');
check(docs.ledger.libraryUploadStatus === '31-T_COMPLETED_RECEIPT_PASS' && docs.ledger.activeMicroStep === null && docs.ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-T_PERSISTENT_RECEIPT', 'ledger complete');
check(requirement?.status === 'PARTIAL' && docs.receipt.PPK002 === 'PARTIAL' && docs.completion.PPK002 === 'PARTIAL', 'PPK-002 remains PARTIAL');
check(docs.scope.targets.migration === 68 && docs.scope.targets.policyIntents === 'ONE_FRESH_EXACT_DELETE_RECEIPT_PER_GOVERNED_ROW', 'migration and exact receipt boundary');
check(docs.scope.targets.transactionBoundary.endsWith('ONE_SQLITE_TRANSACTION') && docs.scope.targets.consumption === 'IMMUTABLE_SINGLE_USE_ROLLBACK_DELETION_TOMBSTONE', 'atomic single-use tombstone boundary');
check(docs.scope.openBoundaries.universalRepositoryEnforcement === 'NOT_COMPLETE', 'universal repository enforcement remains open');
check(docs.scope.openBoundaries.obligationExecution === 'NOT_RUN_NOT_PASS', 'obligation execution remains NOT_RUN');
check(docs.scope.openBoundaries.externalMonotonicRollbackAuthority === 'NOT_IMPLEMENTED', 'external authority remains open');
check([docs.receipt, docs.completion, docs.transition, docs.execution, docs.scopeReport, docs.scope].every((item) => item.requirementCompletionClaimed === false), 'no false requirement completion claim');
check([docs.receipt, docs.completion, docs.transition, docs.execution, docs.scopeReport, docs.scope].every((item) => item.newBuildIssued === false), 'no new Build');
if (external) {
  const files = []; const visit = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(join(directory, entry.name), path); else if (entry.isFile()) files.push(path);
    }
  };
  try {
    await visit(docs.receipt.libraryPath); check(files.length === docs.inventory.finalExpectedFilesIncludingInventoryPair, 'D: exact external file count');
    const bound = await Promise.all(docs.inventory.filesBeforeInventory.map(async (item) => { const bytes = await readFile(resolve(docs.receipt.libraryPath, item.path)); return bytes.length === item.sizeBytes && sha256(bytes) === item.sha256; }));
    check(bound.every(Boolean), 'D: inventory SHA-256 and size readback');
  } catch { check(false, 'D: Library readable'); }
}
const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length) { console.error(`31-T completion transition: FAIL (${failed.length}/${checks.length}).`); failed.forEach((item) => console.error(`- ${item.name}`)); process.exit(1); }
console.log(`31-T completion transition: PASS (${checks.length}/${checks.length}${external ? '; D: external hash/size readback included' : ''}).`);
