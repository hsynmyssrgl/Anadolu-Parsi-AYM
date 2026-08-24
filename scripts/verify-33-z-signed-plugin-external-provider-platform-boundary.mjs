import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const noWrite = process.argv.includes('--no-write');
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const text = async (path) => readFile(resolve(root, path), 'utf8');
const has = (source, markers) => markers.every((marker) => source.includes(marker));
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const [scope, inventory, registry, roadmap, plan, ledger, domain, security, application, repository, adapter, dataStore, ipc, panel] = await Promise.all([
  json('config/33-z-signed-plugin-external-provider-platform-scope.json'),
  json('config/33-z-signed-plugin-external-provider-platform-inventory.json'),
  json('config/accepted-scope-registry.json'),
  json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),
  json('config/active-governance-ledger.json'),
  text('packages/domain/src/signed-plugin-platform.ts'),
  text('packages/security/src/signed-plugin-manifest.ts'),
  text('packages/application/src/signed-plugin-platform-use-cases.ts'),
  text('packages/repositories/src/signed-plugin-platform-repository.ts'),
  text('apps/desktop/src/main/signed-plugin-platform-application-adapter.ts'),
  text('apps/desktop/src/main/data-store.ts'),
  text('apps/desktop/src/main/ipc-integration-policy.ts'),
  text('apps/desktop/src/renderer/SignedPluginPlatformPanel.tsx')
]);

const requirements = ['B6-05', 'PPK-025', 'EXT-075', 'EXT-076', 'EXT-077', 'EXT-078', 'EXT-079', 'EXT-080', 'EXT-081'];
const dependencies = ['33-O', '33-P', '33-Q'];
const roadmapItem = roadmap.packages?.find((item) => item.step === '33-Z');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const manualNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed')
  .every(([, value]) => value === 'NOT_RUN');

const definitions = [
  ['scope inventory roadmap and dependency identities are exact', scope.step === '33-Z' && scope.decision === 'DEC-237'
    && exact(scope.requirements, requirements) && exact(inventory.requirements, requirements)
    && roadmapItem?.status === 'PLANNED' && exact(roadmapItem.dependsOn, dependencies)],
  ['registry plan and ledger remain open behind 33-P', registryItems.every((item) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false)
    && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'],
  ['domain fixes provider capability and fail-honest truth vocabularies', has(domain, ['SIGNED_PLUGIN_PROVIDER_KINDS', 'SIGNED_PLUGIN_CAPABILITY_CODES',
    'SignedPluginPlatformTruthView', 'minimumHostVersionEnforced: true', 'emergencyDisableRequiresNewHigherSignedRelease: true',
    'boundedStorageCapsEnforced: true', 'automaticRetentionRecoveryImplemented: false', 'thirdPartyCodeExecutionPerformed: false',
    'productionSigningTrustProvisioned: false', 'networkUsedByCurrentImplementation: false'])],
  ['security requires canonical Ed25519 evidence and bounded declarations', has(security, ['SIGNED_PLUGIN_MANIFEST_FORMAT', 'verifySignedPluginManifest',
    'canonicalizeSignedPluginManifest', 'createPublicKey', 'verifySignature', 'hostVersion', 'publicKey.asymmetricKeyType',
    'networkBrokerOnly: true'])],
  ['application exposes exact five governed use cases and content-free evidence', has(application, ['GetSignedPluginPlatformCenterUseCase',
    'RegisterSignedPluginReleaseUseCase', 'SetSignedPluginDesiredStateUseCase', 'EmergencyDisableSignedPluginUseCase', 'RollbackSignedPluginUseCase',
    'ensureCapacity', 'found.value.desiredState === \'emergency_disabled\'', 'scope.appendAudit', 'scope.enqueueEvent'])],
  ['repository uses exact receipt fence owner scope and immutable ledgers', has(repository, ['writeBinding(context, row)', 'resolvePolicyResource',
    'getStorageUsage(', 'owner_person_id=? AND actor_account_id=?', 'signed_plugin_mutations', 'signed_plugin_releases',
    'runtime_execution_ready=0', 'external_provider_connection_ready=0'])],
  ['desktop adapter composes central Life PEP and atomic audit outbox', has(adapter, ['RepositoryBackedSignedPluginPlatformUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner', 'auditRepository.append', 'outboxRepository.enqueue'])],
  ['DataStore composes five use cases and keeps trusted keys main-only', has(dataStore, ['signedPluginTrustedKeys?: readonly TrustedPluginSigningKey[]',
    'GetSignedPluginPlatformCenterUseCase', 'RegisterSignedPluginReleaseUseCase', 'SetSignedPluginDesiredStateUseCase',
    'EmergencyDisableSignedPluginUseCase', 'RollbackSignedPluginUseCase', 'verifySignedPluginManifest'])],
  ['IPC exposes exactly four renderer-safe channels without registration authority', has(ipc, ["getCenter:'signedPluginPlatform:getCenter'",
    "setDesiredState:'signedPluginPlatform:setDesiredState'", "emergencyDisable:'signedPluginPlatform:emergencyDisable'", "rollback:'signedPluginPlatform:rollback'",
    "channel.startsWith('signedPluginPlatform:')"])],
  ['renderer reuses the system surface and states candidate-only truth', has(panel, ['SignedPluginPlatformPanel', 'getSignedPluginPlatformCenter',
    'setSignedPluginDesiredState', 'emergencyDisableSignedPlugin', 'rollbackSignedPlugin', 'signed-plugin-truth', 'Canlı sürüm imza güveni'])],
  ['execution provider credentials signing trust sandbox and network claims stay false', scope.truth?.thirdPartyCodeExecutionPerformed === false
    && scope.truth?.externalProviderConnectionPerformed === false && scope.truth?.providerCredentialsStored === false
    && scope.truth?.productionSigningTrustProvisioned === false && scope.truth?.productionReleaseEligible === false
    && scope.truth?.sandboxRuntimeVerified === false && scope.truth?.osNetworkIsolationVerified === false
    && scope.truth?.providerAvailabilityGuaranteed === false && scope.truth?.networkUsedByCurrentImplementation === false],
  ['manual receipt and requirement acceptance remain closed', manualNotRun && scope.manualEvidence?.certificationClaimed === false
    && scope.persistentReceiptStatus === 'NOT_RUN' && scope.truth?.requirementsClosed === false
    && scope.truth?.countsAsRequirementPass === false && inventory.countsAsRequirementPass === false]
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-Z', decision: 'DEC-237', status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED', implementationStatus: scope.localImplementationStatus, countsAsRequirementPass: false,
  checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/33-Z-signed-plugin-external-provider-platform-boundary.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`33-Z boundary: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(item.name);
  process.exit(1);
}
console.log(`33-Z boundary: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
