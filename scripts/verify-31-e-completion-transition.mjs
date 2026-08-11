import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const external = process.argv.includes('--external');
const libraryRoot = 'D:\\AYM_LIBRARY\\31-E_B0-02_User_Visible_Release_Boundary';
const paths = {
  receipt: 'artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json', readback: 'artifacts/validation/31-E_LIBRARY_READBACK_VERIFICATION.json',
  inventory: 'artifacts/validation/31-E_LIBRARY_FINAL_INVENTORY_VERIFICATION.json', completion: 'artifacts/checkpoints/31-E_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/31-E_COMPLETION_TRANSITION_VALIDATION.json', execution: 'artifacts/checkpoints/31-E_EXECUTION_RECORD.json',
  scope: 'config/31-e-user-visible-release-boundary-scope.json', plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json', registry: 'config/accepted-scope-registry.json'
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
const checks = []; const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
for (const key of ['receipt', 'readback', 'inventory']) {
  const bytes = await readFile(resolve(root, paths[key])); const declared = (await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8')).trim().split(/\s+/u)[0];
  check(sha256(bytes) === declared, `${key} sidecar binds exact bytes`);
}
const requirement = docs.registry.requirements.find((item) => item.id === 'B0-02');
const step = docs.plan.steps.find((item) => item.id === '31-E');
const step31F = docs.plan.steps.find((item) => item.id === '31-F');
const successor31FCompleted = docs.plan.currentStep === '31-F' && docs.plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0 && step31F?.status === 'COMPLETED' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan: docs.plan, ledger: docs.ledger, predecessorId: '31-F' });
check(docs.receipt.status === 'PASS' && docs.receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE' && docs.receipt.libraryPath === libraryRoot, 'D: receipt path and backend PASS');
check(docs.readback.status === 'PASS' && docs.readback.failed === 0, 'readback PASS');
check(docs.inventory.status === 'PASS', 'inventory PASS');
check(docs.completion.status === 'PASS' && docs.completion.officialStepStatus === 'COMPLETED', 'completion PASS');
check(docs.transition.status === 'PASS' && docs.transition.failed === 0, 'transition PASS');
check(docs.execution.officialStepStatus === 'COMPLETED' && docs.execution.B002 === 'COMPLETE', 'execution complete');
check(docs.scope.status === 'COMPLETED' && docs.scope.persistentReceiptStatus === 'PASS', 'scope complete');
check(step?.status === 'COMPLETED' && step.persistentReceiptStatus === 'PASS', 'plan complete');
check(((docs.ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS' || (successor31FCompleted && docs.ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS')) && docs.ledger.activeMicroStep === null) || laterSuccessor.ledgerValid, 'ledger complete');
check(requirement?.status === 'COMPLETE' && Object.values(requirement.chain).every(Boolean), 'B0-02 chain complete');
check(!/\b(?:RC2?|MVP|Build)\b/iu.test(docs.receipt.userVisibleDeliveryFileName), 'public filename clean');
check(docs.completion.newBuildIssued === false, 'no new Build');
if (external) {
  const files = []; const visit = async (dir) => { for (const entry of await readdir(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) await visit(path); else files.push(relative(libraryRoot, path).split(sep).join('/')); } };
  try { await visit(libraryRoot); check(files.length === docs.inventory.finalExpectedFilesIncludingInventoryPair, 'D: exact external file count'); }
  catch { check(false, 'D: Library readable'); }
}
const failed = checks.filter((item) => item.status === 'FAIL');
if (failed.length) { console.error(`31-E completion transition: FAIL (${failed.length}/${checks.length}).`); for (const item of failed) console.error(`- ${item.name}`); process.exit(1); }
console.log(`31-E completion transition: PASS (${checks.length}/${checks.length}${external ? '; D: external readback included' : ''}).`);
