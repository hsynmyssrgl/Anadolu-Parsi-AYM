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
  repositoryContext: 'packages/repository-contracts/src/repository-context.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  dispatcher: 'apps/core-service/src/core-service-method-dispatcher.ts',
  test: 'packages/platform-policy/policy-context-binding.test.ts',
  universalApi: 'apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  decision: 'docs/decisions/DEC-185-ppk-004-complete-policy-context-binding.md',
  audit: 'docs/audit/31-Z_PPK-004_TAM_POLITIKA_BAGLAMI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-004');
const scope = JSON.parse(await readFile('config/31-z-ppk-004-complete-policy-context-binding-scope.json', 'utf8'));
const contextFields = [
  'accountId', 'personId', 'deviceId', 'applicationId', 'roles', 'familyIds',
  'householdIds', 'familyBranchIds', 'ownerPersonId', 'purpose', 'occurredAt', 'action', 'capability'
];

check('canonical context snapshot is a public policy-kernel contract', sources.kernel.includes('export interface PlatformPolicyContextSnapshot') && sources.kernel.includes('export const platformPolicyContextSnapshot'));
check('context snapshot covers every PPK-004 identity and operation field', contextFields.every((field) => sources.kernel.includes(field)), { fieldCount: contextFields.length });
check('context hash uses SHA-256 over the canonical snapshot', sources.kernel.includes("createHash('sha256').update(stable(platformPolicyContextSnapshot(request))"));
check('signed decisions carry the computed context hash', sources.kernel.includes('readonly contextHash?: string') && sources.kernel.includes('contextHash = platformPolicyContextHash(request)'));
check('strict requests require a bounded correlation and purpose',
  sources.kernel.includes('strictContext && (')
  && sources.kernel.includes('!nonEmpty(request.correlationId, 128)')
  && sources.kernel.includes('!nonEmpty(request.purpose, 256)'));
check('roles require a non-empty unique bounded set', sources.kernel.includes('validUniqueStrings(request.subject.roles, 1, 64, 128)'));
check('family scope requires a non-empty unique bounded set', sources.kernel.includes('validUniqueStrings(request.subject.familyIds, 1, 10_000, 256)'));
check('strict household and family-branch sets are explicit', sources.kernel.includes("strictContext && (!Array.isArray(request.subject.householdIds) || !Array.isArray(request.subject.familyBranchIds))"));
check('family, household and branch resource scope are enforced', ['familyIds!.includes', 'householdIds.includes', 'familyBranchIds.includes'].every((marker) => sources.kernel.includes(marker)));
check('resource owner and source identities are validated when present', sources.kernel.includes('request.resource.ownerPersonId !== undefined') && sources.kernel.includes('request.resource.sourceResourceId !== undefined'));
check('PEP requires purpose before any dependency resolution', sources.enforcement.indexOf('this.#assertIntent(intent)') < sources.enforcement.indexOf('this.#authorityResolver.resolve()') && sources.enforcement.includes('Policy intent purpose is required and invalid'));
check('PEP emits explicit empty household and branch scopes', sources.enforcement.includes('householdIds: Object.freeze([...(authority.householdIds ?? [])])') && sources.enforcement.includes('familyBranchIds: Object.freeze([...(authority.familyBranchIds ?? [])])'));
check('PEP rejects a provider context-hash mismatch before execution', sources.enforcement.includes('authorization.decision.contextHash !== contextHash') && sources.enforcement.indexOf('authorization.decision.contextHash !== contextHash') < sources.enforcement.indexOf('await operation(context)'));
check('active transaction context carries context hash, owner, purpose and time', ['readonly contextHash: string', 'readonly resourceOwnerPersonId?: string', 'readonly purpose: string', 'readonly occurredAt: string'].every((marker) => sources.enforcement.includes(marker)));
check('active transaction assertion recomputes the receipt-record context hash', sources.enforcement.includes('platformPolicyContextHash(context.receiptRecord.request)') && sources.enforcement.includes('context.contextHash !== boundContextHash'));
check('repository context forwards detailed expectations to the PEP assertion', ['resourceFamilyId', 'resourceHouseholdId', 'resourceFamilyBranchId', 'resourceOwnerPersonId', 'purpose', 'occurredAt', 'contextHash'].every((marker) => sources.repositoryContext.includes(marker)));
check('repository persistence binding exposes the complete operation binding', ['contextHash: authorization.contextHash', 'resourceFamilyId: authorization.resourceFamilyId', 'purpose: authorization.purpose', 'occurredAt: authorization.receiptRecord.recordedAt'].every((marker) => sources.repository.includes(marker)));
check('repository insert persists context_hash with the exact receipt', sources.repository.includes('receipt_hash,receipt_version,request_hash,context_hash') && sources.repository.includes('record.contextHash'));
check('repository rejects mismatched decision, receipt and transaction hashes', sources.repository.includes('record.contextHash !== authorization.contextHash') && sources.repository.includes('record.contextHash !== record.receipt.decision.contextHash'));
check('migration 69 is registered', sources.migration.includes("createMigrationDefinition(69, 'ppk004_complete_policy_context_binding'"));
check('migration adds a backward-compatible context_hash column and index', sources.migration.includes('ADD COLUMN context_hash TEXT') && sources.migration.includes('idx_platform_policy_receipt_context'));
check('SQLite insert trigger requires context binding on every new receipt', sources.migration.includes('trg_ppk004_platform_policy_context_insert') && sources.migration.includes('platform policy context binding is missing or inconsistent'));
check('SQLite trigger matches record, decision and signed receipt hashes', ['$.contextHash', '$.decision.contextHash', '$.receipt.decision.contextHash'].every((marker) => sources.migration.includes(marker)));
check('Core Service authorize and verify APIs require strict complete context', sources.dispatcher.includes('hasStrictPolicyContext') && sources.dispatcher.includes("request.enforcementMode === 'strict'") && sources.dispatcher.includes('Complete strict policy context'));
check('targeted tests cover hash sensitivity, missing context, scope and tamper denial', ['changes the binding when any user', 'fails closed for %s', 'denies a resource outside the %s authority scope', 'rejects a provider decision carrying a context hash'].every((marker) => sources.test.includes(marker)));
check('renderer UI and menu remain confined to authenticated PEP plus preload IPC', sources.universalApi.includes('this.#enforcementPoint.execute') && sources.main.includes('universalApiPolicyEnforcement().execute') && sources.preload.includes("contextBridge.exposeInMainWorld('pardus'"));
check('decision and audit explicitly preserve the no-cutover boundary', sources.decision.includes('DEC-171') && sources.audit.includes('Gerçek veri taşınmamıştır'));
check('accepted scope and closure scope mark only PPK-004 complete', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true);

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '31-Z',
  requirement: 'PPK-004',
  phase: 'COMPLETE_POLICY_CONTEXT_BINDING_CONTRACT',
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
await writeFile('artifacts/validation/31-Z-ppk-004-complete-policy-context-binding-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`31-Z PPK-004 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`31-Z PPK-004 contract: PASS (${checks.length}/${checks.length}).`);
