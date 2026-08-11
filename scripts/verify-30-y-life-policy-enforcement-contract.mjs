import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const REPORT_PATH = 'artifacts/validation/30-Y-life-policy-enforcement-contract.json';
const TRUTH = 'Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.';
const paths = {
  authority: 'artifacts/authority/30-Y_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  correction: 'artifacts/authority/30-Y_CAPABILITY_SEMANTICS_CORRECTION.json',
  selection: 'artifacts/validation/30-Y_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/30-y-life-policy-enforcement-scope.json',
  statusReport: 'artifacts/inventory/30-Y_SCOPE_AND_STATUS_REPORT.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  decision: 'docs/decisions/DEC-150-ppk-002-life-policy-enforcement.md',
  predecessorCompletion: 'artifacts/checkpoints/30-X_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/30-X_LIBRARY_RECEIPT.json',
  predecessorTransition: 'artifacts/validation/30-X_COMPLETION_TRANSITION_VALIDATION.json',
  lifeApplication: 'packages/application/src/life-use-cases.ts',
  lifeContract: 'packages/repository-contracts/src/life-repository.ts',
  lifeRepository: 'packages/repositories/src/life-repository.ts',
  lifeAdapter: 'apps/desktop/src/main/life-application-adapter.ts',
  lifeRuntime: 'apps/desktop/src/main/life-production-policy-runtime.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  policyKernel: 'packages/platform-policy/src/policy-kernel.ts',
  policyPep: 'packages/platform-policy/src/policy-enforcement-point.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  ipcMain: 'apps/desktop/src/main/main.ts',
  automationApplication: 'packages/application/src/automation-use-cases.ts',
  automationContract: 'packages/repository-contracts/src/automation-repository.ts',
  automationRepository: 'packages/repositories/src/automation-repository.ts',
  automationAdapter: 'apps/desktop/src/main/automation-application-adapter.ts',
  reportApplication: 'packages/application/src/report-use-cases.ts',
  reportContract: 'packages/repository-contracts/src/report-repository.ts',
  reportRepository: 'packages/repositories/src/report-repository.ts',
  reportAdapter: 'apps/desktop/src/main/report-application-adapter.ts',
  lifeRepositoryTest: 'packages/repositories/life-repository-policy.test.ts',
  lifeCrossSurfaceTest: 'apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts',
  healthPolicyTest: 'apps/desktop/tests/health-policy-enforcement-runtime.test.ts',
  healthCrossSurfaceTest: 'apps/desktop/tests/health-cross-projection-privacy-runtime.test.ts',
  healthVerifier: 'scripts/verify-30-x-health-policy-enforcement-contract.mjs',
  lifeVerifier: 'scripts/verify-life-use-cases.mjs',
  contractSelf: 'scripts/verify-30-y-life-policy-enforcement-contract.mjs',
  firstFailure: 'artifacts/validation/30-Y_CROSS_SURFACE_RUNTIME_ATTEMPT_1_FAILURE.json',
  cleanCrossSurface: 'artifacts/validation/30-Y_CROSS_SURFACE_RUNTIME_CLEAN_VALIDATION.json',
  cleanHealthRegression: 'artifacts/validation/30-Y_30-X_TARGETED_RUNTIME_REGRESSION_CLEAN_VALIDATION.json',
  cleanTypechecks: 'artifacts/validation/30-Y_WORKER_C_RELEVANT_TYPECHECK_CLEAN_VALIDATION.json',
  lifeUseCaseManifest: 'artifacts/manifests/LIFE_USE_CASE_VERIFICATION_MVP56.json',
  packageJson: 'package.json'
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])
));
const json = (key) => JSON.parse(source[key]);
const checks = [];
const failures = [];
const check = (condition, name, details) => {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};
const all = (key, markers, name) => check(
  markers.every((marker) => source[key].includes(marker)),
  name,
  { path: paths[key], markers }
);
const none = (key, markers, name) => check(
  markers.every((marker) => !source[key].includes(marker)),
  name,
  { path: paths[key], markers }
);
const count = (key, expression) => (source[key].match(expression) || []).length;

const authority = json('authority');
const correction = json('correction');
const selection = json('selection');
const scope = json('scope');
const statusReport = json('statusReport');
const plan = json('plan');
const ledger = json('ledger');
const registry = json('registry');
const predecessorCompletion = json('predecessorCompletion');
const predecessorReceipt = json('predecessorReceipt');
const predecessorTransition = json('predecessorTransition');
const firstFailure = json('firstFailure');
const cleanCrossSurface = json('cleanCrossSurface');
const cleanHealthRegression = json('cleanHealthRegression');
const cleanTypechecks = json('cleanTypechecks');
const lifeUseCaseManifest = json('lifeUseCaseManifest');
const packageJson = json('packageJson');
const validationEntries = await readdir('artifacts/validation');
const preservedFailureFiles = validationEntries
  .filter((name) => /^30-Y.*FAIL.*\.json$/u.test(name))
  .sort();
const preservedFailures = await Promise.all(preservedFailureFiles.map(async (name) => ({
  name,
  value: JSON.parse(await readFile('artifacts/validation/' + name, 'utf8'))
})));

check(
  authority.step === '30-Y'
    && authority.status === 'PASS'
    && authority.selectionClass === 'CONTINUING_STARTED_P0_LIFE_PRIVACY_SECURITY_AND_DATA_INTEGRITY_SLICE'
    && authority.selectedOpenFinding === 'UNIVERSAL_REPOSITORY_ENFORCEMENT_LIFE_VERTICAL_SLICE'
    && authority.targetedBoundary === 'lifePolicyEnforcementVerticalSlice',
  'selection authority binds the exact 30-Y LIFE slice'
);
check(
  authority.predecessor?.step === '30-X'
    && authority.predecessor?.status === 'COMPLETED'
    && authority.predecessor?.persistentReceiptStatus === 'PASS'
    && authority.predecessor?.completionTransitionSemantic === '30_OF_30_PASS'
    && authority.predecessor?.completionTransitionProcess === '5_OF_5_PASS',
  'selection authority binds the completed 30-X receipt chain'
);
check(
  selection.status === 'PASS'
    && selection.semanticPassed === selection.semanticExpected
    && selection.processPassed === 5
    && selection.processExpected === 5
    && selection.processFailed === 0,
  'priority selection remains clean semantic and process PASS'
);
check(
  correction.status === 'PASS'
    && correction.correctionClass === 'DESIGN_DETAIL_CORRECTION_NOT_ATTEMPT_FAILURE'
    && correction.historicalAttempt1?.status === 'PASS'
    && correction.historicalAttempt1?.classification === 'HISTORICAL_PASS_WITH_SUPERSEDED_DESIGN_DETAIL_NOT_FAILURE',
  'capability correction preserves attempt 1 as historical PASS'
);
check(
  correction.effectiveCapabilitySemantics?.read?.capability === 'family.read'
    && correction.effectiveCapabilitySemantics?.create?.capability === 'family.write'
    && correction.effectiveCapabilitySemantics?.resourceType === 'life_record'
    && correction.effectiveCapabilitySemantics?.purpose === 'general'
    && correction.protectedPlatformContractsChanged === false,
  'correction binds family capabilities without platform vocabulary expansion'
);
check(
  scope.step === '30-Y'
    && scope.targets?.productionIpc?.join(',') === 'life:create,life:list'
    && scope.targets?.repositoryOperations?.join(',') === 'listLifeRecords,insertLifeRecord',
  'scope binds exactly two LIFE IPC and repository operations'
);
check(
  scope.targets?.policyIntent?.read?.capability === 'family.read'
    && scope.targets?.policyIntent?.create?.capability === 'family.write'
    && scope.targets?.policyIntent?.resourceType === 'life_record'
    && scope.targets?.policyIntent?.purpose === 'general'
    && scope.targets?.policyIntent?.exactBindings?.join(',') === 'family,ownerPerson,privacy,sensitivity,correlation',
  'scope binds exact corrected policy semantics'
);
const active = plan.steps.filter((step) => step.status === 'IN_PROGRESS');
const step30Y = plan.steps.find((step) => step.id === '30-Y');
const step30X = plan.steps.find((step) => step.id === '30-X');
check(
  plan.currentStep === '30-Y'
    && active.length === 1
    && step30Y?.status === 'IN_PROGRESS'
    && step30Y?.persistentReceiptStatus === 'PENDING',
  'work plan has one active receipt-bounded 30-Y step'
);
check(
  step30X?.status === 'COMPLETED'
    && step30X?.validationStatus === 'PASS'
    && step30X?.persistentReceiptStatus === 'PASS',
  'work plan preserves completed 30-X'
);
check(
  ledger.activeMicroStep === '30-Y'
    && String(ledger.nextOfficialTask).startsWith('30-Y PPK-002 governed life'),
  'ledger selects the exact 30-Y task'
);
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
check(
  ppk002?.status === 'PARTIAL'
    && ppk002?.chain?.repository === false
    && ppk002?.evidence?.includes('artifacts/authority/30-Y_CAPABILITY_SEMANTICS_CORRECTION.json'),
  'accepted scope keeps PPK-002 PARTIAL'
);
check(
  predecessorCompletion.step === '30-X'
    && predecessorCompletion.status === 'PASS'
    && predecessorCompletion.officialStepStatus === 'COMPLETED'
    && predecessorCompletion.persistentReceiptStatus === 'PASS',
  '30-X completion remains official PASS'
);
check(
  predecessorReceipt.step === '30-X'
    && predecessorReceipt.status === 'PASS'
    && predecessorReceipt.persistentReceiptStatus === 'PASS',
  '30-X Library receipt remains PASS'
);
check(
  predecessorTransition.step === '30-X'
    && predecessorTransition.status === 'PASS'
    && predecessorTransition.semanticPassed === 30
    && predecessorTransition.semanticExpected === 30
    && predecessorTransition.processPassed === 5
    && predecessorTransition.processExpected === 5
    && predecessorTransition.processFailed === 0,
  '30-X transition remains 30/30 semantic and 5/5 process PASS'
);
all('decision', ['# DEC-150', 'family.read', 'family.write', 'life_record', 'general'], 'DEC-150 binds corrected semantics');

all('lifeApplication', [
  "readonly capability: 'family.read' | 'family.write'",
  "readonly resourceType: 'life_record'",
  "readonly purpose: 'general'",
  "capability: 'family.write'",
  "action: 'life_record.created'",
  "eventType: 'life.record.created'"
], 'LIFE use case binds exact create, audit and outbox semantics');
none('lifeApplication', ["'life.read'", "'life.write'"], 'LIFE use case has no invented capability');
all('lifeAdapter', [
  'export class RepositoryBackedLifePolicyTransactionRunner',
  'PolicyAuthorizedRepositoryExecutionContext',
  "capability: 'family.read'",
  "resourceType: 'life_record'",
  "purpose: 'general'",
  'public async listLifeRecords'
], 'LIFE adapter exposes shared governed async read');
none('lifeAdapter', ["'life.read'", "'life.write'"], 'LIFE adapter has no invented capability');
all('lifeRuntime', [
  "LIFE_POLICY_FENCE_NAME = 'life-write'",
  "requestedIntent.capability !== 'family.read'",
  "requestedIntent.capability !== 'family.write'",
  'reserveReplayNonce',
  'recordAuthorizedTransaction',
  'deferAllowedReceiptPersistence: true'
], 'production LIFE runtime binds fence, replay and receipt');
check(
  count('lifeContract', /context: PolicyAuthorizedRepositoryExecutionContext/gu) >= 5,
  'LIFE contracts require policy-authorized contexts'
);
all('lifeRepository', [
  'assertPolicyAuthorizedRepositoryContext(context, {',
  "capability: 'family.read'",
  "capability: 'family.write'",
  "platformPolicyPersistenceBinding(context, 'life_record', row.id)",
  'WHERE family_id=?',
  'listAutomationDueLife',
  'listVisibleAutomationLifeRunSources',
  'getLifeReportProjection'
], 'LIFE repository binds exact authorization and projections');
check(count('lifeRepository', /WHERE family_id=\?/gu) >= 4, 'LIFE reads and projections are family-scoped');
all('migration', [
  'const lifePolicyReceiptFenceSql',
  'ADD COLUMN policy_receipt_hash',
  'ADD COLUMN policy_correlation_id',
  'ADD COLUMN policy_resource_type',
  'ADD COLUMN policy_resource_id',
  'ADD COLUMN policy_action',
  'ADD COLUMN policy_capability',
  'CREATE TRIGGER trg_platform_policy_life_record_insert',
  "receipt.capability='family.write'",
  "json_extract(receipt.record_json,'$.request.resource.familyId')=NEW.family_id",
  "json_extract(receipt.record_json,'$.request.resource.ownerPersonId')=NEW.owner_person_id",
  "json_extract(receipt.record_json,'$.request.resource.sensitivity')=CASE NEW.privacy",
  "json_extract(receipt.record_json,'$.request.purpose')='general'",
  'CREATE TRIGGER trg_platform_policy_life_record_update',
  'CREATE TRIGGER trg_platform_policy_life_record_delete',
  'GOVERNED_DELETION_WORKFLOW_REQUIRED',
  "createMigrationDefinition(65, 'life_policy_receipt_fence', lifePolicyReceiptFenceSql)"
], 'migration 65 binds exact LIFE receipt columns and triggers');
none('policyKernel', ["'life.read'", "'life.write'"], 'platform capability kernel has no LIFE literals');
none('policyPep', ["'life.read'", "'life.write'"], 'PEP valid set has no LIFE literals');

all('dataStore', [
  'const lifePolicyTransactionRunner = new RepositoryBackedLifePolicyTransactionRunner',
  'new RepositoryBackedAutomationAdapter({',
  'new RepositoryBackedReportQueryPort({',
  'transactionExecutor: this.#transactionExecutor',
  'lifePolicyTransactionRunner'
], 'data store shares the governed LIFE runner');
for (const channel of [
  'life:list',
  'life:create',
  'automation:list',
  'automation:create',
  'automation:toggle',
  'automation:runs',
  'automation:run',
  'reports:summary'
]) {
  check(source.ipcMain.includes("registerIpcHandler('" + channel + "', async"), 'IPC ' + channel + ' is explicitly async');
}

all('automationApplication', [
  'readonly actorRole: FamilyRole',
  'Promise<Result<readonly AutomationRunRecord[], AppError>>',
  'Promise<Result<number, AppError>>'
], 'automation contract is async with actual actor role');
all('automationContract', [
  'listNonLifeDueSources(',
  'listNonLifeRuns(',
  'listLifeRunCandidates('
], 'automation repository splits non-LIFE and LIFE candidates');
none('automationContract', ['insertGeneratedTask'], 'automation contract removes direct generated LIFE write');
none('automationRepository', ['life_records', 'INSERT INTO life_records'], 'automation repository contains no raw LIFE SQL');
all('automationRepository', [
  "source_type='life_record'",
  'const boundedLimit = Number.isInteger(input.limit)',
  'Math.min(Math.max(input.limit, 1), 500)',
  'ORDER BY created_at DESC,id DESC',
  'LIMIT ?'
], 'automation candidate query is keyset ordered and fail-safe bounded');
all('automationAdapter', [
  "capability: 'family.read'",
  "capability: 'family.write'",
  "resourceType: 'life_record'",
  "purpose: 'general'",
  'listVisibleAutomationLifeRunSources',
  'listAutomationDueLife',
  'insertLifeRecord(repository, {',
  "privacy: 'private'",
  "action: 'life_record.created'",
  "eventType: 'life.record.created'",
  "title: rule.sourceType === 'life_record' ? 'Yaşam kaydı' : source.title",
  'automationIdempotentNoop: true'
], 'automation uses governed LIFE projection and atomic write');
none('automationAdapter', ["'life.read'", "'life.write'", 'INSERT INTO life_records'], 'automation adapter uses family capabilities and no raw SQL');
all('automationAdapter', [
  'if (!context.actorPersonId)',
  'omit LIFE entirely without entering the LIFE PEP',
  'const pageSize = 200',
  'while (lifeRuns.length < limit)',
  'before = { createdAt: last.createdAt, id: last.id }'
], 'automation binds personless omission and starvation-safe paging');

all('reportApplication', ['readonly actorRole: FamilyRole', 'Promise<Result<ReportSummaryView, AppError>>'], 'report contract is async');
all('reportContract', ['getNonLifeSummary('], 'report repository exposes non-LIFE summary only');
none('reportRepository', ['life_records', 'FROM life_records'], 'report repository contains no raw LIFE SQL');
all('reportAdapter', [
  "capability: 'family.read'",
  "resourceType: 'life_record'",
  "purpose: 'general'",
  'if (!context.actorPersonId)',
  'getNonLifeSummary(',
  'getLifeReportProjection(',
  'activeTasks: 0',
  'overdueItems: []'
], 'report uses governed projection and personless LIFE omission');
none('reportAdapter', ["'life.read'", "'life.write'", 'FROM life_records'], 'report adapter has no invented capability or raw LIFE SQL');

check(count('lifeCrossSurfaceTest', /\bit\('/gu) === 2, 'LIFE cross-surface runtime declares two tests');
all('lifeCrossSurfaceTest', [
  '600',
  'FOREIGN_SECRET',
  'OTHER_PERSON_SECRET',
  'ARCHIVED_SECRET',
  'personless LIFE PEP must not execute',
  "fenceName: 'life-write'",
  "resource_id='task-retry'",
  'platform_policy_journal_projection_outbox',
  '{ limit: -1 }',
  'toHaveLength(1)',
  'replayStore',
  'reserveReplayNonce'
], 'LIFE runtime covers privacy, receipt atomicity, retry and bounded paging');
check(count('healthCrossSurfaceTest', /\bit\('/gu) === 2, '30-X cross-projection regression retains two tests');
check(
  firstFailure.step === '30-Y'
    && firstFailure.status === 'FAIL'
    && firstFailure.countsAsPass === false
    && firstFailure.processExitCode !== 0
    && firstFailure.realExitCodeObserved === true
    && firstFailure.tests?.passed === 1
    && firstFailure.tests?.failed === 1,
  'first cross-surface failure remains FAIL and not PASS'
);
check(
  cleanCrossSurface.step === '30-Y'
    && cleanCrossSurface.status === 'PASS'
    && cleanCrossSurface.processExitCode === 0
    && cleanCrossSurface.realExitCodeObserved === true
    && cleanCrossSurface.tests?.passed === 2
    && cleanCrossSurface.tests?.failed === 0,
  'clean cross-surface validation is 2/2 PASS'
);
check(
  cleanHealthRegression.status === 'PASS'
    && cleanHealthRegression.processExitCode === 0
    && cleanHealthRegression.realExitCodeObserved === true
    && cleanHealthRegression.tests?.passed === 12
    && cleanHealthRegression.tests?.failed === 0,
  '30-X targeted successor runtime regression is 12/12 PASS'
);
check(
  cleanTypechecks.status === 'PASS'
    && cleanTypechecks.processExpected === 5
    && cleanTypechecks.processPassed === 5
    && cleanTypechecks.processFailed === 0
    && cleanTypechecks.commands?.every((command) =>
      command.processExitCode === 0 && command.realExitCodeObserved === true),
  'all five relevant Worker C typechecks have real exit code 0'
);
check(
  lifeUseCaseManifest.status === 'passed'
    && lifeUseCaseManifest.checks === 10
    && lifeUseCaseManifest.passed === 10
    && lifeUseCaseManifest.failed === 0
    && lifeUseCaseManifest.exactCountersMatch === true,
  'LIFE use-case manifest uses canonical historical status and exact 10/10 counters'
);
check(
  preservedFailureFiles.includes('30-Y_30-X_HEALTH_SUCCESSOR_REGRESSION_ATTEMPT_1_FAILURE.json')
    && preservedFailureFiles.includes('30-Y_30-X_HEALTH_SUCCESSOR_REGRESSION_ATTEMPT_2_FAILURE.json')
    && preservedFailureFiles.includes('30-Y_CROSS_SURFACE_RUNTIME_ATTEMPT_1_FAILURE.json'),
  'all Worker C nonzero attempts remain separately preserved'
);
check(
  preservedFailures.every(({ value }) =>
    value.status === 'FAIL'
      && value.countsAsPass === false
      && value.processExitCode !== 0
      && value.realExitCodeObserved === true),
  'every preserved 30-Y failure has a real nonzero exit and does not count as PASS'
);

const utf8OwnedKeys = [
  'automationApplication',
  'automationContract',
  'automationRepository',
  'automationAdapter',
  'reportApplication',
  'reportContract',
  'reportRepository',
  'reportAdapter',
  'lifeCrossSurfaceTest',
  'healthPolicyTest',
  'healthCrossSurfaceTest',
  'healthVerifier',
  'lifeVerifier',
  'contractSelf'
];
const badCodePoints = new Set([0x00c3, 0x00c4, 0x00c5, 0xfffd]);
check(
  utf8OwnedKeys.every((key) => [...source[key]].every((character) => !badCodePoints.has(character.codePointAt(0)))),
  'all Worker C TypeScript and verifier files are free of raw mojibake sentinels',
  { paths: utf8OwnedKeys.map((key) => paths[key]) }
);

check(scope.evidenceBoundary?.PPK002 === 'PARTIAL', 'PPK-002 remains PARTIAL');
check(scope.evidenceBoundary?.universalRepositoryEnforcement === 'NOT_COMPLETE', 'universal enforcement remains open');
check(scope.evidenceBoundary?.locationPolicyEnforcementVerticalSlice === 'NOT_COMPLETE', 'location enforcement remains open');
check(scope.evidenceBoundary?.timelineEventPolicyEnforcementVerticalSlice === 'NOT_COMPLETE', 'timeline-event enforcement remains open');
check(
  scope.evidenceBoundary?.lifeDeleteAndPurgeWorkflow === 'NOT_COMPLETE_GOVERNED_DELETION_WORKFLOW_REQUIRED',
  'LIFE delete and purge remain separately governed'
);
check(scope.evidenceBoundary?.dashboardLifeCrossSurface === 'NOT_COMPLETE', 'dashboard LIFE projection remains open');
check(scope.evidenceBoundary?.dataLifecycleLifeCrossSurface === 'NOT_COMPLETE', 'data-lifecycle LIFE surface remains open');
check(
  statusReport.bronzeCompletedPercent === 25.0
    && statusReport.silverStatus === 'FORBIDDEN_NOT_READY'
    && statusReport.goldStatus === 'FORBIDDEN_NOT_READY'
    && statusReport.nativeInteractiveWindowsHello === 'NOT_RUN_NOT_PASS'
    && statusReport.installerBuild === 'NOT_RUN_NOT_PASS'
    && statusReport.officialCompletionClaimed === false,
  'progress and hardware boundaries remain fail-closed'
);
check(
  packageJson.scripts?.['verify:30-y:life-policy-enforcement-contract'] === 'node scripts/verify-30-y-life-policy-enforcement-contract.mjs'
    && packageJson.scripts?.['verify:30-y:life-cross-projection-privacy-runtime'] === 'vitest run apps/desktop/tests/life-cross-projection-privacy-runtime.test.ts'
    && packageJson.scripts?.['verify:30-y:30-x-health-regression'] === 'node scripts/verify-30-x-health-policy-enforcement-contract.mjs --successor-regression'
    && packageJson.scripts?.['verify:life'] === 'node scripts/verify-life-use-cases.mjs',
  'package exposes the governed 30-Y gates'
);

const status = failures.length === 0 ? 'PASS' : 'FAIL';
const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-Y',
  requirement: 'PPK-002',
  phase: 'GOVERNED_LIFE_POLICY_ENFORCEMENT_CONTRACT',
  status,
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  preservedFailedAttempts: preservedFailureFiles.length,
  preservedFailureFiles,
  failedAttemptsCountedAsPass: 0,
  policySemantics: {
    readCapability: 'family.read',
    createCapability: 'family.write',
    resourceType: 'life_record',
    purpose: 'general',
    inventedLifeCapabilitiesUsed: false
  },
  evidenceBoundary: {
    ...scope.evidenceBoundary,
    lifePolicyEnforcementVerticalSlice: status === 'PASS' ? 'TARGETED_CONTRACT_PASS' : 'TARGETED_NOT_YET_PASS',
    crossSurfaceLifeAutomationAndReportPrivacy: status === 'PASS' ? 'TARGETED_CONTRACT_PASS' : 'TARGETED_NOT_YET_PASS'
  },
  PPK002: 'PARTIAL',
  bronzeCompletedPercent: 25.0,
  silverStatus: 'FORBIDDEN_NOT_READY',
  goldStatus: 'FORBIDDEN_NOT_READY',
  nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS',
  installerBuild: 'NOT_RUN_NOT_PASS',
  officialCompletionClaimed: false,
  persistentReceiptStatus: 'PENDING',
  generatedAt: new Date().toISOString(),
  mandatoryTruthSentence: TRUTH
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
if (status !== 'PASS') {
  console.error('30-Y LIFE policy enforcement contract: FAIL (' + failures.length + '/' + checks.length + ').');
  console.error(failures.join('\n'));
  console.error(TRUTH);
  process.exit(1);
}
console.log('30-Y LIFE policy enforcement contract: PASS (' + checks.length + '/' + checks.length + '; PPK-002 remains PARTIAL; persistent receipt PENDING).');
console.log(TRUTH);
