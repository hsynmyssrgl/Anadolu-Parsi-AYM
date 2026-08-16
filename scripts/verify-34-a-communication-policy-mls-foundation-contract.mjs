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
  'packages/security/tests/communication-mls-provider-evidence.test.ts',
  'packages/application/tests/communication-security-use-cases.test.ts',
  'packages/repositories/communication-security-repository-policy.test.ts',
  'apps/desktop/tests/communication-security-data-store.test.ts',
  'apps/desktop/tests/communication-security-ipc-integration.test.ts',
  'apps/desktop/tests/communication-security-ui.test.ts'
]);

const [scope, inventory, manifest, migrations, domain, security, contract, application, repository, adapter, runtime, dataStore, main, preload, globalTypes, decision, threat, ...tests] = await Promise.all([
  json('config/34-a-communication-policy-mls-foundation-scope.json'),
  json('config/34-a-communication-policy-mls-foundation-inventory.json'),
  json('artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json'),
  text('packages/database/src/family-database-migrations.ts'),
  text('packages/domain/src/communication-security-foundation.ts'),
  text('packages/security/src/communication-mls-provider-evidence.ts'),
  text('packages/repository-contracts/src/communication-security-repository.ts'),
  text('packages/application/src/communication-security-use-cases.ts'),
  text('packages/repositories/src/communication-security-repository.ts'),
  text('apps/desktop/src/main/communication-security-application-adapter.ts'),
  text('apps/desktop/src/main/life-production-policy-runtime.ts'),
  text('apps/desktop/src/main/data-store.ts'),
  text('apps/desktop/src/main/main.ts'),
  text('apps/desktop/src/main/preload.ts'),
  text('apps/desktop/src/renderer/global.d.ts'),
  text('docs/decisions/DEC-238-communication-policy-mls-foundation.md'),
  text('docs/security/THREAT_MODEL_34_A_COMMUNICATION_POLICY_MLS_FOUNDATION.md'),
  ...targetedTestFiles.map(text)
]);

const match = migrations.match(/const communicationSecurityFoundationSql = `([\s\S]*?)`;\r?\n/u);
const migrationSha256 = match ? createHash('sha256').update(`${match[1].replace(/\r\n/g, '\n').replaceAll('\\\\', '\\').trim()}\n`).digest('hex') : '';
const migration = manifest.migrationVersions?.find((item) => item.version === 105);
const p15 = scope.validation.ppk015;
const p21 = scope.validation.ppk021;
const p22 = scope.validation.ppk022;

const definitions = [
  ['scope inventory and six-file test matrix are exact', exact(scope.requirements, inventory.requirements)
    && exact(scope.validation.targetedTestFiles, targetedTestFiles) && exact(inventory.implementedTargetedTests, targetedTestFiles)
    && tests.length === 6 && scope.validation.targetedTestFileRatchet === 6 && scope.validation.targetedTestRatchet === 29],
  ['migration 105 source manifest and scope checksums are canonical', migration?.name === 'communication_policy_mls_foundation'
    && migration?.checksum === migrationSha256 && migrationSha256 === scope.validation.migrationSha256
    && migrationSha256 === '3c02d8f0ac6e2b5bf4d6a05bfc73e82fbd14d6144b0c3ef93a49786e45b8b7d7'],
  ['migration owns immutable mutation epoch and current state bindings', has(migrations, ['communication_security_mutations',
    'communication_device_credentials', 'communication_mls_epochs', 'communication_rooms', 'communication_room_memberships',
    'trg_34a_communication_mutation_update', 'trg_34a_communication_mutation_delete', 'trg_34a_mls_epoch_update', 'trg_34a_mls_epoch_delete'])],
  ['domain and security fix room history rekey and fail-closed provider evidence truth', has(domain, ['COMMUNICATION_ROOM_TYPES',
    'revokedCredentialBlocksRoomEpochMutationUntilRekey: true', 'rfc9420ProviderConfigured: false',
    'messageEventSignatureVerificationImplemented: false']) && has(security, ['verifyCommunicationMlsProviderEvidence',
    'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519', 'matchingKeys.length !== 1', 'providerEvidenceVerified: true'])],
  ['repository contract exposes exact center device room membership epoch mutation and policy ports', has(contract, ['loadCenter(',
    'findDeviceCredential(', 'findDeviceCredentialByTrustedDeviceId(', 'findFamilyDeviceCredentialForRoom(', 'findRoom(', 'listMemberships(',
    'findMembership(', 'findEpoch(', 'findMutationByClientOperationId(', 'insertMutation(', 'insertDeviceCredential(', 'saveDeviceCredential(',
    'insertEpoch(', 'insertRoom(', 'saveRoom(', 'insertMembership(', 'saveMembership(', 'resolvePolicyResource('])],
  ['application verifies provider evidence after replay and persists content-free audit outbox', has(application, ['findMutation(command.clientOperationId)',
    'providerEvidenceVerified !== true', 'scope.insertMutation', 'scope.appendAudit', 'scope.enqueueEvent',
    'RekeyCommunicationRoomAfterDeviceRevocationUseCase', 'new_members_no_history'])],
  ['repository enforces receipt owner trusted-device revision and immutable evidence', has(repository, ['assertPolicyAuthorizedRepositoryContext',
    'writeBinding(context, row)', 'state_fingerprint', 'policy_receipt_hash', 'communication_mls_epochs'])],
  ['desktop adapter and runtime compose exact central Life policy resources', has(adapter, ['RepositoryBackedCommunicationSecurityUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner']) && has(runtime, ["'communication_security_center'", "'communication_device_credential'",
      "'communication_room'", 'communicationSecurityPolicyResourceRepository.resolvePolicyResource'])],
  ['DataStore keeps current-device derivation and missing production provider fail closed', has(dataStore, ['communicationMlsFoundation?: CommunicationMlsFoundationPort',
    'RFC 9420 MLS cihaz kimliği sağlayıcısı yapılandırılmadı.', 'trustedDeviceId:context.currentDevice.trustedDeviceId',
    'getCommunicationSecurityCenter()', 'rekeyCommunicationRoomAfterDeviceRevocation('])],
  ['main preload and renderer types expose exact nine safe methods', has(main, ['COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter',
    'COMMUNICATION_SECURITY_IPC_CHANNELS.registerDeviceCredential', 'COMMUNICATION_SECURITY_IPC_CHANNELS.rekeyRoom',
    'COMMUNICATION_SECURITY_IPC_CHANNELS.freezeRoom']) && has(preload, ['getCommunicationSecurityCenter',
    'registerCommunicationDeviceCredential', 'revokeCommunicationDeviceCredential', 'createCommunicationRoom', 'addCommunicationRoomMember',
    'removeCommunicationRoomMember', 'rekeyCommunicationRoomAfterDeviceRevocation', 'setCommunicationHistoryAccess', 'freezeCommunicationRoom'])
    && has(globalTypes, ['getCommunicationSecurityCenter', 'registerCommunicationDeviceCredential', 'rekeyCommunicationRoomAfterDeviceRevocation'])],
  ['tests cover tamper trust window replay rollback foreign owner revoked device history and no-claim UI', has(tests.join('\n'), ['ambiguous key identities',
    'replays exactly', 'outbox failure', 'foreign owner receipt', 'trusted-device revocation', 'new_members_no_history',
    'without a new route', 'const providerReady=false;'])],
  ['decision and threat model deny production MLS messages relay network and acceptance claims', has(decision, ['countsAsRequirementPass=false',
    'Production `CommunicationMlsFoundationPort`', 'NOT_RUN']) && has(threat, ['Sahte sağlayıcı kanıtı', 'Renderer anahtar veya mesaj otoritesi',
    'İptal edilmiş cihazla epoch ilerletme', 'NOT_RUN'])],
  ['PPK-015 021 and 022 ratchets are exact PASS', p15.status === 'PASS' && p15.files === 555
    && p15.sourceSha256 === '1fa021a10651b86e389a0be763977cce61c1c3362a55d6910ad7c938eb512e58' && p15.findings === 0
    && p21.status === 'PASS' && p21.files === 555 && p21.surfaces === 873 && p21.sha256 === '843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc'
    && p22.status === 'PASS' && p22.files === 555 && p22.surfaces === 392 && p22.sha256 === 'cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c'],
  ['production provider conformance delivery and requirement acceptance remain closed', scope.truth?.rfc9420ProviderConfigured === false
    && scope.truth?.rfc9420ConformanceVerified === false && scope.truth?.messageContentStoredOrProcessed === false
    && scope.truth?.relayDeliveryServiceImplemented === false && scope.truth?.requirementsClosed === false
    && scope.validation.countsAsRequirementPass === false && inventory.validation.countsAsRequirementPass === false]
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '34-A', decision: 'DEC-238', status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED', countsAsRequirementPass: false, migration105Sha256: migrationSha256,
  checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/34-A-communication-policy-mls-foundation-contract.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`34-A contract: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(item.name);
  process.exit(1);
}
console.log(`34-A contract: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
