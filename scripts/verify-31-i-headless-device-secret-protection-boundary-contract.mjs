import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const successorRegression = process.argv.includes('--successor-regression');
const readText = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const [scope, authority, priority, plan, ledger, registry, decision, securityIndex, protector, shim, contracts, protectionRuntime, coreRuntime, dispatcher, client, adapter, startup, packageJson, lock, dispatcherTest, protectionTest] = await Promise.all([
  readJson('config/31-i-headless-device-secret-protection-boundary-scope.json'),
  readJson('artifacts/authority/31-I_MAIN_STRUCTURE_PRIORITY_AUTHORITY.json'),
  readJson('artifacts/validation/31-I_PRIORITY_SELECTION_VALIDATION.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/accepted-scope-registry.json'),
  readText('docs/decisions/DEC-170-headless-device-secret-protection-boundary.md'),
  readText('packages/security/src/index.ts'),
  readText('packages/security/src/device-secret-protector.ts'),
  readText('apps/desktop/src/main/device-secret-protector.ts'),
  readText('packages/core-service-contracts/src/index.ts'),
  readText('apps/core-service/src/device-secret-protection-runtime.ts'),
  readText('apps/core-service/src/core-service-runtime.ts'),
  readText('apps/core-service/src/core-service-method-dispatcher.ts'),
  readText('packages/core-service-client/src/local-admin-client.ts'),
  readText('apps/desktop/src/main/core-service-application-adapter.ts'),
  readText('apps/desktop/src/main/core-service-startup-connection.ts'),
  readJson('apps/core-service/package.json'),
  readJson('package-lock.json'),
  readText('apps/core-service/tests/core-service-method-dispatcher.test.ts'),
  readText('apps/core-service/tests/device-secret-protection-runtime.test.ts')
]);

const checks = [];
const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const step = plan.steps.find((item) => item.id === '31-I');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
const authorizedRequirementState = (item) => item?.status !== 'COMPLETE' || (
  Object.values(item.chain ?? {}).every((value) => value === true)
  && ((
    item.id === 'PPK-013'
    && item.evidence?.includes('docs/decisions/DEC-194-ppk-013-client-data-access-boundary.md')
    && item.evidence?.includes('artifacts/validation/32-I-ppk-013-client-data-access-runtime.json')
  ) || (
    item.id === 'PPK-014'
    && item.evidence?.includes('docs/decisions/DEC-195-ppk-014-versioned-core-service-api-boundary.md')
    && item.evidence?.includes('artifacts/validation/32-J-ppk-014-versioned-core-service-api-runtime.json')
  ))
);
const complete = step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-I' });

check(scope.step === '31-I' && scope.decision === 'DEC-170' && scope.primaryRequirement === 'DHA-001', 'scope identity');
check(scope.status === (complete ? 'COMPLETED' : 'IN_PROGRESS'), 'scope lifecycle');
check(scope.targets.singleOwner === 'PACKAGES_SECURITY_OWNS_DEVICE_SECRET_PROTECTION', 'shared security ownership target');
check(scope.targets.headlessDpapi === 'WINDOWS_CURRENT_USER_DPAPI_WITHOUT_ELECTRON_DEPENDENCY', 'headless DPAPI target');
check(scope.targets.protocolPrivacy === 'NO_KEY_PASSWORD_OR_DATABASE_PATH_OVER_CORE_SERVICE_CLIENT_PROTOCOL', 'protocol privacy target');
check(Object.values(scope.openBoundaries).filter((value) => value === 'NOT_COMPLETE').length === 6, 'vault and data migrations remain open');
check(scope.openBoundaries.windowsServiceInstallation === 'APPROVAL_BOUND_NOT_RUN_NOT_PASS', 'Windows service remains approval-bound');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_MAIN_STRUCTURE_CONTINUATION' && authority.predecessor?.step === '31-H', '31-H receipt continuation authority');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, 'priority selection PASS');
check(decision.includes('@ppt/security') && decision.includes('CurrentUser DPAPI') && decision.includes('Core Service'), 'DEC-170 records the headless boundary');
check(step?.title === scope.title && step.scopeRequirement === 'DHA-001', 'work plan selects 31-I');
check((complete && ledger.libraryUploadStatus === '31-I_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null) || (!complete && ledger.libraryUploadStatus.startsWith('31-I_MAIN_STRUCTURE_') && ledger.activeMicroStep === '31-I') || (laterSuccessor.planValid && laterSuccessor.ledgerValid && laterSuccessor.nextTaskValid), 'ledger lifecycle');
check(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && authorizedRequirementState(item)), 'foundation requirements remain open P0 work or have an authorized successor closure');
check(requirements.every((item) => item.evidence.includes('docs/decisions/DEC-170-headless-device-secret-protection-boundary.md')), 'registry binds DEC-170 evidence');

check(securityIndex.includes("export * from './device-secret-protector.js'"), 'security package exports the protector boundary');
check(protector.includes('export interface DeviceSecretProtector') && protector.includes('WindowsDpapiDeviceSecretProtector'), 'shared package owns protector contract and DPAPI provider');
check(protector.includes("WINDOWS_DPAPI_PROTECTION_ID = 'windows-dpapi-current-user-v1'"), 'stable DPAPI provider identity');
check(protector.includes('ProtectedData]::Protect') && protector.includes('ProtectedData]::Unprotect') && protector.includes('DataProtectionScope]::CurrentUser'), 'Windows CurrentUser DPAPI implementation');
check(protector.includes('[Console]::In.ReadToEnd()') && protector.includes("'-EncodedCommand', WINDOWS_DPAPI_ENCODED_COMMAND"), 'DPAPI secrets use stdin and encoded fixed command');
check(!protector.includes("from 'electron'") && !protector.includes("from \"electron\""), 'shared provider has no Electron import');
check(!protector.includes('databasePath') && !protector.includes('userDataPath'), 'shared provider has no database or user-data path');
check(shim.includes("from '@ppt/security'") && shim.includes('type DeviceSecretProtector'), 'Desktop module path is a compatibility re-export');
check(!shim.includes('spawnSync') && !shim.includes('ProtectedData]::Protect') && !shim.includes('class WindowsDpapiDeviceSecretProtector'), 'Desktop shim contains no second implementation');
check(packageJson.dependencies['@ppt/security'] === packageJson.version, 'Core Service declares same-release security dependency');
check(lock.packages['apps/core-service'].dependencies['@ppt/security'] === packageJson.version, 'lockfile binds same-release Core Service security dependency');

check(contracts.includes('CoreServiceDeviceSecretProtectionStatusContract'), 'typed device-secret status contract');
check(contracts.includes("readonly 'device-secret-protection.status'"), 'device-secret status is in canonical method map');
check(contracts.includes('readonly secretMaterialExposed: false') && contracts.includes('readonly electronDependency: false'), 'protocol statically forbids secret and Electron exposure');
check(contracts.includes("deviceSecretProtection: 'detached' | 'core-service'"), 'architecture declares device-secret ownership truth');
check(protectionRuntime.includes('PROTECTOR_ALREADY_ATTACHED') && protectionRuntime.includes('PROTECTOR_INVALID'), 'Core Service prerequisite rejects invalid or duplicate attachment');
check(protectionRuntime.includes("owner: 'detached'") && protectionRuntime.includes("owner: 'core-service'"), 'Core Service prerequisite reports detached and attached ownership');
check(protectionRuntime.includes('secretMaterialExposed: false') && protectionRuntime.includes('electronDependency: false'), 'Core Service prerequisite exposes no secret or Electron dependency');
check(!protectionRuntime.includes('.protect(') && !protectionRuntime.includes('.unprotect('), 'status control plane cannot invoke secret operations');
check(!['node:fs', 'node:sqlite', 'databasePath', 'authenticationToken', 'password'].some((marker) => protectionRuntime.includes(marker)), 'status control plane has no storage, credential, or database dependency');
check(coreRuntime.includes('deviceSecretProtectionStatus()') && coreRuntime.includes('attachDeviceSecretProtector'), 'Core Service runtime owns prerequisite composition');
check(coreRuntime.includes('deviceSecretProtection: deviceSecretProtection.owner'), 'architecture follows live prerequisite ownership');
check(dispatcher.includes("typedMethod === 'device-secret-protection.status'") && dispatcher.includes('this.#runtime.deviceSecretProtectionStatus()'), 'central dispatcher serves safe status');
check(client.includes("this.request('device-secret-protection.status', {})"), 'typed client exposes safe status only');
check(adapter.includes('getDeviceSecretProtectionStatus(): Promise<CoreServiceDeviceSecretProtectionStatusContract>'), 'Desktop adapter exposes safe status');
check(startup.includes('adapter.getDeviceSecretProtectionStatus()') && startup.includes('deviceSecretProtection.secretMaterialExposed !== false'), 'Desktop reads status and rejects secret exposure');
check(startup.includes('deviceSecretProtection.electronDependency !== false') && startup.includes('architecture.ownership.deviceSecretProtection !== deviceSecretProtection.owner'), 'Desktop rejects Electron dependency and ownership contradiction');
check(dispatcherTest.includes("'device-secret-protection.status'") && dispatcherTest.includes('secretMaterialExposed: false'), 'dispatcher test covers safe status route');
check(protectionTest.includes('starts detached without exposing secret material or an Electron dependency'), 'targeted test covers detached privacy');
check(protectionTest.includes('reports ready only after an available headless protector is attached'), 'targeted test covers attachment readiness');
check(protectionTest.includes('fails closed when an attached provider is unavailable or throws'), 'targeted test covers unavailable provider');
check(protectionTest.includes('rejects invalid or duplicate protector attachment'), 'targeted test covers attachment rejection');
check(!JSON.stringify([scope, authority, priority]).includes('G:\\') && !JSON.stringify([scope, authority, priority]).includes("Drive'ım"), '31-I governance has no unused drive address');
check(scope.requirementCompletionClaimed === false && authority.requirementCompletionClaimed === false, 'no false requirement completion claim');
check(scope.newBuildIssued === false && authority.newBuildIssued === false, 'no new Build');

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-I', phase: 'HEADLESS_DEVICE_SECRET_PROTECTION_BOUNDARY_CONTRACT',
  status: failed.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length,
  passed: checks.length - failed.length, failed: failed.length, checks,
  requirements: scope.requirements, requirementCompletionClaimed: false, newBuildIssued: false, verifiedAt: new Date().toISOString()
};
if (!successorRegression) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/31-I_HEADLESS_DEVICE_SECRET_PROTECTION_CONTRACT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failed.length) {
  console.error(`31-I headless device-secret protection contract: FAIL (${failed.length}/${checks.length}).`);
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-I headless device-secret protection contract: PASS (${checks.length}/${checks.length}; vault migration remains open).`);
