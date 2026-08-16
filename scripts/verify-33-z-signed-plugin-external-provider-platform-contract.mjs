import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const noWrite = process.argv.includes('--no-write');
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const text = async (path) => readFile(resolve(root, path), 'utf8');
const has = (source, markers) => markers.every((marker) => source.includes(marker));
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const targetedTestFiles = Object.freeze([
  'packages/security/tests/signed-plugin-manifest.test.ts',
  'packages/application/tests/signed-plugin-platform-use-cases.test.ts',
  'packages/repositories/signed-plugin-platform-repository-policy.test.ts',
  'apps/desktop/tests/signed-plugin-platform-data-store.test.ts',
  'apps/desktop/tests/signed-plugin-platform-ipc-integration.test.ts',
  'apps/desktop/tests/signed-plugin-platform-ui.test.ts'
]);

const [scope, inventory, manifest, migrations, domain, security, contract, repository, adapter, runtime, main, preload, globalTypes, decision, threat, ...tests] = await Promise.all([
  json('config/33-z-signed-plugin-external-provider-platform-scope.json'),
  json('config/33-z-signed-plugin-external-provider-platform-inventory.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  text('packages/domain/src/signed-plugin-platform.ts'),
  text('packages/security/src/signed-plugin-manifest.ts'),
  text('packages/repository-contracts/src/signed-plugin-platform-repository.ts'),
  text('packages/repositories/src/signed-plugin-platform-repository.ts'),
  text('apps/desktop/src/main/signed-plugin-platform-application-adapter.ts'),
  text('apps/desktop/src/main/life-production-policy-runtime.ts'),
  text('apps/desktop/src/main/main.ts'),
  text('apps/desktop/src/main/preload.ts'),
  text('apps/desktop/src/renderer/global.d.ts'),
  text('docs/decisions/DEC-237-signed-plugin-external-provider-platform.md'),
  text('docs/security/THREAT_MODEL_33_Z_SIGNED_PLUGIN_EXTERNAL_PROVIDER_PLATFORM.md'),
  ...targetedTestFiles.map(text)
]);

const match = migrations.match(/const signedPluginPlatformSql = `([\s\S]*?)`;\r?\n/u);
const migrationSha256 = match ? createHash('sha256').update(`${match[1].replace(/\r\n/g, '\n').trim()}\n`).digest('hex') : '';
const migration = manifest.migrationVersions?.find((item) => item.version === 104);
const p15 = scope.validation.ppk015;
const p21 = scope.validation.ppk021;
const p22 = scope.validation.ppk022;

const definitions = [
  ['scope inventory and six-file test matrix are exact', exact(scope.requirements, inventory.requirements)
    && exact(scope.validation.targetedTestFiles, targetedTestFiles) && exact(inventory.implementedTargetedTests, targetedTestFiles)
    && tests.length === 6 && scope.validation.targetedTestFileRatchet === 6 && scope.validation.targetedTestRatchet === 30],
  ['migration 104 source manifest and scope checksums are canonical', migration?.name === 'signed_plugin_external_provider_platform'
    && migration?.checksum === migrationSha256 && migrationSha256 === scope.validation.migrationSha256
    && migrationSha256 === '6380b0fde34fd54d9743d234ad7915f4ddd81564a90681164596e77691f9edf5'],
  ['migration owns immutable release mutation and current installation bindings', has(migrations, ['signed_plugin_mutations', 'signed_plugin_releases',
    'signed_plugin_installations', 'trg_33z_signed_plugin_release_update', 'trg_33z_signed_plugin_release_delete',
    'trg_33z_signed_plugin_mutation_update', 'trg_33z_signed_plugin_mutation_delete'])],
  ['domain and security fix nine providers capabilities and fail-closed manifest truth', has(domain, ['SIGNED_PLUGIN_PROVIDER_KINDS',
    'SIGNED_PLUGIN_CAPABILITY_CODES', 'minimumHostVersionEnforced: true', 'boundedStorageCapsEnforced: true',
    'thirdPartyCodeExecutionPerformed: false']) && has(security, ['ppt-signed-plugin-manifest', 'hostVersion',
    'verifySignedPluginManifest', 'SIGNATURE_INVALID', 'UNTRUSTED_SIGNER', 'publicKey.asymmetricKeyType !== \'ed25519\'',
    'filesystemAccess !== \'none\'', 'networkBrokerOnly !== true'])],
  ['repository contract exposes exact center release mutation capacity write and payload-free policy ports', has(contract, ['loadCenter(',
    'getStorageUsage(', 'minimumHostVersion', 'findInstallation(', 'findRelease(', 'findMutationByClientOperationId(',
    'insertMutation(', 'insertRelease(', 'insertInstallation(', 'saveInstallation(', 'resolvePolicyResource('])],
  ['repository enforces receipt owner revision and non-runnable truth bindings', has(repository, ['writeBinding(context, row)',
    'assertPolicyAuthorizedRepositoryContext', 'runtime_execution_ready=0', 'external_provider_connection_ready=0', 'state_fingerprint'])],
  ['desktop adapter and runtime compose central Life policy with transactional evidence', has(adapter, ['RepositoryBackedSignedPluginPlatformUnitOfWork',
    'auditRepository.append', 'outboxRepository.enqueue']) && has(runtime, ["'signed_plugin_installation'", 'signedPluginPlatformPolicyResourceRepository.resolvePolicyResource'])],
  ['main preload and renderer types expose exact four safe methods', has(main, ['SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.getCenter',
    'SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.setDesiredState', 'SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.emergencyDisable', 'SIGNED_PLUGIN_PLATFORM_IPC_CHANNELS.rollback'])
    && has(preload, ['getSignedPluginPlatformCenter', 'setSignedPluginDesiredState', 'emergencyDisableSignedPlugin', 'rollbackSignedPlugin'])
    && has(globalTypes, ['getSignedPluginPlatformCenter', 'setSignedPluginDesiredState', 'emergencyDisableSignedPlugin', 'rollbackSignedPlugin'])],
  ['tests cover signature tamper privilege bounds replay rollback emergency lock owner isolation capacity and renderer denial', has(tests.join('\n'), ['payload tampering',
    'undeclared-provider capabilities', 'replays exactly', 'exact previous signed release', 'keeps emergency disable locked',
    'bounded-capacity overflow', 'forged owner receipt', 'downstream failure', 'rejects renderer-supplied manifests', 'without a new route'])],
  ['decision and threat model deny execution provider production trust sandbox and acceptance claims', has(decision, ['countsAsRequirementPass=false',
    'NOT_RUN', 'Production imza güveni']) && has(threat, ['Sahte veya değiştirilmiş manifest', 'Renderer otorite yükseltmesi', 'NOT_RUN'])],
  ['PPK-015 021 and 022 ratchets are exact PASS', p15.status === 'PASS' && p15.files === 555
    && p15.sourceSha256 === 'aa3dd95d42449907db73c768a556affd194f97a0752a9c9ac53a3bf2491b6bc4' && p15.findings === 0
    && p21.status === 'PASS' && p21.files === 555 && p21.surfaces === 873 && p21.sha256 === '843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc'
    && p22.status === 'PASS' && p22.files === 555 && p22.surfaces === 392 && p22.sha256 === 'cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'],
  ['production signing external manual evidence and requirement acceptance remain closed', scope.truth?.productionSigningTrustProvisioned === false
    && scope.truth?.productionReleaseEligible === false && scope.truth?.requirementsClosed === false
    && scope.validation.countsAsRequirementPass === false && inventory.validation.countsAsRequirementPass === false]
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '33-Z', decision: 'DEC-237', status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED', countsAsRequirementPass: false, migration104Sha256: migrationSha256,
  checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/33-Z-signed-plugin-external-provider-platform-contract.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`33-Z contract: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(item.name);
  process.exit(1);
}
console.log(`33-Z contract: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
