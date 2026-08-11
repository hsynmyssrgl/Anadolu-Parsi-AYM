import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const successorRegression = process.argv.includes('--successor-regression');
const readText = (path) => readFile(resolve(root, path), 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const [scope, authority, priority, plan, ledger, registry, decision, contracts, ownership, runtime, dispatcher, client, adapter, startup, main, dispatcherTest, ownershipTest] = await Promise.all([
  readJson('config/31-h-core-service-family-data-session-ownership-control-plane-scope.json'),
  readJson('artifacts/authority/31-H_MAIN_STRUCTURE_PRIORITY_AUTHORITY.json'),
  readJson('artifacts/validation/31-H_PRIORITY_SELECTION_VALIDATION.json'),
  readJson('config/work-segmentation-plan.json'),
  readJson('config/active-governance-ledger.json'),
  readJson('config/accepted-scope-registry.json'),
  readText('docs/decisions/DEC-169-core-service-protected-family-data-session-ownership-control-plane.md'),
  readText('packages/core-service-contracts/src/index.ts'),
  readText('apps/core-service/src/family-data-ownership-runtime.ts'),
  readText('apps/core-service/src/core-service-runtime.ts'),
  readText('apps/core-service/src/core-service-method-dispatcher.ts'),
  readText('packages/core-service-client/src/local-admin-client.ts'),
  readText('apps/desktop/src/main/core-service-application-adapter.ts'),
  readText('apps/desktop/src/main/core-service-startup-connection.ts'),
  readText('apps/core-service/src/main.ts'),
  readText('apps/core-service/tests/core-service-method-dispatcher.test.ts'),
  readText('apps/core-service/tests/family-data-ownership-runtime.test.ts')
]);

const checks = [];
const check = (passed, name) => checks.push({ name, status: passed ? 'PASS' : 'FAIL' });
const step = plan.steps.find((item) => item.id === '31-H');
const requirements = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
const authorizedRequirementState = (item) => item?.status !== 'COMPLETE' || (
  Object.values(item.chain ?? {}).every((value) => value === true)
  && ((
    item.id === 'PPK-003'
    && item.evidence?.includes('docs/decisions/DEC-184-ppk-003-bounded-default-deny-policy-decision-availability.md')
    && item.evidence?.includes('artifacts/validation/31-Y-ppk-003-default-deny-availability-runtime.json')
  ) || (
    item.id === 'PPK-014'
    && item.evidence?.includes('docs/decisions/DEC-195-ppk-014-versioned-core-service-api-boundary.md')
    && item.evidence?.includes('artifacts/validation/32-J-ppk-014-versioned-core-service-api-runtime.json')
  ))
);
const complete = step?.status === 'COMPLETED' && step.validationStatus === 'PASS' && step.persistentReceiptStatus === 'PASS';
const laterSuccessor = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-H' });

check(scope.step === '31-H' && scope.decision === 'DEC-169' && scope.primaryRequirement === 'DHA-001', 'scope identity');
check(scope.status === (complete ? 'COMPLETED' : 'IN_PROGRESS'), 'scope lifecycle');
check(scope.targets.typedStatusMethod === 'FAMILY_DATA_STATUS_IN_CORE_SERVICE_METHOD_MAP', 'typed status target');
check(scope.targets.ownershipStateMachine === 'MONOTONIC_EPOCH_FAIL_CLOSED_SESSION_LIFECYCLE', 'monotonic fail-closed target');
check(scope.targets.ownershipTruth === 'CORE_SERVICE_ONLY_AFTER_REAL_SESSION_PORT_ATTACHMENT', 'attachment-before-ownership target');
check(scope.targets.pathPrivacy === 'NO_DATABASE_PATH_EXPOSED_OVER_CLIENT_PROTOCOL', 'path privacy target');
check(Object.values(scope.openBoundaries).filter((value) => value === 'NOT_COMPLETE').length === 5, 'migration boundaries remain open');
check(scope.openBoundaries.windowsServiceInstallation === 'APPROVAL_BOUND_NOT_RUN_NOT_PASS', 'Windows service remains approval-bound');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_MAIN_STRUCTURE_CONTINUATION' && authority.predecessor?.step === '31-G' && authority.predecessor?.status === 'PASS', 'explicit user continuation authority');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, 'priority selection validation PASS');
check(decision.includes('Core Service') && decision.includes('desktop-transition') && decision.includes('fail-closed') && decision.includes('SQLite'), 'DEC-169 records the protected-session boundary');
check(step?.title === scope.title && step.scopeRequirement === 'DHA-001', 'work plan selects 31-H main structure');
check((complete && ledger.libraryUploadStatus === '31-H_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null) || (!complete && ledger.libraryUploadStatus.startsWith('31-H_MAIN_STRUCTURE_') && ledger.activeMicroStep === '31-H') || (laterSuccessor.planValid && laterSuccessor.ledgerValid && laterSuccessor.nextTaskValid), 'ledger lifecycle');
check(requirements.every(Boolean) && requirements.every((item) => item.priority === 'P0' && authorizedRequirementState(item)), 'foundation requirements remain open P0 or have an authorized successor closure');
check(requirements.every((item) => item.evidence.includes('docs/decisions/DEC-169-core-service-protected-family-data-session-ownership-control-plane.md')), 'registry binds DEC-169 evidence');

check(contracts.includes('CoreServiceFamilyDataStatusContract') && contracts.includes("readonly owner: 'desktop-transition' | 'core-service'"), 'typed family-data ownership status');
check(contracts.includes("readonly 'family-data.status'") && contracts.includes("'family-data.status'"), 'family-data status is in the canonical method map');
check(contracts.includes('protectedSessionAttached') && contracts.includes('persistentPathExposed'), 'status carries attachment and path privacy truth');
check(contracts.includes("familyData: 'desktop-transition' | 'core-service'"), 'architecture ownership supports controlled transition');

check(ownership.includes("#lifecycle: CoreServiceFamilyDataStatusContract['lifecycle'] = 'detached'") && ownership.includes("#mode: CoreServiceFamilyDataStatusContract['mode'] = 'none'"), 'ownership begins detached and mode none');
check(ownership.includes("const owner = this.#lifecycle === 'ready' || this.#lifecycle === 'sealing' ? 'core-service' : 'desktop-transition'"), 'Core Service ownership requires attached lifecycle');
check(ownership.includes("writable: this.#lifecycle === 'ready' && this.#mode === 'read-write'"), 'writable truth is fenced by ready read-write state');
check(ownership.includes('protectedSessionAttached: this.#session !== undefined') && ownership.includes('persistentPathExposed: false'), 'session truth has no persistent path exposure');
check(ownership.includes('SESSION_ALREADY_ATTACHED') && ownership.includes('SESSION_INVALID') && ownership.includes('SESSION_CLOSE_FAILED'), 'ownership lifecycle fails closed');
check((ownership.match(/this\.#epoch \+= 1/gu) ?? []).length >= 4, 'ownership epochs advance across attach and seal');
check(ownership.includes('await session.close()') && ownership.indexOf('await session.close()') < ownership.indexOf("this.#lifecycle = 'sealed'"), 'session closes before sealed truth');
check(!['node:fs', 'node:sqlite', 'databasePath', 'SELECT ', 'Google Drive', 'Drive\'ım'].some((marker) => ownership.includes(marker)), 'ownership control plane has no storage or unused-drive dependency');

check(runtime.includes('familyDataStatus()') && runtime.includes('attachFamilyDataSession') && runtime.includes('sealFamilyDataSession'), 'Core Service runtime owns the control-plane operations');
check(runtime.includes('familyData: familyData.owner'), 'architecture follows live family-data ownership');
check(dispatcher.includes("typedMethod === 'family-data.status'") && dispatcher.includes('this.#runtime.familyDataStatus()'), 'central dispatcher serves family-data status');
check(client.includes("this.request('family-data.status', {})"), 'typed client exposes family-data status');
check(adapter.includes('getFamilyDataStatus(): Promise<CoreServiceFamilyDataStatusContract>'), 'Desktop adapter exposes family-data status');
check(startup.includes('Promise.all([') && ['adapter.getHealth()', 'adapter.getArchitecture()', 'adapter.getFamilyDataStatus()', 'adapter.getDeviceSecretProtectionStatus()'].every((marker) => startup.includes(marker)), 'Desktop startup obtains all protected truth sources');
check(startup.includes('familyData.persistentPathExposed !== false') && startup.includes('architecture.ownership.familyData !== familyData.owner'), 'Desktop rejects path exposure and ownership contradiction');
check(startup.includes("familyData.owner === 'core-service'") && startup.includes('!familyData.protectedSessionAttached'), 'Desktop rejects unattached Core Service ownership');
check(startup.includes("familyData.owner === 'desktop-transition' && familyData.writable"), 'Desktop rejects writable transition state');
check(main.indexOf('await this.#server.stop()') < main.indexOf('await this.runtime.sealFamilyDataSession()') && main.indexOf('await this.runtime.sealFamilyDataSession()') < main.indexOf('this.runtime.finishShutdown()'), 'process shutdown seals family-data session before stopped truth');

check(dispatcherTest.includes("'family-data.status'") && dispatcherTest.includes('persistentPathExposed: false'), 'dispatcher test covers family-data status');
check(ownershipTest.includes('stays detached and path-private until a real session port is attached'), 'ownership test covers detached path privacy');
check(ownershipTest.includes('moves ownership with monotonic epochs and seals the attached session') && ownershipTest.includes('toHaveBeenCalledOnce'), 'ownership test covers monotonic attach and seal');
check(ownershipTest.includes('fails closed when the protected session cannot be sealed') && ownershipTest.includes('SESSION_CLOSE_FAILED'), 'ownership test covers close failure');
check(!JSON.stringify([scope, authority, priority]).includes('G:\\') && !JSON.stringify([scope, authority, priority]).includes("Drive'ım"), '31-H governance has no Google Drive address');
check(scope.requirementCompletionClaimed === false && authority.requirementCompletionClaimed === false, 'no false requirement completion claim');
check(scope.newBuildIssued === false && authority.newBuildIssued === false, 'no new Build');

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1,
  release: scope.release,
  step: '31-H',
  phase: 'CORE_SERVICE_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE_CONTRACT',
  status: failed.length ? 'FAIL' : 'PASS',
  expected: checks.length,
  executed: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  checks,
  requirements: scope.requirements,
  requirementCompletionClaimed: false,
  newBuildIssued: false,
  verifiedAt: new Date().toISOString()
};
if (!successorRegression) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/31-H_FAMILY_DATA_SESSION_OWNERSHIP_CONTROL_PLANE_CONTRACT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failed.length) {
  console.error(`31-H family-data ownership contract: FAIL (${failed.length}/${checks.length}).`);
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-H family-data ownership contract: PASS (${checks.length}/${checks.length}; protected vault handoff remains open).`);
