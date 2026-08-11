import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const successorRegression = process.argv.includes('--successor-regression');
const paths = {
  migration: 'packages/database/src/family-database-migrations.ts',
  contracts: 'packages/repository-contracts/src/family-data-import-repository.ts',
  repository: 'packages/repositories/src/family-data-import-repository.ts',
  service: 'apps/desktop/src/main/family-data-import-service.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  locationIntent: 'packages/application/src/location-use-cases.ts',
  timelineIntent: 'packages/application/src/timeline-use-cases.ts',
  locationRuntime: 'apps/desktop/src/main/location-production-policy-runtime.ts',
  timelineRuntime: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  test: 'apps/desktop/tests/family-data-import-governed-rollback-runtime.test.ts',
  scope: 'config/31-t-family-import-governed-rollback-receipt-fence-scope.json',
  deferredScope: 'config/31-g-family-import-governed-rollback-receipt-fence-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-181-ppk-002-family-import-governed-rollback-receipt-fence.md',
  deferredDecision: 'docs/decisions/DEC-167-ppk-002-family-import-governed-rollback-receipt-fence.md',
  authority: 'artifacts/authority/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_AUTHORITY.json'
};
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const checks = [];
const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const has = (key, markers) => markers.forEach((marker) => check(docs[key].includes(marker), `${key} contains ${marker}`));

has('migration', [
  "createMigrationDefinition(68, 'ppk002_family_import_governed_rollback_receipt_fence'",
  'ADD COLUMN create_policy_receipt_hash', 'CREATE TABLE family_data_import_rollback_deletions',
  'delete_receipt_hash TEXT NOT NULL UNIQUE',
  'BEFORE INSERT ON family_data_import_rollback_deletions', 'BEFORE UPDATE ON family_data_import_rollback_deletions',
  'BEFORE DELETE ON family_data_import_rollback_deletions', 'AFTER DELETE ON events', 'AFTER DELETE ON locations',
  'deletion.create_receipt_hash=item.create_policy_receipt_hash', 'deletion.consumed_at IS NOT NULL',
  'trg_family_import_rollback_completion_fence'
]);
has('contracts', [
  'FamilyDataImportRollbackPolicyTarget', "entityType: 'event' | 'location'", 'readonly governed: boolean',
  'listRollbackPolicyTargets(', 'policyContexts?: ReadonlyMap<string, PolicyAuthorizedRepositoryExecutionContext>'
]);
has('repository', [
  'listRollbackPolicyTargets(', 'family_data_import_rollback_deletions', 'assertPolicyAuthorizedRepositoryContext',
  "action: 'delete'", "capability: 'family.write'", 'policyContext.correlationId', 'policyContexts.get',
  'deleteCreatedEntities(', 'consumed_at IS NOT NULL', "type='table' AND name='family_data_import_rollback_deletions'"
]);
has('service', [
  "'rollback-location'", "'rollback-event'", 'public async rollback(', 'listRollbackPolicyTargets(',
  "action: 'delete' as const", "capability: 'family.write' as const", 'policyBatchRunner!.execute(',
  'deleteCreatedEntities(repository, batch.id, policyRepositories)', "action: 'family_data.import_rolled_back'"
]);
has('dataStore', ['rollbackFamilyDataImport(', 'Promise<FamilyDataImportBatchView>']);
has('locationIntent', ["'read' | 'create' | 'delete'"]);
has('timelineIntent', ["'read' | 'create' | 'update' | 'delete'"]);
has('locationRuntime', ["requestedIntent.action === 'delete'", "row.actions[0] === 'read' || row.actions[0] === 'delete'"]);
has('timelineRuntime', ["action === 'read' || action === 'update' || action === 'delete'", "requestedIntent.action === 'update'"]);
has('test', [
  'requires exact delete receipts, consumes immutable tombstones and rolls back atomically',
  'DELETE FROM events WHERE id=?', 'INSERT INTO family_data_import_rollback_deletions(',
  'await store.rollbackFamilyDataImport', 'toHaveLength(2)', 'consumed_at',
  'UPDATE family_data_import_rollback_deletions', 'DELETE FROM family_data_import_rollback_deletions',
  'rejects.toThrow'
]);

const scope = JSON.parse(docs.scope);
const deferredScope = JSON.parse(docs.deferredScope);
const plan = JSON.parse(docs.plan);
const ledger = JSON.parse(docs.ledger);
const registry = JSON.parse(docs.registry);
const authority = JSON.parse(docs.authority);
const requirement = registry.requirements.find((item) => item.id === 'PPK-002');
const step = plan.steps.find((item) => item.id === '31-T');
const active = plan.currentStep === '31-T' && step?.status === 'IN_PROGRESS' && ledger.activeMicroStep === '31-T';
const complete = step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS';
check(active || complete, '31-T lifecycle is active or completed');
check(scope.step === '31-T' && scope.decision === 'DEC-181' && scope.deferredBoundaryDecision === 'DEC-167', 'scope identity');
check(scope.targets.migration === 68, 'scope binds migration 68');
check(scope.targets.policyIntents === 'ONE_FRESH_EXACT_DELETE_RECEIPT_PER_GOVERNED_ROW', 'fresh exact receipt boundary');
check(scope.targets.transactionBoundary.endsWith('ONE_SQLITE_TRANSACTION'), 'single transaction boundary');
check(scope.targets.consumption === 'IMMUTABLE_SINGLE_USE_ROLLBACK_DELETION_TOMBSTONE', 'single-use immutable tombstone');
check(scope.targets.completionFence.includes('ALL_CREATED_ROWS_ABSENT'), 'completion fence requires rows absent');
check(scope.targets.legacyCompatibility.includes('NULL_RECEIPT'), 'legacy null-receipt rollback retained');
check(scope.openBoundaries.universalRepositoryEnforcement === 'NOT_COMPLETE', 'universal repository enforcement remains open');
check(scope.openBoundaries.obligationExecution === 'NOT_RUN_NOT_PASS', 'obligation execution remains NOT_RUN');
check(scope.openBoundaries.externalMonotonicRollbackAuthority === 'NOT_IMPLEMENTED', 'external authority remains open');
check(scope.requirementCompletionClaimed === false && scope.newBuildIssued === false, 'no requirement or Build completion claim');
check(deferredScope.status === 'SUPERSEDED_BY_DEC_168' && deferredScope.targetSliceStatus === 'IMPLEMENTATION_PENDING', 'historical DEC-167 state preserved');
check(docs.decision.includes('Status: ACTIVE') && docs.decision.includes('DEC-167'), 'DEC-181 decision active and linked');
check(docs.deferredDecision.includes('31-G'), 'DEC-167 decision document preserved');
check(authority.status === 'PASS' && authority.selectedBoundary === 'FAMILY_IMPORT_GOVERNED_ROLLBACK_EXACT_DELETE_RECEIPT_FENCE', 'authority selects exact boundary');
check(authority.authoritativeSourceAtStart.treeSha256 === 'e9a01ad6e102bc2358c2e83f3e1717af2b10cf90e7a964107e65baf749764a96', 'authority binds predecessor source seal');
check(requirement?.priority === 'P0' && (requirement.status === 'PARTIAL' || (requirement.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true))), 'PPK-002 remains P0 or has a fully closed successor chain');
check(!plan.steps.some((item) => item.id === '31-T' && item.status === 'COMPLETED' && scope.status !== 'COMPLETED'), 'plan and scope completion are consistent');

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: plan.release, step: '31-T', phase: 'FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE_CONTRACT',
  status: failed.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length,
  passed: checks.length - failed.length, failed: failed.length, checks, failures: failed.map((item) => item.name),
  PPK002: 'PARTIAL', requirementCompletionClaimed: false, newBuildIssued: false, generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: 'Bu PASS yalnız family import ile yaratılmış governed event/location rollback exact delete receipt fence dilimine aittir; PPK-002 kapanışı, evrensel repository enforcement, obligation execution veya dış monoton rollback otoritesi PASS değildir.'
};
if (!successorRegression) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile('artifacts/validation/31-T_FAMILY_IMPORT_GOVERNED_ROLLBACK_RECEIPT_FENCE_CONTRACT.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failed.length) {
  console.error(`31-T contract: FAIL (${failed.length}/${checks.length}).`);
  failed.forEach((item) => console.error(`- ${item.name}`));
  process.exit(1);
}
console.log(`31-T contract: PASS (${checks.length}/${checks.length}).`);
