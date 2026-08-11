import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const jsonPaths = {
  completion31B: 'artifacts/checkpoints/31-B_COMPLETION_RECORD.json',
  receipt31B: 'artifacts/checkpoints/31-B_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-C_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  priority: 'artifacts/validation/31-C_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/31-c-family-import-multi-policy-receipt-batch-scope.json',
  plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json', execution: 'artifacts/checkpoints/31-C_EXECUTION_RECORD.json', packageJson: 'package.json'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(jsonPaths).map(async ([key, path]) => [key, JSON.parse(await readFile(resolve(root, path), 'utf8'))])));
const read = async (path) => readFile(resolve(root, path), 'utf8');
const [batchRunner, service, locationAdapter, timelineAdapter, composition, repositoryContract, repository, regression] = await Promise.all([
  read('apps/desktop/src/main/family-data-import-policy-batch-runner.ts'),
  read('apps/desktop/src/main/family-data-import-service.ts'),
  read('apps/desktop/src/main/location-application-adapter.ts'),
  read('apps/desktop/src/main/timeline-application-adapter.ts'),
  read('apps/desktop/src/main/data-store.ts'),
  read('packages/repository-contracts/src/family-data-import-repository.ts'),
  read('packages/repositories/src/family-data-import-repository.ts'),
  read('apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts')
]);
const checks = [];
const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const { completion31B, receipt31B, authority, priority, scope, plan, ledger, registry, execution, packageJson } = documents;
const step31C = plan.steps.find((item) => item.id === '31-C');
const step31D = plan.steps.find((item) => item.id === '31-D');
const step31E = plan.steps.find((item) => item.id === '31-E');
const step31F = plan.steps.find((item) => item.id === '31-F');
const step31B = plan.steps.find((item) => item.id === '31-B');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
const completed31C = step31C?.status === 'COMPLETED' && step31C.validationStatus === 'PASS' && step31C.persistentReceiptStatus === 'PASS';
const inProgress31C = step31C?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(step31C.validationStatus) && step31C.persistentReceiptStatus === 'PENDING';
const successor31DCompleted = plan.currentStep === '31-D' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0
  && step31D?.status === 'COMPLETED' && step31D.persistentReceiptStatus === 'PASS';
const successor31ECompleted = plan.currentStep === '31-E' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0
  && step31D?.status === 'COMPLETED' && step31E?.status === 'COMPLETED' && step31E.persistentReceiptStatus === 'PASS';
const successor31FCompleted = plan.currentStep === '31-F' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0
  && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });

check(completion31B.status === 'PASS' && completion31B.officialStepStatus === 'COMPLETED', '31-B predecessor completion is PASS');
check(receipt31B.status === 'PASS' && receipt31B.persistentReceiptStatus === 'PASS', '31-B predecessor receipt is PASS');
check(step31B.status === 'COMPLETED' && step31B.persistentReceiptStatus === 'PASS', 'work plan preserves completed 31-B');
check(authority.step === '31-C' && authority.status === 'PASS' && authority.selectedOpenFinding === 'FAMILY_DATA_IMPORT_MULTI_RECEIPT_BATCH', '31-C authority selects exact multi-receipt slice');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, '31-C priority selection is PASS');
check(scope.step === '31-C' && scope.decision === 'DEC-161' && scope.supportedRows.createdLocations === 'GOVERNED_ATOMIC_BATCH', '31-C scope identity is exact');
check((plan.currentStep === '31-C' && (inProgress31C || completed31C)) || (completed31C && (successor31DCompleted || successor31ECompleted || successor31FCompleted || laterSuccessor.planValid)), '31-C has a valid pending or completed receipt lifecycle');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === (laterSuccessor.active || !completed31C ? 1 : 0), 'work plan active-step count matches 31-C lifecycle');
check(
  (inProgress31C && ledger.activeMicroStep === '31-C' && ['31-C_IN_PROGRESS_PREDECESSOR_31-B_RECEIPT_CHAIN_PASS', '31-C_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger.libraryUploadStatus))
  || (completed31C && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-C_COMPLETED_RECEIPT_PASS')
  || (successor31DCompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-D_COMPLETED_RECEIPT_PASS')
  || (successor31ECompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS')
  || (successor31FCompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS')
  || laterSuccessor.ledgerValid,
  'ledger matches pending or completed 31-C receipt lifecycle'
);
check(ppk002.priority === 'P0' && (ppk002.status === 'PARTIAL' || (ppk002.status === 'COMPLETE' && Object.values(ppk002.chain ?? {}).every((value) => value === true))), 'PPK-002 remains P0 or has a fully closed successor chain');
check(execution.step === '31-C' && ((inProgress31C && String(execution.officialStepStatus).startsWith('IN_PROGRESS') && execution.persistentReceiptStatus === 'PENDING') || (completed31C && execution.officialStepStatus === 'COMPLETED' && execution.persistentReceiptStatus === 'PASS')), '31-C execution record matches receipt lifecycle');
check(locationAdapter.includes('GovernedLocationPolicyAuthorizationLease') && locationAdapter.includes('public authorize<T>(') && locationAdapter.includes('establish: (transaction)'), 'location runner exposes a transaction-independent authorization lease');
check(timelineAdapter.includes('GovernedTimelinePolicyAuthorizationLease') && timelineAdapter.includes('public authorize<T>(') && timelineAdapter.includes('establish: (transaction)'), 'timeline runner exposes a transaction-independent authorization lease');
check(batchRunner.includes('locationRunner.authorize') && batchRunner.includes('timelineRunner.authorize'), 'batch runner preauthorizes both policy kinds');
check(batchRunner.includes('keys.size !== requests.length') && batchRunner.includes("request.key.trim().length === 0"), 'batch request keys are unique and non-empty');
check(batchRunner.includes('transactionExecutor.execute(correlationId') && batchRunner.match(/transactionExecutor\.execute\(/gu)?.length === 1, 'batch runner opens exactly one transaction boundary');
check(batchRunner.indexOf('entry.lease.establish(transaction)') < batchRunner.indexOf('const result = operation({ transaction, repositories })'), 'all receipt leases establish before import operation');
check(service.includes('parseSourceDocument(sourceText, Boolean(this.dependencies.policyBatchRunner && this.dependencies.locationRepository))'), 'location parsing requires production batch composition');
check(service.includes("key: `location:${row.targetId}`") && service.includes("kind: 'location'") && service.includes("resourceType: 'location'"), 'created location rows receive exact governed requests');
check(service.includes("key: `event:${row.targetId}`") && service.includes("kind: 'event'") && service.includes("resourceType: 'event'"), 'created event rows receive exact governed requests');
check(service.includes("importCorrelation(context.correlationId, 'location'") && service.includes("importCorrelation(context.correlationId, 'event'"), 'governed rows receive deterministic unique child correlations');
check(service.includes('locationRepository.insert(governedRepository') && service.includes('timelineRepository.insert(governedRepository'), 'governed repositories receive only request-bound contexts');
check(service.includes('import.event_location_policy_batch_required') && service.includes('kaynak-konum read makbuzu') && service.includes("kind: 'created-location-read'"), 'location-linked import preserves batch requirement and governed created-location dependency');
check(repositoryContract.includes('FamilyDataImportExistingLocationRecord') && repositoryContract.includes('readonly locations:'), 'import repository contract includes existing locations');
check(repository.includes("SELECT id,label,kind FROM locations WHERE family_id=?") && repository.includes('locations: locations.map'), 'SQLite import repository loads reusable location identity');
check(composition.includes('RepositoryBackedFamilyDataImportPolicyBatchRunner') && composition.includes('locationRunner: locationPolicyTransactionRunner') && composition.includes('timelineRunner: timelinePolicyTransactionRunner') && composition.includes('policyBatchRunner: familyDataImportPolicyBatchRunner'), 'production composition binds the shared batch runner');
check(regression.includes("trace).toEqual") && regression.includes("fails closed before the import operation") && regression.includes("imports created locations and locationless events"), 'runtime regression covers atomic order, fail-closed and service integration');
check(packageJson.scripts['verify:31-c:family-import-policy-batch-contract'] === 'node scripts/verify-31-c-family-import-multi-policy-receipt-batch-contract.mjs', 'package exposes 31-C contract gate');
check(scope.openBoundaries.PPK002 === 'PARTIAL' && scope.openBoundaries.importedEventLocationReadReceiptChain === 'NOT_COMPLETE_FAIL_CLOSED' && scope.openBoundaries.governedImportRollbackReceiptFence === 'NOT_COMPLETE', '31-C preserves explicit open boundaries');
check(scope.newBuildIssued === false, '31-C issues no new Build');

const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-C', requirement: 'PPK-002', phase: 'FAMILY_IMPORT_MULTI_POLICY_RECEIPT_BATCH_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length,
  checks, failures: failures.map((item) => item.name), PPK002: 'PARTIAL', persistentReceiptStatus: completed31C ? 'PASS' : 'PENDING',
  officialCompletionClaimed: completed31C, newBuildIssued: false, generatedAt: new Date().toISOString()
};
const reportPath = resolve(root, 'artifacts/validation/31-C_FAMILY_IMPORT_MULTI_POLICY_RECEIPT_BATCH_CONTRACT.json');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failures.length) {
  console.error(`31-C family import multi-policy receipt batch contract: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-C family import multi-policy receipt batch contract: PASS (${checks.length}/${checks.length}; PPK-002 PARTIAL; receipt ${completed31C ? 'PASS' : 'PENDING'}).`);
