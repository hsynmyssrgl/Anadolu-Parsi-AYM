import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const REPORT_PATH = 'artifacts/validation/30-S-archive-accessory-receipt-fence-contract.json';
const paths = {
  authority: 'artifacts/authority/30-S_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-S_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-s-archive-accessory-receipt-fence-scope.json',
  decision: 'docs/decisions/DEC-144-ppk-002-archive-accessory-and-event-attachment-receipt-fence.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  migration: 'packages/database/src/family-database-migrations.ts',
  repository: 'packages/repositories/src/archive-repository.ts',
  focusedTest: 'apps/desktop/tests/archive-accessory-receipt-fence.test.ts',
  coreRegression: 'apps/desktop/tests/archive-core-table-receipt-fence.test.ts',
  productionRegression: 'apps/desktop/tests/archive-production-policy-runtime.test.ts',
  packageJson: 'package.json',
  predecessorCompletion: 'artifacts/checkpoints/30-R_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-R_LIBRARY_RECEIPT.json',
  predecessorTransition: 'artifacts/validation/30-R_COMPLETION_TRANSITION_VALIDATION.json',
  stalePreflightFailure: 'artifacts/validation/30-S_FOCUSED_VITEST_FIRST_ATTEMPT_STALE_PREFLIGHT_FAILURE.json',
  expectationFailure: 'artifacts/validation/30-S_THREE_TEST_REGRESSION_FIRST_ATTEMPT_EXPECTATION_FAILURE.json',
  receiptTimeFailure: 'artifacts/validation/30-S_FULL_VITEST_FIRST_ATTEMPT_RECEIPT_TIME_BINDING_FAILURE.json'
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
const scope = json('scope');
const plan = json('plan');
const ledger = json('ledger');
const packageJson = json('packageJson');
const completion = json('predecessorCompletion');
const receipt = json('predecessorReceipt');
const transition = json('predecessorTransition');

check(authority.step === '30-S' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-S/PPK-002');
check(authority.authority === 'DEC-137_FULL_AUTO_PRIORITY_SELECTION', 'priority authority derives from DEC-137');
check(authority.predecessor?.step === '30-R' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'priority authority binds the completed persistent predecessor');
check(new Set(authority.targetedTables ?? []).size === 5, 'priority authority fixes five unique accessory targets');
check(authority.mandatoryTruthSentence === TRUTH, 'priority authority preserves the truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === 12 && selection.semanticExpected === 12, 'priority selection is 12/12 semantic PASS');
check(selection.processPassed === 5 && selection.processExpected === 5 && selection.processNotRun === 0, 'priority selection is 5/5 process PASS');

check(scope.step === '30-S' && scope.scope === 'DATABASE_ENFORCED_RECEIPT_BINDING_FOR_ARCHIVE_ACCESSORY_AND_EVENT_ATTACHMENT_WRITES', 'scope has the canonical 30-S identity');
check(scope.targets?.length === 5 && new Set(scope.targets.map((item) => item.id)).size === 5, 'scope declares five unique targets');
check(scope.requiredOrder?.join('|') === 'migration-and-trigger-contract|repository-binding-write-path|real-sqlite-direct-bypass-tests|production-archive-regression|security-review', 'scope fixes the five-stage security order');
check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'scope keeps PPK-002 PARTIAL');
check(scope.evidenceBoundary?.archiveCoreTableDirectSqlFence === 'TARGETED_PASS', 'scope preserves the 30-R core-table PASS');
check(scope.evidenceBoundary?.archiveAccessoryTableReceiptFence === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the 30-S target');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal enforcement open');
check(scope.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED', 'scope keeps external rollback authority open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim requirement completion');
contains('decision', '# DEC-144', 'DEC-144 heading exists');
contains('decision', '`archive_retention_policies`', 'DEC-144 names retention policy fencing');
contains('decision', '`archive_item_tags`', 'DEC-144 names item-tag fencing');
contains('decision', '`events.attachment_count`', 'DEC-144 names the cross-aggregate event counter');
contains('decision', TRUTH, 'DEC-144 preserves the truth sentence');

check(plan.currentStep === '30-S', 'work plan selects 30-S');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 1, 'work plan contains exactly one active step');
check(plan.steps.find((item) => item.id === '30-S')?.persistentReceiptStatus === 'PENDING', 'work plan keeps 30-S receipt PENDING');
check(ledger.nextOfficialTask === '30-S PPK-002 database-enforced receipt binding for archive accessory tables and cross-aggregate event attachment updates', 'active ledger selects the exact 30-S task');
check(ledger.libraryUploadStatus === '30-S_IN_PROGRESS_PREDECESSOR_30-R_RECEIPT_CHAIN_PASS', 'active ledger distinguishes predecessor receipt from current work');

contains('migration', "createMigrationDefinition(59, 'archive_accessory_receipt_fence'", 'migration 59 is registered');
for (const table of ['archive_retention_policies', 'archive_categories', 'archive_tags', 'archive_item_tags', 'events']) {
  contains('migration', `ALTER TABLE ${table}\nADD COLUMN policy_receipt_hash`, `${table} stores the receipt hash`);
}
for (const field of ['policy_receipt_version', 'policy_receipt_nonce', 'policy_correlation_id', 'policy_resource_type', 'policy_resource_id', 'policy_action', 'policy_capability']) {
  contains('migration', `ADD COLUMN ${field}`, `migration adds ${field}`);
}
contains('migration', 'CREATE TABLE platform_policy_archive_accessory_mutations', 'migration creates the accessory consumption ledger');
contains('migration', 'PRIMARY KEY(receipt_hash,table_name,operation,row_id,related_row_id)', 'ledger rejects exact accessory replay');
contains('migration', 'UNIQUE(receipt_nonce,table_name,operation,row_id,related_row_id)', 'ledger rejects nonce-level accessory replay');
contains('migration', 'CREATE TABLE platform_policy_archive_classification_batches', 'migration creates one-shot classification batches');
contains('migration', "status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','sealed'))", 'classification batch has an explicit seal state');
contains('migration', 'trg_platform_policy_archive_accessory_mutation_update', 'ledger updates are blocked');
contains('migration', 'trg_platform_policy_archive_accessory_mutation_delete', 'ledger deletion is blocked');
contains('migration', 'trg_archive_retention_policies_policy_insert', 'retention inserts are fenced');
contains('migration', 'trg_archive_categories_policy_insert', 'category inserts are fenced');
contains('migration', 'trg_archive_tags_policy_insert', 'tag inserts are fenced');
contains('migration', 'trg_archive_item_tags_policy_insert', 'item-tag inserts are fenced');
contains('migration', 'trg_archive_item_tags_policy_delete', 'item-tag deletes are fenced');
contains('migration', 'trg_events_attachment_initial_count', 'event creation cannot forge an initial attachment count');
contains('migration', 'trg_events_attachment_policy_update', 'event attachment increments are fenced');
contains('migration', 'NEW.attachment_count IS NOT OLD.attachment_count+1', 'event attachment mutation is exactly one increment');
contains('migration', 'item.linked_event_id=NEW.id', 'event increment is bound to the linked archive item');
contains('migration', 'REVISION-30-S-PPK-002-ARCHIVE-ACCESSORY-RECEIPT-FENCE', 'schema generation records 30-S');
inOrder('migration', [
  "'archive_classification_batches','open'",
  'UPDATE archive_item_tags',
  'DELETE FROM archive_item_tags',
  'INSERT INTO archive_tags',
  'INSERT INTO archive_item_tags',
  "SET status='sealed'"
], 'classification batch atomically opens, replaces, writes and seals');

contains('repository', 'const exactPolicyBinding=', 'archive repository centralizes all exact resource bindings');
contains('repository', "exactPolicyBinding(context,'archive_retention_policy',row.id,'create')", 'retention repository derives an exact receipt');
contains('repository', "exactPolicyBinding(context,'archive_category',row.id,'create')", 'category repository derives an exact receipt');
contains('repository', 'platform_policy_archive_classification_batches', 'classification repository invokes the one-shot database batch');
contains('repository', 'receipt.recorded_at', 'classification uses the authoritative persisted receipt timestamp');
contains('repository', "archivePolicyBinding(context,context.policyAuthorization.resourceId,'create')", 'event attachment repository binds the parent archive create receipt');
check((source.repository.match(/policy_receipt_hash/g) ?? []).length >= 8, 'repository persists receipt hashes across core and accessory paths');

check((source.focusedTest.match(/\bit\(/gu) ?? []).length === 1, 'focused runtime declares one integrated 30-S test');
contains('focusedTest', '30-S archive accessory-table and event attachment receipt fence', 'focused runtime names the 30-S fence');
for (const marker of [
  'Direct retention', 'Direct category', 'Direct tag', 'event-30s-nonzero',
  'event-30s-cross-target', 'ledger is immutable', 'batch is durable'
]) contains('focusedTest', marker, `focused runtime covers ${marker}`);
contains('focusedTest', 'toHaveLength(13)', 'focused runtime checks the exact accessory ledger cardinality');
excludes('productionRegression', "INSERT INTO archive_tags(id,name,created_at)", 'production regression no longer bypasses tag creation');
excludes('productionRegression', "DELETE FROM archive_item_tags", 'production regression no longer bypasses item-tag deletion');
contains('productionRegression', 'resourceRaceArchiveRepository', 'production resource-race regression uses an explicit snapshot test double');
contains('coreRegression', "resourceType: 'archive_retention_policy'", '30-R regression now seeds retention through a governed receipt');

for (const key of ['stalePreflightFailure', 'expectationFailure', 'receiptTimeFailure']) {
  const failure = json(key);
  check(failure.status === 'FAIL' && failure.countedAsPass === false, `${key} remains preserved FAIL and NOT_PASS`);
}
check(completion.step === '30-R' && completion.status === 'PASS' && completion.officialStepStatus === 'COMPLETED', 'predecessor completion remains PASS/COMPLETED');
check(completion.persistentReceiptStatus === 'PASS' && receipt.status === 'PASS', 'predecessor persistent receipt remains PASS');
check(transition.status === 'PASS' && transition.semanticPassed === 40 && transition.processPassed === 5, 'predecessor completion transition remains PASS');
check(sha256(source.predecessorReceipt).length === 64 && sha256(source.predecessorTransition).length === 64, 'predecessor evidence has deterministic SHA-256 identities');
check(packageJson.scripts?.['verify:30-s:archive-accessory-receipt-fence-contract'] === 'node scripts/verify-30-s-archive-accessory-receipt-fence-contract.mjs', 'package exposes the 30-S contract gate');
check(packageJson.scripts?.['verify:30-s:archive-accessory-receipt-fence-runtime'] === 'node scripts/verify-30-s-archive-accessory-receipt-fence-runtime.mjs', 'package exposes the 30-S runtime gate');

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-S',
  requirement: 'PPK-002',
  phase: 'ARCHIVE_ACCESSORY_AND_EVENT_ATTACHMENT_RECEIPT_FENCE_CONTRACT',
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
  console.error(`30-S archive accessory receipt-fence contract: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`30-S archive accessory receipt-fence contract: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
