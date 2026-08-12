import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const external = process.argv.includes('--external');
const allowPlanPending = process.argv.includes('--allow-plan-pending');
const canonicalLibraryRoot = 'D:\\AYM_LIBRARY\\Panthera pardus tulliana\\Anadolu Parsı Aile Yaşam Merkezi\\Bronze 04.08.2026.29\\checkpoints\\33-D_B4_Controlled_Import_Open_Banking';
const paths = Object.freeze({
  receipt: 'artifacts/checkpoints/33-D_LIBRARY_RECEIPT.json',
  readback: 'artifacts/validation/33-D_LIBRARY_READBACK_VERIFICATION.json',
  receiptReadback: 'artifacts/validation/33-D_RECEIPT_READBACK_VERIFICATION.json',
  persistence: 'artifacts/validation/33-D_RECEIPT_READBACK_PERSISTENCE_VERIFICATION.json',
  inventory: 'artifacts/validation/33-D_LIBRARY_FINAL_INVENTORY_VERIFICATION.json',
  closureInventory: 'artifacts/validation/33-D_LIBRARY_CLOSURE_INVENTORY_VERIFICATION.json',
  completion: 'artifacts/checkpoints/33-D_COMPLETION_RECORD.json',
  transition: 'artifacts/validation/33-D_COMPLETION_TRANSITION_VALIDATION.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  scope: 'config/33-d-b4-controlled-import-open-banking-scope.json'
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
const checks = [];
const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory', 'completion', 'transition', 'closureInventory']) {
  const bytes = await readFile(resolve(root, paths[key]));
  const sidecarText = await readFile(resolve(root, `${paths[key]}.sha256`), 'utf8');
  const sidecarMatch = sidecarText.match(/^([0-9a-f]{64})  ([^\r\n]+)\r?\n?$/u);
  check(sidecarMatch?.[1] === sha256(bytes) && sidecarMatch?.[2] === paths[key].split('/').at(-1), `${key} sidecar binds exact local bytes and basename`);
}
const step = docs.plan.steps.find((item) => item.id === '33-D');
const successor = docs.plan.steps.find((item) => item.id === '33-E');
const laterLifecycle = inspectAuthorizedSuccessorLifecycle({ plan: docs.plan, ledger: docs.ledger, predecessorId: '33-D' });
check(docs.receipt.status === 'PASS' && docs.receipt.persistentReceiptStatus === 'PASS', 'receipt is PASS');
check(
  docs.receipt.storageBackend === 'EXTERNAL_USB_D_DRIVE'
    && docs.receipt.libraryPath === canonicalLibraryRoot
    && docs.completion.libraryPath === canonicalLibraryRoot,
  'receipt and completion bind the canonical 33-D D: path'
);
check(docs.readback.status === 'PASS' && docs.readback.failed === 0 && docs.readback.expected === docs.readback.matched, 'base readback is exact PASS');
check(docs.receiptReadback.status === 'PASS' && docs.receiptReadback.failed === 0, 'receipt readback is PASS');
check(docs.persistence.status === 'PASS' && docs.persistence.failed === 0, 'receipt persistence is PASS');
check(docs.inventory.status === 'PASS' && docs.inventory.finalExpectedFilesIncludingInventoryPair > 0, 'final inventory is PASS');
check(docs.closureInventory.status === 'PASS' && docs.closureInventory.finalExpectedFilesIncludingInventoryPair > docs.inventory.finalExpectedFilesIncludingInventoryPair, 'closure inventory is PASS');
check(docs.completion.status === 'PASS' && docs.completion.officialStepStatus === 'COMPLETED', 'completion record is PASS');
check(docs.transition.status === 'PASS' && docs.transition.failed === 0, 'completion transition is PASS');
check(
  (step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS')
    || (allowPlanPending && docs.plan.currentStep === '33-D' && step?.status === 'IN_PROGRESS' && step.validationStatus === 'PENDING' && step.persistentReceiptStatus === 'PENDING'),
  'work plan preserves 33-D completion or the exact ledger-sealed recovery state'
);
check(successor?.status === 'PENDING' || successor?.status === 'IN_PROGRESS' || successor?.status === 'COMPLETED', '33-E successor is governed');
check(
  (docs.plan.currentStep === '33-D' && docs.ledger.libraryUploadStatus === '33-D_COMPLETED_RECEIPT_PASS' && docs.ledger.activeMicroStep === null)
    || (laterLifecycle.planValid && laterLifecycle.ledgerValid && laterLifecycle.nextTaskValid),
  'ledger preserves 33-D completion through the governed successor lifecycle'
);
check(
  docs.ledger.externalLibraryAuthority33D?.status === 'PASS'
    && docs.ledger.externalLibraryAuthority33D?.storageBackend === 'EXTERNAL_USB_D_DRIVE'
    && docs.ledger.externalLibraryAuthority33D?.path === canonicalLibraryRoot
    && docs.ledger.externalLibraryAuthority33D?.receipt === paths.receipt,
  'ledger retains exact 33-D external library authority'
);
check(docs.scope.openBanking.liveBankConnection === 'not_implemented' && docs.scope.openBanking.networkAccess === 'not_performed', 'no-live banking truth is preserved');
check(docs.receipt.liveBankConnectionImplemented === false && docs.receipt.networkAccessPerformed === false && docs.receipt.credentialsCollected === false, 'receipt makes no live or credential claim');
check(docs.receipt.sourceCommit === docs.completion.sourceCommit && /^[0-9a-f]{40}$/u.test(docs.receipt.sourceCommit), 'source commit binding is exact');
check(docs.receipt.officialCompletionClaimed === true && docs.receipt.requirementCompletionClaimed === true, 'receipt truthfully claims completed requirements');
check(docs.completion.officialCompletionClaimed === true && docs.completion.requirementCompletionClaimed === true, 'completion truthfully claims completed requirements');
check([docs.receipt, docs.completion, docs.transition].every((item) => item.newBuildIssued === false), 'no new build is claimed');
check(
  [docs.receipt, docs.completion, docs.transition].every((item) => item.currentAuthoritativeSourceExternalProtectionStatus === 'SEPARATE_GOV_005_REFRESH_REQUIRED_AFTER_SOURCE_CHANGE'),
  'separate source protection refresh remains explicit'
);
check(
  [docs.receipt, docs.readback, docs.receiptReadback, docs.persistence, docs.inventory, docs.completion, docs.transition, docs.closureInventory]
    .every((item) => item.sourceCommit === docs.receipt.sourceCommit),
  'all 33-D proof documents bind one source commit'
);

if (external) {
  const files = [];
  const visit = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link forbidden: ${path}`);
      if (entry.isDirectory()) await visit(join(directory, entry.name), path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Special filesystem entry forbidden: ${path}`);
    }
  };
  try {
    await visit(docs.receipt.libraryPath);
    const expectedNames = [...docs.closureInventory.filesBeforeInventory.map((item) => item.path), paths.closureInventory, `${paths.closureInventory}.sha256`].sort();
    check(JSON.stringify(files.sort()) === JSON.stringify(expectedNames), 'D: exact recursive file set');
    const bound = await Promise.all(docs.closureInventory.filesBeforeInventory.map(async (item) => {
      const bytes = await readFile(resolve(docs.receipt.libraryPath, item.path));
      return bytes.length === item.sizeBytes && sha256(bytes) === item.sha256;
    }));
    check(bound.every(Boolean), 'D: inventory SHA-256 and size readback');
    for (const key of ['receipt', 'readback', 'receiptReadback', 'persistence', 'inventory', 'completion', 'transition', 'closureInventory']) {
      for (const path of [paths[key], `${paths[key]}.sha256`]) {
        const [local, remote] = await Promise.all([
          readFile(resolve(root, path)), readFile(resolve(docs.receipt.libraryPath, path))
        ]);
        check(local.length === remote.length && sha256(local) === sha256(remote), `D: ${key} pair exact bytes: ${path}`);
      }
    }
  } catch (error) {
    check(false, `D: 33-D checkpoint is readable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const failures = checks.filter((item) => item.status === 'FAIL');
if (failures.length > 0) {
  console.error(`33-D completion verification: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`33-D completion verification: PASS (${checks.length}/${checks.length}${external ? '; D: external readback included' : ''}).`);
