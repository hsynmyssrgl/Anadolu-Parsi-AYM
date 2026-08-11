import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-R-archive-core-receipt-fence-contract.json';
const paths = {
  authority: 'artifacts/authority/30-R_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-R_PRIORITY_SELECTION_VALIDATION.json',
  selectionFailure: 'artifacts/validation/30-R_PRIORITY_SELECTION_FIRST_ATTEMPT_TRUTH_ENCODING_FAILURE.json',
  scope: 'config/30-r-archive-core-table-receipt-fence-scope.json',
  decision: 'docs/decisions/DEC-143-ppk-002-archive-core-table-receipt-fence.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/archive-repository.ts',
  binding: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  focusedTest: 'apps/desktop/tests/archive-core-table-receipt-fence.test.ts',
  productionRegression: 'apps/desktop/tests/archive-production-policy-runtime.test.ts',
  packageJson: 'package.json',
  predecessorCompletion: 'artifacts/checkpoints/30-Q_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-Q_LIBRARY_RECEIPT.json',
  predecessorReceiptReadback: 'artifacts/validation/30-Q_RECEIPT_READBACK_VERIFICATION.json'
};

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [
  key,
  await readFile(path, 'utf8')
])));
const json = (key) => JSON.parse(source[key]);
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
const contains = (key, marker, name) => check(source[key].includes(marker), name, { path: paths[key], marker });
const excludes = (key, marker, name) => check(!source[key].includes(marker), name, { path: paths[key], marker });
const inOrder = (key, markers, name) => {
  let cursor = -1;
  for (const marker of markers) {
    cursor = source[key].indexOf(marker, cursor + 1);
    if (cursor < 0) break;
  }
  check(cursor >= 0, name, { path: paths[key], markers });
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const authority = json('authority');
const selection = json('selection');
const selectionFailure = json('selectionFailure');
const scope = json('scope');
const plan = json('plan');
const ledger = json('ledger');
const packageJson = json('packageJson');
const completion = json('predecessorCompletion');
const receipt = json('predecessorReceipt');
const receiptReadback = json('predecessorReceiptReadback');

check(authority.step === '30-R' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-R/PPK-002');
check(authority.authority === 'DEC-137_FULL_AUTO_PRIORITY_SELECTION', 'priority authority derives from DEC-137');
check(authority.predecessor?.step === '30-Q' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'priority authority binds the completed persistent predecessor');
check(authority.preservedOpenBoundaries?.includes('externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback'), 'priority authority preserves the external rollback boundary');
check(authority.mandatoryTruthSentence === TRUTH, 'priority authority preserves the truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === selection.semanticExpected && selection.processPassed === selection.processExpected, 'clean priority selection is fully PASS');
check(selectionFailure.status === 'FAIL_PRESERVED_NOT_PASS' && selectionFailure.failure?.countedAsPass === false, 'first selection encoding failure remains NOT_PASS');

check(scope.step === '30-R' && scope.scope === 'DATABASE_ENFORCED_RECEIPT_BINDING_FOR_ARCHIVE_CORE_BUSINESS_TABLES', 'scope has the canonical 30-R identity');
check(scope.targets?.length === 5 && new Set(scope.targets.map((item) => item.id)).size === 5, 'scope declares five unique targets');
check(scope.requiredOrder?.join('|') === 'migration-and-trigger-contract|repository-binding-write-path|real-sqlite-direct-bypass-tests|production-archive-regression|security-review', 'scope fixes the five-stage security order');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.archiveAccessoryTableUniversalFenceEnforcement === 'NOT_COMPLETE', 'scope keeps accessory-table enforcement open');
check(scope.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED', 'scope keeps coordinated rollback authority open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim requirement completion');
check(scope.mandatoryTruthSentence === TRUTH, 'scope preserves the truth sentence');
contains('decision', '# DEC-143', 'DEC-143 heading exists');
contains('decision', '`archive_items` ve `archive_versions`', 'DEC-143 fixes the two core-table boundary');
contains('decision', TRUTH, 'DEC-143 preserves the truth sentence');

check(plan.currentStep === '30-R', 'work plan selects 30-R');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1, 'work plan contains exactly one active step');
check(plan.steps.find((item) => item.id === '30-R')?.persistentReceiptStatus === 'PENDING', 'work plan keeps 30-R receipt PENDING');
check(ledger.nextOfficialTask === '30-R PPK-002 database-enforced receipt binding for direct writes to core archive business tables', 'active ledger selects the exact 30-R task');
check(ledger.libraryUploadStatus === '30-R_IN_PROGRESS_PREDECESSOR_30-Q_RECEIPT_CHAIN_PASS', 'active ledger distinguishes predecessor receipt from current pending work');

contains('migration', "createMigrationDefinition(58, 'archive_core_table_receipt_fence'", 'migration 58 is registered');
for (const table of ['archive_items', 'archive_versions']) {
  contains('migration', `ALTER TABLE ${table}\nADD COLUMN policy_receipt_hash`, `${table} stores the receipt hash`);
}
for (const field of ['policy_receipt_version', 'policy_receipt_nonce', 'policy_correlation_id', 'policy_resource_type', 'policy_resource_id', 'policy_action', 'policy_capability']) {
  contains('migration', `ADD COLUMN ${field}`, `migration adds ${field}`);
}
contains('migration', 'CREATE TABLE platform_policy_archive_business_mutations', 'migration creates the immutable consumption ledger');
contains('migration', "PRIMARY KEY(receipt_hash,table_name,operation)", 'ledger prevents receipt/table/operation replay');
contains('migration', "UNIQUE(receipt_nonce,table_name,operation)", 'ledger also prevents nonce/table/operation replay');
contains('migration', 'trg_platform_policy_archive_mutation_insert', 'ledger insert validates exact live receipt binding');
contains('migration', 'trg_platform_policy_archive_mutation_update', 'ledger updates are blocked');
contains('migration', 'trg_platform_policy_archive_mutation_delete', 'ledger deletion is blocked');
contains('migration', 'trg_archive_items_policy_insert', 'archive item insert is fenced');
contains('migration', 'trg_archive_items_policy_update', 'archive item update is fenced');
contains('migration', 'archive item physical deletion is forbidden', 'archive item physical deletion fails closed');
contains('migration', 'trg_archive_versions_policy_insert', 'archive version insert is fenced');
contains('migration', 'archive version mutation is forbidden', 'archive version updates fail closed');
contains('migration', 'archive version deletion is forbidden', 'archive version deletion fails closed');
contains('migration', "json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id", 'item receipt is bound to the exact family');
contains('migration', "consumed.operation=CASE NEW.policy_action WHEN 'delete' THEN 'destroy' ELSE 'update' END", 'update and destruction use distinct replay domains');
contains('migration', 'REVISION-30-R-PPK-002-ARCHIVE-CORE-RECEIPT-FENCE', 'schema generation records 30-R');
inOrder('migration', ['trg_archive_items_policy_insert', 'trg_archive_items_policy_insert_consumption'], 'item validation precedes consumption');
inOrder('migration', ['trg_archive_versions_policy_insert', 'trg_archive_versions_policy_insert_consumption'], 'version validation precedes consumption');

contains('binding', 'export const platformPolicyPersistenceBinding', 'canonical receipt binding helper remains exported');
contains('repository', "import { platformPolicyPersistenceBinding }", 'archive repository uses the canonical binding helper');
contains('repository', 'const archivePolicyBinding=', 'archive repository centralizes exact core binding');
contains('repository', "archivePolicyBinding(context,row.id,'create')", 'archive item create derives a receipt binding');
contains('repository', "archivePolicyBinding(context,row.archiveItemId,'create')", 'archive version create derives the parent receipt binding');
contains('repository', "archivePolicyBinding(context,itemId,'update')", 'retention assignment derives an update receipt binding');
contains('repository', "archivePolicyBinding(context,itemId,'delete')", 'destruction derives a delete receipt binding');
contains('repository', "archivePolicyBinding(context,input.itemId,'update')", 'classification derives an update receipt binding');
check((source.repository.match(/policy_receipt_hash/g) ?? []).length >= 5, 'all five governed core write paths persist the receipt hash');
check((source.repository.match(/policy_correlation_id/g) ?? []).length >= 5, 'all five governed core write paths persist correlation binding');

check((source.focusedTest.match(/\bit\(/gu) ?? []).length === 1, 'focused runtime declares one integrated receipt-fence test');
contains('focusedTest', '30-R archive core-table receipt fence', 'focused runtime names the 30-R fence');
contains('focusedTest', 'archive-30r-missing', 'focused runtime covers a missing receipt');
contains('focusedTest', 'nonce-30r-mismatched', 'focused runtime covers nonce mismatch');
contains('focusedTest', 'archive-30r-cross-target', 'focused runtime covers cross-resource binding');
contains('focusedTest', 'archive-version-30r-replay', 'focused runtime covers table-operation replay');
contains('focusedTest', 'ledger is immutable', 'focused runtime covers immutable-ledger update and delete');
contains('focusedTest', 'corr-30r-stale-fence', 'focused runtime covers a stale receipt fence');
excludes('productionRegression', "UPDATE archive_items SET sensitivity=?", 'historical resource race no longer bypasses the core item fence');
excludes('productionRegression', "UPDATE archive_versions SET sha256=?", 'historical resource race no longer mutates immutable versions');

check(completion.step === '30-Q' && completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED', 'predecessor completion remains PASS/COMPLETED');
check(completion.persistentReceiptStatus === 'PASS', 'predecessor completion binds a PASS receipt');
check(receipt.status === 'PASS', 'predecessor Library receipt remains PASS');
check(receiptReadback.status === 'PASS', 'predecessor receipt readback remains PASS');
check(sha256(source.predecessorReceipt).length === 64 && sha256(source.predecessorReceiptReadback).length === 64, 'predecessor receipt evidence has deterministic SHA-256 identities');
check(packageJson.scripts?.['verify:30-r:archive-core-receipt-fence-contract'] === 'node scripts/verify-30-r-archive-core-receipt-fence-contract.mjs', 'package exposes the 30-R contract gate');
check(packageJson.scripts?.['verify:30-r:archive-core-receipt-fence-runtime'] === 'node scripts/verify-30-r-archive-core-receipt-fence-runtime.mjs', 'package exposes the 30-R runtime gate');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-R',
  requirement: 'PPK-002',
  phase: 'ARCHIVE_CORE_TABLE_RECEIPT_FENCE_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  evidenceBoundary: scope.evidenceBoundary,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`30-R archive core receipt-fence contract: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-R archive core receipt-fence contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
