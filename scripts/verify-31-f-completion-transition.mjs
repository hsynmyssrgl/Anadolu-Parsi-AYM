import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const external = process.argv.includes('--external');
const paths = {
  receipt: 'artifacts/checkpoints/31-F_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/31-F_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-F_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/31-F_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-F_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/31-F_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-F_COMPLETION_TRANSITION_VALIDATION.json',
  execution: 'artifacts/checkpoints/31-F_EXECUTION_RECORD.json',
  scopeReport: 'artifacts/inventory/31-F_SCOPE_AND_STATUS_REPORT.json',
  scope: 'config/31-f-family-import-created-location-linked-event-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
const checks = [];
const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });

for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
  const bytes = await readFile(resolve(root, paths[key]));
  const declared = (await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8')).trim().split(/\s+/u)[0];
  check(sha256(bytes) === declared, `${key} sidecar binds exact bytes`);
}
const step = docs.plan.steps.find((item) => item.id === '31-F');
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan: docs.plan, ledger: docs.ledger, predecessorId: '31-F' });
check(docs.receipt.status === 'PASS' && docs.receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE' && docs.receipt.libraryPath === docs.completion.libraryPath, 'D: receipt path and backend PASS');
check(docs.receipt.basePackage.status === 'PASS' && docs.receipt.basePackage.expected === docs.receipt.basePackage.matched && docs.receipt.basePackage.failed === 0, 'base package receipt PASS');
check(docs.readback.status === 'PASS' && docs.readback.failed === 0, 'base package readback PASS');
check(docs.receiptReadback.status === 'PASS' && docs.receiptReadback.failed === 0, 'receipt readback PASS');
check(docs.persistence.status === 'PASS' && docs.persistence.failed === 0, 'receipt persistence PASS');
check(docs.inventory.status === 'PASS' && docs.inventory.finalExpectedFilesIncludingInventoryPair > 0, 'inventory PASS');
check(docs.completion.status === 'PASS' && docs.completion.officialStepStatus === 'COMPLETED' && docs.completion.persistentReceiptStatus === 'PASS', 'completion PASS');
check(docs.transition.status === 'PASS' && docs.transition.failed === 0, 'transition PASS');
check(docs.execution.status === 'PASS' && docs.execution.officialStepStatus === 'COMPLETED' && docs.execution.persistentReceiptStatus === 'PASS', 'execution complete');
check(docs.scopeReport.status === 'PASS' && docs.scopeReport.officialStepStatus === 'COMPLETED' && docs.scopeReport.persistentReceiptStatus === 'PASS', 'scope report complete');
check(docs.scope.status === 'COMPLETED' && docs.scope.targetSliceStatus === 'PASS' && docs.scope.persistentReceiptStatus === 'PASS', 'scope config complete');
check(step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS', 'work plan complete');
check((docs.ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS' && docs.ledger.activeMicroStep === null) || laterSuccessor.ledgerValid, 'ledger complete');
check([docs.receipt, docs.completion, docs.transition, docs.execution, docs.scopeReport].every((item) => item.PPK002 === 'PARTIAL'), 'PPK-002 remains PARTIAL');
check(docs.receipt.requirementCompletionClaimed === false && docs.completion.requirementCompletionClaimed === false, 'no false requirement completion claim');
check([docs.receipt, docs.completion, docs.transition, docs.execution, docs.scopeReport, docs.scope].every((item) => item.newBuildIssued === false), 'no new Build');

if (external) {
  let count = 0;
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(join(directory, entry.name));
      else if (entry.isFile()) count += 1;
    }
  };
  try {
    await visit(docs.receipt.libraryPath);
    check(count === docs.inventory.finalExpectedFilesIncludingInventoryPair, 'D: exact external file count');
  } catch {
    check(false, 'D: Library readable');
  }
}

const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length) {
  console.error(`31-F completion transition: FAIL (${failed.length}/${checks.length}).`);
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-F completion transition: PASS (${checks.length}/${checks.length}${external ? '; D: external readback included' : ''}).`);
