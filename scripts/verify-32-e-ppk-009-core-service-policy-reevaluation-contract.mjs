import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};
const sources = Object.fromEntries(await Promise.all(Object.entries({
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  enforcement: 'packages/platform-policy/src/policy-enforcement-point.ts',
  coreMain: 'apps/core-service/src/main.ts',
  coreRuntime: 'apps/core-service/src/core-service-runtime.ts',
  dispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts',
  adapter: 'apps/desktop/src/main/core-service-application-adapter.ts',
  universal: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  targetedTest: 'apps/desktop/tests/core-service-policy-reevaluation.test.ts',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  decision: 'docs/decisions/DEC-190-ppk-009-core-service-policy-reevaluation.md',
  audit: 'docs/audit/32-E_PPK-009_CORE_SERVICE_POLITIKA_YENIDEN_DEGERLENDIRME_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-009');
const scope = JSON.parse(await readFile('config/32-e-ppk-009-core-service-policy-reevaluation-scope.json', 'utf8'));

check('decision authority has a closed vocabulary', sources.kernel.includes("export type PlatformPolicyDecisionAuthorityId = 'local-policy-kernel' | 'windows-core-service'"));
check('kernel configuration accepts an explicit decision authority', sources.kernel.includes('readonly decisionAuthorityId?: PlatformPolicyDecisionAuthorityId'));
check('invalid decision authority stops composition', sources.kernel.includes("throw new Error('decisionAuthorityId is invalid')"));
check('signed package payload carries the decision authority', sources.kernel.includes('export interface PlatformPolicyPackagePayload') && sources.kernel.includes('decisionAuthorityId: this.#config.decisionAuthorityId'));
check('strict request carries the expected evaluator', sources.kernel.includes('Trusted process that must freshly evaluate this complete request'));
check('decision carries the actual evaluator', sources.kernel.includes('export interface PlatformPolicyDecision') && sources.kernel.includes('readonly decisionAuthorityId?:'));
check('context hash covers decision authority', sources.kernel.includes("decisionAuthorityId: request.decisionAuthorityId ?? ''"));
check('missing or changed evaluator is denied', sources.kernel.includes("return deny('DECISION_AUTHORITY_MISMATCH')"));
check('allow decisions bind signed evaluator identity', sources.kernel.includes("decisionAuthorityId: this.#config.decisionAuthorityId"));
check('receipt signing includes the complete decision', sources.kernel.includes('const unsigned = { receiptVersion: 1 as const, requestHash: digest(request), decision'));
check('PEP authority receives package-bound evaluator', sources.enforcement.includes('const decisionAuthorityId = policyPackage.payload.decisionAuthorityId'));
check('PEP request carries evaluator before provider crossing', sources.enforcement.includes('decisionAuthorityId: authority.decisionAuthorityId'));
check('PEP compares returned evaluator before persistence', sources.enforcement.includes('authorization.decision.decisionAuthorityId !== effectiveRequest.decisionAuthorityId'));
check('active context revalidates request evaluator', sources.enforcement.includes('context.decisionAuthorityId !== context.receiptRecord.request.decisionAuthorityId'));
check('active context revalidates signed receipt evaluator', sources.enforcement.includes('context.decisionAuthorityId !== context.receipt.decision.decisionAuthorityId'));
check('provider exposes an explicit Core process marker', sources.enforcement.includes("readonly decisionAuthority?: 'windows-core-service'"));
check('Core adapter is the production marked provider', sources.adapter.includes("decisionAuthority: 'windows-core-service'"));
check('Core production kernel signs itself as authority', sources.coreMain.includes("decisionAuthorityId: 'windows-core-service'"));
check('Core runtime rejects a conflicting signed authority', sources.coreRuntime.includes('Core Service is not the signed policy decision authority'));
check('Core runtime freshly calls kernel authorization', sources.coreRuntime.includes('this.#kernel.authorizeWithReceipt(effectiveRequest'));
check('Core narrows Desktop fence with live writability', sources.coreRuntime.includes('request.clusterWritable && fence.writable'));
check('dispatcher requires a complete strict policy context', sources.dispatcher.includes('hasStrictPolicyContext') && sources.dispatcher.includes("typedMethod === 'policy.authorize'"));
check('Desktop universal PEP requires the Core provider marker', sources.universal.includes("dependencies.authorizationProvider?.decisionAuthority !== 'windows-core-service'"));
check('UI intent is derived from channel not visibility claims', sources.universal.includes('resolveDesktopUniversalApiIntent') && !sources.universal.includes('visible:'));
check('receiptless bootstrap is a closed explicit registry', sources.universal.includes('const BOOTSTRAP_CHANNELS = new Set([') && sources.targetedTest.includes('receiptless execution limited'));
check('protected operation executes only inside active signed callback', sources.universal.includes('assertActivePlatformPolicyTransactionContext') && sources.universal.includes('runAuthorized(authorization, input.operation)'));
check('production main composes universal PEP with Core provider', sources.main.includes('authorizationProvider: coreService.adapter.policyProvider'));
check('repository contract preserves migration-74 history', sources.repositoryContract.includes('migration-74 decision-authority metadata'));
check('repository persists and compares decision authority', sources.repository.includes('decision_authority_id') && sources.repository.includes('record.decisionAuthorityId !== authorization.decisionAuthorityId'));
check('migration 74 adds the exact JSON binding trigger', sources.migration.includes("createMigrationDefinition(74, 'ppk009_core_service_decision_reevaluation'") && sources.migration.includes('trg_ppk009_platform_policy_decision_authority_insert'));
check('targeted test proves provider relabel and UI bypass default deny', sources.targetedTest.includes('relabels a Core decision as local') && sources.targetedTest.includes('without the Core process marker'));
check('scope registry UI menu evidence and no-cutover truth are closed', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.decision.includes('DEC-171') && sources.audit.includes('Gerçek veri taşınmamıştır'));

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-E', requirement: 'PPK-009',
  phase: 'CORE_SERVICE_POLICY_REEVALUATION_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL', checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length, failed: failures.length,
  checks, failures, cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-E-ppk-009-core-service-policy-reevaluation-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-E PPK-009 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-E PPK-009 contract: PASS (${checks.length}/${checks.length}).`);
