import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import type { CommunicationMlsFoundationPort } from '@ppt/application';
import { ok } from '@ppt/core';
import { FamilyDataStore } from '../src/main/data-store.js';

const POLICY_VERSION = '34-a-communication-data-store-v1';
const PASSWORD = 'Guclu34AIletisimParolasi!';
const directories: string[] = [];
const stores: FamilyDataStore[] = [];
let projectionSequence = 0;
const sha = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

const kernel = new PlatformPolicyKernel({
  policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('34-a-communication-data-store-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write', 'location.read'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});
const authorizationProvider: PlatformPolicyAuthorizationProvider = {
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize: ({ request, nonce }) => ({
    effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce)
  }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
};
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => ({
  schemaVersion: 1,
  receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record),
  receiptNonce: record.receipt.nonce,
  entrySequence: ++projectionSequence,
  entryHash: 'd'.repeat(64),
  headSequence: projectionSequence,
  headHash: 'd'.repeat(64),
  journalSizeBytes: projectionSequence * 512,
  issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});

class TestMlsProvider implements CommunicationMlsFoundationPort {
  public deviceCalls = 0;
  public createCalls = 0;
  public advanceCalls = 0;
  public provisionDeviceCredential(input: Parameters<CommunicationMlsFoundationPort['provisionDeviceCredential']>[0]) {
    this.deviceCalls += 1;
    return ok({
      trustedDeviceId: input.trustedDeviceId,
      deviceCredentialSha256: sha({ device: input.trustedDeviceId }),
      keyPackageSha256: sha({ keyPackage: input.trustedDeviceId }),
      sealedCredentialReference: `mls-vault:device:${input.trustedDeviceId}`,
      providerId: 'test-rfc9420-provider', providerImplementation: 'test-rfc9420-adapter',
      providerAttestationSha256: sha({ attestation: input.trustedDeviceId }),
      providerEvidenceVerified: true as const, createdAt: input.occurredAt
    });
  }
  public createGroup(input: Parameters<CommunicationMlsFoundationPort['createGroup']>[0]) {
    this.createCalls += 1;
    return ok(this.epoch(input.roomId, 1, sha({ group: input.roomId }), input.membershipDigestSha256,
      'room_created', input.occurredAt));
  }
  public advanceEpoch(input: Parameters<CommunicationMlsFoundationPort['advanceEpoch']>[0]) {
    this.advanceCalls += 1;
    return ok(this.epoch(input.roomId, input.currentEpoch + 1, input.groupIdSha256,
      input.membershipDigestSha256, input.reason, input.occurredAt));
  }
  private epoch(roomId: string, epoch: number, groupIdSha256: string, membershipDigestSha256: string,
    reason: 'room_created'|'member_added'|'member_removed'|'device_revoked_recovery', createdAt: string) {
    return {
      roomId, epoch, cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,
      groupIdSha256, commitSha256: sha({ roomId, epoch, reason, kind: 'commit' }),
      confirmedTranscriptHashSha256: sha({ roomId, epoch, reason, kind: 'transcript' }),
      groupContextSha256: sha({ roomId, epoch, reason, kind: 'context' }), membershipDigestSha256,
      sealedStateReference: `mls-vault:room:${roomId}:epoch:${epoch}`,
      providerId: 'test-rfc9420-provider', providerImplementation: 'test-rfc9420-adapter',
      providerAttestationSha256: sha({ roomId, epoch, reason, kind: 'attestation' }),
      providerEvidenceVerified: true as const, createdAt, reason
    };
  }
}

afterEach(() => {
  projectionSequence = 0;
  for (const store of stores.splice(0)) {
    try { store.close(); } catch { /* best effort */ }
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const makeStore = (governed: boolean, mlsProvider?: CommunicationMlsFoundationPort) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34a-communication-'));
  directories.push(directory);
  const databasePath = join(directory, 'family.db');
  const store = new FamilyDataStore({
    databasePath,
    seed: false,
    ...(mlsProvider ? { communicationMlsFoundation: mlsProvider } : {}),
    ...(governed ? {
      archivePolicyAuthorizationProvider: authorizationProvider,
      archivePolicyReceiptSink: { append: () => undefined, ensure: projectionProof, verifyProjectionProof: () => true },
      archivePolicyVersion: POLICY_VERSION,
      archiveClusterFence: () => ({ writable: true, epoch: 105 })
    } : {})
  });
  stores.push(store);
  store.setupAdmin({
    familyName: '34-A İletişim Ailesi', displayName: '34-A Aile Yöneticisi',
    email: 'communication-34a@example.test', password: PASSWORD
  });
  const account = store.listAccounts()[0]!;
  return { directory, databasePath, store, accountId: account.id };
};

const allow = (store: FamilyDataStore, accountId: string) => {
  for (const [resourceType, actions] of [
    ['communication_security_center', ['read']],
    ['communication_device_credential', ['create', 'delete']],
    ['communication_room', ['create', 'update', 'delete']]
  ] as const) {
    store.upsertPermission({
      subjectAccountId: accountId, resourceType, resourceId: '*', actions: [...actions],
      effect: 'allow', purpose: 'general'
    });
  }
};

describe('34-A communication security DataStore integration', () => {
  it('fails closed without central policy or a configured MLS provider and writes nothing', async () => {
    const noPolicy = makeStore(false, new TestMlsProvider()).store;
    await expect(noPolicy.getCommunicationSecurityCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    const missingProvider = makeStore(true);
    allow(missingProvider.store, missingProvider.accountId);
    await expect(missingProvider.store.registerCommunicationDeviceCredential({
      clientOperationId: 'register-without-provider', expectedRevision: 0
    })).rejects.toThrow(/MLS.*yapılandırılmadı/i);
    const database = new DatabaseSync(missingProvider.databasePath, { readOnly: true });
    try {
      expect(database.prepare('SELECT COUNT(*) count FROM communication_security_mutations').get()).toEqual({ count: 0 });
      expect(database.prepare('SELECT COUNT(*) count FROM communication_device_credentials').get()).toEqual({ count: 0 });
    } finally { database.close(); }
  });

  it('registers the current trusted device, creates every room scope safely and replays exactly', async () => {
    const provider = new TestMlsProvider();
    const { store, accountId } = makeStore(true, provider);
    allow(store, accountId);
    const registered = await store.registerCommunicationDeviceCredential({
      clientOperationId: 'register-current-device', expectedRevision: 0
    });
    expect(registered).toMatchObject({
      mutationKind: 'device_credential_register', revision: 1, replayed: false,
      messageContentProcessed: false, networkUsed: false
    });
    expect(await store.registerCommunicationDeviceCredential({
      clientOperationId: 'register-current-device', expectedRevision: 0
    })).toMatchObject({ replayed: true, resourceId: registered.resourceId });
    const roomTypes = ['direct','family','household','family_branch','event','care','private_topic'] as const;
    for (const [index, roomType] of roomTypes.entries()) {
      const result = await store.createCommunicationRoom({
        clientOperationId: `create-room-${index}`, expectedRevision: 0,
        ownerDeviceCredentialId: registered.resourceId, roomType, displayName: `Oda ${index + 1}`
      });
      expect(result).toMatchObject({ mutationKind: 'room_create', revision: 1 });
    }
    const center = await store.getCommunicationSecurityCenter();
    expect(center.deviceCredentials).toHaveLength(1);
    expect(center.rooms.map((room) => room.roomType).sort()).toEqual([...roomTypes].sort());
    expect(center.rooms.every((room) => room.historyAccessMode === 'new_members_no_history'
      && room.currentEpochEvidence.providerEvidenceVerified
      && room.currentEpochEvidence.sealedProviderStateStored)).toBe(true);
    expect(center.truth).toMatchObject({
      rfc9420ProviderConfigured: false,
      rfc9420ConformanceVerified: false,
      forwardSecrecyVerifiedInProduction: false,
      postCompromiseSecurityVerifiedInProduction: false,
      automaticRoomRekeyOnCredentialRevocation: false,
      messageEventSignatureVerificationImplemented: false,
      relayDeliveryServiceImplemented: false,
      networkUsedByCurrentImplementation: false
    });
    const serialized = JSON.stringify(center);
    for (const forbidden of [
      'deviceCredentialSha256','keyPackageSha256','sealedCredentialReference','providerAttestationSha256',
      'groupIdSha256','commitSha256','confirmedTranscriptHashSha256','groupContextSha256','sealedStateReference'
    ]) expect(serialized).not.toContain(forbidden);
    expect(provider.deviceCalls).toBe(1);
    expect(provider.createCalls).toBe(7);
  });

  it('persists history/freeze transitions and rolls mutation, room, audit and outbox back together', async () => {
    const provider = new TestMlsProvider();
    const { databasePath, store, accountId } = makeStore(true, provider);
    allow(store, accountId);
    const credential = await store.registerCommunicationDeviceCredential({
      clientOperationId: 'register-history-device', expectedRevision: 0
    });
    const created = await store.createCommunicationRoom({
      clientOperationId: 'create-history-room', expectedRevision: 0,
      ownerDeviceCredentialId: credential.resourceId, roomType: 'family', displayName: 'Geçmiş odası'
    });
    const injector = new DatabaseSync(databasePath);
    try {
      injector.exec(`CREATE TRIGGER test_34a_outbox_failure BEFORE INSERT ON event_outbox
        WHEN NEW.event_type='communication_security.history_policy_update'
        BEGIN SELECT RAISE(ABORT,'controlled 34-A outbox failure'); END;`);
    } finally { injector.close(); }
    await expect(store.setCommunicationHistoryAccess({
      clientOperationId: 'history-rollback', expectedRevision: 1, roomId: created.resourceId,
      historyAccessMode: 'explicit_snapshot_grant', reason: 'Yalnız ayrı snapshot kararıyla.'
    })).rejects.toThrow(/SQLite|beklenmeyen/i);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(database.prepare('SELECT history_access_mode,revision FROM communication_rooms WHERE id=?').get(created.resourceId))
        .toEqual({ history_access_mode: 'new_members_no_history', revision: 1 });
      expect(database.prepare('SELECT COUNT(*) count FROM communication_security_mutations').get()).toEqual({ count: 2 });
      expect(database.prepare("SELECT COUNT(*) count FROM audit_log WHERE action='communication_security.history_policy_update'").get())
        .toEqual({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) count FROM event_outbox WHERE event_type='communication_security.history_policy_update'").get())
        .toEqual({ count: 0 });
    } finally { database.close(); }
    const cleanup = new DatabaseSync(databasePath);
    try { cleanup.exec('DROP TRIGGER test_34a_outbox_failure'); } finally { cleanup.close(); }
    expect(await store.setCommunicationHistoryAccess({
      clientOperationId: 'history-success', expectedRevision: 1, roomId: created.resourceId,
      historyAccessMode: 'explicit_snapshot_grant', reason: 'Yalnız ayrı snapshot kararıyla.'
    })).toMatchObject({ mutationKind: 'history_policy_update', revision: 2 });
    expect(await store.freezeCommunicationRoom({
      clientOperationId: 'freeze-history-room', expectedRevision: 2, roomId: created.resourceId,
      confirmation: 'ILETISIM ODASINI DONDUR', reason: 'Oda yerel olarak kapatıldı.'
    })).toMatchObject({ mutationKind: 'room_freeze', revision: 3 });
  });
});
