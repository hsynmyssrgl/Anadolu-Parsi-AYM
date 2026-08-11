import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const successorRegression = process.argv.slice(2).includes('--successor-regression');
const REPORT_PATH = successorRegression
  ? 'artifacts/validation/30-Y_30-X_HEALTH_POLICY_ENFORCEMENT_REGRESSION.json'
  : 'artifacts/validation/30-X-health-policy-enforcement-contract.json';
const paths = {
  authority: 'artifacts/authority/30-X_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-X_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-x-health-policy-enforcement-scope.json',
  statusReport: 'artifacts/inventory/30-X_SCOPE_AND_STATUS_REPORT.json',
  decision: 'docs/decisions/DEC-149-ppk-002-health-policy-enforcement.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  application: 'packages/application/src/health-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/health-repository.ts',
  repository: 'packages/repositories/src/health-repository.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  adapter: 'apps/desktop/src/main/health-application-adapter.ts',
  productionRuntime: 'apps/desktop/src/main/health-production-policy-runtime.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  ipcMain: 'apps/desktop/src/main/main.ts',
  coreService: 'apps/core-service/src/main.ts',
  legacyVerifier: 'scripts/verify-health-use-cases.mjs',
  automationApplication: 'packages/application/src/automation-use-cases.ts',
  automationContract: 'packages/repository-contracts/src/automation-repository.ts',
  automationRepository: 'packages/repositories/src/automation-repository.ts',
  reportApplication: 'packages/application/src/report-use-cases.ts',
  reportContract: 'packages/repository-contracts/src/report-repository.ts',
  reportRepository: 'packages/repositories/src/report-repository.ts',
  securityTest: 'apps/desktop/tests/health-policy-enforcement-runtime.test.ts',
  rowVisibilityTest: 'apps/desktop/tests/health-repository-row-visibility-runtime.test.ts',
  projectionPrivacyTest: 'apps/desktop/tests/health-cross-projection-privacy-runtime.test.ts',
  hardenedValidation: 'artifacts/validation/30-X_HEALTH_SECURITY_HARDENED_VALIDATION.json',
  predecessorCompletion: 'artifacts/checkpoints/30-W_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-W_LIBRARY_RECEIPT.json',
  firstFailure: 'artifacts/validation/30-X_TARGETED_TEST_FIRST_ATTEMPT_FAILURE.json',
  packageJson: 'package.json'
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const successorEvidence = successorRegression
  ? {
      completion: JSON.parse(await readFile('artifacts/checkpoints/30-X_COMPLETION_RECORD.json', 'utf8')),
      receipt: JSON.parse(await readFile('artifacts/checkpoints/30-X_LIBRARY_RECEIPT.json', 'utf8')),
      transition: JSON.parse(await readFile('artifacts/validation/30-X_COMPLETION_TRANSITION_VALIDATION.json', 'utf8'))
    }
  : undefined;
const json = (key) => JSON.parse(source[key]);
const checks = [];
const failures = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
const contains = (key, marker, name) => check(source[key].includes(marker), name, { path: paths[key], marker });
const containsAll = (key, markers, name) => check(
  markers.every((marker) => source[key].includes(marker)),
  name,
  { path: paths[key], markers }
);
const inOrder = (key, markers, name) => {
  let cursor = -1;
  for (const marker of markers) {
    cursor = source[key].indexOf(marker, cursor + 1);
    if (cursor < 0) break;
  }
  check(cursor >= 0, name, { path: paths[key], markers });
};
const countMatches = (key, expression) => (source[key].match(expression) ?? []).length;

const authority = json('authority');
const selection = json('selection');
const scope = json('scope');
const statusReport = json('statusReport');
const plan = json('plan');
const ledger = json('ledger');
const registry = json('registry');
const predecessorCompletion = json('predecessorCompletion');
const predecessorReceipt = json('predecessorReceipt');
const firstFailure = json('firstFailure');
const hardenedValidation = json('hardenedValidation');
const packageJson = json('packageJson');
const validationEntries = await readdir('artifacts/validation');
const preservedFailureFiles = validationEntries
  .filter((name) => /^30-X.*FAILURES?\.json$/u.test(name))
  .sort();
const preservedFailures = await Promise.all(preservedFailureFiles.map(async (name) => ({
  name,
  value: JSON.parse(await readFile(`artifacts/validation/${name}`, 'utf8'))
})));
const localPass = statusReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';

check(authority.step === '30-X' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-X/PPK-002');
check(authority.predecessor?.step === '30-W' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'authority binds the persistent 30-W predecessor');
check(authority.gapInventory?.healthIpcOperationCount === 6 && authority.gapInventory?.healthRepositoryOperationCount === 6, 'authority enumerates six health IPC and six repository operations');
check(authority.gapInventory?.healthWriteTables?.join(',') === 'health_records,medication_plans,family_health_history', 'authority enumerates the three health write tables');
check(authority.mandatoryTruthSentence === TRUTH, 'authority preserves the mandatory truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === 14 && selection.semanticExpected === 14, 'priority selection is 14/14 semantic PASS');
check(selection.processPassed === 5 && selection.processExpected === 5 && selection.processFailed === 0, 'priority selection is 5/5 process PASS');
check(scope.step === '30-X' && scope.scope === 'GOVERNED_HEALTH_POLICY_ENFORCEMENT_REPOSITORY_RECEIPT_AND_DIRECT_WRITE_FENCE_VERTICAL_SLICE', 'scope has the canonical 30-X identity');
check(scope.targets?.productionIpc?.length === 6 && scope.targets?.repositoryOperations?.length === 6, 'scope binds six IPC and six repository operations');
check(scope.targets?.writeTables?.join(',') === 'health_records,medication_plans,family_health_history', 'scope binds all three protected health tables');
check(scope.evidenceBoundary?.healthPolicyEnforcementVerticalSlice === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the target slice');
check(scope.evidenceBoundary?.crossSurfaceHealthReadProjection === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the cross-surface projection');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal enforcement open');
check(scope.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED', 'scope keeps external monotonic authority open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');
if (successorRegression) {
  check(
    localPass && statusReport.targetSliceStatus === 'PASS' && statusReport.persistentReceiptStatus === 'PENDING',
    'immutable pre-receipt status report remains the bounded 30-X local PASS snapshot'
  );
} else {
  check(
    (localPass && statusReport.targetSliceStatus === 'PASS' && statusReport.persistentReceiptStatus === 'PENDING')
      || (
        statusReport.status === 'IN_PROGRESS_SELECTION_LOCKED_IMPLEMENTATION_NOT_YET_PASS'
        && statusReport.targetSliceStatus === 'NOT_YET_PASS'
        && statusReport.persistentReceiptStatus === 'PENDING'
      ),
    'status report matches the receipt-bounded lifecycle phase'
  );
}
check(statusReport.bronzeCompletedPercent === 25.0, 'Bronze verified progress remains 25.0 percent');
check(statusReport.officialCompletionClaimed === false, 'status report does not claim official completion');
check(statusReport.silverStatus === 'FORBIDDEN_NOT_READY' && statusReport.goldStatus === 'FORBIDDEN_NOT_READY', 'Silver and Gold remain forbidden');

contains('decision', '# DEC-149', 'DEC-149 heading exists');
contains('decision', 'Policy Enforcement Point', 'DEC-149 requires the central PEP boundary');
contains('decision', 'aynı SQLite transaction', 'DEC-149 requires atomic receipt binding');
contains('decision', 'PPK-002 `PARTIAL`', 'DEC-149 preserves the requirement boundary');
contains('decision', '`%25,0`', 'DEC-149 preserves Bronze at 25.0 percent');

const active = plan.steps.filter((step) => step.status === 'IN_PROGRESS');
const selectedStep = active.find((step) => step.id === (successorRegression ? '30-Y' : '30-X'));
if (successorRegression) {
  const completed30X = plan.steps.find((step) => step.id === '30-X');
  check(plan.currentStep === '30-Y' && active.length === 1 && selectedStep?.id === '30-Y', 'work plan has exactly one active 30-Y successor step');
  check(selectedStep?.status === 'IN_PROGRESS' && selectedStep?.persistentReceiptStatus === 'PENDING', '30-Y remains the active receipt-bounded successor');
  check(
    completed30X?.status === 'COMPLETED'
      && completed30X?.validationStatus === 'PASS'
      && completed30X?.persistentReceiptStatus === 'PASS'
      && completed30X?.persistentReceiptPath === 'artifacts/checkpoints/30-X_LIBRARY_RECEIPT.json',
    'work plan preserves 30-X as COMPLETED/PASS with its persistent receipt'
  );
  check(ledger.activeMicroStep === '30-Y' && String(ledger.nextOfficialTask).startsWith('30-Y PPK-002'), 'governance ledger selects the exact 30-Y successor task');
} else {
  check(plan.currentStep === '30-X' && active.length === 1, 'work plan has exactly one active 30-X step');
  check(selectedStep?.persistentReceiptStatus === 'PENDING' && selectedStep?.validationStatus === (localPass ? 'PASS' : 'PENDING'), 'work plan matches the receipt-bounded validation phase');
  check(ledger.activeMicroStep === '30-X' && String(ledger.nextOfficialTask).startsWith('30-X PPK-002'), 'governance ledger selects the exact 30-X task');
}
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.chain?.repository === false, 'accepted scope keeps PPK-002 PARTIAL');
check(ppk002?.evidence?.includes('artifacts/validation/30-X_PRIORITY_SELECTION_VALIDATION.json'), 'registry binds the 30-X selection evidence');

for (const marker of [
  'export interface HealthPolicyIntent',
  "readonly capability: 'health.read' | 'health.write'",
  "readonly purpose: 'health'",
  'intent: HealthPolicyIntent',
  "capability: 'health.write'",
  "capability: 'health.read'"
]) contains('application', marker, `application contract declares ${marker}`);
for (const marker of [
  'Promise<Result<readonly HealthRecordView[], AppError>>',
  'Promise<Result<readonly MedicationPlanView[], AppError>>',
  'Promise<Result<readonly FamilyHealthHistoryView[], AppError>>',
  'Promise<Result<HealthRecordView, AppError>>',
  'Promise<Result<MedicationPlanView, AppError>>',
  'Promise<Result<FamilyHealthHistoryView, AppError>>'
]) contains('application', marker, `application makes governed health operation async: ${marker}`);

contains('repositoryContract', 'PolicyAuthorizedRepositoryExecutionContext', 'health repository requires policy-authorized contexts');
for (const operation of [
  'listHealthRecords(context:',
  'insertHealthRecord(context:',
  'listMedicationPlans(context:',
  'insertMedicationPlan(context:',
  'listFamilyHealthHistory(context:',
  'insertFamilyHealthHistory(context:'
]) contains('repositoryContract', operation, `repository contract declares governed operation ${operation}`);
contains('repositoryContract', 'HealthPolicyResourceRepositoryPort', 'repository contract declares the narrow health policy resolver port');
for (const lookup of [
  'findHealthRecordForPolicyResolution(',
  'findMedicationPlanForPolicyResolution(',
  'findFamilyHealthHistoryForPolicyResolution('
]) contains('repositoryContract', lookup, `policy resolver declares ${lookup}`);
contains('composition', 'HealthRepositoryPort & HealthPolicyResourceRepositoryPort', 'composition exposes the narrow health resource resolver');
contains('repository', 'assertPolicyAuthorizedRepositoryContext', 'repository validates the exact PEP execution context');
contains('repository', "capability: 'health.read'", 'repository binds health.read on reads');
contains('repository', "capability: 'health.write'", 'repository binds health.write on writes');
containsAll('repository', [
  'collectionVisibilitySql',
  'object_permissions denied',
  "denied.effect='deny'",
  "allowed.effect='allow'",
  ".privacy='family'",
  "dl.state<>'active'"
], 'repository enforces row-level health visibility before returning SQL rows');
containsAll('repository', [
  'context.policyAuthorization.subject',
  'receiptRecord.request.occurredAt',
  'receipt subject'
], 'repository binds visibility to the signed receipt subject and time');
check(countMatches('repository', /policy_receipt_hash,policy_receipt_version,policy_receipt_nonce,/gu) === 3, 'all three inserts persist durable receipt identity fields');
check(countMatches('repository', /policy_correlation_id,policy_resource_type,policy_resource_id,/gu) === 3, 'all three inserts persist exact correlation and resource fields');
check(countMatches('repository', /policy_action,policy_capability/gu) === 3, 'all three inserts persist exact action and capability fields');

contains('migration', "createMigrationDefinition(64, 'health_policy_receipt_fence'", 'migration 64 is registered');
for (const table of ['health_records', 'medication_plans', 'family_health_history']) {
  contains('migration', `ALTER TABLE ${table}\nADD COLUMN policy_receipt_hash`, `${table} receives durable receipt columns`);
}
check(countMatches('migration', /ADD COLUMN policy_receipt_hash TEXT REFERENCES platform_policy_transaction_receipts/gu) >= 3, 'migration source contains receipt hashes for all three health tables');
check(countMatches('migration', /ADD COLUMN policy_receipt_version INTEGER/gu) >= 5, 'migration source preserves receipt version columns including all three health tables');
for (const index of [
  'idx_health_records_policy_receipt',
  'idx_medication_plans_policy_receipt',
  'idx_family_health_history_policy_receipt'
]) contains('migration', index, `migration declares unique receipt index ${index}`);
for (const trigger of [
  'trg_platform_policy_health_record_insert',
  'trg_platform_policy_health_record_update',
  'trg_platform_policy_health_record_delete',
  'trg_platform_policy_medication_plan_insert',
  'trg_platform_policy_medication_plan_update',
  'trg_platform_policy_medication_plan_delete',
  'trg_platform_policy_family_health_history_insert',
  'trg_platform_policy_family_health_history_update',
  'trg_platform_policy_family_health_history_delete'
]) contains('migration', trigger, `database declares health receipt fence trigger ${trigger}`);
check(countMatches('migration', /CREATE TRIGGER trg_platform_policy_(?:health_record|medication_plan|family_health_history)_(?:insert|update|delete)/gu) === 9, 'migration declares exactly nine health table receipt-fence triggers');
contains('migration', "json_extract(receipt.record_json,'$.request.purpose')='health'", 'database fence binds the health purpose');
const healthMigrationSlice = source.migration.slice(
  source.migration.indexOf('const healthPolicyReceiptFenceSql'),
  source.migration.indexOf('const lifePolicyReceiptFenceSql')
);
check(
  (healthMigrationSlice.match(/json_extract\(receipt\.record_json,'\$\.request\.resource\.sensitivity'\)=CASE NEW\.privacy/gu) ?? []).length === 6,
  'all health insert and update fences bind privacy to receipt sensitivity'
);
containsAll('migration', [
  "WHEN 'private' THEN 'highly_sensitive'",
  "WHEN 'selected_members' THEN 'sensitive'",
  "WHEN 'family' THEN 'personal'"
], 'database fence maps every health privacy level to exact policy sensitivity');
contains('migration', "SET value='REVISION-30-X-PPK-002-HEALTH-POLICY-RECEIPT-FENCE'", 'schema generation records 30-X');

contains('adapter', 'HealthPolicyEnforcementPointResolver', 'desktop adapter resolves a production health PEP');
contains('adapter', 'failClosedHealthPolicyEnforcementPointResolver', 'desktop adapter has a fail-closed missing-PEP boundary');
contains('adapter', 'policyEnforcementPointResolver.resolve', 'desktop adapter resolves authorization before repository execution');
contains('adapter', 'recordAuthorizedTransaction', 'desktop adapter requires durable authorization recording');
contains('adapter', 'projectCommittedTransaction', 'desktop adapter projects durable receipts after commit');
containsAll('adapter', [
  'businessTransactionCommitted === true',
  'durableProjectionPending === true',
  'return result;'
], 'desktop adapter reports an already committed business result once while retaining durable recovery');
inOrder('adapter', ['policyEnforcementPointResolver.resolve', 'enforcementPoint.execute', 'operation(authorization', 'projectCommittedTransaction'], 'desktop adapter preserves authorization, repository, commit and projection order');
contains('productionRuntime', "HEALTH_POLICY_FENCE_NAME = 'health-write'", 'production runtime binds the health-write cluster fence');
contains('productionRuntime', 'reserveReplayNonce', 'production runtime reserves replay nonces durably');
contains('productionRuntime', 'recordAuthorizedTransaction', 'production runtime records authorized transactions');
contains('productionRuntime', 'findReceiptByNonce', 'production runtime confirms protected receipt projection');
contains('productionRuntime', 'durableProjectionPending: true', 'production runtime keeps projection failure durable and pending');
contains('dataStore', 'createHealthProductionPolicyEnforcementPointResolver', 'data store composes the production health PEP');
contains('dataStore', 'failClosedHealthPolicyEnforcementPointResolver', 'data store fails closed without production composition');
for (const method of [
  'public async listHealthRecords',
  'public async createHealthRecord',
  'public async listMedicationPlans',
  'public async createMedicationPlan',
  'public async listFamilyHealthHistory',
  'public async createFamilyHealthHistory'
]) contains('dataStore', method, `data store exposes async governed operation ${method}`);
check(
  countMatches('dataStore', /const visibleBeforeCommit = await this\.list(?:HealthRecords|MedicationPlans|FamilyHealthHistory)\(\)/gu) === 3,
  'health creates take their visible snapshot before the business commit'
);
const healthDataStoreSlice = source.dataStore.slice(
  source.dataStore.indexOf('public async listHealthRecords'),
  source.dataStore.indexOf('public async listFinanceValuations')
);
check(
  (healthDataStoreSlice.match(/visibleBeforeCommit\.filter/gu) ?? []).length === 3,
  'health creates do not perform a fallible post-commit list operation'
);
for (const channel of scope.targets.productionIpc) {
  contains('ipcMain', `registerIpcHandler('${channel}', async`, `IPC ${channel} awaits the governed health boundary`);
}
contains(
  'coreService',
  "'windows-desktop': ['family.read', 'family.write', 'health.read', 'health.write', 'finance.read', 'finance.write', 'archive.write']",
  'desktop service capability map registers family and health read/write while preserving predecessor capabilities'
);
contains('legacyVerifier', 'new PlatformPolicyKernel', 'legacy health gate composes the policy kernel');
contains('legacyVerifier', 'await store.createHealthRecord', 'legacy health gate awaits governed record writes');
contains('legacyVerifier', 'await store.listHealthRecords', 'legacy health gate awaits governed record reads');

containsAll('automationApplication', ['readonly familyId: FamilyId', 'readonly actorPersonId?: PersonId'], 'automation application context binds family and optional actor person');
contains('automationContract', 'familyId: FamilyId', 'automation repository contract requires the family boundary');
containsAll('automationRepository', [
  "SELECT m.id,'İlaç planı' title",
  'm.family_id=? AND m.owner_person_id=?',
  "dl.resource_type='medication_plan'",
  "dl.state<>'active'"
], 'automation medication projection is actor-owned, lifecycle-aware and title-minimized');
containsAll('automationRepository', [
  'listNonLifeRuns(',
  "CASE WHEN ar.source_type='medication_plan' THEN 'İlaç planı'",
  'm.owner_person_id=?'
], 'automation history is family and actor scoped and masks historical medication titles');
containsAll('reportApplication', ['readonly familyId: FamilyId', 'readonly actorPersonId?: PersonId'], 'report application context binds family and optional actor person');
contains('reportContract', 'familyId: FamilyId', 'report repository contract requires the family boundary');
containsAll('reportRepository', [
  'WHERE family_id=? AND owner_person_id=?',
  "dl.resource_type='medication_plan'",
  "dl.state<>'active'",
  ': 0'
], 'report projections are family scoped and medication count is actor-owned and lifecycle-aware');
containsAll('dataStore', ['#automationApplicationContext', '#reportApplicationContext', "familyId: asFamilyId('family-main')", 'actorPersonId: asPersonId(account.personId)'], 'data store projects trusted family and actor bindings to automation and reports');

check(countMatches('securityTest', /\bit\('/gu) >= 8, 'security runtime declares the hardened focused security test set');
contains('securityTest', 'fails closed when no health PEP is composed', 'focused runtime covers missing PEP');
contains('securityTest', 'rejects a forged repository context before any health SQL executes', 'focused runtime covers forged repository contexts');
contains('securityTest', 'rejects health access when the live production fence is not writable', 'focused runtime covers a non-writable fence');
contains('securityTest', 'rejects an authority-to-transaction fence race during revalidation', 'focused runtime covers transaction revalidation races');
contains('securityTest', 'returns a committed create once and recovers its pending journal projection', 'focused runtime covers projection recovery without duplicate business writes');
contains('securityTest', 'rolls back health data, receipt, audit and outbox when the domain outbox write fails', 'focused runtime covers atomic rollback');
contains('securityTest', 'does not leak another person medication details through reports or automation', 'focused runtime covers cross-person medication privacy');
contains('securityTest', 'persists exact receipts and rejects missing, copied, stale and deletion writes', 'focused runtime covers exact receipt persistence and direct-write bypasses');
containsAll('securityTest', ['health_records', 'medication_plans', 'family_health_history'], 'focused runtime covers all three protected tables');
check(countMatches('rowVisibilityTest', /\bit\('/gu) === 2, 'row-visibility runtime declares two focused tests');
containsAll('rowVisibilityTest', [
  'enforces lifecycle, family, privacy, role, grants, time, action and deny precedence in SQL',
  'rejects ordinary, forged and receipt-subject-mismatched repository contexts before SQL'
], 'row-visibility runtime covers SQL authorization and context forgery');
check(countMatches('projectionPrivacyTest', /\bit\('/gu) === 2, 'cross-projection privacy runtime declares two focused tests');
containsAll('projectionPrivacyTest', [
  'keeps medication due sources and prior runs inside actor ownership and active lifecycle',
  'scopes every report query to family and personal aggregates to actor ownership'
], 'cross-projection runtime covers prior runs, lifecycle and report scoping');
check(
  hardenedValidation.status === 'PASS'
    && hardenedValidation.processExitCode === 0
    && hardenedValidation.tests?.passed === 12
    && hardenedValidation.tests?.failed === 0,
  'hardened health security runtime is 12/12 PASS with real exit code 0'
);

check(predecessorCompletion.step === '30-W' && predecessorCompletion.officialStepStatus === 'COMPLETED', '30-W predecessor remains completed');
check(predecessorReceipt.status === 'PASS' && predecessorReceipt.persistentReceiptStatus === 'PASS', '30-W persistent receipt remains PASS');
if (successorRegression) {
  check(
    successorEvidence.completion.step === '30-X'
      && successorEvidence.completion.status === 'PASS'
      && successorEvidence.completion.officialStepStatus === 'COMPLETED'
      && successorEvidence.completion.validationStatus === 'PASS'
      && successorEvidence.completion.persistentReceiptStatus === 'PASS',
    '30-X completion record remains official COMPLETED/PASS with persistent receipt PASS'
  );
  check(
    successorEvidence.receipt.step === '30-X'
      && successorEvidence.receipt.status === 'PASS'
      && successorEvidence.receipt.persistentReceiptStatus === 'PASS',
    '30-X Library receipt remains PASS'
  );
  check(
    successorEvidence.transition.step === '30-X'
      && successorEvidence.transition.status === 'PASS'
      && successorEvidence.transition.semanticPassed === 30
      && successorEvidence.transition.semanticExpected === 30
      && successorEvidence.transition.processPassed === 5
      && successorEvidence.transition.processExpected === 5
      && successorEvidence.transition.processFailed === 0,
    '30-X completion transition remains 30/30 semantic and 5/5 process PASS'
  );
}
check(firstFailure.stepId === '30-X' && firstFailure.status === 'FAIL' && firstFailure.countsAsPass === false, 'first targeted failure remains FAIL and does not count as PASS');
check(firstFailure.processExitCode === 1 && firstFailure.realExitCodeObserved === true, 'first targeted failure preserves its real non-zero exit code');
check(preservedFailureFiles.length >= 11, 'all observed 30-X failure attempts remain separately preserved');
check(
  preservedFailures.every(({ value }) => value.status === 'FAIL' && value.countsAsPass === false),
  'no preserved 30-X failure is counted as PASS'
);
check(packageJson.scripts?.['verify:30-x:health-policy-enforcement-contract'] === 'node scripts/verify-30-x-health-policy-enforcement-contract.mjs', 'package exposes the 30-X contract gate');
if (successorRegression) {
  check(
    packageJson.scripts?.['verify:30-y:30-x-health-regression'] === 'node scripts/verify-30-x-health-policy-enforcement-contract.mjs --successor-regression',
    'package exposes the non-destructive 30-Y successor regression gate'
  );
}

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: successorRegression ? '30-Y' : '30-X',
  ...(successorRegression ? { predecessorStep: '30-X', successorRegression: true } : {}),
  requirement: 'PPK-002',
  phase: successorRegression
    ? '30_Y_SUCCESSOR_30_X_HEALTH_POLICY_ENFORCEMENT_REGRESSION'
    : 'GOVERNED_HEALTH_POLICY_ENFORCEMENT_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  preservedFailedAttempts: preservedFailureFiles.length,
  preservedFailureFiles,
  failedAttemptsCountedAsPass: 0,
  evidenceBoundary: {
    ...scope.evidenceBoundary,
    healthPolicyEnforcementVerticalSlice: status === 'PASS' ? 'TARGETED_CONTRACT_PASS' : 'TARGETED_NOT_YET_PASS',
    crossSurfaceHealthReadProjection: status === 'PASS' ? 'TARGETED_CONTRACT_PASS' : 'TARGETED_NOT_YET_PASS'
  },
  PPK002: 'PARTIAL',
  bronzeCompletedPercent: 25.0,
  officialCompletionClaimed: false,
  persistentReceiptStatus: successorRegression ? 'PASS' : 'PENDING',
  ...(successorRegression
    ? {
        predecessorOfficialStepStatus: successorEvidence.completion.officialStepStatus,
        predecessorPersistentReceiptStatus: successorEvidence.receipt.persistentReceiptStatus,
        activeSuccessorStep: plan.currentStep
      }
    : {}),
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`${successorRegression ? '30-Y successor 30-X regression' : '30-X health policy enforcement contract'}: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(
  `${successorRegression ? '30-Y successor 30-X regression' : '30-X health policy enforcement contract'}: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL; persistent receipt ${successorRegression ? 'PASS' : 'PENDING'}).`
);
console.log(TRUTH);
