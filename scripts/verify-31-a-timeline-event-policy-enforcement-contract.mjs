import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const reportPath = 'artifacts/validation/31-A_TIMELINE_EVENT_POLICY_ENFORCEMENT_CONTRACT.json';
const paths = {
  completion30Z: 'artifacts/checkpoints/30-Z_COMPLETION_RECORD.json',
  receipt30Z: 'artifacts/checkpoints/30-Z_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-A_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  priority: 'artifacts/validation/31-A_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/31-a-timeline-event-policy-enforcement-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  execution: 'artifacts/checkpoints/31-A_EXECUTION_RECORD.json',
  runtime: 'artifacts/validation/PPK002_TIMELINE_POLICY_LOCAL_CONTINUATION.json',
  regression: 'artifacts/validation/PPK002_TIMELINE_FULL_REGRESSION.json',
  migration: 'packages/database/src/family-database-migrations.ts',
  useCase: 'packages/application/src/timeline-use-cases.ts',
  repository: 'packages/repositories/src/timeline-repository.ts',
  adapter: 'apps/desktop/src/main/timeline-application-adapter.ts',
  runtimeSource: 'apps/desktop/src/main/timeline-production-policy-runtime.ts',
  importService: 'apps/desktop/src/main/family-data-import-service.ts',
  packageJson: 'package.json'
};
const jsonKeys = new Set(['completion30Z', 'receipt30Z', 'authority', 'priority', 'scope', 'plan', 'ledger', 'registry', 'execution', 'runtime', 'regression', 'packageJson']);
const documents = {};
for (const [key, path] of Object.entries(paths)) {
  const text = await readFile(resolve(root, path), 'utf8');
  documents[key] = jsonKeys.has(key) ? JSON.parse(text) : text;
}

const checks = [];
const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const { completion30Z, receipt30Z, authority, priority, scope, plan, ledger, registry, execution, runtime, regression } = documents;
const step31A = plan.steps?.find((step) => step.id === '31-A');
const step30Z = plan.steps?.find((step) => step.id === '30-Z');
const step31B = plan.steps?.find((step) => step.id === '31-B');
const step31C = plan.steps?.find((step) => step.id === '31-C');
const step31D = plan.steps?.find((step) => step.id === '31-D');
const step31E = plan.steps?.find((step) => step.id === '31-E');
const step31F = plan.steps?.find((step) => step.id === '31-F');
const activeSteps = plan.steps?.filter((step) => step.status === 'IN_PROGRESS') ?? [];
const ppk002 = registry.requirements?.find((item) => item.id === 'PPK-002');
const completed31A = step31A?.status === 'COMPLETED'
  && step31A.validationStatus === 'PASS'
  && step31A.persistentReceiptStatus === 'PASS'
  && step31A.persistentReceiptPath === 'artifacts/checkpoints/31-A_LIBRARY_RECEIPT.json';
const inProgress31A = step31A?.status === 'IN_PROGRESS' && step31A.persistentReceiptStatus === 'PENDING';
const successor31BActive = plan.currentStep === '31-B' && activeSteps.length === 1 && activeSteps[0]?.id === '31-B' && activeSteps[0]?.persistentReceiptStatus === 'PENDING';
const successor31BCompleted = plan.currentStep === '31-B' && activeSteps.length === 0 && step31B?.status === 'COMPLETED' && step31B.persistentReceiptStatus === 'PASS';
const successor31CActive = plan.currentStep === '31-C' && activeSteps.length === 1 && activeSteps[0]?.id === '31-C' && activeSteps[0]?.persistentReceiptStatus === 'PENDING' && step31B?.status === 'COMPLETED';
const successor31CCompleted = plan.currentStep === '31-C' && activeSteps.length === 0 && step31B?.status === 'COMPLETED' && step31C?.status === 'COMPLETED' && step31C.persistentReceiptStatus === 'PASS';
const successor31DCompleted = plan.currentStep === '31-D' && activeSteps.length === 0 && step31C?.status === 'COMPLETED' && step31D?.status === 'COMPLETED' && step31D.persistentReceiptStatus === 'PASS';
const successor31ECompleted = plan.currentStep === '31-E' && activeSteps.length === 0 && step31D?.status === 'COMPLETED' && step31E?.status === 'COMPLETED' && step31E.persistentReceiptStatus === 'PASS';
const successor31FCompleted = plan.currentStep === '31-F' && activeSteps.length === 0 && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });

check(completion30Z.status === 'PASS' && completion30Z.officialStepStatus === 'COMPLETED', '30-Z predecessor completion is PASS');
check(receipt30Z.status === 'PASS' && receipt30Z.persistentReceiptStatus === 'PASS', '30-Z predecessor receipt is PASS');
check(step30Z?.status === 'COMPLETED' && step30Z.persistentReceiptStatus === 'PASS', 'work plan preserves completed 30-Z');
check(authority.step === '31-A' && authority.status === 'PASS' && authority.selectedOpenFinding === 'TIMELINE_EVENT_POLICY_ENFORCEMENT_VERTICAL_SLICE', '31-A authority selects exact timeline slice');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, '31-A priority selection checks are PASS');
check(scope.step === '31-A' && scope.requirement === 'PPK-002' && scope.decision === 'DEC-159', '31-A scope identity is exact');
check(scope.targets?.migration === 67 && scope.targets?.resourceType === 'event' && scope.targets?.governedProjection === 'governed_timeline_events', '31-A scope binds migration and event projection');
check(scope.targets?.writeFence === 'timeline-event-write' && scope.targets?.sourceLocationReceipt === 'location.read', '31-A scope binds write and source-location receipts');
check((plan.currentStep === '31-A' && (inProgress31A || completed31A)) || (completed31A && (successor31BActive || successor31BCompleted || successor31CActive || successor31CCompleted || successor31DCompleted || successor31ECompleted || successor31FCompleted || laterSuccessor.planValid)), '31-A has a valid lifecycle through authorized successors');
check(activeSteps.length === (inProgress31A || successor31BActive || successor31CActive || laterSuccessor.active ? 1 : 0), 'work plan active-step count matches 31-A successor lifecycle');
check(
  (inProgress31A && ledger.activeMicroStep === '31-A' && String(ledger.nextOfficialTask).startsWith('31-A'))
  || (completed31A && plan.currentStep === '31-A' && ledger.activeMicroStep === null && ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-A_PERSISTENT_RECEIPT')
  || (successor31BActive && ledger.activeMicroStep === '31-B' && String(ledger.nextOfficialTask).startsWith('31-B'))
  || (successor31BCompleted && ledger.activeMicroStep === null && ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-B_PERSISTENT_RECEIPT')
  || (successor31CActive && ledger.activeMicroStep === '31-C' && String(ledger.nextOfficialTask).startsWith('31-C'))
  || (successor31CCompleted && ledger.activeMicroStep === null && ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-C_PERSISTENT_RECEIPT')
  || (successor31DCompleted && ledger.activeMicroStep === null && ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-D_PERSISTENT_RECEIPT')
  || (successor31ECompleted && ledger.activeMicroStep === null && ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-E_PERSISTENT_RECEIPT')
  || (successor31FCompleted && ledger.activeMicroStep === null && ledger.nextOfficialTask === 'AUTO_PRIORITY_SELECTION_AFTER_31-F_PERSISTENT_RECEIPT')
  || (laterSuccessor.ledgerValid && laterSuccessor.nextTaskValid),
  'governance ledger matches 31-A lifecycle'
);
check(
  (inProgress31A && ['31-A_IN_PROGRESS_PREDECESSOR_30-Z_RECEIPT_CHAIN_PASS', '31-A_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger.libraryUploadStatus))
  || (completed31A && plan.currentStep === '31-A' && ledger.libraryUploadStatus === '31-A_COMPLETED_RECEIPT_PASS')
  || (successor31BActive && ['31-B_IN_PROGRESS_PREDECESSOR_31-A_RECEIPT_CHAIN_PASS', '31-B_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger.libraryUploadStatus))
  || (successor31BCompleted && ledger.libraryUploadStatus === '31-B_COMPLETED_RECEIPT_PASS')
  || (successor31CActive && ['31-C_IN_PROGRESS_PREDECESSOR_31-B_RECEIPT_CHAIN_PASS', '31-C_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger.libraryUploadStatus))
  || (successor31CCompleted && ledger.libraryUploadStatus === '31-C_COMPLETED_RECEIPT_PASS')
  || (successor31DCompleted && ledger.libraryUploadStatus === '31-D_COMPLETED_RECEIPT_PASS')
  || (successor31ECompleted && ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS')
  || (successor31FCompleted && ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS')
  || laterSuccessor.ledgerValid,
  'ledger distinguishes predecessor, pending and completed 31-A receipt states'
);
check(ppk002?.priority === 'P0' && (ppk002.status === 'PARTIAL' || (ppk002.status === 'COMPLETE' && Object.values(ppk002.chain ?? {}).every((value) => value === true))), 'PPK-002 remains P0 or has a fully closed successor chain');
check(
  execution.step === '31-A'
  && ((inProgress31A && String(execution.officialStepStatus).startsWith('IN_PROGRESS') && execution.persistentReceiptStatus === 'PENDING')
    || (completed31A && execution.officialStepStatus === 'COMPLETED' && execution.persistentReceiptStatus === 'PASS')),
  '31-A execution record matches receipt lifecycle'
);

check(runtime.status === 'PASS' && runtime.checkCount === 14 && runtime.checks?.length === 14, 'fresh controlled SQLite runtime is 14/14 PASS');
check(runtime.external30ZReceipt === 'PASS' && runtime.officialBuildClaim === false, 'runtime evidence reflects predecessor receipt and no Build');
check(regression.status === 'PASS' && regression.testFilePassCount === regression.testFileCount && regression.testPassCount === regression.testCount, 'full regression evidence is clean PASS');
check(regression.testFileCount === 28 && regression.testCount === 158, 'full regression evidence binds 28 files and 158 tests');

check(documents.migration.includes("createMigrationDefinition(67, 'local_ppk002_timeline_event_policy_receipt_fence'"), 'migration 67 is registered');
check(documents.migration.includes('CREATE VIEW governed_timeline_events AS'), 'migration creates governed timeline projection');
check(documents.migration.includes('timeline event insert requires an exact durable event policy receipt'), 'SQLite insert fence is fail-closed');
check(documents.migration.includes('timeline event update requires a fresh exact durable event policy receipt'), 'SQLite update fence requires a fresh receipt');
check(documents.migration.includes('GOVERNED_TIMELINE_EVENT_DELETION_WORKFLOW_REQUIRED'), 'SQLite delete fence preserves governed deletion boundary');
check(documents.useCase.includes("resourceType: 'event'") && documents.useCase.includes("capability: 'family.write'"), 'timeline use cases emit exact event policy intents');
check(documents.repository.includes("resourceType: 'event'") && documents.repository.includes('PolicyAuthorizedRepositoryExecutionContext'), 'timeline repository requires policy-authorized context');
check(documents.adapter.includes("resourceType: 'event'") && documents.adapter.includes('sourceLocationReceiptHash'), 'timeline adapter binds event and source-location receipts');
check(documents.runtimeSource.includes("const TIMELINE_POLICY_FENCE_NAME = 'timeline-event-write'"), 'production runtime uses exact timeline fence');
check(documents.importService.includes('timelineRepository.insert(governedRepository') && !documents.importService.includes('timelineRepository.insert(repository'), 'family import has only receipt-authorized timeline write path');

for (const reader of [
  'automation-repository.ts', 'ai-consent-repository.ts', 'dashboard-repository.ts',
  'entity-catalog-repository.ts', 'genealogy-repository.ts',
  'large-family-read-model-repository.ts', 'report-repository.ts'
]) {
  const source = await readFile(resolve(root, 'packages/repositories/src', reader), 'utf8');
  check(source.includes('governed_timeline_events'), `${reader} uses governed timeline projection`);
}
check(documents.packageJson.scripts?.['verify:31-a:timeline-policy-contract'] === 'node scripts/verify-31-a-timeline-event-policy-enforcement-contract.mjs', 'package exposes 31-A contract gate');
check(scope.openBoundaries?.PPK002 === 'PARTIAL' && scope.openBoundaries?.universalRepositoryEnforcement === 'NOT_COMPLETE', '31-A preserves PPK-002 and universal enforcement boundaries');
check(scope.newBuildIssued === false, '31-A issues no new Build');

const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-A', requirement: 'PPK-002',
  phase: 'TIMELINE_EVENT_POLICY_ENFORCEMENT_CONTRACT', status: failures.length === 0 ? 'PASS' : 'FAIL',
  expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length,
  checks, failures: failures.map((item) => item.name), controlledRuntimeChecks: runtime.checkCount,
  fullRegression: { files: regression.testFileCount, tests: regression.testCount, status: regression.status },
  PPK002: 'PARTIAL', persistentReceiptStatus: completed31A ? 'PASS' : 'PENDING', officialCompletionClaimed: completed31A,
  newBuildIssued: false, generatedAt: new Date().toISOString()
};
await mkdir(dirname(resolve(root, reportPath)), { recursive: true });
await writeFile(resolve(root, reportPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failures.length > 0) {
  console.error(`31-A timeline-event Policy Enforcement contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure.name}`);
  process.exit(1);
}
console.log(`31-A timeline-event Policy Enforcement contract: PASS (${checks.length}/${checks.length}; runtime 14/14; PPK-002 PARTIAL; receipt ${completed31A ? 'PASS' : 'PENDING'}).`);
