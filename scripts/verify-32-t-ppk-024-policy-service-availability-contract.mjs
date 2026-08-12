import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanPolicyServiceAvailabilityBoundary } from './verify-policy-service-availability-boundary.mjs';

const candidateMode = process.argv.includes('--candidate');
const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const exactArray = (actual, expected) =>
  Array.isArray(actual) && actual.length === expected.length && expected.every((item, index) => actual[index] === item);

const [
  scope, inventory, registry, ledger, rootPackage, policy, policyIndex, domain, domainIndex,
  useCases, applicationIndex, coreContracts, coreState, coreRuntime, coreApplicationAdapter, corePolicySdk,
  liveObserver, startupConnection, universalGate, enforcementPoint, desktopMain, preload,
  rendererGlobal, renderer, ipcIntegration, ipcReadSharing, policyTest, coreTest, desktopTest,
  integrationTest, sourceGate, combinedGate, decision, threatModel, audit, masterRegister,
  migrations
] = await Promise.all([
  readJson('config/32-t-ppk-024-policy-service-availability-scope.json'),
  readJson('config/32-t-ppk-024-policy-service-availability-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readText('packages/platform-policy/src/policy-service-availability-policy.ts'),
  readText('packages/platform-policy/src/index.ts'),
  readText('packages/domain/src/policy-service-availability.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/policy-service-availability-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('packages/core-service-contracts/src/index.ts'),
  readText('apps/core-service/src/service-state.ts'),
  readText('apps/core-service/src/core-service-runtime.ts'),
  readText('apps/desktop/src/main/core-service-application-adapter.ts'),
  readText('packages/core-service-client/src/core-service-policy-sdk.ts'),
  readText('apps/desktop/src/main/policy-service-availability-application-adapter.ts'),
  readText('apps/desktop/src/main/core-service-startup-connection.ts'),
  readText('apps/desktop/src/main/desktop-universal-api-policy-enforcement.ts'),
  readText('packages/platform-policy/src/policy-enforcement-point.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/ipc-read-sharing.ts'),
  readText('packages/platform-policy/policy-service-availability-policy.test.ts'),
  readText('apps/core-service/tests/ppk024-policy-service-availability-runtime.test.ts'),
  readText('apps/desktop/tests/ppk024-policy-service-availability.test.ts'),
  readText('apps/desktop/tests/ppk024-policy-service-availability-integration.test.ts'),
  readText('scripts/verify-policy-service-availability-boundary.mjs'),
  readText('scripts/verify-platform-policy-gate.mjs'),
  readText('docs/decisions/DEC-205-ppk-024-policy-service-availability-runtime-gate.md'),
  readText('docs/security/PPK-024_POLICY_SERVICE_AVAILABILITY_THREAT_MODEL.md'),
  readText('docs/audit/32-T_PPK-024_POLICY_SERVICE_AVAILABILITY_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('packages/database/src/family-database-migrations.ts')
]);

const sourceScan = await scanPolicyServiceAvailabilityBoundary();
const failures = [];
const checks = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
};
const requirement = registry.requirements.find((item) => item.id === 'PPK-024');
const predecessor = registry.requirements.find((item) => item.id === 'PPK-023');
const successor = registry.requirements.find((item) => item.id === 'PPK-025');
const versions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...versions);
const targetedTests = [
  'packages/platform-policy/policy-service-availability-policy.test.ts',
  'apps/core-service/tests/ppk024-policy-service-availability-runtime.test.ts',
  'apps/desktop/tests/ppk024-policy-service-availability.test.ts',
  'apps/desktop/tests/ppk024-policy-service-availability-integration.test.ts'
];
const exactTargetedCommand = `vitest run ${targetedTests.join(' ')} --maxWorkers=1`;

check('scope identity is exact', scope.step === '32-T' && scope.requirement === 'PPK-024');
check('inventory identity is exact', inventory.step === '32-T' && inventory.requirement === 'PPK-024');
check('accepted registry contains PPK-024', requirement !== undefined);
check('PPK-023 predecessor remains complete', predecessor?.status === 'COMPLETE');
check('PPK-025 remains a separate unfinished successor', successor !== undefined && successor.status !== 'COMPLETE');
check('DEC-205 is active and decision count is exact', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-205' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-024')));
check('master decision register contains DEC-205', masterRegister.includes('## DEC-205') && masterRegister.includes('DEC-205-ppk-024-policy-service-availability-runtime-gate.md'));

check('source gate scans clean production boundary', sourceScan.findings.length === 0 && sourceScan.canonicalPolicyClassDefinitions === 1);
check('source gate covers eighteen production zones', sourceScan.zones === 18);
check('source gate has exact canonical reference coverage', sourceScan.canonicalReferencePaths.length === 19);
check('source gate denies legacy and broad model escapes', includesAll(sourceGate, ['LEGACY_POLICY_SERVICE_RUNTIME_MODEL', 'BROAD_OR_MISSING_STATUS_EXCEPTION', 'CANONICAL_AVAILABILITY_REFERENCE_OUTSIDE_EXACT_ALLOWLIST']));
check('combined platform policy gate invokes availability gate', includesAll(combinedGate, ['verify-policy-service-availability-boundary.mjs', 'policy service availability gate PASS']));

check('policy pins exact freshness thresholds', includesAll(policy, ['POLICY_SERVICE_OBSERVATION_MAX_AGE_MS = 30_000', 'POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS = 5_000', 'ageMs > POLICY_SERVICE_OBSERVATION_MAX_AGE_MS', 'ageMs < -POLICY_SERVICE_OBSERVATION_MAX_FUTURE_SKEW_MS']));
check('policy has exact read-write read-only deny modes', includesAll(policy, ["'read-write' | 'read-only' | 'deny'", "decision('read-only', 'FRESH_VERIFIED_READ_ONLY'", "decision('read-write', 'FRESH_VERIFIED_READ_WRITE'"]));
check('policy denies unavailable malformed and invalid signature', includesAll(policy, ["decision('deny', 'SERVICE_UNAVAILABLE')", "decision('deny', 'OBSERVATION_MALFORMED')", "decision('deny', 'POLICY_PACKAGE_SIGNATURE_INVALID')"]));
check('policy denies version and hash mismatch', includesAll(policy, ['POLICY_VERSION_MISMATCH', 'POLICY_PACKAGE_VERSION_MISMATCH', 'POLICY_PACKAGE_HASH_MISMATCH']));
check('policy denies stale future not-ready and unsafe states', includesAll(policy, ['OBSERVATION_STALE', 'OBSERVATION_FROM_FUTURE', 'SERVICE_NOT_READY', 'UNSAFE_SERVICE_STATE']));
check('policy separates sensitive read and mutation operation gate', includesAll(policy, ['PolicyServiceSensitiveOperation', "operation === 'mutation'", 'READ_ONLY_MUTATION_DENIED']));
check('policy snapshot denies mapping and historical authority', includesAll(policy, ['mappingGrantsRuntimeAuthority: false', 'historicalReceiptGrantsCurrentAuthority: false', "enforcement: 'fail-closed'"]));
check('platform policy exports canonical availability exactly once', (policyIndex.match(/policy-service-availability-policy\.js/gu) ?? []).length === 1);

check('domain boundary is content free and non-authoritative', includesAll(domain, ['PolicyServiceAvailabilityBoundaryView', 'maximumObservationAgeMs: 30_000', 'maximumFutureSkewMs: 5_000', 'mappingGrantsRuntimeAuthority: false', 'historicalReceiptGrantsCurrentAuthority: false', 'policyPackageHashesExposedToClient: false']));
check('domain exports availability boundary', domainIndex.includes("export * from './policy-service-availability.js'"));
check('application catches observer failure as unavailable', includesAll(useCases, ['return this.policy.evaluate(await this.observation.observe());', 'return this.policy.evaluate(undefined);']));
check('application asserts operation before callback', useCases.indexOf('this.policy.assertOperationAllowed(input.operation, availability);') < useCases.indexOf('return input.callback(availability);'));
check('application publishes a verified content-free boundary', includesAll(useCases, ['GetPolicyServiceAvailabilityBoundaryUseCase', 'this.policy.verifySnapshot(snapshot)', 'policyPackageHashesExposedToClient: snapshot.policyPackageHashesExposedToClient']));
check('application exports availability use cases', applicationIndex.includes("export * from './policy-service-availability-use-cases.js'"));

check('Core health contract exposes verification and observation time', includesAll(coreContracts, ['readonly policyPackageVerified: boolean;', 'readonly observedAt: string;']));
check('Core state exposes verification and observation time', includesAll(coreState, ['readonly policyPackageVerified: boolean;', 'readonly observedAt: string;']));
check('Core runtime uses actual kernel HMAC self-verification', includesAll(coreRuntime, ['policyPackageVerified: this.#policyPackageVerified()', 'observedAt: this.#clock()', 'return this.#kernel.verifyPolicyPackage(this.#kernel.policyPackage) === true;', 'catch {', 'return false;']));
check('Core runtime fails authorization closed when unavailable or invalid', includesAll(coreRuntime, ['#assertPolicyDecisionServiceAvailable()', "'POLICY_DECISION_UNAVAILABLE'", 'this.#policyPackageVerified()']));
check('Core degraded mutation returns signed cluster non-writable decision path', includesAll(coreRuntime, ['clusterWritable: request.clusterWritable && fence.writable', 'this.#kernel.authorizeWithReceipt(effectiveRequest, this.#clock(), nonce)']));

check('Desktop live observer calls authenticated health every observation', includesAll(liveObserver, ['public async observe()', 'const health = await this.#adapter.getHealth();', 'policyPackageVerified: health.policyPackageVerified', 'observedAt: health.observedAt', 'checkedAt: this.#clock()', 'return undefined;']));
check('Desktop live observer uses startup package only as exact pin', includesAll(liveObserver, ['this.#expectedPolicyVersion = options.startupHealth.policyVersion;', 'this.#expectedPolicyPackageVersion = options.startupHealth.policyPackage.payload.packageVersion;', 'this.#expectedPolicyPackageSha256 = options.startupHealth.policyPackage.payloadSha256;']));
check('Core application adapter exposes live observation to PEP', includesAll(coreApplicationAdapter, ['new CoreServicePolicySdk(new GeneratedPolicyServiceClient(this.#client))', 'bindPolicyServiceAvailabilityObserver(', 'const health = await this.#client.health();', 'this.#policySdk.observeHealth(health);']) && includesAll(corePolicySdk, ['observePolicyServiceAvailability:', 'health.policyPackageVerified !== true', 'this.#observePolicyServiceAvailability = observer;']));
check('startup validates hash and availability before connection', includesAll(startupConnection, ["createHash('sha256').update(stable(policyPackage.payload), 'utf8').digest('hex') !== policyPackage.payloadSha256", 'policyPackageVerified: health.policyPackageVerified', "if (policyServiceAvailability.mode === 'deny')"]));

check('universal gate keeps one exact status exception', includesAll(universalGate, ["POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL = 'system:getPolicyServiceAvailabilityBoundary'", 'channel === POLICY_SERVICE_AVAILABILITY_STATUS_CHANNEL', 'if (isDesktopPolicyServiceAvailabilityStatusChannel(input.channel)) return input.operation();']));
check('universal gate runs availability before bootstrap', universalGate.indexOf('const availability = await this.#evaluatePolicyServiceAvailability();') < universalGate.indexOf('if (isDesktopPolicyBootstrapChannel(input.channel))'));
check('universal gate restricts caches and asserts bootstrap operation', includesAll(universalGate, ["if (availability.mode !== 'read-write') this.#onAvailabilityRestricted?.(availability);", 'this.#policyServiceAvailabilityPolicy.assertOperationAllowed(', "bootstrapIntent.action === 'read' ? 'read' : 'mutation'"]));
check('PEP has direct live availability defense', includesAll(enforcementPoint, ['await this.#assertPolicyServiceAvailability(intent.action);', '#assertPolicyServiceAvailability(action: PolicyAction)', 'POLICY_SERVICE_AVAILABILITY_DENIED']));
check('PEP requires observer only for explicit Core Service provider', includesAll(enforcementPoint, ["options.provider.decisionAuthority === 'windows-core-service'", "typeof options.provider.observePolicyServiceAvailability !== 'function'", "if (!this.#provider || this.#provider.decisionAuthority !== 'windows-core-service') return;"]));
check('PEP permits only read on narrowed fence and persists signed deny', includesAll(enforcementPoint, ["authorization.decision.allowed && !effectiveRequest.clusterWritable && effectiveRequest.action !== 'read'", 'if (!authorization.decision.allowed)', 'await this.#appendReceipt(', "throw new PlatformPolicyEnforcementError('POLICY_DENIED'"]));

check('Desktop composes live observer and cache lock', includesAll(desktopMain, ['new PolicyServiceAvailabilityApplicationAdapter({', 'bindPolicyServiceAvailabilityObserver(', 'evaluatePolicyServiceAvailability:', 'ipcReadResults.clearAll();', "offlineSensitiveCache.lock('CONTEXT_MISMATCH')"]));
check('Desktop registers exact zero-argument status handler', /registerIpcHandler\('system:getPolicyServiceAvailabilityBoundary',\s*\(\)\s*:\s*Promise<PolicyServiceAvailabilityBoundaryView>/u.test(desktopMain));
check('preload status method is exact zero argument', /getPolicyServiceAvailabilityBoundary\s*:\s*\(\s*\)\s*:\s*Promise<PolicyServiceAvailabilityBoundaryView>\s*=>\s*invoke\(\s*'system:getPolicyServiceAvailabilityBoundary'\s*\)/u.test(preload));
check('renderer global status method is exact zero argument', /getPolicyServiceAvailabilityBoundary\s*\(\s*\)\s*:\s*Promise<PolicyServiceAvailabilityBoundaryView>/u.test(rendererGlobal));
check('IPC contract accepts only zero arguments', /case\s+'system:getPolicyServiceAvailabilityBoundary':\s*(?:case\s+'[^']+':\s*)*return\s+zeroArguments\(args\);/u.test(ipcIntegration));
check('availability status channel is policy-sensitive no-cache', ipcReadSharing.includes("'system:getPolicyServiceAvailabilityBoundary'") && includesAll(ipcReadSharing, ['IPC_SECURITY_POSTURE_NO_CACHE_CHANNELS', 'if (policySensitiveChannels.has(channel)) return disabledPolicy;']));
check('renderer shows posture without package hashes', includesAll(renderer, ['PPK-024', 'Politika servisi çalışma modu', 'istemci bu göstergeden ek yetki türetemez']) && !renderer.includes('policyPackageSha256'));

check('policy tests cover exact 30000 and 30001 millisecond boundary', includesAll(policyTest, ['exact 30,000 ms freshness boundary', 'one millisecond beyond the 30,000 ms freshness boundary', 'observationAgeMs: 30_000', 'observationAgeMs: 30_001']));
check('policy tests cover exact future-skew boundary and integration covers fail-closed use cases', includesAll(policyTest, ['exact -5,000 ms future-skew boundary', 'one millisecond beyond the -5,000 ms future-skew boundary']) && integrationTest.includes('maps an observation-port exception to unavailable without calling the callback'));
check('Core tests cover HMAC self-verification and signed non-writable denial', includesAll(coreTest, ['attests a freshly self-verified signed package', 'keeps verified degraded service read-only and signs the mutation denial', 'CLUSTER_NOT_WRITABLE', 'verifyPolicyPackage: () => false']));
check('Desktop tests cover bootstrap and cache restriction', includesAll(desktopTest, ['read-only bootstrap mutation', 'exact content-free status channel', 'lookalike status channel', 'cache clear and offline cache lock']));
check('integration tests cover unavailable invalid signature stale and IPC', includesAll(integrationTest, ['SERVICE_UNAVAILABLE', 'POLICY_PACKAGE_SIGNATURE_INVALID', 'OBSERVATION_STALE', 'system:getPolicyServiceAvailabilityBoundary']));

check('root pretypecheck and prebuild run availability gate', rootPackage.scripts?.pretypecheck?.includes('verify-policy-service-availability-boundary.mjs') && rootPackage.scripts?.prebuild?.includes('verify-policy-service-availability-boundary.mjs'));
check('root package has exact PPK-024 source gate command', rootPackage.scripts?.['verify:ppk024:availability-gate'] === 'node scripts/verify-policy-service-availability-boundary.mjs');
check('root package has exact four-file targeted command', rootPackage.scripts?.['verify:ppk024:targeted'] === exactTargetedCommand);
check('root package has exact contract and runtime commands', rootPackage.scripts?.['verify:ppk024:contract'] === 'node scripts/verify-32-t-ppk-024-policy-service-availability-contract.mjs' && rootPackage.scripts?.['verify:ppk024:runtime'] === 'node scripts/verify-32-t-ppk-024-policy-service-availability-runtime.mjs');

check('scope records exact fail-closed matrix', scope.boundaries?.defaultDecision === 'DENY' && scope.boundaries?.unavailableMode === 'DENY' && scope.boundaries?.invalidSignatureMode === 'DENY' && scope.boundaries?.staleObservationMode === 'DENY' && scope.boundaries?.denyBlocksSensitiveReads === true && scope.boundaries?.denyBlocksSensitiveMutations === true);
check('scope records exact freshness edges', scope.boundaries?.exactMaximumAgeAcceptedMs === 30_000 && scope.boundaries?.firstStaleAgeDeniedMs === 30_001 && scope.boundaries?.maximumFutureSkewMs === 5_000 && scope.boundaries?.firstFutureSkewDeniedMs === 5_001);
check('scope records exact read-only and read-write boundary', scope.boundaries?.freshVerifiedCoherentNonWritableMode === 'READ_ONLY' && scope.boundaries?.readOnlyAllowsSensitiveReads === true && scope.boundaries?.readOnlyDeniesSensitiveMutations === true && scope.boundaries?.readOnlyMutationSignedReason === 'CLUSTER_NOT_WRITABLE' && scope.boundaries?.freshVerifiedCoherentReadyWritableMode === 'READ_WRITE');
check('scope preserves cache lease and status fences', scope.boundaries?.statusIpcZeroArgumentRequired === true && scope.boundaries?.statusIpcCacheAllowed === false && scope.boundaries?.sensitiveReadCachesLockedOnRestrictedMode === true && scope.boundaries?.offlineLeaseOverridesInvalidOrStaleOnlinePolicy === false);
check('scope and inventory preserve no migration or ownership transfer', scope.boundaries?.schemaMigrationRequired === false && scope.boundaries?.latestDatabaseMigration === 77 && scope.boundaries?.realDataTransferPerformed === false && scope.boundaries?.cutoverPerformed === false && scope.boundaries?.desktopVaultOwnershipPreserved === true && scope.boundaries?.sqliteOwnershipTransferred === false && inventory.engine?.latestDatabaseMigration === 77);
check('inventory has eight implemented controls and no open production path', inventory.controls?.length === 8 && inventory.controls.every((item) => item.disposition === 'IMPLEMENTED') && inventory.closureSummary?.openProductionPathCount === 0 && inventory.closureSummary?.openProductionPaths?.length === 0);
check('decision documents live attestation and exact matrix', includesAll(decision, ['kernel HMAC doğrulayıcısıyla yeniden doğrular', '30.000 ms', '30.001 ms', '5.000 ms', '5.001 ms', 'CLUSTER_NOT_WRITABLE', 'eski allow receipt']));
check('threat model covers canonical threats and truth boundary', (threatModel.match(/^### /gmu) ?? []).length >= 9 && includesAll(threatModel, ['invalid/stale online policy', 'PPK-012', 'migration, veri taşıma, backfill, cutover']));
check('database migration remains 77', latestMigration === 77);

if (candidateMode) {
  check('candidate registry remains validation pending', requirement?.status === 'IN_PROGRESS' && requirement?.chain?.evidence === false);
  check('candidate scope remains validation pending', scope.status === 'IN_PROGRESS' && scope.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && scope.validation?.state === 'PENDING' && scope.validation?.finalValidationRecorded === false && scope.requirementCompletionClaimed === false && scope.remainingClosureWork?.length > 0);
  check('candidate inventory remains validation pending', inventory.status === 'IMPLEMENTED_VALIDATION_PENDING' && inventory.completionClaimed === false && inventory.closureSummary?.finalValidationPending === true);
  check('candidate decision and threat model make no final claim', decision.includes('IMPLEMENTED_VALIDATION_PENDING') && threatModel.includes('IMPLEMENTED / VALIDATION_PENDING') && !threatModel.includes('VALIDATED / COMPLETE'));
  check('candidate audit makes no final PASS claim', audit.includes('IMPLEMENTED / VALIDATION_PENDING') && audit.includes('Bu belge final kapanış değildir') && !audit.includes('`COMPLETE / PASS` —'));
} else {
  check('accepted registry closes complete PPK-024 chain', requirement?.status === 'COMPLETE' && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 20);
  check('scope closes only after final validation', scope.status === 'COMPLETED' && scope.implementationState === 'VALIDATED_COMPLETE' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.validation?.finalEvidence !== null && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.openBlockers?.length === 0 && inventory.closureSummary?.finalValidationPending === false);
  check('decision and threat model close only after final validation', decision.includes('ACTIVE / COMPLETE') && threatModel.includes('VALIDATED / COMPLETE'));
  check('audit closes only with real final evidence', audit.includes('COMPLETE / PASS') && /contract: `\d+\/\d+ PASS`/u.test(audit) && /runtime kanıt demeti: `\d+\/\d+ PASS`/u.test(audit));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-T',
  requirement: 'PPK-024',
  phase: candidateMode ? 'POLICY_SERVICE_AVAILABILITY_CANDIDATE_CONTRACT' : 'POLICY_SERVICE_AVAILABILITY_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  failures,
  checks,
  productionSourceZones: sourceScan.zones,
  scannedProductionFiles: sourceScan.files,
  securityRelevantFiles: sourceScan.securityRelevantFiles,
  exactCanonicalReferenceFiles: sourceScan.canonicalReferencePaths.length,
  canonicalPolicyClassDefinitions: sourceScan.canonicalPolicyClassDefinitions,
  sourceGateFindings: sourceScan.findings.length,
  targetedTestFiles: targetedTests.length,
  targetedTestsMinimum: 71,
  observationMaximumAgeMs: 30_000,
  maximumFutureSkewMs: 5_000,
  unavailableInvalidAndStaleSensitiveReadsAllowed: false,
  freshVerifiedNonWritableSensitiveReadsAllowed: true,
  freshVerifiedNonWritableMutationsAllowed: false,
  readOnlyMutationSignedReason: 'CLUSTER_NOT_WRITABLE',
  historicalReceiptGrantsCurrentAuthority: false,
  startupSnapshotGrantsCurrentAuthority: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
  historicalBackfillPerformed: false,
  realDataTransferPerformed: false,
  cutoverPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-T-ppk-024-policy-service-availability-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-024${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(`PPK-024${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);
