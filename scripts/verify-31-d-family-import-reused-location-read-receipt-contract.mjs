import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const paths = {
  predecessorCompletion: 'artifacts/checkpoints/31-C_COMPLETION_RECORD.json',
  predecessorReceipt: 'artifacts/checkpoints/31-C_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-D_AUTO_PRIORITY_SELECTION_AUTHORITY.json',
  priority: 'artifacts/validation/31-D_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/31-d-family-import-reused-location-read-receipt-scope.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json',
  execution: 'artifacts/checkpoints/31-D_EXECUTION_RECORD.json',
  packageJson: 'package.json'
};
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const docs = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path)])));
const read = async (path) => readFile(resolve(root, path), 'utf8');
const [service, batchRunner, locationAdapter, timelineAdapter, composition, timelineContract, timelineRepository, regression] = await Promise.all([
  read('apps/desktop/src/main/family-data-import-service.ts'),
  read('apps/desktop/src/main/family-data-import-policy-batch-runner.ts'),
  read('apps/desktop/src/main/location-application-adapter.ts'),
  read('apps/desktop/src/main/timeline-application-adapter.ts'),
  read('apps/desktop/src/main/data-store.ts'),
  read('packages/repository-contracts/src/timeline-repository.ts'),
  read('packages/repositories/src/timeline-repository.ts'),
  read('apps/desktop/tests/family-data-import-location-read-receipt-runtime.test.ts')
]);
const checks = [];
const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const { predecessorCompletion, predecessorReceipt, authority, priority, scope, plan, ledger, registry, execution, packageJson } = docs;
const step = plan.steps.find((item) => item.id === '31-D');
const step31E = plan.steps.find((item) => item.id === '31-E');
const step31F = plan.steps.find((item) => item.id === '31-F');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
const completed = step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS';
const pending = step?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(step.validationStatus) && step.persistentReceiptStatus === 'PENDING';
const successor31ECompleted = plan.currentStep === '31-E' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0 && completed && step31E?.status === 'COMPLETED' && step31E.persistentReceiptStatus === 'PASS';
const successor31FCompleted = plan.currentStep === '31-F' && plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === 0 && completed && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });
const createdLocationBoundaryCompleted = successor31FCompleted || laterSuccessor.planValid;

check(predecessorCompletion.status === 'PASS' && predecessorCompletion.officialStepStatus === 'COMPLETED', '31-C predecessor completion is PASS');
check(predecessorReceipt.status === 'PASS' && predecessorReceipt.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-C predecessor has D: receipt');
check(authority.step === '31-D' && authority.status === 'PASS' && authority.selectedOpenFinding === 'IMPORTED_EVENT_LOCATION_READ_RECEIPT_CHAIN', 'authority selects exact 31-D slice');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, 'priority selection is clean PASS');
check(scope.step === '31-D' && scope.decision === 'DEC-163' && scope.targets.sourceLocationResolution === 'REUSED_EXISTING_LOCATION_ONLY', 'scope identity and reused-only boundary are exact');
check((plan.currentStep === '31-D' && (pending || completed)) || successor31ECompleted || successor31FCompleted || laterSuccessor.planValid, 'work plan has a valid 31-D lifecycle');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === (laterSuccessor.active || !completed ? 1 : 0), 'active-step count matches lifecycle');
check((pending && ledger.activeMicroStep === '31-D') || (completed && plan.currentStep === '31-D' && ledger.activeMicroStep === null) || (successor31ECompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS') || (successor31FCompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS') || laterSuccessor.ledgerValid, 'ledger matches lifecycle');
check(ppk002.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 remains P0 PARTIAL');
check(execution.step === '31-D' && execution.persistentReceiptStatus === (completed ? 'PASS' : 'PENDING'), 'execution record matches receipt lifecycle');
check(service.includes("kind: 'location-read'") || service.includes("kind: 'location' | 'location-read' | 'event'"), 'correlation namespace supports location-read');
check(service.includes('targetLocationId?: string') && service.includes('targetLocationResolution?: Resolution'), 'plan carries target location identity and resolution');
check(service.includes('plannedLocationsBySource.get(record.locationId)') && service.includes('targetLocationId: targetLocation.targetId'), 'source location maps to planned target identity');
check(createdLocationBoundaryCompleted
  ? service.includes("kind: 'created-location-read'") && !service.includes('import.event_new_location_policy_chain_required')
  : service.includes('import.event_new_location_policy_chain_required') && service.includes("targetLocation?.resolution === 'created'"),
  'new-location-linked event follows its receipt-bounded successor lifecycle');
check(service.includes("key: `event-location-read:${row.targetId}`") && service.includes("capability: 'location.read'"), 'exact location-read request is present');
check(service.includes("resourceType: 'location'") && service.includes('resourceId: row.targetLocationId!'), 'location-read request binds exact target location');
check(service.includes("importCorrelation(context.correlationId, 'location-read'"), 'location read receives deterministic child correlation');
check(service.includes("resourceType: 'event'") && service.includes('sourceResourceId: row.targetLocationId'), 'event write intent binds source location');
check(service.includes("policyRepositories.get(`event-location-read:${row.targetId}`)"), 'transaction resolves exact request-bound repository');
check(createdLocationBoundaryCompleted
  ? !service.includes("row.targetLocationResolution !== 'reused'") && service.includes('createKey: `location:${row.targetLocationId}`')
  : service.includes("row.targetLocationResolution !== 'reused'"),
  'apply path matches the historical or completed successor location boundary');
check(service.includes('locationRepository.findById(locationReadRepository, context.familyId, row.targetLocationId)'), 'location is re-read through governed repository');
check(service.includes('found.value.familyId !== context.familyId'), 'governed read rechecks family ownership');
check(service.includes('computePlatformPolicyReceiptHash(locationReadRepository.policyAuthorization.receiptRecord.receipt)'), 'exact read receipt hash is computed');
check(service.includes('sourceLocationReceiptHash: locationBinding.receiptHash'), 'receipt hash is persisted on event');
check(timelineContract.includes('readonly sourceLocationReceiptHash?: string') && timelineContract.includes('findById('), 'timeline contract exposes receipt projection and exact read');
check(timelineRepository.includes('source_location_receipt_hash') && timelineRepository.includes('event.sourceLocationReceiptHash ?? null'), 'SQLite timeline repository persists receipt hash');
check(batchRunner.includes('transactionExecutor.execute(correlationId') && batchRunner.includes('const result = operation({ transaction, repositories })'), 'batch runner uses one governed transaction');
check(locationAdapter.includes('public authorize<T>(') && timelineAdapter.includes('public authorize<T>('), 'policy runners expose preauthorization leases');
check(composition.includes('RepositoryBackedFamilyDataImportPolicyBatchRunner') && composition.includes('policyBatchRunner: familyDataImportPolicyBatchRunner'), 'production composition binds batch runner');
check(regression.includes('event-location-read:') && regression.includes('sourceLocationReceiptHash') && regression.includes('computePlatformPolicyReceiptHash'), 'runtime test asserts exact receipt binding');
check(createdLocationBoundaryCompleted ? regression.includes("'created-location-read'") : regression.includes('import.event_new_location_policy_chain_required'), 'runtime test asserts the active new-location boundary');
check(packageJson.scripts['verify:31-d:family-import-location-read-contract'] === 'node scripts/verify-31-d-family-import-reused-location-read-receipt-contract.mjs', 'package exposes contract gate');
check(scope.openBoundaries.newlyCreatedLocationLinkedEventImport === 'NOT_COMPLETE_FAIL_CLOSED' && scope.openBoundaries.governedImportRollbackReceiptFence === 'NOT_COMPLETE', 'open boundaries remain explicit');
check(scope.PPK002 === 'PARTIAL' && scope.newBuildIssued === false, 'requirement and Build boundary remain honest');

const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-D', requirement: 'PPK-002',
  phase: 'FAMILY_IMPORT_REUSED_LOCATION_READ_RECEIPT_CONTRACT', status: failures.length ? 'FAIL' : 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length,
  checks, failures: failures.map((item) => item.name), PPK002: 'PARTIAL',
  persistentReceiptStatus: completed ? 'PASS' : 'PENDING', officialCompletionClaimed: completed,
  newBuildIssued: false, generatedAt: new Date().toISOString()
};
const reportPath = resolve(root, 'artifacts/validation/31-D_FAMILY_IMPORT_REUSED_LOCATION_READ_RECEIPT_CONTRACT.json');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failures.length) {
  console.error(`31-D reused-location read receipt contract: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-D reused-location read receipt contract: PASS (${checks.length}/${checks.length}; PPK-002 PARTIAL; receipt ${completed ? 'PASS' : 'PENDING'}).`);
