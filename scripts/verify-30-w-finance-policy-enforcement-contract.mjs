import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const successorRegression = process.argv.slice(2).includes('--successor-regression');
const REPORT_PATH = successorRegression
  ? 'artifacts/validation/30-X_30-W_FINANCE_POLICY_ENFORCEMENT_REGRESSION.json'
  : 'artifacts/validation/30-W-finance-policy-enforcement-contract.json';
const paths = {
  authority: 'artifacts/authority/30-W_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  selection: 'artifacts/validation/30-W_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-w-finance-policy-enforcement-scope.json',
  statusReport: 'artifacts/inventory/30-W_SCOPE_AND_STATUS_REPORT.json',
  decision: 'docs/decisions/DEC-148-ppk-002-finance-policy-enforcement.md',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  application: 'packages/application/src/finance-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/finance-repository.ts',
  repository: 'packages/repositories/src/finance-repository.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  adapter: 'apps/desktop/src/main/finance-application-adapter.ts',
  productionRuntime: 'apps/desktop/src/main/finance-production-policy-runtime.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  coreService: 'apps/core-service/src/main.ts',
  coreServiceContract: 'scripts/verify-core-service-local-admin-contract.mjs',
  legacyVerifier: 'scripts/verify-finance-use-cases.mjs',
  dataStoreTest: 'apps/desktop/tests/data-store.test.ts',
  securityTest: 'apps/desktop/tests/finance-policy-enforcement-runtime.test.ts',
  predecessorCompletion: 'artifacts/checkpoints/30-V_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-V_LIBRARY_RECEIPT.json',
  packageJson: 'package.json'
};
const failurePaths = [
  'artifacts/validation/30-W_TYPECHECK_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_MIGRATION_VALIDATION_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_TARGETED_TEST_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_GOVERNED_PREFLIGHT_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_TARGETED_TEST_SECOND_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_TARGETED_TEST_THIRD_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_SECURITY_TEST_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_LEGACY_FINANCE_GATE_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_CONTRACT_GATE_FIRST_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_CONTRACT_GATE_SECOND_ATTEMPT_FAILURE.json',
  'artifacts/validation/30-W_FINAL_VALIDATION_FIRST_ATTEMPT_FAILURE.json'
];

const source = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const failuresEvidence = await Promise.all(failurePaths.map(async (path) => JSON.parse(await readFile(path, 'utf8'))));
const successorEvidence = successorRegression
  ? {
      completion: JSON.parse(await readFile('artifacts/checkpoints/30-W_COMPLETION_RECORD.json', 'utf8')),
      receipt: JSON.parse(await readFile('artifacts/checkpoints/30-W_LIBRARY_RECEIPT.json', 'utf8')),
      transition: JSON.parse(await readFile('artifacts/validation/30-W_COMPLETION_TRANSITION_VALIDATION.json', 'utf8'))
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
const inOrder = (key, markers, name) => {
  let cursor = -1;
  for (const marker of markers) {
    cursor = source[key].indexOf(marker, cursor + 1);
    if (cursor < 0) break;
  }
  check(cursor >= 0, name, { path: paths[key], markers });
};

const authority = json('authority');
const selection = json('selection');
const scope = json('scope');
const statusReport = json('statusReport');
const plan = json('plan');
const ledger = json('ledger');
const registry = json('registry');
const predecessorCompletion = json('predecessorCompletion');
const predecessorReceipt = json('predecessorReceipt');
const packageJson = json('packageJson');
const localPass = statusReport.status === 'LOCAL_PASS_AWAITING_LIBRARY_RECEIPT';

check(authority.step === '30-W' && authority.requirement === 'PPK-002' && authority.status === 'PASS', 'priority authority binds PASS 30-W/PPK-002');
check(authority.predecessor?.step === '30-V' && authority.predecessor?.persistentReceiptStatus === 'PASS', 'authority binds the completed persistent predecessor');
check(authority.mandatoryTruthSentence === TRUTH, 'authority preserves the truth sentence');
check(selection.status === 'PASS' && selection.semanticPassed === 14 && selection.semanticExpected === 14, 'priority selection is 14/14 semantic PASS');
check(selection.processPassed === 5 && selection.processExpected === 5 && selection.processFailed === 0, 'priority selection is 5/5 process PASS');
check(scope.step === '30-W' && scope.scope === 'GOVERNED_FINANCE_POLICY_ENFORCEMENT_REPOSITORY_RECEIPT_AND_DIRECT_WRITE_FENCE_VERTICAL_SLICE', 'scope has the canonical 30-W identity');
check(scope.targets?.productionIpc?.length === 4 && scope.targets?.repositoryOperations?.length === 5, 'scope binds four IPC and five repository operations');
check(scope.targets?.writeTables?.join(',') === 'finance_records,finance_valuations', 'scope binds the two protected finance tables');
check(scope.evidenceBoundary?.financePolicyEnforcementVerticalSlice === 'TARGETED_NOT_YET_PASS', 'scope does not pre-claim the target');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'scope keeps universal enforcement open');
check(scope.evidenceBoundary?.externalMonotonicAuthorityAgainstCoordinatedDatabaseAndJournalRollback === 'NOT_IMPLEMENTED', 'scope keeps external monotonic authority open');
check(scope.evidenceBoundary?.requirementCompletionClaimed === false, 'scope does not claim PPK-002 completion');
if (successorRegression) {
  check(
    localPass && statusReport.targetSliceStatus === 'PASS' && statusReport.persistentReceiptStatus === 'PENDING',
    'immutable pre-receipt status report remains the bounded 30-W local PASS snapshot'
  );
} else {
  check(
    (localPass && statusReport.targetSliceStatus === 'PASS' && statusReport.persistentReceiptStatus === 'PENDING')
      || statusReport.status === 'IN_PROGRESS_SELECTION_LOCKED_IMPLEMENTATION_NOT_YET_PASS',
    'status report matches the receipt-bounded lifecycle phase'
  );
}

contains('decision', '# DEC-148', 'DEC-148 heading exists');
contains('decision', 'Policy Enforcement Point', 'DEC-148 requires the central PEP boundary');
contains('decision', 'aynı SQLite transaction', 'DEC-148 requires atomic receipt binding');
contains('decision', 'PPK-002 `PARTIAL`', 'DEC-148 preserves the requirement boundary');

const active = plan.steps.filter((step) => step.status === 'IN_PROGRESS');
const selectedStep = active.find((step) => step.id === (successorRegression ? '30-X' : '30-W'));
if (successorRegression) {
  const completed30W = plan.steps.find((step) => step.id === '30-W');
  check(plan.currentStep === '30-X' && active.length === 1 && selectedStep?.id === '30-X', 'work plan has exactly one active 30-X successor step');
  check(selectedStep?.status === 'IN_PROGRESS' && selectedStep?.persistentReceiptStatus === 'PENDING', '30-X remains the active receipt-bounded successor');
  check(
    completed30W?.status === 'COMPLETED'
      && completed30W?.validationStatus === 'PASS'
      && completed30W?.persistentReceiptStatus === 'PASS'
      && completed30W?.persistentReceiptPath === 'artifacts/checkpoints/30-W_LIBRARY_RECEIPT.json',
    'work plan preserves 30-W as COMPLETED/PASS with its persistent receipt'
  );
  check(ledger.activeMicroStep === '30-X' && String(ledger.nextOfficialTask).startsWith('30-X PPK-002'), 'governance ledger selects the exact 30-X successor task');
} else {
  check(plan.currentStep === '30-W' && active.length === 1, 'work plan has exactly one active 30-W step');
  check(selectedStep?.persistentReceiptStatus === 'PENDING' && selectedStep?.validationStatus === (localPass ? 'PASS' : 'PENDING'), 'work plan matches the receipt-bounded validation phase');
  check(ledger.activeMicroStep === '30-W' && String(ledger.nextOfficialTask).startsWith('30-W PPK-002'), 'governance ledger selects the exact 30-W task');
}
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check(ppk002?.status === 'PARTIAL' && ppk002?.chain?.repository === false, 'accepted scope keeps PPK-002 PARTIAL');
check(ppk002?.evidence?.includes('artifacts/validation/30-W_PRIORITY_SELECTION_VALIDATION.json'), 'registry binds the 30-W selection evidence');

for (const marker of [
  'export interface FinancePolicyIntent',
  "readonly capability: 'finance.read' | 'finance.write'",
  'intent: FinancePolicyIntent',
  "capability: 'finance.write'",
  "capability: 'finance.read'",
  'Promise<Result<readonly FinanceRecordView[], AppError>>',
  'Promise<Result<readonly FinanceValuationView[], AppError>>'
]) contains('application', marker, `application contract declares ${marker}`);

for (const marker of [
  'PolicyAuthorizedRepositoryExecutionContext',
  'listRecords(context:',
  'findRecord(context:',
  'insertRecord(context:',
  'listValuations(context:',
  'insertValuation(context:',
  'FinancePolicyResourceRepositoryPort',
  'findRecordForPolicyResolution'
]) contains('repositoryContract', marker, `repository contract declares ${marker}`);

contains('repository', 'assertPolicyAuthorizedRepositoryContext', 'repository validates the exact PEP execution context');
contains('repository', 'policy_receipt_hash,policy_receipt_version,policy_receipt_nonce', 'repository writes durable receipt identity columns');
contains('repository', "capability: 'finance.read'", 'repository binds finance.read on reads');
contains('repository', "capability: 'finance.write'", 'repository binds finance.write on writes');
contains('composition', 'FinancePolicyResourceRepositoryPort', 'composition exposes the narrow resource resolver port');

contains('migration', "createMigrationDefinition(63, 'finance_policy_receipt_fence'", 'migration 63 is registered');
contains('migration', 'idx_finance_records_policy_receipt', 'migration adds a unique record receipt index');
contains('migration', 'idx_finance_valuations_policy_receipt', 'migration adds a unique valuation receipt index');
contains('migration', 'trg_platform_policy_finance_record_insert', 'database guards record inserts');
contains('migration', 'trg_platform_policy_finance_record_update', 'database guards record updates');
contains('migration', 'trg_platform_policy_finance_record_delete', 'database guards record deletes');
contains('migration', 'trg_platform_policy_finance_valuation_insert', 'database guards valuation inserts');
contains('migration', 'trg_platform_policy_finance_valuation_delete', 'database guards valuation deletes');
contains('migration', 'REVISION-30-W-PPK-002-FINANCE-POLICY-RECEIPT-FENCE', 'schema generation records 30-W');

contains('adapter', 'FinancePolicyEnforcementPointResolver', 'desktop adapter resolves a production finance PEP');
contains('adapter', 'failClosedFinancePolicyEnforcementPointResolver', 'desktop adapter has a fail-closed missing-PEP boundary');
contains('adapter', 'policyEnforcementPointResolver.resolve', 'desktop adapter resolves authorization before repository execution');
contains('adapter', 'projectCommittedTransaction', 'desktop adapter projects durable receipts after commit');
inOrder('adapter', ['policyEnforcementPointResolver.resolve', 'enforcementPoint.execute', 'operation(authorization', 'projectCommittedTransaction'], 'desktop adapter preserves authorization, repository, commit and projection order');

contains('productionRuntime', "FINANCE_POLICY_FENCE_NAME = 'finance-write'", 'production runtime binds the finance-write cluster fence');
contains('productionRuntime', 'reserveReplayNonce', 'production runtime reserves replay nonces durably');
contains('productionRuntime', 'recordAuthorizedTransaction', 'production runtime records authorized transactions');
contains('productionRuntime', 'findReceiptByNonce', 'production runtime confirms protected receipt projection');
contains('productionRuntime', 'durableProjectionPending: true', 'production runtime keeps projection failure durable and pending');
contains('dataStore', 'createFinanceProductionPolicyEnforcementPointResolver', 'data store composes the production finance PEP');
contains('dataStore', 'failClosedFinancePolicyEnforcementPointResolver', 'data store fails closed without production composition');
contains('dataStore', 'public async createFinanceRecord', 'data store finance record writes are async governed calls');
contains('dataStore', 'public async createFinanceValuation', 'data store valuation writes are async governed calls');

contains('coreService', "'windows-desktop': ['health.read', 'health.write', 'finance.read', 'finance.write', 'archive.write']", 'desktop service capability map preserves finance and archive while adding health enforcement');
contains('coreServiceContract', "'finance.read'", 'core-service contract requires finance.read');
contains('coreServiceContract', "'finance.write'", 'core-service contract requires finance.write');
contains('coreServiceContract', "'archive.write'", 'core-service contract preserves archive.write');
contains('legacyVerifier', 'await store.createFinanceRecord', 'legacy finance gate awaits governed record writes');
contains('legacyVerifier', 'await store.listFinanceRecords', 'legacy finance gate awaits governed reads');
contains('legacyVerifier', 'new PlatformPolicyKernel', 'legacy finance gate composes the production policy kernel');

check((source.securityTest.match(/\bit\(/gu) ?? []).length === 4, 'security runtime declares four focused tests');
contains('securityTest', 'fails closed when no finance PEP is composed', 'security runtime covers missing PEP');
contains('securityTest', 'rejects a forged repository context', 'security runtime covers forged repository context');
contains('securityTest', 'rejects missing, stale, copied and deletion writes', 'security runtime covers direct SQL receipt fence bypasses');
contains('dataStoreTest', "describe('FamilyDataStore'", 'data-store regression keeps the finance suite');

check(predecessorCompletion.step === '30-V' && predecessorCompletion.officialStepStatus === 'COMPLETED', '30-V predecessor remains completed');
check(predecessorReceipt.status === 'PASS' && predecessorReceipt.persistentReceiptStatus === 'PASS', '30-V persistent receipt remains PASS');
if (successorRegression) {
  check(
    successorEvidence?.completion?.step === '30-W'
      && successorEvidence.completion.status === 'PASS'
      && successorEvidence.completion.officialStepStatus === 'COMPLETED'
      && successorEvidence.completion.validationStatus === 'PASS'
      && successorEvidence.completion.persistentReceiptStatus === 'PASS',
    '30-W completion record remains COMPLETED/PASS with persistent receipt PASS'
  );
  check(
    successorEvidence?.receipt?.step === '30-W'
      && successorEvidence.receipt.status === 'PASS'
      && successorEvidence.receipt.persistentReceiptStatus === 'PASS',
    '30-W Library receipt remains PASS'
  );
  check(
    successorEvidence?.transition?.step === '30-W'
      && successorEvidence.transition.status === 'PASS'
      && successorEvidence.transition.semanticPassed === successorEvidence.transition.semanticExpected
      && successorEvidence.transition.processPassed === successorEvidence.transition.processExpected,
    '30-W completion transition remains semantic and process PASS'
  );
}
check(failuresEvidence.length === 11, 'all eleven failed attempts are enumerated');
check(failuresEvidence.every((item) => item.stepId === '30-W' && item.status === 'FAIL' && item.countsAsPass === false && item.processExitCode === 1), 'every failed attempt remains FAIL and not counted as PASS');
check(packageJson.scripts?.['verify:30-w:finance-policy-enforcement-contract'] === 'node scripts/verify-30-w-finance-policy-enforcement-contract.mjs', 'package exposes the 30-W contract gate');
if (successorRegression) {
  check(
    packageJson.scripts?.['verify:30-x:30-w-finance-regression'] === 'node scripts/verify-30-w-finance-policy-enforcement-contract.mjs --successor-regression',
    'package exposes the 30-X successor regression gate'
  );
}

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const defaultReport = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-W',
  requirement: 'PPK-002',
  phase: 'GOVERNED_FINANCE_POLICY_ENFORCEMENT_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  preservedFailedAttempts: 11,
  failedAttemptsCountedAsPass: 0,
  evidenceBoundary: {
    ...scope.evidenceBoundary,
    financePolicyEnforcementVerticalSlice: localPass ? 'TARGETED_PASS' : 'TARGETED_NOT_YET_PASS'
  },
  officialCompletionClaimed: false,
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
const report = successorRegression
  ? {
      ...defaultReport,
      step: '30-X',
      predecessorStep: '30-W',
      phase: '30_X_SUCCESSOR_30_W_FINANCE_POLICY_ENFORCEMENT_REGRESSION',
      successorRegression: true,
      predecessorCompletionStatus: successorEvidence?.completion?.officialStepStatus ?? 'UNAVAILABLE',
      predecessorValidationStatus: successorEvidence?.completion?.validationStatus ?? 'UNAVAILABLE',
      predecessorPersistentReceiptStatus: successorEvidence?.receipt?.persistentReceiptStatus ?? 'UNAVAILABLE',
      activeSuccessorStep: plan.currentStep,
      officialCompletionClaimed: false
    }
  : defaultReport;
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (status !== 'PASS') {
  console.error(`${successorRegression ? '30-X -> 30-W finance regression' : '30-W finance policy enforcement contract'}: FAIL (${failures.length}/${checks.length}).`);
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log(`${successorRegression ? '30-X -> 30-W finance regression' : '30-W finance policy enforcement contract'}: PASS (${checks.length}/${checks.length}; PPK-002 remains PARTIAL).`);
console.log(TRUTH);
