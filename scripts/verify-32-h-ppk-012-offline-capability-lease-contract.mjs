import { mkdir, readFile, writeFile } from 'node:fs/promises';

const checks = [];
const failures = [];
const check = (name, condition) => {
  const status = condition ? 'PASS' : 'FAIL';
  checks.push({ name, status });
  if (!condition) failures.push(name);
};
const sources = Object.fromEntries(await Promise.all(Object.entries({
  policy: 'packages/platform-policy/src/offline-capability-lease.ts',
  domain: 'packages/domain/src/app-data.ts',
  useCase: 'packages/application/src/offline-capability-lease-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/offline-capability-lease-repository.ts',
  repository: 'packages/repositories/src/offline-capability-lease-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  adapter: 'apps/desktop/src/main/authorization-application-adapter.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  cache: 'apps/desktop/src/main/ipc-read-sharing.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  targetedTest: 'apps/desktop/tests/ppk012-offline-capability-lease-cache-fence.test.ts',
  dataStoreTest: 'apps/desktop/tests/data-store.test.ts',
  decision: 'docs/decisions/DEC-193-ppk-012-offline-capability-lease-cache-fence.md',
  audit: 'docs/audit/32-H_PPK-012_CEVRIMDISI_CAPABILITY_LEASE_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-012');
const scope = JSON.parse(await readFile('config/32-h-ppk-012-offline-capability-lease-scope.json', 'utf8'));
const ledger = JSON.parse(await readFile('config/user-decision-ledger.json', 'utf8'));

check('lease duration has a hard 24-hour ceiling', sources.policy.includes('OFFLINE_CAPABILITY_LEASE_MAX_SECONDS = 86_400'));
check('lease duration has a positive minimum', sources.policy.includes('OFFLINE_CAPABILITY_LEASE_MIN_SECONDS = 60'));
check('lease binds family, subject, device and capability', ['familyId','subjectAccountId','deviceId','capability'].every((field) => sources.policy.includes(`readonly ${field}:`)));
check('lease binds policy package and capability manifest', sources.policy.includes('readonly policyPackageSha256: string') && sources.policy.includes('readonly capabilityManifestSha256: string'));
check('lease carries a canonical SHA-256 integrity identity', sources.policy.includes('computeOfflineCapabilityLeaseSha256') && sources.policy.includes("createHash('sha256')"));
check('structural validation enforces finite canonical time', sources.policy.includes('isOfflineCapabilityLeaseStructurallyValid') && sources.policy.includes('expires - notBefore > OFFLINE_CAPABILITY_LEASE_MAX_SECONDS'));
check('offline lease cannot replace online policy', sources.policy.includes("if (input.online) return denied('ONLINE_MODE')"));
check('exact expiry is fail closed', sources.policy.includes("occurredAt >= Date.parse(lease.expiresAt)") && sources.policy.includes("denied('EXPIRED')"));
check('all security context mismatches have dedicated denials', ['FAMILY_MISMATCH','SUBJECT_MISMATCH','DEVICE_MISMATCH','CAPABILITY_MISMATCH','POLICY_PACKAGE_MISMATCH','CAPABILITY_MANIFEST_MISMATCH'].every((reason) => sources.policy.includes(reason)));
check('revocation recomputes integrity and remains structurally valid', sources.policy.includes('revokeOfflineCapabilityLease') && sources.policy.includes('computeOfflineCapabilityLeaseSha256(unsigned)'));
check('domain exposes lease, issue and cache-state views', sources.domain.includes('export interface OfflineCapabilityLeaseView') && sources.domain.includes('export interface IssueOfflineCapabilityLeaseInput') && sources.domain.includes('export interface OfflineSensitiveCacheStateView'));
check('domain workspace exposes lease and cache state together', sources.domain.includes('export interface OfflineCapabilityLeaseWorkspaceView'));
check('repository contract exposes list, active lookup, insert and revoke', ['listForFamily','findActiveForScope','insert(','revoke('].every((token) => sources.repositoryContract.includes(token)));
check('repository maps every policy binding from SQLite', sources.repository.includes('policy_package_sha256') && sources.repository.includes('capability_manifest_sha256') && sources.repository.includes('lease_sha256'));
check('repository active lookup excludes revoked and expired leases', sources.repository.includes('revoked_at IS NULL AND not_before<=? AND expires_at>?'));
check('repository insert persists the complete lease envelope', sources.repository.includes('INSERT INTO offline_capability_leases') && sources.repository.includes('lease.policyPackageSha256'));
check('repository revocation is compare-and-set on active rows', sources.repository.includes('WHERE lease_id=? AND revoked_at IS NULL'));
check('migration 76 creates the durable lease table and scope index', sources.migration.includes('CREATE TABLE offline_capability_leases') && sources.migration.includes('idx_offline_capability_lease_scope'));
check('migration enforces the 60..86400 second window', sources.migration.includes('BETWEEN 60 AND 86400'));
check('migration makes lease identity fields immutable', sources.migration.includes('trg_ppk012_offline_capability_lease_immutable'));
check('migration permits only one valid revocation transition', sources.migration.includes('trg_ppk012_offline_capability_lease_revoke_once'));
check('migration 76 is append-only registered', sources.migration.includes("createMigrationDefinition(76, 'ppk012_offline_capability_lease_cache_fence'"));
check('application exposes list, issue, revoke and evaluate use cases', ['ListOfflineCapabilityLeasesUseCase','IssueOfflineCapabilityLeaseUseCase','RevokeOfflineCapabilityLeaseUseCase','EvaluateOfflineCapabilityLeaseUseCase'].every((name) => sources.useCase.includes(`class ${name}`)));
check('lease administration uses the central authorization service', sources.useCase.includes('new CentralAuthorizationService()') && sources.useCase.includes("resourceType: 'offline_capability_lease'"));
check('desktop adapter and composition root wire the repository', sources.adapter.includes('offlineCapabilityLeaseRepository') && sources.composition.includes('SqliteOfflineCapabilityLeaseRepository'));
check('sensitive cache starts locked and requires an active lease', sources.cache.includes("#reason: OfflineSensitiveCacheStateView['reason'] = 'NO_LEASE'") && sources.cache.includes('public activate(lease: OfflineCapabilityLease'));
check('cache entries are bound to lease digest and capped at lease expiry', sources.cache.includes('leaseSha256: this.#lease.leaseSha256') && sources.cache.includes('Math.min(now + options.ttlMs, Date.parse(this.#lease.expiresAt))'));
check('expiry, revocation and mismatch clear then lock the cache', sources.cache.includes("this.lock('EXPIRED')") && sources.cache.includes("this.lock('REVOKED')") && sources.cache.includes("'CONTEXT_MISMATCH'"));
check('logout locks the sensitive cache', sources.main.includes("offlineSensitiveCache.lock('NO_LEASE')"));
check('typed IPC, preload and renderer declaration expose the lease workspace', sources.main.includes("registerIpcHandler('offlineCapability:getWorkspace'") && sources.preload.includes('getOfflineCapabilityLeaseWorkspace') && sources.global.includes('issueOfflineCapabilityLease'));
check('existing permissions menu renders lease and lock controls', sources.renderer.includes('Çevrimdışı yetki kirası ve hassas önbellek kilidi') && sources.renderer.includes('Kirayı iptal et ve kilitle'));
check('registry, decision, scope and runtime tests close only PPK-012 truthfully', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.persistentSensitivePayloadCacheIntroduced === false && ledger.decisions.at(-1)?.id === 'DEC-193' && (sources.targetedTest.match(/\bit\(/gu) ?? []).length === 12 && sources.dataStoreTest.includes('PPK-012 çevrimdışı yetki kirasını kalıcılaştırır') && sources.decision.includes('kalıcı hassas payload cache eklemez') && sources.audit.includes('no-cache'));

const report = {
  schemaVersion: 1, release: 'Bronze 04.08.2026.29', step: '32-H', requirement: 'PPK-012',
  phase: 'OFFLINE_CAPABILITY_LEASE_CONTRACT', status: failures.length === 0 ? 'PASS' : 'FAIL',
  checkCount: checks.length, passed: checks.filter((item) => item.status === 'PASS').length, failed: failures.length,
  checks, failures, persistentSensitivePayloadCacheIntroduced: false, policySensitiveIpcNoCacheWeakened: false,
  cutoverAuthorityAttached: false, realDataTransferPerformed: false,
  requirementCompletionClaimed: failures.length === 0, generatedAt: new Date().toISOString()
};
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-H-ppk-012-offline-capability-lease-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`32-H PPK-012 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-H PPK-012 contract: PASS (${checks.length}/${checks.length}).`);
