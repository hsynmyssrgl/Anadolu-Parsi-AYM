import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyPpk026PolicyClient } from './verify-ppk026-policy-client.mjs';
import { verifyTypedPolicySdkBoundary } from './verify-typed-policy-sdk-boundary.mjs';

const readText = async (path) => {
  try { return await readFile(path, 'utf8'); }
  catch { return ''; }
};
const readJson = async (path) => {
  const source = await readText(path);
  if (!source) return undefined;
  try { return JSON.parse(source.replace(/^\uFEFF/u, '')); }
  catch { return undefined; }
};
const exactArray = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every((item, index) => actual[index] === item);
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const hash = (value) => createHash('sha256').update(value).digest('hex');

export const verifyPpk026TypedPolicySdkContract = async (root = process.cwd()) => {
  const read = (path) => readText(resolve(root, path));
  const json = (path) => readJson(resolve(root, path));
  const [
    scope, inventory, schema, registry, ledger, packageJson, manifest, gitAttributes,
    generatedSource, sdkSource, clientSource, clientIndex, contractsSource,
    factorySource, platformIndex, adapterSource, financeSource, healthSource,
    integrationTest, generatedTest, sdkTest, factoryTest, financeTest, healthTest,
    decisionDocument, threatModel, auditDocument, masterRegister, migrations,
    ppk025ContractSource
  ] = await Promise.all([
    json('config/32-v-ppk-026-typed-policy-sdk-scope.json'),
    json('config/32-v-ppk-026-typed-policy-sdk-inventory.json'),
    json('config/32-v-ppk-026-typed-policy-sdk-schema.json'),
    json('config/accepted-scope-registry.json'),
    json('config/user-decision-ledger.json'),
    json('package.json'),
    json('artifacts/manifests/32-V-ppk-026-generated-policy-client.json'),
    read('.gitattributes'),
    read('packages/core-service-client/src/generated-policy-client.ts'),
    read('packages/core-service-client/src/core-service-policy-sdk.ts'),
    read('packages/core-service-client/src/local-admin-client.ts'),
    read('packages/core-service-client/src/index.ts'),
    read('packages/core-service-contracts/src/index.ts'),
    read('packages/platform-policy/src/typed-policy-sdk.ts'),
    read('packages/platform-policy/src/index.ts'),
    read('apps/desktop/src/main/core-service-application-adapter.ts'),
    read('apps/desktop/src/main/finance-production-policy-runtime.ts'),
    read('apps/desktop/src/main/health-production-policy-runtime.ts'),
    read('apps/desktop/tests/ppk026-typed-policy-sdk-integration.test.ts'),
    read('packages/core-service-client/generated-policy-client.test.ts'),
    read('packages/core-service-client/core-service-policy-sdk.test.ts'),
    read('packages/platform-policy/typed-policy-sdk.test.ts'),
    read('apps/desktop/tests/finance-policy-enforcement-runtime.test.ts'),
    read('apps/desktop/tests/health-policy-enforcement-runtime.test.ts'),
    read('docs/decisions/DEC-207-ppk-026-typed-policy-sdk-and-xpf003.md'),
    read('docs/security/PPK-026_TYPED_POLICY_SDK_THREAT_MODEL.md'),
    read('docs/audit/32-V_PPK-026_TYPED_POLICY_SDK_UST_KAPANIS.md'),
    read('docs/10_MASTER_DECISION_REGISTER.md'),
    read('packages/database/src/family-database-migrations.ts'),
    read('scripts/verify-32-u-ppk-025-software-supply-chain-contract.mjs')
  ]);
  const [codegen, boundary] = await Promise.all([
    verifyPpk026PolicyClient(root),
    verifyTypedPolicySdkBoundary(root)
  ]);
  const checks = [];
  const failures = [];
  const check = (name, condition, detail) => {
    const passed = Boolean(condition);
    checks.push({ name, passed, ...(detail === undefined ? {} : { detail }) });
    if (!passed) failures.push(name);
  };
  const ppk026 = registry?.requirements?.find((item) => item.id === 'PPK-026');
  const xpf003 = registry?.requirements?.find((item) => item.id === 'XPF-003');
  const dha011 = registry?.requirements?.find((item) => item.id === 'DHA-011');
  const decision = ledger?.decisions?.find((item) => item.id === 'DEC-207');
  const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
    .map((match) => Number.parseInt(match[1], 10));
  const latestMigration = migrationVersions.length ? Math.max(...migrationVersions) : undefined;

  check('scope identity and completed state are exact', scope?.schemaVersion === 1 && scope.step === '32-V' && scope.status === 'COMPLETED');
  check('scope closes exactly PPK-026 and XPF-003', exactArray(scope?.requirements, ['PPK-026', 'XPF-003']));
  check('inventory identity and completed state are exact', inventory?.schemaVersion === 1 && inventory.step === '32-V' && inventory.status === 'COMPLETED');
  check('inventory contains six exact controls', inventory?.controls?.length === 6 && new Set(inventory.controls.map((item) => item.id)).size === 6);
  check('schema identity is exact', schema?.schemaVersion === 1 && schema.step === '32-V' && schema.requirement === 'PPK-026');
  check('schema contains exact two policy methods', exactArray(schema?.methods?.map((item) => item.wireMethod), ['policy.authorize', 'policy.verify']));
  check('schema output paths are canonical', schema?.generatedSource === 'packages/core-service-client/src/generated-policy-client.ts' && schema?.generatedManifest === 'artifacts/manifests/32-V-ppk-026-generated-policy-client.json');
  check('all schema invariants are true', schema?.invariants && Object.keys(schema.invariants).length === 8 && Object.values(schema.invariants).every((value) => value === true));
  check('deterministic code generation passes exact source and manifest', codegen.status === 'PASS' && codegen.sourceExact && codegen.manifestExact);
  check('generated manifest binds schema and source hashes', manifest?.schemaSha256 === hash(await read('config/32-v-ppk-026-typed-policy-sdk-schema.json')) && manifest?.generatedSourceSha256 === hash(generatedSource));
  check('generated manifest has no timestamp and forbids manual edits', manifest?.generationMode === 'deterministic-no-timestamp' && manifest?.manualEditsAllowed === false && !('generatedAt' in (manifest ?? {})));
  check('generated schema source and manifest are pinned to LF bytes across platforms', includesAll(gitAttributes, ['/config/32-v-ppk-026-typed-policy-sdk-schema.json text eol=lf', '/packages/core-service-client/src/generated-policy-client.ts text eol=lf', '/artifacts/manifests/32-V-ppk-026-generated-policy-client.json text eol=lf']));
  check('generated client contains exact typed operations', includesAll(generatedSource, ['class GeneratedPolicyServiceClient', "request('policy.authorize'", "request('policy.verify'", 'GeneratedPolicyMethod']));
  check('generated client is exported by package index', clientIndex.includes("export * from './generated-policy-client.js'"));
  check('typed SDK is exported by package index', clientIndex.includes("export * from './core-service-policy-sdk.js'"));
  check('local admin transport exposes no manual policy convenience methods', !clientSource.includes('public authorize(') && !clientSource.includes('public verify('));
  check('contracts re-export provider boundary types', includesAll(contractsSource, ['PlatformPolicyAuthorizationProvider', 'PlatformPolicyClusterFence', 'PolicyServiceAvailabilityObservation']));
  check('SDK owns generated client and provider mapping', includesAll(sdkSource, ['GeneratedPolicyServiceClient', 'policyProvider', '#authorize(', '#verify(']));
  check('SDK denies unobserved package and fence', includesAll(sdkSource, ['POLICY_STATE_UNOBSERVED', 'has not been verified and observed']));
  check('SDK clears trusted state on unverified health', sdkSource.includes('health.policyPackageVerified !== true') && sdkSource.includes('#clearObservedState()'));
  check('SDK denies invalid remote responses', sdkSource.includes('POLICY_RESPONSE_INVALID'));
  check('SDK denies invalid and regressing fences', includesAll(sdkSource, ['POLICY_FENCE_INVALID', 'POLICY_FENCE_REGRESSION', 'value.epoch < previous.epoch']));
  check('SDK prevents duplicate availability observer binding', sdkSource.includes('POLICY_AVAILABILITY_OBSERVER_ALREADY_BOUND'));
  check('typed enforcement factory accepts provider path only', includesAll(factorySource, ['TypedPolicyEnforcementPointOptions', "{ readonly provider: unknown }", 'createTypedPolicyEnforcementPoint']));
  check('typed enforcement factory is exported by platform package', platformIndex.includes("export * from './typed-policy-sdk.js'"));
  check('application adapter composes generated client and SDK', includesAll(adapterSource, ['new GeneratedPolicyServiceClient(this.#client)', 'new CoreServicePolicySdk(', 'this.#policySdk.observeHealth(health)']));
  check('application adapter exposes no raw authorize or verify methods', !adapterSource.includes('public async authorize(') && !adapterSource.includes('public async verify('));
  check('production SDK boundary passes with zero findings', boundary.status === 'PASS' && boundary.findings.length === 0);
  check('boundary scans at least 360 production files', boundary.scannedProductionFiles >= 360, boundary.scannedProductionFiles);
  check('boundary binds exact seven production factory consumers', boundary.canonicalFactoryConsumers === 7);
  check('boundary self-tests fourteen malicious and four benign cases', boundary.maliciousSelfTestAssertions === 14 && boundary.benignSelfTestAssertions === 4);
  check('finance production runtime uses only the typed factory', financeSource.includes('createTypedPolicyEnforcementPoint') && !financeSource.includes('new PlatformPolicyEnforcementPoint'));
  check('health production runtime uses only the typed factory', healthSource.includes('createTypedPolicyEnforcementPoint') && !healthSource.includes('new PlatformPolicyEnforcementPoint'));
  check('PPK-026 tests cover generated client, SDK, factory and integration', [generatedTest, sdkTest, factoryTest, integrationTest].every((source) => source.includes("describe('32-V PPK-026")));
  check('XPF-003 finance and health regression tests remain present', financeTest.includes("describe('") && healthTest.includes("describe('"));
  check('integration test asserts malicious escape detection', includesAll(integrationTest, ['DIRECT_PEP_CONSTRUCTION', 'RAW_POLICY_METHOD_LITERAL', 'RAW_POLICY_RESULT_IMPORT', 'GENERATED_CLIENT_ESCAPE']));
  check('integration test binds finance and health to shared factory', integrationTest.includes("['finance'") && integrationTest.includes("['health'"));
  check('PPK-026 registry entry is complete with full chain', ppk026?.status === 'COMPLETE' && Object.values(ppk026.chain ?? {}).every((value) => value === true));
  check('XPF-003 registry entry is complete with full chain', xpf003?.status === 'COMPLETE' && Object.values(xpf003.chain ?? {}).every((value) => value === true));
  check('PPK-026 evidence contains final contract and runtime paths', ppk026?.evidence?.includes('artifacts/validation/32-V-ppk-026-typed-policy-sdk-contract.json') && ppk026?.evidence?.includes('artifacts/validation/32-V-ppk-026-typed-policy-sdk-runtime.json'));
  check('XPF-003 evidence contains finance and health production paths', xpf003?.evidence?.includes('apps/desktop/src/main/finance-production-policy-runtime.ts') && xpf003?.evidence?.includes('apps/desktop/src/main/health-production-policy-runtime.ts'));
  check('DHA-011 remains honestly open', dha011?.status === 'FOUNDATION_STARTED');
  check('scope explicitly denies DHA-011 completion', scope?.crossRequirementClosure?.['DHA-011']?.includes('remain open'));
  check('DEC-207 is active and covers both requirements', decision?.status === 'ACTIVE' && exactArray(decision?.requirements, ['PPK-026', 'XPF-003']));
  check('decision ledger count is internally exact', ledger?.decisionCount === 61 && ledger?.decisionCount === ledger?.decisions?.length);
  check('master register contains DEC-207 and exact decision path', masterRegister.includes('## DEC-207') && masterRegister.includes('DEC-207-ppk-026-typed-policy-sdk-and-xpf003.md'));
  check('decision document records generated client and fail-closed state', includesAll(decisionDocument, ['deterministik generated client', 'Fail-closed kuralları', 'XPF-003 kapanışı']));
  check('threat model covers raw interpretation, fence and finance-health drift', includesAll(threatModel, ['Ham sonuç tipleri', 'Monotonic fence', 'Finans veya sağlığın']));
  check('audit document records two closed requirements and DHA-011 boundary', includesAll(auditDocument, ['PPK-026', 'XPF-003', 'DHA-011 tamamlanmadı']));
  check('pretypecheck includes both PPK-026 gates', packageJson?.scripts?.pretypecheck?.includes('verify-ppk026-policy-client.mjs') && packageJson?.scripts?.pretypecheck?.includes('verify-typed-policy-sdk-boundary.mjs'));
  check('prebuild includes both PPK-026 gates', packageJson?.scripts?.prebuild?.includes('verify-ppk026-policy-client.mjs') && packageJson?.scripts?.prebuild?.includes('verify-typed-policy-sdk-boundary.mjs'));
  check('root exposes six PPK-026 scripts', ['generate:ppk026:client', 'verify:ppk026:codegen', 'verify:ppk026:sdk-boundary', 'verify:ppk026:targeted', 'verify:ppk026:contract', 'verify:ppk026:runtime'].every((name) => typeof packageJson?.scripts?.[name] === 'string'));
  check('final targeted and full Vitest evidence is exact', scope?.validation?.finalEvidence?.targetedTestFilesPassed === 6 && scope?.validation?.finalEvidence?.targetedTestsPassed === 26 && scope?.validation?.finalEvidence?.fullVitestFilesPassed === 91 && scope?.validation?.finalEvidence?.fullVitestTestsPassed === 823);
  check('final build and governance evidence is exact', scope?.validation?.finalEvidence?.productionWorkspaceBuildsPassed === 18 && scope?.validation?.finalEvidence?.pretypecheckSecurityGatesPassed === 15 && scope?.validation?.finalEvidence?.governedPreflightPassed === true && scope?.validation?.finalEvidence?.finalClosureEvidence === true);
  check('PPK-025 predecessor contract no longer asserts unfinished successor', !ppk025ContractSource.includes('separate unfinished successor') && ppk025ContractSource.includes('separate independently evidenced successor'));
  check('no repository persistence or migration was added', scope?.boundaries?.repositoryPersistenceRequired === false && scope?.boundaries?.schemaMigrationRequired === false && latestMigration === 77);
  check('no data transfer, backfill or ownership cutover is claimed', scope?.boundaries?.historicalBackfillPerformed === false && scope?.boundaries?.realDataTransferPerformed === false && scope?.boundaries?.cutoverPerformed === false && scope?.boundaries?.desktopVaultOwnershipPreserved === true && scope?.boundaries?.sqliteOwnershipTransferred === false);

  return Object.freeze({
    schemaVersion: 1,
    step: '32-V',
    requirements: Object.freeze(['PPK-026', 'XPF-003']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    codegen,
    boundary,
    latestDatabaseMigration: latestMigration,
    requirementCompletionClaimed: failures.length === 0,
    dha011CompletedByThisPackage: false,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyPpk026TypedPolicySdkContract();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-V-ppk-026-typed-policy-sdk-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`PPK-026/XPF-003 contract: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.status !== 'PASS') {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}
