import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd()); if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const jsonPaths = {
  completion31A: 'artifacts/checkpoints/31-A_COMPLETION_RECORD.json', receipt31A: 'artifacts/checkpoints/31-A_LIBRARY_RECEIPT.json',
  authority: 'artifacts/authority/31-B_AUTO_PRIORITY_SELECTION_AUTHORITY.json', priority: 'artifacts/validation/31-B_PRIORITY_SELECTION_VALIDATION.json',
  scope: 'config/31-b-family-data-import-central-authorization-scope.json', plan: 'config/work-segmentation-plan.json', ledger: 'config/active-governance-ledger.json',
  registry: 'config/accepted-scope-registry.json', execution: 'artifacts/checkpoints/31-B_EXECUTION_RECORD.json',
  runtime: 'artifacts/validation/PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json', platform: 'artifacts/validation/platform-policy-ast-gate.json', packageJson: 'package.json'
};
const documents = Object.fromEntries(await Promise.all(Object.entries(jsonPaths).map(async ([key, path]) => [key, JSON.parse(await readFile(resolve(root, path), 'utf8'))])));
const service = await readFile(resolve(root, 'apps/desktop/src/main/family-data-import-service.ts'), 'utf8');
const composition = await readFile(resolve(root, 'apps/desktop/src/main/data-store.ts'), 'utf8');
const regression = await readFile(resolve(root, 'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts'), 'utf8');
const checks = []; const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const { completion31A, receipt31A, authority, priority, scope, plan, ledger, registry, execution, runtime, platform, packageJson } = documents;
const step31B = plan.steps.find((item) => item.id === '31-B'); const step31A = plan.steps.find((item) => item.id === '31-A'); const step31C = plan.steps.find((item) => item.id === '31-C'); const step31D = plan.steps.find((item) => item.id === '31-D'); const step31E = plan.steps.find((item) => item.id === '31-E'); const step31F = plan.steps.find((item) => item.id === '31-F'); const activeSteps = plan.steps.filter((item) => item.status === 'IN_PROGRESS'); const ppk002 = registry.requirements.find((item) => item.id === 'PPK-002');
const completed31B = step31B?.status === 'COMPLETED' && step31B.validationStatus === 'PASS' && step31B.persistentReceiptStatus === 'PASS';
const inProgress31B = step31B?.status === 'IN_PROGRESS' && step31B.persistentReceiptStatus === 'PENDING';
const successor31CActive = plan.currentStep === '31-C' && activeSteps.length === 1 && activeSteps[0]?.id === '31-C' && activeSteps[0]?.persistentReceiptStatus === 'PENDING';
const successor31CCompleted = plan.currentStep === '31-C' && activeSteps.length === 0 && step31C?.status === 'COMPLETED' && step31C.persistentReceiptStatus === 'PASS';
const successor31DCompleted = plan.currentStep === '31-D' && activeSteps.length === 0 && step31C?.status === 'COMPLETED' && step31D?.status === 'COMPLETED' && step31D.persistentReceiptStatus === 'PASS';
const successor31ECompleted = plan.currentStep === '31-E' && activeSteps.length === 0 && step31D?.status === 'COMPLETED' && step31E?.status === 'COMPLETED' && step31E.persistentReceiptStatus === 'PASS';
const successor31FCompleted = plan.currentStep === '31-F' && activeSteps.length === 0 && step31E?.status === 'COMPLETED' && step31F?.status === 'COMPLETED' && step31F.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-F' });
check(completion31A.status === 'PASS' && completion31A.officialStepStatus === 'COMPLETED', '31-A predecessor completion is PASS');
check(receipt31A.status === 'PASS' && receipt31A.persistentReceiptStatus === 'PASS', '31-A predecessor receipt is PASS');
check(step31A.status === 'COMPLETED' && step31A.persistentReceiptStatus === 'PASS', 'work plan preserves completed 31-A');
check(authority.step === '31-B' && authority.status === 'PASS' && authority.selectedOpenFinding === 'FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION', '31-B authority selects exact import authorization slice');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, '31-B priority selection is PASS');
check(scope.step === '31-B' && scope.decision === 'DEC-160' && scope.targets.resourceType === 'family_data_import', '31-B scope identity is exact');
check((plan.currentStep === '31-B' && (inProgress31B || completed31B)) || (completed31B && (successor31CActive || successor31CCompleted || successor31DCompleted || successor31ECompleted || successor31FCompleted || laterSuccessor.planValid)), '31-B has a valid lifecycle through authorized successors');
check(activeSteps.length === (inProgress31B || successor31CActive || laterSuccessor.active ? 1 : 0), 'work plan active-step count matches 31-B successor lifecycle');
check(
  (inProgress31B && ledger.activeMicroStep === '31-B' && ['31-B_IN_PROGRESS_PREDECESSOR_31-A_RECEIPT_CHAIN_PASS', '31-B_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger.libraryUploadStatus))
  || (completed31B && plan.currentStep === '31-B' && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-B_COMPLETED_RECEIPT_PASS')
  || (successor31CActive && ledger.activeMicroStep === '31-C' && ['31-C_IN_PROGRESS_PREDECESSOR_31-B_RECEIPT_CHAIN_PASS', '31-C_LOCAL_PASS_AWAITING_LIBRARY_RECEIPT'].includes(ledger.libraryUploadStatus))
  || (successor31CCompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-C_COMPLETED_RECEIPT_PASS')
  || (successor31DCompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-D_COMPLETED_RECEIPT_PASS')
  || (successor31ECompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-E_COMPLETED_RECEIPT_PASS')
  || (successor31FCompleted && ledger.activeMicroStep === null && ledger.libraryUploadStatus === '31-F_COMPLETED_RECEIPT_PASS')
  || laterSuccessor.ledgerValid,
  'ledger matches pending or completed 31-B receipt lifecycle'
);
check(ppk002.priority === 'P0' && (ppk002.status === 'PARTIAL' || (ppk002.status === 'COMPLETE' && Object.values(ppk002.chain ?? {}).every((value) => value === true))), 'PPK-002 remains P0 or has a fully closed successor chain');
check(execution.step === '31-B' && ((inProgress31B && String(execution.officialStepStatus).startsWith('IN_PROGRESS') && execution.persistentReceiptStatus === 'PENDING') || (completed31B && execution.officialStepStatus === 'COMPLETED' && execution.persistentReceiptStatus === 'PASS')), '31-B execution record matches receipt lifecycle');
check(runtime.status === 'PASS' && runtime.checkCount === 12 && runtime.external30ZReceipt === 'PASS' && runtime.external31AReceipt === 'PASS', 'fresh family import verifier is 12/12 PASS');
check(platform.status === 'PASS'
  && platform.directRoleAuthorizationBypasses === 0
  && platform.exactAllowlistEntries === 873
  && platform.surfaceCounts?.USE_CASE_COMPOSITION === 431,
'current platform policy AST gate is PASS with no direct-role bypass and exact successor ratchet');
check(service.includes('CentralAuthorizationService') && service.includes("resourceType: 'family_data_import'") && service.includes("purpose: 'administration'"), 'service uses exact central authorization intent');
check(!service.includes("context.actor.role !== 'family_admin'"), 'direct family_admin gate is absent');
check(service.includes('listActiveForSubject') && service.includes('grants: grants.value.map(toAuthorizationGrant)'), 'active object grants participate in authorization');
check(service.indexOf("#assertAuthorized(context, 'read')") < service.indexOf('lstatSync(sourcePath)'), 'preview authorization precedes file access');
check(service.includes("authorizeFamilyDataImport(this.dependencies, context, repository, 'create')"), 'apply reauthorizes create in transaction');
check(service.includes("authorizeFamilyDataImport(this.dependencies, context, repository, 'delete')"), 'rollback reauthorizes delete in transaction');
check(composition.includes('accountRepository: this.#repositories.accountRepository') && composition.includes('permissionRepository: this.#repositories.objectPermissionRepository'), 'production composition supplies authorization repositories');
check(service.includes('import.location_policy_batch_required') && service.includes('import.event_location_policy_batch_required') && !service.includes('timelineRepository.insert(repository'), 'multi-receipt import boundary remains fail-closed');
check(regression.includes("actorRole = 'adult_member'") && regression.includes('deny-family-import-read') && regression.includes('missing.json'), 'regression covers role and explicit deny before file access');
check(packageJson.scripts['verify:31-b:family-import-authorization-contract'] === 'node scripts/verify-31-b-family-data-import-central-authorization-contract.mjs', 'package exposes 31-B contract gate');
check(scope.openBoundaries.PPK002 === 'PARTIAL' && scope.openBoundaries.familyDataImportMultiReceiptBatch === 'NOT_COMPLETE', '31-B preserves PPK-002 and multi-receipt boundaries');
check(scope.newBuildIssued === false, '31-B issues no new Build');
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, release: scope.release, step: '31-B', requirement: 'PPK-002', phase: 'FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION_CONTRACT', status: failures.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, failures: failures.map((item) => item.name), PPK002: 'PARTIAL', persistentReceiptStatus: completed31B ? 'PASS' : 'PENDING', officialCompletionClaimed: completed31B, newBuildIssued: false, generatedAt: new Date().toISOString() };
const reportPath = resolve(root, 'artifacts/validation/31-B_FAMILY_DATA_IMPORT_CENTRAL_AUTHORIZATION_CONTRACT.json'); await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failures.length) { console.error(`31-B family data import authorization contract: FAIL (${failures.length}/${checks.length}).`); for (const item of failures) console.error(`- ${item.name}`); process.exit(1); }
console.log(`31-B family data import authorization contract: PASS (${checks.length}/${checks.length}; PPK-002 PARTIAL; receipt ${completed31B ? 'PASS' : 'PENDING'}).`);
