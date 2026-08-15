import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ok } from '@ppt/core';
import type { CommunicationMlsFoundationPort } from '@ppt/application';
import {
  PlatformPolicyKernel,
  type PlatformPolicyAuthorizationProvider,
  type PlatformPolicyJournalProjectionProof,
  type PlatformPolicyReceiptRecord
} from '@ppt/platform-policy';
import { computePlatformPolicyReceiptHash, computePlatformPolicyReceiptRecordHash } from '@ppt/repositories';
import { FamilyDataStore } from '../src/main/data-store.js';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const POLICY_VERSION = '34-b-communication-messaging-v1';
const PASSWORD = 'Guclu34BMesajParolasi!';
const directories: string[] = []; const stores: FamilyDataStore[] = []; const protectedStores: ProtectedSideArtifactStore[] = [];
let projectionSequence = 0;
const sha = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const kernel = new PlatformPolicyKernel({ policyVersion: POLICY_VERSION,
  signingKey: Buffer.from('34-b-communication-messaging-policy-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read','family.write','location.read'] },
  consentRequiredCapabilities: [], onlineOnlyCapabilities: [], writeActions: ['create','update','delete'] });
const authorizationProvider: PlatformPolicyAuthorizationProvider = {
  resolvePolicyPackage: () => kernel.policyPackage,
  authorize: ({ request, nonce }) => ({ effectiveRequest: request,
    authorization: kernel.authorizeWithReceipt(request, request.occurredAt, nonce) }),
  verify: ({ request, receipt }) => kernel.verifyReceiptForRequest(receipt, request)
};
const projectionProof = (record: PlatformPolicyReceiptRecord): PlatformPolicyJournalProjectionProof => ({
  schemaVersion: 1, receiptHash: computePlatformPolicyReceiptHash(record.receipt),
  recordHash: computePlatformPolicyReceiptRecordHash(record), receiptNonce: record.receipt.nonce,
  entrySequence: ++projectionSequence, entryHash: 'd'.repeat(64), headSequence: projectionSequence,
  headHash: 'd'.repeat(64), journalSizeBytes: projectionSequence * 512, issuedAt: record.recordedAt,
  proofMac: 'e'.repeat(64)
});
const protector: DeviceSecretProtector = Object.freeze({ protectionId: '34-b-message-test-protector', isAvailable: () => true,
  protect: (value: string) => Buffer.from(value, 'utf8').toString('base64url'),
  unprotect: (value: string) => Buffer.from(value, 'base64url').toString('utf8') });

class TestMlsProvider implements CommunicationMlsFoundationPort {
  public provisionDeviceCredential(input: Parameters<CommunicationMlsFoundationPort['provisionDeviceCredential']>[0]) {
    return ok({ trustedDeviceId: input.trustedDeviceId, deviceCredentialSha256: sha({ device: input.trustedDeviceId }),
      keyPackageSha256: sha({ key: input.trustedDeviceId }), sealedCredentialReference: `mls-vault:device:${input.trustedDeviceId}`,
      providerId: 'test-rfc9420-provider', providerImplementation: 'test-rfc9420-adapter',
      providerAttestationSha256: sha({ attestation: input.trustedDeviceId }), providerEvidenceVerified: true as const,
      createdAt: input.occurredAt });
  }
  public createGroup(input: Parameters<CommunicationMlsFoundationPort['createGroup']>[0]) {
    return ok(this.epoch(input.roomId, 1, sha({ group: input.roomId }), input.membershipDigestSha256, 'room_created', input.occurredAt));
  }
  public advanceEpoch(input: Parameters<CommunicationMlsFoundationPort['advanceEpoch']>[0]) {
    return ok(this.epoch(input.roomId, input.currentEpoch + 1, input.groupIdSha256, input.membershipDigestSha256,
      input.reason, input.occurredAt));
  }
  private epoch(roomId: string, epoch: number, groupIdSha256: string, membershipDigestSha256: string,
    reason: 'room_created'|'member_added'|'member_removed'|'device_revoked_recovery', createdAt: string) {
    return { roomId, epoch, cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,
      groupIdSha256, commitSha256: sha({ roomId, epoch, reason, type: 'commit' }),
      confirmedTranscriptHashSha256: sha({ roomId, epoch, reason, type: 'transcript' }),
      groupContextSha256: sha({ roomId, epoch, reason, type: 'context' }), membershipDigestSha256,
      sealedStateReference: `mls-vault:room:${roomId}:epoch:${epoch}`, providerId: 'test-rfc9420-provider',
      providerImplementation: 'test-rfc9420-adapter', providerAttestationSha256: sha({ roomId, epoch, reason }),
      providerEvidenceVerified: true as const, createdAt, reason };
  }
}

afterEach(() => {
  projectionSequence = 0; for (const store of stores.splice(0)) try { store.close(); } catch { /* best effort */ }
  for (const protectedStore of protectedStores.splice(0)) protectedStore.dispose();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const makeStore = (input: { governed: boolean; protectedPayloads: boolean }) => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34b-messaging-')); directories.push(directory);
  const databasePath = join(directory, 'family.db');
  const protectedSideArtifacts = input.protectedPayloads ? new ProtectedSideArtifactStore({
    keyPath: join(directory, 'protected', 'payload.key'), applicationVersion: '34-b-test', protector,
    now: () => '2026-08-15T12:00:00.000Z'
  }) : undefined;
  if (protectedSideArtifacts) protectedStores.push(protectedSideArtifacts);
  const store = new FamilyDataStore({ databasePath, seed: false, communicationMlsFoundation: new TestMlsProvider(),
    ...(protectedSideArtifacts ? { protectedSideArtifacts, communicationMessagePayloadPath: join(directory, 'messages') } : {}),
    ...(input.governed ? { archivePolicyAuthorizationProvider: authorizationProvider,
      archivePolicyReceiptSink: { append: () => undefined, ensure: projectionProof, verifyProjectionProof: () => true },
      archivePolicyVersion: POLICY_VERSION, archiveClusterFence: () => ({ writable: true, epoch: 106 }) } : {}) });
  stores.push(store); store.setupAdmin({ familyName: '34-B İletişim Ailesi', displayName: '34-B Aile Yöneticisi',
    email: 'communication-34b@example.test', password: PASSWORD });
  const accountId = store.listAccounts()[0]!.id; return { directory, databasePath, store, accountId };
};
const allow = (store: FamilyDataStore, accountId: string) => {
  for (const [resourceType, actions] of [
    ['communication_security_center',['read']], ['communication_device_credential',['create','delete']],
    ['communication_room',['create','update','delete']], ['communication_messaging_center',['read']],
    ['communication_message',['create','update','delete']], ['communication_presence',['create','update']],
    ['communication_retention_policy',['create','update']]
  ] as const) store.upsertPermission({ subjectAccountId: accountId, resourceType, resourceId: '*',
    actions: [...actions], effect: 'allow', purpose: 'general' });
};
const createRoom = async (store: FamilyDataStore) => {
  const credential = await store.registerCommunicationDeviceCredential({ clientOperationId: 'register-message-device', expectedRevision: 0 });
  return store.createCommunicationRoom({ clientOperationId: 'create-message-room', expectedRevision: 0,
    ownerDeviceCredentialId: credential.resourceId, roomType: 'family', displayName: 'Güvenli mesaj odası' });
};

describe('34-B communication messaging DataStore production composition', () => {
  it('fails closed without central policy or protected payload authority and creates no message metadata', async () => {
    const noPolicy = makeStore({ governed: false, protectedPayloads: true });
    await expect(noPolicy.store.getCommunicationMessagingCenter()).rejects.toThrow(/policy enforcement is not composed/i);
    const noPayload = makeStore({ governed: true, protectedPayloads: false }); allow(noPayload.store, noPayload.accountId);
    const room = await createRoom(noPayload.store);
    await expect(noPayload.store.createCommunicationMessage({ clientOperationId: 'missing-payload-provider', expectedRevision: 0,
      roomId: room.resourceId, contentKind: 'text', contentMime: 'text/plain', text: 'Yazılmamalı' }))
      .rejects.toThrow(/payload provider is unavailable/i);
    const database = new DatabaseSync(noPayload.databasePath, { readOnly: true });
    try { expect(database.prepare('SELECT COUNT(*) count FROM communication_messages').get()).toEqual({ count: 0 }); }
    finally { database.close(); }
  });

  it('runs create, replay, edit, retry, annotation, presence, retention, delete and restore without DB plaintext', async () => {
    const { store, accountId, databasePath } = makeStore({ governed: true, protectedPayloads: true }); allow(store, accountId);
    const room = await createRoom(store);
    const created = await store.createCommunicationMessage({ clientOperationId: 'create-message-e2e', expectedRevision: 0,
      roomId: room.resourceId, contentKind: 'text', contentMime: 'text/plain', text: 'Veritabanına girmeyen gizli mesaj' });
    expect(await store.createCommunicationMessage({ clientOperationId: 'create-message-e2e', expectedRevision: 0,
      roomId: room.resourceId, contentKind: 'text', contentMime: 'text/plain', text: 'Veritabanına girmeyen gizli mesaj' }))
      .toMatchObject({ replayed: true, resourceId: created.resourceId });
    expect(await store.getCommunicationMessageContent(created.resourceId)).toMatchObject({
      text: 'Veritabanına girmeyen gizli mesaj', networkUsed: false, cloudUsed: false });
    await store.editCommunicationMessage({ clientOperationId: 'edit-message-e2e', expectedRevision: 1,
      messageId: created.resourceId, text: 'Düzeltilmiş gizli mesaj', reason: 'Yazım düzeltildi.' });
    await store.updateCommunicationDelivery({ clientOperationId: 'queue-message-e2e', expectedRevision: 2,
      messageId: created.resourceId, action: 'queue_offline' });
    await store.updateCommunicationDelivery({ clientOperationId: 'retry-message-e2e', expectedRevision: 3,
      messageId: created.resourceId, action: 'retry' });
    await store.annotateCommunicationMessage({ clientOperationId: 'pin-message-e2e', expectedRevision: 4,
      messageId: created.resourceId, pinned: true });
    await store.setCommunicationPresence({ clientOperationId: 'presence-message-e2e', expectedRevision: 0,
      status: 'invisible', audience: 'nobody', lastSeenShared: false, typingIndicatorsEnabled: false,
      readReceiptsEnabled: false, emergencyReachabilityEnabled: false });
    await store.setCommunicationRetentionPolicy({ clientOperationId: 'retention-message-e2e', expectedRevision: 0,
      roomId: room.resourceId, mode: 'auto_delete', durationDays: 30, reason: 'Otuz günlük yerel politika.' });
    await store.setCommunicationMessageLifecycle({ clientOperationId: 'delete-message-e2e', expectedRevision: 5,
      messageId: created.resourceId, action: 'delete', reason: 'Kullanıcı sildi.' });
    await expect(store.getCommunicationMessageContent(created.resourceId)).rejects.toThrow(/bulunamadı/i);
    await store.setCommunicationMessageLifecycle({ clientOperationId: 'restore-message-e2e', expectedRevision: 6,
      messageId: created.resourceId, action: 'restore', reason: 'Kullanıcı geri aldı.' });
    expect(await store.getCommunicationMessageContent(created.resourceId)).toMatchObject({ text: 'Düzeltilmiş gizli mesaj' });
    const center = await store.getCommunicationMessagingCenter();
    expect(center).toMatchObject({ presence: { status: 'invisible', publicAvailability: 'hidden', activeDeviceDisclosed: false },
      retentionPolicies: [{ mode: 'auto_delete', physicalSecureEraseGuaranteed: false }], truth: {
        relayDeliveryImplemented: false, realMessageExchangePerformed: false, networkUsedByCurrentImplementation: false
      }});
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(JSON.stringify(database.prepare('SELECT * FROM communication_messages').all()))
        .not.toMatch(/Veritabanına girmeyen|Düzeltilmiş gizli|Otuz günlük/u);
      expect(database.prepare('SELECT COUNT(*) count FROM communication_message_events').get()).toEqual({ count: 7 });
      expect(database.prepare('SELECT attempt_count,state FROM communication_delivery_queue WHERE message_id=?').get(created.resourceId))
        .toEqual({ attempt_count: 1, state: 'retry_wait' });
    } finally { database.close(); }
    const tamper = new DatabaseSync(databasePath);
    try {
      expect(() => tamper.prepare('DELETE FROM communication_messaging_mutations').run()).toThrow(/durable/i);
      expect(() => tamper.prepare('UPDATE communication_message_events SET message_revision=99').run()).toThrow(/immutable/i);
      expect(() => tamper.prepare('DELETE FROM communication_messages WHERE id=?').run(created.resourceId)).toThrow(/logical deletion/i);
      expect(() => tamper.prepare('UPDATE communication_messages SET revision=99 WHERE id=?').run(created.resourceId))
        .toThrow(/exact immutable identity/i);
    } finally { tamper.close(); }
  });

  it('rejects an explicit central-policy deny before sealing or persisting a message', async () => {
    const { directory, store, accountId, databasePath } = makeStore({ governed: true, protectedPayloads: true });allow(store,accountId);
    const room=await createRoom(store);
    store.upsertPermission({subjectAccountId:accountId,resourceType:'communication_message',resourceId:'*',actions:['create'],
      effect:'deny',purpose:'general',denialReason:'Mesaj oluşturma açıkça reddedildi.'});
    await expect(store.createCommunicationMessage({clientOperationId:'denied-message-e2e',expectedRevision:0,
      roomId:room.resourceId,contentKind:'text',contentMime:'text/plain',text:'Yetkisiz içerik'})).rejects.toThrow();
    const database=new DatabaseSync(databasePath,{readOnly:true});try{
      expect(database.prepare('SELECT COUNT(*) count FROM communication_messages').get()).toEqual({count:0});
      expect(database.prepare('SELECT COUNT(*) count FROM communication_messaging_mutations').get()).toEqual({count:0});
    }finally{database.close();}
    expect(readdirSync(join(directory,'messages')).filter(name=>name.endsWith('.pptmsg'))).toHaveLength(0);
  });

  it('rolls database state back and removes the newly sealed payload after an outbox failure', async () => {
    const { directory, store, accountId, databasePath } = makeStore({ governed: true, protectedPayloads: true }); allow(store, accountId);
    const room = await createRoom(store); const injector = new DatabaseSync(databasePath);
    try { injector.exec(`CREATE TRIGGER test_34b_outbox_failure BEFORE INSERT ON event_outbox
      WHEN NEW.event_type='communication.messaging.changed'
      BEGIN SELECT RAISE(ABORT,'controlled 34-B outbox failure'); END;`); } finally { injector.close(); }
    await expect(store.createCommunicationMessage({ clientOperationId: 'rollback-message-e2e', expectedRevision: 0,
      roomId: room.resourceId, contentKind: 'text', contentMime: 'text/plain', text: 'Rollback gizli mesaj' }))
      .rejects.toThrow(/SQLite|beklenmeyen/i);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      expect(database.prepare('SELECT COUNT(*) count FROM communication_messages').get()).toEqual({ count: 0 });
      expect(database.prepare('SELECT COUNT(*) count FROM communication_messaging_mutations').get()).toEqual({ count: 0 });
    } finally { database.close(); }
    expect(readdirSync(join(directory, 'messages')).filter((name) => name.endsWith('.pptmsg'))).toHaveLength(0);
  });
});
