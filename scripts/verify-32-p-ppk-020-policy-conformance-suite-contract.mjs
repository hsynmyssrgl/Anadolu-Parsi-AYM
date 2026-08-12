import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanPolicyConformanceBoundary } from './verify-policy-conformance-suite-boundary.mjs';

const candidateMode = process.argv.includes('--candidate');
const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const [
  scope, inventory, registry, ledger, rootPackage, policy, policyIndex, domain, domainIndex,
  useCase, applicationIndex, targetTest, integrationTest, main, preload, globalTypes,
  renderer, ipcPolicy, ipcCache, decision, threat, audit, masterRegister, migrations
] = await Promise.all([
  readJson('config/32-p-ppk-020-policy-conformance-suite-scope.json'),
  readJson('config/32-p-ppk-020-policy-conformance-target-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readText('packages/platform-policy/src/policy-conformance-suite.ts'),
  readText('packages/platform-policy/src/index.ts'),
  readText('packages/domain/src/policy-conformance-suite.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/policy-conformance-suite-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('packages/platform-policy/policy-conformance-suite.test.ts'),
  readText('apps/desktop/tests/ppk020-policy-conformance-integration.test.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/ipc-read-sharing.ts'),
  readText('docs/decisions/DEC-201-ppk-020-cross-platform-policy-conformance-suite.md'),
  readText('docs/security/PPK-020_CROSS_PLATFORM_POLICY_CONFORMANCE_THREAT_MODEL.md'),
  readText('docs/audit/32-P_PPK-020_COK_PLATFORM_POLICY_CONFORMANCE_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('packages/database/src/family-database-migrations.ts')
]);

const scan = await scanPolicyConformanceBoundary();
const failures = [];
const checks = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
};
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const requirement = registry.requirements.find((item) => item.id === 'PPK-020');
const prior = ['PPK-012', 'PPK-013', 'PPK-014', 'PPK-015', 'PPK-016', 'PPK-017', 'PPK-018', 'PPK-019']
  .map((id) => registry.requirements.find((item) => item.id === id));
const successor = registry.requirements.find((item) => item.id === 'PPK-021');
const versions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...versions);
const targetIds = inventory.targets.map((target) => target.applicationId);
const uniqueTargets = new Set(targetIds);
const deployed = inventory.targets.filter((target) => target.deploymentState === 'DEPLOYED');
const profileOnly = inventory.targets.filter((target) => target.deploymentState === 'NOT_DEPLOYED');

check('scope identity is exact', scope.step === '32-P' && scope.requirement === 'PPK-020');
check('inventory identity is exact', inventory.step === '32-P' && inventory.requirement === 'PPK-020');
check('suite version is PPK-020-V1', inventory.suite?.version === 'PPK-020-V1');
check('inventory has fourteen unique canonical targets', inventory.targets?.length === 14 && uniqueTargets.size === 14);
check('target order matches the canonical platform registry', JSON.stringify(targetIds) === JSON.stringify([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service', 'backup-worker', 'signed-plugin'
]));
check('exact two deployed runtime targets are recorded', JSON.stringify(deployed.map((item) => item.applicationId)) === JSON.stringify(['windows-desktop', 'windows-core-service']));
check('exact twelve profile-only targets are recorded', profileOnly.length === 12 && profileOnly.every((item) => item.nativeRuntimeExecution === 'PROFILE_ONLY'));
check('macOS iOS and iPadOS remain not deployed', ['macos-companion', 'ios-companion', 'ipados-companion'].every((id) => profileOnly.some((item) => item.applicationId === id)));
check('scope requires the exact shared matrix', scope.boundaries?.canonicalTargetCount === 14 && scope.boundaries?.identicalCasesPerTarget === 22 && scope.boundaries?.totalKernelEvaluations === 308);
check('scope requires signed package strict context and certificate binding', scope.boundaries?.signedPolicyPackageVerificationRequired === true && scope.boundaries?.strictContextBindingRequired === true && scope.boundaries?.deviceCertificateBindingRequired === true);
check('scope forbids target exclusions and case subsets', scope.boundaries?.perTargetSkipOrExclusionAllowed === false && scope.boundaries?.caseSubsetAllowed === false);
check('scope does not claim native Apple execution', scope.boundaries?.nativeAppleRuntimeExecutionClaimed === false && scope.boundaries?.nativeRuntimeValidationRequiredBeforeDeployment === true);
check('scope denies runtime authority to the reference harness', scope.boundaries?.referenceHarnessGrantsRuntimeAuthority === false);
check('scope requires content-free no-cache status', scope.boundaries?.contentFreeStatusIpcRequired === true && scope.boundaries?.policyStatusIpcCacheAllowed === false && scope.boundaries?.testPayloadExposedToRenderer === false);
check('scope forbids persistence and schema change', scope.boundaries?.repositoryPersistenceRequired === false && scope.boundaries?.schemaMigrationRequired === false);
check('scope forbids transfer backfill ownership change and cutover', scope.realDataTransferPerformed === false && scope.realDataBackfillPerformed === false && scope.sqliteOwnershipTransferred === false && scope.cutoverAuthorityAttached === false);
check('database migration 77 baseline remains present', versions.includes(77) && latestMigration >= 77 && scope.boundaries?.latestDatabaseMigration === 77);
check('no PPK-020 migration marker exists', !migrations.toLowerCase().includes('ppk020'));

check('policy publishes one canonical target registry', (policy.match(/export const POLICY_CONFORMANCE_TARGET_PROFILES/gu) ?? []).length === 1);
check('policy publishes one canonical case registry', (policy.match(/export const POLICY_CONFORMANCE_CASE_IDS/gu) ?? []).length === 1);
check('policy contains exactly twenty-two case identifiers', (policy.match(/caseId:\s*'/gu) ?? []).length === 22);
check('policy applies every case definition without a target branch', policy.includes('CASE_DEFINITIONS.map') && !policy.includes('switch (input.target.applicationId)'));
check('policy verifies the signed package before execution', policy.includes('input.kernel.verifyPolicyPackage(policyPackage)'));
check('policy requires strict baseline context', policy.includes("input.baselineRequest.enforcementMode !== 'strict'"));
check('policy binds target application and canonical manifest', includesAll(policy, ['POLICY_CONFORMANCE_BASELINE_APPLICATION_MISMATCH', 'POLICY_CONFORMANCE_BASELINE_BINDING_INVALID', 'capabilityManifestSha256']));
check('policy requires device certificate in the reference manifest', policy.includes('manifest.deviceCertificateRequired !== true'));
check('policy executes the real kernel', policy.includes('input.kernel.evaluate(request)'));
check('policy re-computes exact context hashes', policy.includes('decision.contextHash === platformPolicyContextHash(request)'));
check('invalid request cannot mint a context hash', policy.includes("definition.expectedReason === 'INVALID_REQUEST' ? decision.contextHash === undefined"));
check('report includes canonical SHA-256 binding', includesAll(policy, ['reportHash: sha256(body)', 'report.reportHash === sha256(unsignedReport(report))']));
check('report verification requires every case to pass', policy.includes('report.cases.every((item) => item.passed'));
check('policy snapshot denies native false claims and harness authority', includesAll(policy, ['referenceHarnessGrantsRuntimeAuthority: false', 'nativeAppleRuntimeExecutionClaimed: false', 'nativeRuntimeValidationRequiredBeforeDeployment: true']));
check('platform policy exports the suite', policyIndex.includes("export * from './policy-conformance-suite.js'"));

check('domain boundary exposes content-free fixed counts', includesAll(domain, ['targetCount: 14', 'caseCount: 22', 'totalMatrixAssertions: 308', 'payloadExposedToClient: false']));
check('domain boundary records deployment truth', includesAll(domain, ['deployedRuntimeTargets: 2', 'profileOnlyTargets: 12', 'nativeAppleRuntimeExecutionClaimed: false']));
check('domain exports the boundary', domainIndex.includes("export * from './policy-conformance-suite.js'"));
check('application use case maps only the suite snapshot', includesAll(useCase, ['GetPolicyConformanceSuiteBoundaryUseCase', 'private readonly suite: PlatformPolicyConformanceSuite', 'const snapshot = this.suite.snapshot()']));
check('application boundary keeps migration 77 and no persistence', includesAll(useCase, ['schemaMigrationRequired: false', 'latestDatabaseMigration: 77']));
check('application exports the use case', applicationIndex.includes("export * from './policy-conformance-suite-use-cases.js'"));

check('target test iterates every canonical target', targetTest.includes('it.each(POLICY_CONFORMANCE_TARGET_PROFILES)'));
check('target test compares the exact case sequence', targetTest.includes('toEqual(POLICY_CONFORMANCE_CASE_IDS)'));
check('target test requires twenty-two passed cases', targetTest.includes('passedCases: 22') && targetTest.includes('failedCases: 0'));
check('target test constructs real signed policy kernels', includesAll(targetTest, ['new PlatformPolicyKernel({', 'signingKey: Buffer.alloc(32, 20)', 'createPlatformDeviceCertificate']));
check('target test covers target and report tamper', includesAll(targetTest, ['POLICY_CONFORMANCE_TARGET_PROFILE_MISMATCH', 'whose case outcome was changed after execution']));
check('target test asserts no native Apple execution claim', targetTest.includes('keeps undeployed Apple clients profile-only without claiming native execution'));
check('integration test verifies no test payload exposure', integrationTest.includes("expect(Object.hasOwn(view, 'cases')).toBe(false)"));
check('integration test verifies zero-argument IPC', integrationTest.includes("evaluateIpcIntegrationPolicy('system:getPolicyConformanceSuiteBoundary', [])"));
check('integration test verifies no-cache behavior', integrationTest.includes("resolveIpcReadSharingPolicy('system:getPolicyConformanceSuiteBoundary')"));

check('main composes one content-free suite status use case', includesAll(main, ['new PlatformPolicyConformanceSuite()', 'new GetPolicyConformanceSuiteBoundaryUseCase(platformPolicyConformanceSuite)']));
check('main registers the exact status handler', main.includes("registerIpcHandler('system:getPolicyConformanceSuiteBoundary'"));
check('preload exposes the exact status channel', preload.includes("invoke('system:getPolicyConformanceSuiteBoundary')"));
check('renderer global type exposes the status API', globalTypes.includes('getPolicyConformanceSuiteBoundary():Promise<PolicyConformanceSuiteBoundaryView>'));
check('IPC integration policy requires zero arguments', ipcPolicy.includes("case 'system:getPolicyConformanceSuiteBoundary':"));
check('IPC read sharing marks status no-cache', ipcCache.includes("'system:getPolicyConformanceSuiteBoundary'"));
check('renderer truthfully labels profile-only targets', renderer.includes('profile-only/not-deployed'));
check('renderer explicitly denies native Apple execution claim', renderer.includes('Native Apple çalıştırması tamamlandı iddiası yoktur'));

check('source gate passes with no finding', scan.findings.length === 0);
check('source gate scans all eighteen production zones', scan.zones === 18);
check('source gate scans at least 349 source files', scan.files >= 349);
check('source gate sees at least thirteen relevant files', scan.relevantFiles >= 13);
check('root pretypecheck includes the conformance gate', rootPackage.scripts?.pretypecheck?.includes('verify-policy-conformance-suite-boundary.mjs'));
check('root prebuild includes the conformance gate', rootPackage.scripts?.prebuild?.includes('verify-policy-conformance-suite-boundary.mjs'));
check('root package exposes all four PPK-020 commands', ['verify:ppk020:conformance-boundary', 'verify:ppk020:targeted', 'verify:ppk020:contract', 'verify:ppk020:runtime'].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

check('inventory records five implemented controls', inventory.controlInventory?.length === 5 && inventory.controlInventory.every((item) => item.disposition === 'IMPLEMENTED'));
check('inventory has zero exclusions false claims and bypasses', inventory.closureSummary?.perTargetExclusions === 0 && inventory.closureSummary?.nativeRuntimeFalseClaims === 0 && inventory.closureSummary?.directBypassExceptions === 0);
check('inventory has no open production blocker', inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.openBlockers?.length === 0);
check('DEC-201 records the deployment and no-migration truth', includesAll(decision, ['DEC-201', 'NOT_DEPLOYED / PROFILE_ONLY', 'Yeni migration veya repository persistence yoktur']));
check('threat model covers skip mock native cache and tamper threats', ['Platforma özel vaka atlama', 'Mock karar ile sahte PASS', 'Native deployment sahteciliği', 'IPC cache veya payload sızıntısı', 'Rapor tamperi'].every((marker) => threat.includes(marker)));
check('master decision register contains DEC-201', masterRegister.includes('## DEC-201') && masterRegister.includes('DEC-201-ppk-020-cross-platform-policy-conformance-suite.md'));
check('decision ledger contains active DEC-201 with exact count', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-201' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-020')));
check('prior PPK-012 through PPK-019 packages remain complete', prior.every((item) => item?.status === 'COMPLETE'));
check('PPK-021 remains outside PPK-020 closure', successor !== undefined && successor.status !== 'COMPLETE');

if (candidateMode) {
  check('candidate registry remains validation pending', requirement?.status === 'IN_PROGRESS' && requirement?.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && requirement?.chain?.targetedTest === false && requirement?.chain?.evidence === false);
  check('candidate scope remains open for final evidence', scope.status === 'IN_PROGRESS' && scope.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && scope.validation?.state === 'PENDING' && scope.validation?.finalValidationRecorded === false && scope.requirementCompletionClaimed === false && scope.remainingClosureWork?.length > 0);
  check('candidate inventory remains validation pending', inventory.status === 'IMPLEMENTED_VALIDATION_PENDING' && inventory.completionClaimed === false && inventory.closureSummary?.finalValidationPending === true);
  check('candidate audit does not claim final PASS', audit.includes('VALIDATION_PENDING') && !audit.includes('Durum: `COMPLETE / PASS`'));
} else {
  check('accepted registry closes the complete PPK-020 evidence chain', requirement?.status === 'COMPLETE' && requirement.implementationState === undefined && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 14);
  check('scope closes PPK-020 without migration transfer or cutover', scope.status === 'COMPLETED' && scope.implementationState === 'VALIDATED_COMPLETE' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);
  check('audit closes only with final contract and runtime evidence', audit.includes('Durum: `COMPLETE / PASS`') && /contract: `\d+\/\d+ PASS`/u.test(audit) && /runtime kanıt demeti: `\d+\/\d+ PASS`/u.test(audit));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-P',
  requirement: 'PPK-020',
  phase: candidateMode ? 'CROSS_PLATFORM_POLICY_CONFORMANCE_CANDIDATE_CONTRACT' : 'CROSS_PLATFORM_POLICY_CONFORMANCE_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  sourceGate: {
    status: scan.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: scan.zones,
    scannedFiles: scan.files,
    securityRelevantFiles: scan.relevantFiles,
    maliciousSelfTestAssertions: 8,
    benignFalsePositiveAssertions: 4,
    findings: scan.findings
  },
  canonicalTargets: 14,
  identicalCasesPerTarget: 22,
  totalKernelEvaluations: 308,
  deployedRuntimeTargets: 2,
  profileOnlyTargets: 12,
  perTargetExclusions: 0,
  nativeRuntimeFalseClaims: 0,
  referenceHarnessGrantsRuntimeAuthority: false,
  nativeAppleRuntimeExecutionClaimed: false,
  latestDatabaseMigration: latestMigration,
  schemaMigrationRequired: false,
  historicalBackfillPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  cutoverAuthorityAttached: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-P-ppk-020-policy-conformance-suite-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-020${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`PPK-020${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);
