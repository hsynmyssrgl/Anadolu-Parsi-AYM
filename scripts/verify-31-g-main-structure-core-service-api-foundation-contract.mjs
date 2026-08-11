import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const readText = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const [scope, authority, priority, plan, ledger, registry, decision, contracts, runtime, dispatcher, server, client, adapter, startup, test] = await Promise.all([
  readJson('config/31-g-main-structure-core-service-api-foundation-scope.json'),
  readJson('artifacts/authority/31-G_MAIN_STRUCTURE_PRIORITY_AUTHORITY.json'),
  readJson('artifacts/validation/31-G_MAIN_STRUCTURE_PRIORITY_VALIDATION.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/accepted-scope-registry.json'),
  readText('docs/decisions/DEC-168-main-structure-first-core-service-api-foundation.md'),
  readText('packages/core-service-contracts/src/index.ts'),
  readText('apps/core-service/src/core-service-runtime.ts'),
  readText('apps/core-service/src/core-service-method-dispatcher.ts'),
  readText('apps/core-service/src/local-admin-server.ts'),
  readText('packages/core-service-client/src/local-admin-client.ts'),
  readText('apps/desktop/src/main/core-service-application-adapter.ts'),
  readText('apps/desktop/src/main/core-service-startup-connection.ts'),
  readText('apps/core-service/tests/core-service-method-dispatcher.test.ts')
]);
const checks = [];
const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const step = plan.steps.find((item) => item.id === '31-G');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
const completed = step?.status === 'COMPLETED' && step.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-G' });

check(scope.step === '31-G' && scope.decision === 'DEC-168' && scope.primaryRequirement === 'DHA-001', 'scope identity');
check(scope.status === (completed ? 'COMPLETED' : 'IN_PROGRESS'), 'scope lifecycle');
check(scope.targets.typedMethodMap === 'ONE_COMPILE_TIME_CORE_SERVICE_API_METHOD_MAP', 'typed method-map target');
check(scope.targets.dispatch === 'ONE_CENTRAL_FAIL_CLOSED_SERVER_DISPATCHER', 'central dispatcher target');
check(scope.targets.desktopHandshake.includes('POLICY_OWNERSHIP'), 'desktop ownership handshake target');
check(scope.openBoundaries.familyDataOwnershipInCoreService === 'TRANSITION_NOT_COMPLETE', 'family data migration remains open');
check(scope.openBoundaries.windowsServiceInstallation === 'APPROVAL_BOUND_NOT_RUN_NOT_PASS', 'Windows service installation remains approval-bound');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_MAIN_STRUCTURE_FIRST' && authority.supersedesDecision === 'DEC-167', 'explicit user priority authority');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, 'priority validation PASS');
check(decision.includes('Ana yapı önce') && decision.includes('tip güvenli') && decision.includes('Desktop'), 'DEC-168 documents the structure boundary');
check(step?.title === scope.title && step.scopeRequirement === 'DHA-001', 'work plan selects main structure');
check((completed && ledger.libraryUploadStatus === '31-G_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null) || (!completed && ledger.libraryUploadStatus.startsWith('31-G_MAIN_STRUCTURE_') && ledger.activeMicroStep === '31-G') || (laterSuccessor.planValid && laterSuccessor.ledgerValid && laterSuccessor.nextTaskValid), 'ledger lifecycle');
check(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && item.status !== 'COMPLETE'), 'foundation requirements remain open P0');
check(contracts.includes("CORE_SERVICE_APPLICATION_API_VERSION = 'v1'") && contracts.includes('CoreServiceLocalAdminMethodMap'), 'versioned typed method map');
check(contracts.includes("readonly 'architecture.get'") && contracts.includes("readonly 'health.get'") && contracts.includes("readonly 'policy.authorize'") && contracts.includes("readonly 'policy.verify'"), 'required methods share one map');
check(contracts.includes('CoreServiceMethodPayload') && contracts.includes('CoreServiceMethodResult'), 'typed payload/result projection');
check(contracts.includes('CoreServiceArchitectureContract') && contracts.includes('CORE_SERVICE_REQUIRED_DESKTOP_METHODS'), 'architecture contract and required method set');
check(runtime.includes('public architecture(): CoreServiceArchitectureContract'), 'runtime exposes architecture manifest');
check(runtime.includes("processBoundary: 'headless-core-service'") && runtime.includes("policyKernel: 'core-service'") && runtime.includes("applicationApi: 'core-service'"), 'runtime declares core ownership');
check(runtime.includes('familyData: familyData.owner') && runtime.includes("backup: 'desktop-transition'") && runtime.includes("sync: 'not-implemented'"), 'runtime reports dynamic family-data truth without overclaiming other ownership');
check(dispatcher.includes('class CoreServiceMethodDispatcher') && dispatcher.includes('knownMethods') && dispatcher.includes('METHOD_NOT_ALLOWED'), 'dispatcher is centralized and fail-closed');
check(['architecture.get', 'health.get', 'policy.authorize', 'policy.verify'].every((method) => dispatcher.includes(method)), 'dispatcher implements required methods');
check(!dispatcher.includes('node:fs') && !dispatcher.includes('node:sqlite') && !dispatcher.includes('SELECT '), 'dispatcher has no direct filesystem or SQL access');
check(server.includes('new CoreServiceMethodDispatcher(options.runtime)') && server.includes('this.#dispatcher.dispatch(requestId, request.method, request.payload)'), 'server delegates after envelope authentication');
check(!server.includes("request.method === 'health.get'") && !server.includes("request.method === 'policy.authorize'"), 'server has no duplicated method routing');
check(client.includes('public async request<TMethod extends CoreServiceLocalAdminMethod>') && client.includes('CoreServiceMethodPayload<TMethod>') && client.includes('CoreServiceMethodResult<TMethod>'), 'client request API is compile-time typed');
check(client.includes("this.request('architecture.get', {})") && client.includes("this.request('policy.authorize', payload)"), 'client wrappers use typed registry');
check(adapter.includes('getArchitecture(): Promise<CoreServiceArchitectureContract>'), 'Desktop adapter exposes architecture');
check(startup.includes('Promise.all([') && ['adapter.getHealth()', 'adapter.getArchitecture()', 'adapter.getFamilyDataStatus()', 'adapter.getDeviceSecretProtectionStatus()'].every((marker) => startup.includes(marker)), 'Desktop obtains health, architecture, family-data ownership, and device-secret protection at startup');
check(startup.includes("architecture.ownership.policyKernel !== 'core-service'") && startup.includes("architecture.ownership.applicationApi !== 'core-service'"), 'Desktop verifies Core Service ownership');
check(startup.includes('CORE_SERVICE_REQUIRED_DESKTOP_METHODS.some') && startup.includes("'ARCHITECTURE_MISMATCH'"), 'Desktop rejects missing methods or architecture mismatch');
check(test.includes('rejects malformed or unknown calls') && test.includes("'database.query'"), 'targeted unknown-method fail-closed test');
check(test.includes("familyData: 'desktop-transition'") && test.includes("sync: 'not-implemented'"), 'targeted test preserves open ownership');
check(![scope, authority].some((value) => JSON.stringify(value).includes('Google Drive')), '31-G governance has no Google Drive path');
check(scope.newBuildIssued === false && authority.newBuildIssued === false, 'no new Build');

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-G', phase: 'MAIN_STRUCTURE_CORE_SERVICE_API_FOUNDATION_CONTRACT',
  status: failed.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length,
  passed: checks.length - failed.length, failed: failed.length, checks,
  requirements: scope.requirements, requirementCompletionClaimed: false, newBuildIssued: false,
  verifiedAt: new Date().toISOString()
};
await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
await writeFile(resolve(root, 'artifacts/validation/31-G_MAIN_STRUCTURE_CORE_SERVICE_API_CONTRACT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
if (failed.length) {
  console.error(`31-G main-structure contract: FAIL (${failed.length}/${checks.length}).`);
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-G main-structure contract: PASS (${checks.length}/${checks.length}; requirements remain open foundation).`);
