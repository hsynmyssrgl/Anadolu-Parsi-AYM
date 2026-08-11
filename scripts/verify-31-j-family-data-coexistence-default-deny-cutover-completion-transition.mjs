import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const external = process.argv.includes('--external');
const paths = {
  receipt: 'artifacts/checkpoints/31-J_LIBRARY_RECEIPT.json', readback: 'artifacts/validation/31-J_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/31-J_RECEIPT_READBACK_VERIFICATION.json', persistence: 'artifacts/validation/31-J_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/31-J_LIBRARY_FINAL_INVENTORY_VERIFICATION.json', completion: 'artifacts/checkpoints/31-J_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-J_COMPLETION_TRANSITION_VALIDATION.json', execution: 'artifacts/checkpoints/31-J_EXECUTION_RECORD.json',
  scopeReport: 'artifacts/inventory/31-J_SCOPE_AND_STATUS_REPORT.json', scope: 'config/31-j-family-data-coexistence-default-deny-cutover-gate-scope.json',
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
const checks = []; const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const later = inspectAuthorizedSuccessorLifecycle({ plan: docs.plan, ledger: docs.ledger, predecessorId: '31-J' });
for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory']) {
  const bytes = await readFile(resolve(root, paths[key]));
  const declared = (await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8')).trim().split(/\s+/u)[0];
  check(sha256(bytes) === declared, `${key} sidecar binds exact bytes`);
}
const step = docs.plan.steps.find((item) => item.id === '31-J');
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
check((docs.ledger.libraryUploadStatus === '31-J_COMPLETED_RECEIPT_PASS' && docs.ledger.activeMicroStep === null) || (later.planValid && later.ledgerValid && later.nextTaskValid), 'ledger complete or authorized successor active');
check(docs.receipt.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED' && docs.receipt.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED', 'real data and SQLite cutover remain blocked');
check([docs.receipt, docs.completion, docs.transition, docs.execution, docs.scopeReport, docs.scope].every((item) => item.requirementCompletionClaimed === false), 'no false requirement completion claim');
check([docs.receipt, docs.completion, docs.transition, docs.execution, docs.scopeReport, docs.scope].every((item) => item.newBuildIssued === false), 'no new Build');
if (external) {
  const files = []; const visit = async (directory, prefix = '') => { for (const entry of await readdir(directory, { withFileTypes: true })) { const path = prefix ? `${prefix}/${entry.name}` : entry.name; if (entry.isDirectory()) await visit(join(directory, entry.name), path); else if (entry.isFile()) files.push(path); } };
  try {
    await visit(docs.receipt.libraryPath); check(files.length === docs.inventory.finalExpectedFilesIncludingInventoryPair, 'D: exact external file count');
    const bound = await Promise.all(docs.inventory.filesBeforeInventory.map(async (item) => { const bytes = await readFile(resolve(docs.receipt.libraryPath, item.path)); return bytes.length === item.sizeBytes && sha256(bytes) === item.sha256; }));
    check(bound.every(Boolean), 'D: inventory SHA-256 and size readback');
  } catch { check(false, 'D: Library readable'); }
}
const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length) { console.error(`31-J completion transition: FAIL (${failed.length}/${checks.length}).`); for (const item of failed) console.error(`- ${item.name}`); process.exit(1); }
console.log(`31-J completion transition: PASS (${checks.length}/${checks.length}${external ? '; D: external hash/size readback included' : ''}).`);
