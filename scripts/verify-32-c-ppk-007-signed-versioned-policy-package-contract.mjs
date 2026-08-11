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
  targetedTest: 'packages/platform-policy/policy-package-version-binding.test.ts',
  healthContract: 'packages/core-service-contracts/src/index.ts',
  coreRuntime: 'apps/core-service/src/core-service-runtime.ts',
  coreMain: 'apps/core-service/src/main.ts',
  adapter: 'apps/desktop/src/main/core-service-application-adapter.ts',
  startup: 'apps/desktop/src/main/core-service-startup-connection.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  repositoryContract: 'packages/repository-contracts/src/platform-policy-transaction-repository.ts',
  repository: 'packages/repositories/src/platform-policy-transaction-repository.ts',
  migration: 'packages/database/src/family-database-migrations.ts',
  decision: 'docs/decisions/DEC-188-ppk-007-signed-versioned-policy-package.md',
  audit: 'docs/audit/32-C_PPK-007_IMZALI_SURUMLU_POLITIKA_PAKETI_UST_KAPANIS.md'
}).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));

const registry = JSON.parse(await readFile('config/accepted-scope-registry.json', 'utf8'));
const requirement = registry.requirements.find((item) => item.id === 'PPK-007');
const scope = JSON.parse(await readFile('config/32-c-ppk-007-signed-versioned-policy-package-scope.json', 'utf8'));

check('policy package payload has one explicit schema', sources.kernel.includes('export interface PlatformPolicyPackagePayload'));
check('signed package publishes payload hash algorithm and signature', sources.kernel.includes('export interface PlatformPolicyPackage') && sources.kernel.includes("readonly signatureAlgorithm: 'HMAC-SHA256'"));
check('package payload uses deterministic canonical serialization', sources.kernel.includes('const stable =') && sources.kernel.includes('Object.keys(record).sort()'));
check('payload binding uses plain SHA-256', sources.kernel.includes("createHash('sha256').update(stable(value)"));
check('package signature uses domain-separated HMAC-SHA-256', sources.kernel.includes("createHmac('sha256', key).update('ppt-policy-package-v1\\0'"));
check('package version is a positive safe integer', sources.kernel.includes('policyPackageVersion must be a positive safe integer'));
check('capability rules are canonicalized before packaging', sources.kernel.includes('[...(capabilities ?? [])].sort()'));
check('application versions are inside the signed payload', sources.kernel.includes('readonly applicationVersions') && sources.kernel.includes('applicationVersions: this.#config.applicationVersions!'));
check('kernel self-verifies its package before use', sources.kernel.includes('signed policy package self-verification failed'));
check('package verification compares signatures in constant time', sources.kernel.includes('verifyPolicyPackage') && sources.kernel.includes('timingSafeEqual(expected, actual)'));
check('strict request carries package version and SHA-256', sources.kernel.includes('readonly policyPackageVersion?: number') && sources.kernel.includes('readonly policyPackageSha256?: string'));
check('subject and context snapshot carry application version', sources.kernel.includes('readonly applicationVersion?: string') && sources.kernel.includes("applicationVersion: request.subject.applicationVersion ?? ''"));
check('decision carries the exact package and application binding', sources.kernel.includes('readonly policyPackageSha256?: string') && sources.kernel.includes('applicationVersion: decisionApplicationVersion!'));
check('three mismatch reasons are in the closed reason vocabulary', ['POLICY_PACKAGE_VERSION_MISMATCH','POLICY_PACKAGE_HASH_MISMATCH','APPLICATION_VERSION_MISMATCH'].every((value) => sources.kernel.includes(`'${value}'`)));
check('package version mismatch is denied', sources.kernel.includes("return deny('POLICY_PACKAGE_VERSION_MISMATCH')"));
check('package hash mismatch is denied', sources.kernel.includes("return deny('POLICY_PACKAGE_HASH_MISMATCH')"));
check('application version mismatch is denied', sources.kernel.includes("return deny('APPLICATION_VERSION_MISMATCH')"));
check('receipt verification requires package version and hash', sources.kernel.includes('receipt.decision.policyPackageVersion !== this.#policyPackage.payload.packageVersion') && sources.kernel.includes('receipt.decision.policyPackageSha256 !== this.#policyPackage.payloadSha256'));
check('out-of-process provider exposes trusted package metadata', sources.enforcement.includes('readonly resolvePolicyPackage?:') && sources.adapter.includes('resolvePolicyPackage: () =>'));
check('missing provider package metadata fails authority validation', sources.enforcement.includes("!Number.isSafeInteger(authority.policyPackageVersion)") && sources.targetedTest.includes('provider authority omits package bindings'));
check('PEP builds strict requests with all three bindings', sources.enforcement.includes('policyPackageVersion: authority.policyPackageVersion!') && sources.enforcement.includes('applicationVersion: authority.applicationVersion!'));
check('PEP checks decision binding before persistence and callback', sources.enforcement.includes('authorization.decision.policyPackageSha256 !== effectiveRequest.policyPackageSha256') && sources.enforcement.indexOf('authorization.decision.policyPackageSha256') < sources.enforcement.indexOf('await operation(context)'));
check('receipt record carries package binding explicitly', sources.enforcement.includes('readonly policyPackageVersion: number') && sources.enforcement.includes('policyPackageSha256: effectiveRequest.policyPackageSha256!'));
check('active transaction context revalidates package binding', sources.enforcement.includes('context.policyPackageVersion !== context.receiptRecord.request.policyPackageVersion') && sources.enforcement.includes('context.applicationVersion !== context.receiptRecord.applicationVersion'));
check('Core Service health contract publishes the signed package', sources.healthContract.includes('readonly policyPackage: PlatformPolicyPackage'));
check('Core Service rejects its application API version mismatch', sources.coreRuntime.includes('application API version does not match the signed policy package') && sources.coreMain.includes("'windows-core-service': CORE_SERVICE_APPLICATION_API_VERSION"));
check('Desktop startup validates package payload SHA-256', sources.startup.includes("createHash('sha256').update(stable(policyPackage.payload)") && sources.startup.includes("'POLICY_PACKAGE_MISMATCH'"));
check('Desktop startup rejects Desktop or Core application mismatch', sources.startup.includes("applicationVersions['windows-desktop']") && sources.startup.includes("applicationVersions['windows-core-service']") && sources.startup.includes("'APPLICATION_VERSION_MISMATCH'"));
check('repository contract preserves migration-72 historical compatibility', sources.repositoryContract.includes('Absent only on historical rows created before migration 72'));
check('repository persists and compares the complete package binding', sources.repository.includes('policy_package_version,policy_package_sha256,application_version') && sources.repository.includes('record.policyPackageSha256 !== authorization.policyPackageSha256'));
check('migration 72 adds three columns and exact JSON trigger', sources.migration.includes("createMigrationDefinition(72, 'ppk007_signed_versioned_policy_package'") && sources.migration.includes('trg_ppk007_platform_policy_package_binding_insert') && sources.migration.includes("$.receipt.decision.policyPackageSha256"));
check('scope registry evidence UI/menu confinement and no-cutover truth are closed', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && scope.status === 'COMPLETED' && scope.requirementCompletionClaimed === true && sources.main.includes('universalApiPolicyEnforcement().execute') && sources.preload.includes("contextBridge.exposeInMainWorld('pardus'") && sources.decision.includes('DEC-171') && sources.audit.includes('Gerçek veri taşınmamıştır'));

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-C',
  requirement: 'PPK-007',
  phase: 'SIGNED_VERSIONED_POLICY_PACKAGE_CONTRACT',
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
await writeFile('artifacts/validation/32-C-ppk-007-signed-versioned-policy-package-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`32-C PPK-007 contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`32-C PPK-007 contract: PASS (${checks.length}/${checks.length}).`);
