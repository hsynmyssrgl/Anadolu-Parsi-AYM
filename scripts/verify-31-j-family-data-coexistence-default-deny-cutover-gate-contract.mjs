import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectAuthorizedSuccessorLifecycle } from './lib/authorized-successor-lifecycle.mjs';

const root = resolve(process.cwd());
const successorRegression = process.argv.includes('--successor-regression');
const read = (path) => readFile(resolve(root, path), 'utf8');
const json = async (path) => JSON.parse(await read(path));
const [scope, authority, priority, plan, ledger, decisions, registry, decision, currentDecisions, contracts, guard, runtime, dispatcher, client, adapter, startup, index, dispatcherTest, guardTest, coreContract, desktopContract] = await Promise.all([
  json('config/31-j-family-data-coexistence-default-deny-cutover-gate-scope.json'),
  json('artifacts/authority/31-J_MAIN_STRUCTURE_SECURITY_HARDENING_AUTHORITY.json'),
  json('artifacts/validation/31-J_PRIORITY_SELECTION_VALIDATION.json'),
  json('config/work-segmentation-plan.json'), json('config/active-governance-ledger.json'), json('config/user-decision-ledger.json'), json('config/accepted-scope-registry.json'),
  read('docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md'), read('docs/current/09_KULLANICI_KARARLARI_KAYDI.md'),
  read('packages/core-service-contracts/src/index.ts'), read('apps/core-service/src/family-data-cutover-guard.ts'), read('apps/core-service/src/core-service-runtime.ts'),
  read('apps/core-service/src/core-service-method-dispatcher.ts'), read('packages/core-service-client/src/local-admin-client.ts'), read('apps/desktop/src/main/core-service-application-adapter.ts'),
  read('apps/desktop/src/main/core-service-startup-connection.ts'), read('apps/core-service/src/index.ts'), read('apps/core-service/tests/core-service-method-dispatcher.test.ts'),
  read('apps/core-service/tests/family-data-cutover-guard.test.ts'), json('artifacts/validation/core-service-local-admin-contract.json'),
  json('artifacts/validation/desktop-core-service-startup-contract.json')
]);
const checks = []; const check = (condition, name) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const step = plan.steps.find((item) => item.id === '31-J');
const requirementRecords = scope.requirements.map((id) => registry.requirements.find((item) => item.id === id));
const authorizedRequirementState = (item) => {
  if (item?.status !== 'COMPLETE') return true;
  const evidence = item.evidence ?? [];
  const completeChain = Object.values(item.chain ?? {}).every((value) => value === true);
  if (!completeChain) return false;
  return (
    item.id === 'PPK-003'
    && evidence.includes('docs/decisions/DEC-184-ppk-003-bounded-default-deny-policy-decision-availability.md')
    && evidence.includes('artifacts/validation/31-Y-ppk-003-default-deny-availability-runtime.json')
  ) || (
    item.id === 'PPK-013'
    && evidence.includes('docs/decisions/DEC-194-ppk-013-client-data-access-boundary.md')
    && evidence.includes('artifacts/validation/32-I-ppk-013-client-data-access-runtime.json')
  ) || (
    item.id === 'PPK-014'
    && evidence.includes('docs/decisions/DEC-195-ppk-014-versioned-core-service-api-boundary.md')
    && evidence.includes('artifacts/validation/32-J-ppk-014-versioned-core-service-api-runtime.json')
  );
};
const complete = step?.status === 'COMPLETED';
const later = inspectAuthorizedSuccessorLifecycle({ plan, ledger, predecessorId: '31-J' });

check(scope.step === '31-J' && scope.decision === 'DEC-171', 'scope binds 31-J and DEC-171');
check(scope.primaryRequirement === 'DHA-001' && scope.requirements.length === 4, 'scope binds the main structure and security requirements');
check(scope.targets.legacyAuthority === 'DESKTOP_VAULT_AND_ACTIVE_SQLITE_REMAIN_AUTHORITATIVE', 'legacy Desktop data remains authoritative');
check(scope.targets.coreServiceDefault === 'REAL_DATA_AND_WRITE_OWNERSHIP_CUTOVER_BLOCKED', 'Core Service cutover is default-deny');
check(scope.targets.compositionFence === 'CORE_SERVICE_FAMILY_DATA_SESSION_ATTACHMENT_REJECTED', 'composition boundary attachment fence is selected');
check(scope.targets.automaticActivation === 'FORBIDDEN', 'automatic cutover is forbidden');
check(scope.requiredFutureGates.length === 5, 'all five future cutover acceptance gates are explicit');
check(scope.openBoundaries.realVaultTransfer === 'NOT_PERFORMED_BLOCKED', 'real vault transfer remains blocked');
check(scope.openBoundaries.sqliteOwnershipTransfer === 'NOT_PERFORMED_BLOCKED', 'SQLite ownership transfer remains blocked');
check(scope.openBoundaries.windowsServiceInstallation === 'APPROVAL_BOUND_NOT_RUN_NOT_PASS', 'Windows Service remains approval-bound');
check(authority.status === 'PASS' && authority.authority === 'EXPLICIT_USER_NEW_ARCHITECTURE_SECURITY_HARDENING', 'explicit security-hardening authority is recorded');
check(authority.predecessor?.step === '31-I' && authority.predecessor?.status === 'PASS', '31-I receipt continuation authority is recorded');
check(priority.status === 'PASS' && priority.failed === 0 && priority.passed === priority.expected, 'priority selection is clean PASS');
check(decision.includes('Desktop-owned encrypted user vault') && decision.includes('default-deny'), 'DEC-171 records coexistence and default-deny');
check(decision.includes('User approval alone does not bypass the technical gates'), 'DEC-171 forbids approval-only bypass');
check(currentDecisions.includes('DEC-171') && decisions.decisions.some((item) => item.id === 'DEC-171') && decisions.decisionCount === decisions.decisions.length, 'decision registers include DEC-171');
check(step?.title === scope.title && (plan.currentStep === '31-J' || later.planValid), 'work plan selects 31-J or an authorized successor');
check((complete && ledger.libraryUploadStatus === '31-J_COMPLETED_RECEIPT_PASS' && ledger.activeMicroStep === null) || (!complete && ledger.libraryUploadStatus.startsWith('31-J_MAIN_STRUCTURE_') && ledger.activeMicroStep === '31-J') || (complete && later.planValid && later.ledgerValid && later.nextTaskValid), 'governance ledger follows the 31-J or authorized-successor lifecycle');
check(requirementRecords.every(Boolean) && requirementRecords.every((item) => item.priority === 'P0' && authorizedRequirementState(item)), 'foundation requirements remain open P0 work or have an authorized successor closure');
check(requirementRecords.every((item) => item.evidence.includes('docs/decisions/DEC-171-family-data-coexistence-default-deny-cutover-gate.md')), 'scope registry binds DEC-171 evidence');

check(contracts.includes('CoreServiceFamilyDataCutoverStatusContract'), 'typed cutover status contract exists');
check(contracts.includes("readonly 'family-data-cutover.status'"), 'cutover status is in the canonical method map');
check(contracts.includes("readonly mode: 'coexistence-no-cutover'") && contracts.includes("readonly decision: 'blocked'"), 'protocol statically fixes coexistence and blocked decision');
check(contracts.includes('readonly realDataTransferAllowed: false') && contracts.includes('readonly writeOwnershipTransferAllowed: false'), 'protocol statically forbids data and write-ownership transfer');
check(contracts.includes('readonly automaticActivationAllowed: false') && contracts.includes('readonly cutoverAuthorityAttached: false'), 'protocol statically forbids automatic or attached authority');
check(contracts.includes('readonly persistentPathExposed: false') && contracts.includes('readonly secretMaterialExposed: false'), 'protocol statically forbids path and secret exposure');
check(contracts.includes("familyDataCutover: 'blocked'") && contracts.includes('automaticCutoverAllowed: false'), 'architecture safety contract is default-deny');
check(contracts.includes("'END_TO_END_SECURITY_VALIDATION'") && contracts.includes("'EXPLICIT_USER_CUTOVER_APPROVAL'"), 'contract declares the future gate identity range');

check(guard.includes('CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES'), 'guard owns the canonical future gate order');
check(guard.includes("decision: 'blocked'") && guard.includes('cutoverEpoch: 0'), 'guard emits an unadvanced blocked epoch');
check(guard.includes('legacyDesktopDataActive: true'), 'guard preserves legacy Desktop authority');
check(guard.includes('realDataTransferAllowed: false') && guard.includes('writeOwnershipTransferAllowed: false'), 'guard forbids data and write transfer');
check(guard.includes('automaticActivationAllowed: false') && guard.includes('cutoverAuthorityAttached: false'), 'guard forbids automatic or pre-attached cutover');
check(guard.includes('persistentPathExposed: false') && guard.includes('secretMaterialExposed: false'), 'guard exposes neither path nor secret');
check(guard.includes('FAMILY_DATA_CUTOVER_BLOCKED') && guard.includes('assertSessionAttachmentAllowed(): never'), 'guard exposes only a throwing attachment assertion');
check(!['node:fs', 'node:sqlite', 'databasePath', 'authenticationToken', 'password', '.attach('].some((marker) => guard.includes(marker)), 'guard has no storage, credential, database, or attachment dependency');
check(index.includes("export * from './family-data-cutover-guard.js'"), 'Core Service exports the guard boundary');

check(runtime.indexOf('this.#familyDataCutoverGuard.assertSessionAttachmentAllowed()') < runtime.indexOf('return this.#familyDataOwnership.attach(session)'), 'composition guard executes before session attachment');
check(runtime.includes('familyDataCutoverStatus()') && runtime.includes('return this.#familyDataCutoverGuard.status()'), 'Core Service runtime exposes safe cutover status');
check(runtime.includes('familyDataCutover: familyDataCutover.decision'), 'architecture follows live cutover guard status');
check(dispatcher.includes("typedMethod === 'family-data-cutover.status'") && dispatcher.includes('this.#runtime.familyDataCutoverStatus()'), 'central dispatcher serves safe cutover status');
check(client.includes("this.request('family-data-cutover.status', {})"), 'typed client exposes empty-payload cutover status only');
check(adapter.includes('getFamilyDataCutoverStatus(): Promise<CoreServiceFamilyDataCutoverStatusContract>'), 'Desktop adapter exposes typed cutover status');

check(startup.includes('adapter.getFamilyDataCutoverStatus()'), 'Desktop requests cutover status during startup');
check(startup.includes("familyDataCutover.decision !== 'blocked'"), 'Desktop rejects a permissive cutover decision');
check(startup.includes('familyDataCutover.realDataTransferAllowed !== false') && startup.includes('familyDataCutover.writeOwnershipTransferAllowed !== false'), 'Desktop rejects transfer permissions');
check(startup.includes('familyDataCutover.automaticActivationAllowed !== false') && startup.includes('familyDataCutover.cutoverAuthorityAttached !== false'), 'Desktop rejects automatic or pre-authorized cutover');
check(startup.includes('familyDataCutover.persistentPathExposed !== false') && startup.includes('familyDataCutover.secretMaterialExposed !== false'), 'Desktop rejects path or secret exposure');
check(startup.includes('familyDataCutover.requiredGates.some'), 'Desktop verifies exact future gate order and pending state');
check(startup.includes('architecture.safety.familyDataCutover !== familyDataCutover.decision'), 'Desktop rejects architecture/status contradiction');

check(dispatcherTest.includes("'family-data-cutover.status'") && dispatcherTest.includes('realDataTransferAllowed: false'), 'dispatcher test covers safe cutover route');
check(dispatcherTest.includes("{ allow: true }") && dispatcherTest.includes("code: 'INVALID_REQUEST'"), 'dispatcher test rejects an enable-shaped payload');
check(guardTest.includes('reports an immutable no-cutover decision without exposing sensitive material'), 'targeted test covers immutable privacy status');
check(guardTest.includes('blocks session attachment at the Core Service composition boundary'), 'targeted test covers composition attachment rejection');
check(coreContract.status === 'PASS' && coreContract.failures.length === 0, 'Core Service contract regression is PASS');
check(desktopContract.status === 'PASS' && desktopContract.failures.length === 0, 'Desktop startup contract regression is PASS');
check(!JSON.stringify([scope, authority, priority]).includes('G:\\') && !JSON.stringify([scope, authority, priority]).includes("Drive'ım"), '31-J governance has no unused drive address');
check(scope.requirementCompletionClaimed === false && authority.requirementCompletionClaimed === false, 'no false requirement completion claim');
check(scope.newBuildIssued === false && authority.newBuildIssued === false, 'no new Build is issued');

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion: 1, release: scope.release, step: '31-J', phase: 'FAMILY_DATA_COEXISTENCE_DEFAULT_DENY_CUTOVER_GATE_CONTRACT',
  status: failed.length ? 'FAIL' : 'PASS', expected: checks.length, executed: checks.length,
  passed: checks.length - failed.length, failed: failed.length, checks,
  requirements: scope.requirements, requirementCompletionClaimed: false, newBuildIssued: false, verifiedAt: new Date().toISOString()
};
if (!successorRegression) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/31-J_FAMILY_DATA_COEXISTENCE_DEFAULT_DENY_CUTOVER_GATE_CONTRACT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failed.length) {
  console.error(`31-J cutover gate contract: FAIL (${failed.length}/${checks.length}).`);
  for (const item of failed) console.error(`- ${item.name}`);
  process.exit(1);
}
console.log(`31-J cutover gate contract: PASS (${checks.length}/${checks.length}; real data cutover remains blocked).`);
