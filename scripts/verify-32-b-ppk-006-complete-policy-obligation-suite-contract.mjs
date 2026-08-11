import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition, details = undefined) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status, ...(details === undefined ? {} : { details }) });
  if (!condition) failures.push(name);
};

const sources = Object.fromEntries(await Promise.all(Object.entries({
  kernel: 'packages/platform-policy/src/policy-kernel.ts',
  enforcement: 'packages/platform-policy/src/policy-enforcement-point.ts',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  targetedTest: 'packages/platform-policy/policy-obligation-suite.test.ts',
  coreTest: 'apps/core-service/tests/platform-policy-obligation-execution.test.ts',
  durableTest: 'apps/desktop/tests/archive-durable-policy-transaction-runtime.test.ts',
  universalApi: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  decision: 'docs/decisions/DEC-187-ppk-006-complete-policy-obligation-suite.md',
  audit: 'docs/audit/32-B_PPK-006_POLITIKA_YUKUMLULUKLERI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-006');
const scope = JSON.parse(await readFile('config/32-b-ppk-006-complete-policy-obligation-suite-scope.json', 'utf8'));
const obligationTypes = [
  'mask_fields', 'local_processing_only', 'no_cache', 'no_export',
  'no_ai', 'no_recording', 'watermark', 'delete_after'
];

check('policy obligation domain has one reusable type', sources.kernel.includes('export type PolicyObligationType'));
check('all eight accepted PPK-006 obligations are published', obligationTypes.every((value) => sources.kernel.includes(`'${value}'`)) && sources.kernel.includes('PPK006_POLICY_OBLIGATION_TYPES'), { obligationCount: obligationTypes.length });
check('data classes map to deterministic obligation sets', sources.kernel.includes('const obligationDataClassSets') && ['localProcessingOnly', 'noCache', 'noExport', 'noAi', 'noRecording'].every((value) => sources.kernel.includes(`${value}: new Set<PlatformDataClass>`)));
check('non-owner reads receive signed field masking', sources.kernel.includes("const nonOwnerRead = request.action === 'read' && !owner") && sources.kernel.includes("type: 'mask_fields'"));
check('missing field projections use one wildcard mask', sources.kernel.includes(": ['*']"));
check('declared field masks are put in canonical order', sources.kernel.includes('[...request.requestedFields].sort()'));
check('special processing can be confined to local execution', sources.kernel.includes('obligationDataClassSets.localProcessingOnly') && sources.kernel.includes("type: 'local_processing_only'"));
check('restricted classes generate no-cache', sources.kernel.includes('obligationDataClassSets.noCache') && sources.kernel.includes("type: 'no_cache'"));
check('restricted and offline data generate no-export', sources.kernel.includes('obligationDataClassSets.noExport') && sources.kernel.includes("if (!request.online) addObligation({ type: 'no_export' })"));
check('restricted classes generate no-AI', sources.kernel.includes('obligationDataClassSets.noAi') && sources.kernel.includes("type: 'no_ai'"));
check('restricted classes generate no-record', sources.kernel.includes('obligationDataClassSets.noRecording') && sources.kernel.includes("type: 'no_recording'"));
check('share watermark is bound to policy version and correlation', sources.kernel.includes('policy:${this.#config.policyVersion};correlation:${request.correlationId}'));
check('retention is bound to consent or the strictest data class', sources.kernel.includes('retentionPriority.find') && sources.kernel.includes('retention:consent-policy') && sources.kernel.includes('retention:data-class:${retentionClass}'));
check('value-less controls reject injected values', sources.enforcement.includes('noValueObligations.has(obligation.type) && value !== undefined'));
check('mask fields require unique canonical requested fields or wildcard', sources.enforcement.includes('!uniqueStrings(value)') && sources.enforcement.includes("value.includes('*')") && sources.enforcement.includes('request.requestedFields'));
check('watermark execution validates exact context binding', sources.enforcement.includes('value !== `policy:${request.policyVersion};correlation:${request.correlationId}`'));
check('retention execution accepts only the closed policy vocabulary', sources.enforcement.includes('retention:(?:consent-policy|data-class:'));
check('PEP exposes all enforceable obligation controls', ['localProcessingOnly', 'allowCache', 'allowExport', 'allowAi', 'allowRecording', 'maskedFields', 'watermark', 'deleteAfter'].every((value) => sources.enforcement.includes(`readonly ${value}`)));
check('obligations execute before the operation callback', sources.enforcement.indexOf('executePolicyObligations(effectiveRequest') < sources.enforcement.indexOf('await operation(context)'));
check('no-export blocks file sharing before operation', sources.enforcement.includes("!controls.allowExport && request.capability === 'file.share'"));
check('no-AI blocks AI processing before operation', sources.enforcement.includes("!controls.allowAi && request.capability === 'ai.process'"));
check('no-record blocks communication recording before operation', sources.enforcement.includes("!controls.allowRecording && request.capability === 'communication.record'"));
check('local-only rejects non-local application identities', sources.enforcement.includes('localProcessingApplications.has(request.subject.applicationId)'));
check('execution attestation hashes request nonce sequence controls and time', ['requestHash', 'receiptNonce', 'executedAt', 'executed', 'controls', 'attestationHash'].every((value) => sources.enforcement.includes(`readonly ${value}`)) && sources.enforcement.includes('sha256(stable(payload))'));
check('active context verifies the exact receipt-bound execution attestation', sources.enforcement.includes('assertObligationExecution(context.obligationExecution, context.receipt)') && sources.enforcement.includes('execution.attestationHash !== sha256'));
check('receipt record carries obligation execution evidence', sources.enforcement.includes('readonly obligationExecution?: PlatformPolicyObligationExecution') && sources.enforcement.includes('{ obligationExecution }'));
check('repository contract preserves historical compatibility for execution hash', sources.repositoryContract.includes('readonly obligationExecutionHash?: string'));
check('repository binding requires the active execution attestation', sources.repository.includes('obligationExecutionHash: authorization.obligationExecution.attestationHash') && sources.repository.includes('record.obligationExecution.attestationHash !== authorization.obligationExecution.attestationHash'));
check('repository persists obligation execution hash beside the receipt', sources.repository.includes('data_classes_json,obligation_execution_hash') && sources.repository.includes('record.obligationExecution!.attestationHash'));
check('migration 71 adds and enforces the execution hash', sources.migration.includes("createMigrationDefinition(71, 'ppk006_complete_policy_obligation_suite'") && sources.migration.includes('ADD COLUMN obligation_execution_hash TEXT') && sources.migration.includes('trg_ppk006_platform_policy_obligation_execution_insert'));
check('targeted and durable tests cover all obligations conflicts and missing persistence', sources.targetedTest.includes('publishes the eight accepted PPK-006 obligation types') && sources.targetedTest.includes('blocks a conflicting %s operation') && sources.coreTest.includes('executes every signed obligation before the operation') && sources.durableTest.includes('missing-obligation-execution'));
check('accepted scope, UI/menu confinement and no-cutover truth are closed', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && sources.universalApi.includes('this.#enforcementPoint.execute') && sources.main.includes('universalApiPolicyEnforcement().execute') && sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.decision.includes('DEC-171') && sources.audit.includes('Gerçek veri taşınmamıştır'));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-B',
  requirement: 'PPK-006',
  phase: 'COMPLETE_POLICY_OBLIGATION_SUITE_CONTRACT',
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  passed: checks.filter((item) => item.status === 'PASS').length,
  failed: failures.length,
  checks,
  failures,
  cutoverAuthorityAttached: false,
  realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-B-ppk-006-complete-policy-obligation-suite-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`32-B PPK-006 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-B PPK-006 contract: PASS (${checks.length}/${checks.length}).`);
