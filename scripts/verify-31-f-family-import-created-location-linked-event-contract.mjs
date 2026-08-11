import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const read = (path) => readFile(resolve(root, path), 'utf8');
const json = async (path) => JSON.parse(await read(path));
const [completion31E, receipt31E, receipt31D, authority, priority, scope, plan, ledger, registry, execution, packageJson] = await Promise.all([
  json('artifacts/checkpoints/31-E_COMPLETION_RECORD.json'),
  json('artifacts/checkpoints/31-E_LIBRARY_RECEIPT.json'),
  json('artifacts/checkpoints/31-D_LIBRARY_RECEIPT.json'),
  json('artifacts/authority/31-F_AUTO_PRIORITY_SELECTION_AUTHORITY.json'),
  json('artifacts/validation/31-F_PRIORITY_SELECTION_VALIDATION.json'),
  json('config/31-f-family-import-created-location-linked-event-scope.json'),
  json('config/work-segmentation-plan.json'),
  json('config/active-governance-ledger.json'),
  json('config/accepted-scope-registry.json'),
  json('artifacts/checkpoints/31-F_EXECUTION_RECORD.json'),
  json('package.json')
]);
const [service, batch, adapter, runtime, locationContract, locationRepository, serviceTest, batchTest, runtimeTest, repositoryTest, decision] = await Promise.all([
  read('apps/desktop/src/main/family-data-import-service.ts'),
  read('apps/desktop/src/main/family-data-import-policy-batch-runner.ts'),
  read('apps/desktop/src/main/location-application-adapter.ts'),
  read('apps/desktop/src/main/location-production-policy-runtime.ts'),
  read('packages/repository-contracts/src/location-repository.ts'),
  read('packages/repositories/src/location-repository.ts'),
  read('apps/desktop/tests/family-data-import-location-read-receipt-runtime.test.ts'),
  read('apps/desktop/tests/family-data-import-policy-batch-runtime.test.ts'),
  read('apps/desktop/tests/location-policy-enforcement-runtime.test.ts'),
  read('packages/repositories/location-repository-policy.test.ts'),
  read('docs/decisions/DEC-166-ppk-002-family-import-created-location-linked-event.md')
]);
const checks = [];
const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const step = plan.steps.find((item) => item.id === '31-F');
const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
const completed = step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS';
const pending = step?.status === 'IN_PROGRESS' && ['PENDING', 'PASS'].includes(step.validationStatus) && step.persistentReceiptStatus === 'PENDING';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });

check(completion31E.status === 'PASS' && completion31E.officialStepStatus === 'COMPLETED', '31-E predecessor completion is PASS');
check(receipt31E.status === 'PASS' && receipt31E.storageBackend === 'EXTERNAL_USB_D_DRIVE', '31-E predecessor has D: receipt');
check(receipt31D.openBoundaries?.newlyCreatedLocationLinkedEventImport === 'NEXT_SEPARATE_SLICE_FAIL_CLOSED', '31-D names the selected open boundary');
check(authority.step === '31-F' && authority.status === 'PASS' && authority.selectedOpenFinding === 'NEWLY_CREATED_LOCATION_LINKED_EVENT_IMPORT', 'authority selects exact 31-F slice');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, 'priority selection is clean PASS');
check(scope.step === '31-F' && scope.decision === 'DEC-166' && scope.targets.sourceLocationResolution === 'CREATED_IN_SAME_IMPORT_BATCH', 'scope identity is exact');
check((plan.currentStep === '31-F' && (pending || completed)) || (completed && laterSuccessor.planValid), 'work plan has a valid 31-F lifecycle');
check(plan.steps.filter((item) => item.status === 'IN_PROGRESS').length === (laterSuccessor.active || (!completed && pending) ? 1 : 0), 'active-step count matches lifecycle');
check((pending && ledger.activeMicroStep === '31-F') || (completed && plan.currentStep === '31-F' && ledger.activeMicroStep === null) || (completed && laterSuccessor.ledgerValid), 'ledger matches lifecycle');
check(ppk002.priority === 'P0' && ppk002.status === 'PARTIAL', 'PPK-002 remains P0 PARTIAL');
check(execution.step === '31-F' && execution.persistentReceiptStatus === (completed ? 'PASS' : 'PENDING'), 'execution record matches lifecycle');
check(decision.includes('öngörülü kaynak') && decision.includes('Commit öncesi tamamlanma çiti'), 'DEC-166 defines dependency and completion fence');
check(!service.includes('import.event_new_location_policy_chain_required'), 'preview no longer rejects the completed slice');
check(service.includes("kind: 'created-location-read'") && service.includes('createKey: `location:${row.targetLocationId}`'), 'service emits dependent created-location read');
check(service.includes("row.targetLocationResolution === 'created'") && service.includes("kind: 'location'"), 'service separates created and reused location reads');
check(service.includes('locationRepository.findById(locationReadRepository, context.familyId, row.targetLocationId)'), 'created location is read through exact governed repository');
check(!service.includes("row.targetLocationResolution !== 'reused'"), 'apply path no longer carries the obsolete reused-only rejection');
check(service.includes('sourceLocationReceiptHash: locationBinding.receiptHash'), 'event persists dependent exact read receipt hash');
check(batch.includes("kind: 'created-location-read'") && batch.includes('createKey: string'), 'batch request contract exposes exact dependency key');
check(batch.includes("createRequest.intent.action !== 'create'") && batch.includes('createRequest.intent.resourceId !== request.intent.resourceId'), 'batch validates create action and resource identity');
check(batch.includes('createRequest.context.familyId !== request.context.familyId') && batch.includes('createRequest.context.actor.userId !== request.context.actor.userId'), 'batch validates family and subject identity');
check(batch.includes("!RECEIPT_HASH.test(source.lease.receiptHash)"), 'batch requires a canonical create receipt hash');
check(batch.includes('anticipatedCreate: Object.freeze') && batch.includes('receiptHash: source.lease.receiptHash'), 'batch injects trusted create receipt dependency');
check(batch.includes('const result = operation({ transaction, repositories })') && batch.includes('entries.length - 1'), 'completion fences run after the operation in the same transaction');
check(batch.includes("entry.request.kind === 'created-location-read'") && batch.includes('completion fence is missing'), 'missing dependent completion fence fails closed');
check(adapter.includes('receiptHash: computePlatformPolicyReceiptHash') && adapter.includes('complete?(transaction: TransactionContext)'), 'location lease carries exact receipt and completion hook');
check(adapter.includes('validateTransactionCompletion?.') && adapter.includes('if (completed && !completed.ok) return completed'), 'location runner enforces completion before success');
check(runtime.includes('state: \'anticipated_create\'') && runtime.includes('createReceiptHash: requestedIntent.anticipatedCreate.receiptHash'), 'runtime snapshots the anticipated create provenance');
check(runtime.includes('Anticipated location policy read resource already exists') && runtime.includes('must be owned by the active person'), 'anticipated resolution is exact and owner-bound');
check(runtime.includes('validateProductionTransactionCompletion') && runtime.includes('current.value.createReceiptHash !== anticipated.receiptHash'), 'runtime validates persisted create provenance before commit');
check(runtime.includes('requiresTransactionCompletionValidation: true'), 'production PEP requires completion validation');
check(locationContract.includes('readonly createReceiptHash: string'), 'repository policy resource contract exposes create receipt provenance');
check(locationRepository.includes('SELECT id,family_id,owner_person_id,policy_receipt_hash') && locationRepository.includes('createReceiptHash: String(row.policy_receipt_hash)'), 'SQLite resolver returns exact create receipt hash');
check(serviceTest.includes("'created-location-read'") && serviceTest.includes("locationLabel: 'Yeni ev'"), 'service runtime test covers created-location linked event');
check(batchTest.includes('binds a created-location read to the exact prior create receipt') && batchTest.includes('returns a failed transaction'), 'batch tests cover binding and rollback signal');
check(batchTest.includes('exact create dependency is absent'), 'batch test covers missing dependency fail-closed');
check(runtimeTest.includes('created row carries the bound create receipt') && runtimeTest.includes("createReceiptHash: 'b'.repeat(64)"), 'production runtime test covers matching and mismatching provenance');
check(repositoryTest.includes("createReceiptHash: '1'.padStart(64, '0')"), 'repository regression asserts provenance projection');
check(packageJson.scripts['verify:31-f:family-import-created-location-event-contract'] === 'node scripts/verify-31-f-family-import-created-location-linked-event-contract.mjs', 'package exposes the 31-F contract gate');
check(scope.openBoundaries.governedImportRollbackReceiptFence === 'NOT_COMPLETE' && scope.openBoundaries.universalRepositoryEnforcement === 'NOT_COMPLETE', 'remaining boundaries stay explicit');
check(scope.PPK002 === 'PARTIAL' && scope.newBuildIssued === false, 'requirement and Build boundary remain honest');

const failures = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-F', requirement: 'PPK-002',
  phase: 'FAMILY_IMPORT_CREATED_LOCATION_LINKED_EVENT_CONTRACT', status: failures.length ? 'FAIL' : 'PASS',
  expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length,
  checks, failures: failures.map((item) => item.name), PPK002: 'PARTIAL',
  persistentReceiptStatus: completed ? 'PASS' : 'PENDING', officialCompletionClaimed: completed,
  newBuildIssued: false, generatedAt: new Date().toISOString()
};
const reportPath = resolve(root, 'artifacts/validation/31-F_FAMILY_IMPORT_CREATED_LOCATION_LINKED_EVENT_CONTRACT.json');
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failures.length) {
  console.error(`31-F created-location linked-event contract: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-F created-location linked-event contract: PASS (${checks.length}/${checks.length}; PPK-002 PARTIAL; receipt ${completed ? 'PASS' : 'PENDING'}).`);
