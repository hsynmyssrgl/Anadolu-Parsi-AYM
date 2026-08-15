import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMMUNICATION_SECURITY_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const NOW = '2026-08-15T10:00:00.000Z';
const receipt = {
  resourceType: 'communication_room', resourceId: 'comm-room-34-a', mutationKind: 'history_policy_update',
  previousRevision: 1, revision: 2, occurredAt: NOW, replayed: false,
  messageContentProcessed: false, networkUsed: false
};
const truth = {
  centralPolicyKernelRequired: true, localRoomAndEpochMetadataRegistryImplemented: true,
  opaqueSealedMlsStateRequired: true, verifiedProviderEvidenceRequired: true,
  newMemberHistoryDefaultDenied: true, revokedDeviceRekeyWorkflowImplemented: true,
  revokedCredentialBlocksRoomEpochMutationUntilRekey: true, automaticRoomRekeyOnCredentialRevocation: false,
  contentFreeAuditRequired: true, rendererKeyMaterialAuthority: false, rendererRelayAuthority: false,
  privateKeyPersistedInDatabase: false, messagePlaintextPersistedByFoundation: false,
  messageEventSignatureVerificationImplemented: false, relayDeliveryServiceImplemented: false,
  rfc9420ProviderConfigured: false, rfc9420ConformanceVerified: false,
  forwardSecrecyVerifiedInProduction: false, postCompromiseSecurityVerifiedInProduction: false,
  relayContentBlindnessVerifiedInProduction: false, realMessageExchangePerformed: false,
  networkUsedByCurrentImplementation: false
};
const center = {
  schemaVersion: 1,
  centerId: 'communication-security:family-34-a:person-34-a',
  ownerPersonId: 'person-34-a',
  deviceCredentials: [{
    id: 'comm-device-34-a', trustedDeviceId: 'trusted-device-34-a', status: 'active',
    providerVerified: true, keyPackageStoredOutsideDatabase: true, revision: 1, createdAt: NOW, updatedAt: NOW
  }],
  rooms: [{
    id: 'comm-room-34-a', displayName: 'Aile odası', roomType: 'family', status: 'active',
    historyAccessMode: 'new_members_no_history', currentEpoch: 1,
    memberships: [{
      id: 'comm-member-34-a', memberPersonId: 'person-34-a', deviceCredentialId: 'comm-device-34-a',
      role: 'owner', status: 'active', joinedAtEpoch: 1, historyVisibleFromEpoch: 1
    }],
    currentEpochEvidence: {
      epoch: 1, cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
      providerEvidenceVerified: true, sealedProviderStateStored: true, activeDeviceCredentialCount: 1,
      createdAt: NOW, reason: 'room_created'
    },
    revision: 1, createdAt: NOW, updatedAt: NOW
  }],
  truth,
  generatedAt: NOW
};

describe('34-A communication security IPC boundary', () => {
  it('accepts exactly nine renderer-safe channels and their bounded commands', () => {
    const valid = new Map<string, unknown[]>([
      [COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter, []],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.registerDeviceCredential,
        [{ clientOperationId: 'register-device-34-a', expectedRevision: 0 }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.revokeDeviceCredential, [{
        clientOperationId: 'revoke-device-34-a', expectedRevision: 1, deviceCredentialId: 'comm-device-34-a',
        confirmation: 'ILETISIM CIHAZ KIMLIGINI IPTAL ET', reason: 'Cihaz kayboldu.'
      }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.createRoom, [{
        clientOperationId: 'create-room-34-a', expectedRevision: 0, ownerDeviceCredentialId: 'comm-device-34-a',
        roomType: 'family', displayName: 'Aile odası'
      }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.addMember, [{
        clientOperationId: 'add-member-34-a', expectedRevision: 1, roomId: 'comm-room-34-a',
        memberPersonId: 'person-member-34-a', deviceCredentialId: 'comm-device-member-34-a', role: 'member'
      }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.removeMember, [{
        clientOperationId: 'remove-member-34-a', expectedRevision: 2, roomId: 'comm-room-34-a',
        membershipId: 'comm-membership-member-34-a', reason: 'Üyelik sona erdi.'
      }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.rekeyRoom, [{
        clientOperationId: 'rekey-room-34-a', expectedRevision: 2, roomId: 'comm-room-34-a',
        revokedDeviceCredentialId: 'comm-device-member-34-a',
        confirmation: 'KAYIP CIHAZ SONRASI ODAYI YENIDEN ANAHTARLA', reason: 'Kayıp cihaz çıkarıldı.'
      }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.setHistoryAccess, [{
        clientOperationId: 'history-room-34-a', expectedRevision: 1, roomId: 'comm-room-34-a',
        historyAccessMode: 'explicit_snapshot_grant', reason: 'Ayrı snapshot kararı gerekir.'
      }]],
      [COMMUNICATION_SECURITY_IPC_CHANNELS.freezeRoom, [{
        clientOperationId: 'freeze-room-34-a', expectedRevision: 2, roomId: 'comm-room-34-a',
        confirmation: 'ILETISIM ODASINI DONDUR', reason: 'Oda yerel olarak kapatıldı.'
      }]]
    ]);
    for (const [channel, args] of valid) expect(evaluateIpcIntegrationPolicy(channel, args).accepted).toBe(true);
    expect(evaluateIpcIntegrationPolicy('communicationSecurity:sendMessage', [{}]).accepted).toBe(false);
  });

  it('rejects renderer-supplied key material, provider evidence, relay authority, paths and prototype tricks', () => {
    const base = { clientOperationId: 'create-room-34-a', expectedRevision: 0,
      ownerDeviceCredentialId: 'comm-device-34-a', roomType: 'family', displayName: 'Aile odası' };
    for (const extra of [
      { privateKey: 'secret' }, { keyPackage: 'opaque' }, { sealedStateReference: 'vault:item' },
      { providerAttestation: {} }, { providerKeyId: 'provider-root' }, { relayUrl: 'https://relay.example' },
      { token: 'secret' }, { path: 'C:\\keys\\mls.bin' }, { message: 'plaintext' }
    ]) expect(evaluateIpcIntegrationPolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.createRoom, [{ ...base, ...extra }]).accepted)
      .toBe(false);
    const inherited = Object.create({ privateKey: 'secret' }) as Record<string, unknown>;
    Object.assign(inherited, base);
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.createRoom, [inherited]).accepted).toBe(false);
  });

  it('accepts only redacted center and content-free mutation projections', () => {
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter, center).accepted).toBe(true);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.setHistoryAccess, receipt).accepted).toBe(true);
    for (const extra of [
      { deviceCredentialSha256: 'a'.repeat(64) }, { keyPackageSha256: 'b'.repeat(64) },
      { sealedStateReference: 'mls-vault:room' }, { providerAttestationSha256: 'c'.repeat(64) },
      { policyReceiptHash: 'd'.repeat(64) }, { messagePlaintext: 'secret' }
    ]) expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter, { ...center, ...extra }).accepted)
      .toBe(false);
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.setHistoryAccess,
      { ...receipt, networkUsed: true }).accepted).toBe(false);
  });

  it('keeps reads cancellable and every durable MLS metadata write non-cancellable and bounded', () => {
    expect(resolveIpcRequestLifecyclePolicy(COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter))
      .toMatchObject({ cancellable: true, latestWins: true, timeoutMs: 10_000 });
    for (const channel of Object.values(COMMUNICATION_SECURITY_IPC_CHANNELS)
      .filter((value) => value !== COMMUNICATION_SECURITY_IPC_CHANNELS.getCenter)) {
      expect(resolveIpcRequestLifecyclePolicy(channel)).toMatchObject({ cancellable: false, latestWins: false, timeoutMs: 0 });
      expect(resolveIpcRequestRatePolicy(channel)).toMatchObject({ enabled: true, maxRequestsPerWindow: 12, windowMs: 60_000 });
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({
        enabled: true, maxConcurrentPerChannel: 1, maxQueuedPerSender: 4
      });
    }
  });

  it('registers all safe bridge methods without exposing provider, key or message authority', () => {
    const main = readFileSync('apps/desktop/src/main/main.ts', 'utf8');
    const preload = readFileSync('apps/desktop/src/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('apps/desktop/src/renderer/global.d.ts', 'utf8');
    for (const channel of Object.values(COMMUNICATION_SECURITY_IPC_CHANNELS)) expect(main + preload).toContain(channel);
    for (const method of [
      'getCommunicationSecurityCenter','registerCommunicationDeviceCredential','revokeCommunicationDeviceCredential',
      'createCommunicationRoom','addCommunicationRoomMember','removeCommunicationRoomMember',
      'rekeyCommunicationRoomAfterDeviceRevocation','setCommunicationHistoryAccess','freezeCommunicationRoom'
    ]) expect(preload + globalTypes).toContain(method);
    for (const forbidden of [
      'setCommunicationMlsProvider','readCommunicationKeyPackage','sendCommunicationMessage',
      'configureCommunicationRelay','exportCommunicationPrivateKey'
    ]) expect(preload + globalTypes).not.toContain(forbidden);
  });
});
