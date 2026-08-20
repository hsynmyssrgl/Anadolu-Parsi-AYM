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
  json('config/34-a-communication-policy-mls-foundation-scope.json'),
  json('config/34-a-communication-policy-mls-foundation-inventory.json'),
  json('config/accepted-scope-registry.json'),
  json('config/remaining-scope-package-roadmap.json'),
  json('config/work-segmentation-plan.json'),
  json('config/active-governance-ledger.json'),
  text('packages/domain/src/communication-security-foundation.ts'),
  text('packages/security/src/communication-mls-provider-evidence.ts'),
  text('packages/application/src/communication-security-use-cases.ts'),
  text('packages/repositories/src/communication-security-repository.ts'),
  text('apps/desktop/src/main/communication-security-application-adapter.ts'),
  text('apps/desktop/src/main/data-store.ts'),
  text('apps/desktop/src/main/ipc-integration-policy.ts'),
  text('apps/desktop/src/renderer/CommunicationSecurityPanel.tsx')
]);

const requirements = ['PPK-001','XPF-002','COM-001','COM-002','SEC-COM-001','SEC-COM-002','SEC-COM-003','SEC-COM-004','SEC-COM-005','SEC-COM-006','SEC-COM-007','SEC-COM-008'];
const dependencies = ['33-P','33-Z'];
const roadmapItem = roadmap.packages?.find((item) => item.step === '34-A');
const registryItems = requirements.map((id) => registry.requirements?.find((item) => item.id === id));
const manualNotRun = Object.entries(scope.manualEvidence ?? {})
  .filter(([key]) => key !== 'certificationClaimed').every(([, value]) => value === 'NOT_RUN');

const definitions = [
  ['scope inventory roadmap and dependency identities are exact', scope.step === '34-A' && scope.decision === 'DEC-238'
    && exact(scope.requirements, requirements) && exact(inventory.requirements, requirements)
    && roadmapItem?.status === 'PLANNED' && exact(roadmapItem.dependsOn, dependencies)],
  ['registry plan and ledger remain open behind 33-P', registryItems.every((item) => item && item.status !== 'COMPLETE' && item.chain?.evidence === false)
    && plan.currentStep === '33-P' && ledger.activeMicroStep === '33-P'],
  ['domain fixes seven rooms history and fail-honest production truth', has(domain, ['COMMUNICATION_ROOM_TYPES', "'private_topic'",
    'COMMUNICATION_SECURITY_STORAGE_LIMITS', 'deviceCredentialsPerOwner: 32', 'roomsPerOwner: 256', 'membershipsPerRoom: 128',
    'new_members_no_history', 'revokedDeviceRekeyWorkflowImplemented: true', 'automaticRoomRekeyOnCredentialRevocation: false',
    'messageEventSignatureVerificationImplemented: false', 'relayDeliveryServiceImplemented: false', 'networkUsedByCurrentImplementation: false',
    'scopedResourceAuthorizationImplemented: false', 'automaticRetentionRecoveryImplemented: false'])],
  ['security requires canonical Ed25519 provider evidence and exact cipher suite', has(security, ['canonicalizeCommunicationMlsProviderEvidence',
    'verifyCommunicationMlsProviderEvidence', 'createPublicKey', 'verify(null,', 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
    'providerImplementation === evidence.providerImplementation', 'previousConfirmedTranscriptHashSha256', 'canonicalArray',
    'matchingKeys.length !== 1'])],
  ['application exposes exact nine governed use cases and content-free evidence', has(application, ['GetCommunicationSecurityCenterUseCase',
    'RegisterCommunicationDeviceCredentialUseCase', 'RevokeCommunicationDeviceCredentialUseCase', 'CreateCommunicationRoomUseCase',
    'AddCommunicationRoomMemberUseCase', 'RemoveCommunicationRoomMemberUseCase', 'RekeyCommunicationRoomAfterDeviceRevocationUseCase',
    'SetCommunicationHistoryAccessUseCase', 'FreezeCommunicationRoomUseCase', 'ensureStorageCapacity', 'exactCommand',
    'İptal edilmiş cihaz üyeliği yalnız açık kayıp-cihaz rekey akışıyla kaldırılabilir.', 'scope.appendAudit', 'scope.enqueueEvent'])],
  ['repository uses exact receipt owner device revision and immutable ledger bindings', has(repository, ['resolvePolicyResource',
    'communication_security_mutations', 'communication_device_credentials', 'communication_mls_epochs', 'communication_rooms',
    'communication_room_memberships', 'getStorageUsage(', 'COMMUNICATION_SECURITY_STORAGE_LIMITS',
    'previous_confirmed_transcript_hash_sha256', 'assertPolicyAuthorizedRepositoryContext'])],
  ['desktop adapter and DataStore compose central Life PEP with fail-closed provider default', has(adapter, ['RepositoryBackedCommunicationSecurityUnitOfWork',
    'RepositoryBackedLifePolicyTransactionRunner', 'auditRepository.append', 'outboxRepository.enqueue'])
    && has(dataStore, ['communicationMlsFoundation?: CommunicationMlsFoundationPort', 'RFC 9420 MLS cihaz kimliği sağlayıcısı yapılandırılmadı.',
      'GetCommunicationSecurityCenterUseCase', 'RekeyCommunicationRoomAfterDeviceRevocationUseCase'])],
  ['IPC exposes exactly nine renderer-safe channels without message relay or key authority', has(ipc, ["getCenter:'communicationSecurity:getCenter'",
    "registerDeviceCredential:'communicationSecurity:registerDeviceCredential'", "revokeDeviceCredential:'communicationSecurity:revokeDeviceCredential'",
    "createRoom:'communicationSecurity:createRoom'", "addMember:'communicationSecurity:addMember'", "removeMember:'communicationSecurity:removeMember'",
    "rekeyRoom:'communicationSecurity:rekeyRoom'", "setHistoryAccess:'communicationSecurity:setHistoryAccess'", "freezeRoom:'communicationSecurity:freezeRoom'",
    "channel.startsWith('communicationSecurity:')"])],
  ['renderer reuses system surface and states every cryptographic no-claim boundary', has(panel, ['CommunicationSecurityPanel',
    'Bu ekran mesaj göndermez ve anahtar yönetmez.', 'const providerReady=false;', 'Production RFC 9420 sağlayıcısı',
    'gerçek ağ teslimi doğrulanmadı', 'Kapsamlı kaynak yetkilendirmesi henüz uygulanmadı',
    'otomatik retention ve kapasite kurtarma yoktur', 'replacementDeviceCredentialId',
    "<strong>0</strong> {text('gönderilmiş mesaj','sent messages')}"])],
  ['provider conformance messages relay network and production guarantees stay false', scope.truth?.rfc9420ProviderConfigured === false
    && scope.truth?.rfc9420ConformanceVerified === false && scope.truth?.forwardSecrecyVerifiedInProduction === false
    && scope.truth?.postCompromiseSecurityVerifiedInProduction === false && scope.truth?.messageContentStoredOrProcessed === false
    && scope.truth?.messageEventSignatureVerificationImplemented === false && scope.truth?.relayDeliveryServiceImplemented === false
    && scope.truth?.networkUsedByCurrentImplementation === false
    && scope.truth?.scopedResourceAuthorizationImplemented === false
    && scope.truth?.boundedMetadataStorageEnforced === true
    && scope.truth?.automaticRetentionRecoveryImplemented === false
    && scope.truth?.providerEpochContinuityBound === true
    && scope.truth?.soleOwnerReplacementRecoveryImplemented === true],
  ['manual receipt and requirement acceptance remain closed', manualNotRun && scope.manualEvidence?.certificationClaimed === false
    && scope.persistentReceiptStatus === 'NOT_RUN' && scope.truth?.requirementsClosed === false
    && scope.truth?.countsAsRequirementPass === false && inventory.countsAsRequirementPass === false],
  ['local validation ratchets are exact but do not grant requirement PASS', scope.validation?.targetedTestFileRatchet === 6
    && scope.validation?.targetedTestRatchet === 37 && scope.validation?.migrationVersion === 105
    && scope.validation?.countsAsRequirementPass === false && inventory.validation?.countsAsRequirementPass === false]
];

const checks = definitions.map(([name, passed]) => ({ name, status: passed ? 'PASS' : 'FAIL' }));
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, step: '34-A', decision: 'DEC-238', status: failures.length ? 'FAIL' : 'PASS',
  governanceState: 'PLANNED', implementationStatus: scope.localImplementationStatus, countsAsRequirementPass: false,
  checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, generatedAt: new Date().toISOString() };
if (!noWrite) {
  await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
  await writeFile(resolve(root, 'artifacts/validation/34-A-communication-policy-mls-foundation-boundary.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
if (failures.length) {
  console.error(`34-A boundary: FAIL (${failures.length}/${checks.length}).`);
  for (const item of failures) console.error(item.name);
  process.exit(1);
}
console.log(`34-A boundary: PASS (${checks.length}/${checks.length}; requirement PASS=false; write=${!noWrite}).`);
