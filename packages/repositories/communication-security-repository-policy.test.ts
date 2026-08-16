import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  type Clock
} from '@ppt/core';
import { PlatformPolicyEnforcementPoint, PlatformPolicyKernel } from '@ppt/platform-policy';
import type {
  CommunicationDeviceCredentialRow,
  CommunicationMlsEpochRow,
  CommunicationRoomMembershipRow,
  CommunicationRoomRow,
  CommunicationSecurityCenterKey,
  CommunicationSecurityMutationRow,
  PolicyAuthorizedRepositoryExecutionContext,
  RepositoryExecutionContext,
  RepositoryResult,
  TransactionContext
} from '@ppt/repository-contracts';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';
import { SqliteCommunicationSecurityRepository } from './src/communication-security-repository.js';
import { SqlitePlatformPolicyTransactionRepository } from './src/platform-policy-transaction-repository.js';

const NOW = asIsoDateTime('2026-08-15T12:00:00.000Z');
const FAMILY = asFamilyId('family-34-a-repository');
const ACCOUNT = asUserId('account-34-a-owner');
const OWNER = asPersonId('person-34-a-owner');
const OTHER = asPersonId('person-34-a-other');
const DEVICE = 'trusted-device-34-a';
const FENCE = 'communication-security-write';
const EPOCH = 105;
const clock: Clock = { now: () => NOW };
const runtimes: SqliteFamilyDatabaseRuntime[] = [];
const directories: string[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const repositoryContext = (transaction: TransactionContext): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: ACCOUNT, personId: OWNER, roles: ['family_admin'] },
  correlationId: transaction.correlationId,
  occurredAt: transaction.occurredAt
});

const openHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34a-communication-'));
  directories.push(directory);
  const runtime = new SqliteFamilyDatabaseRuntime({
    databasePath: join(directory, 'family.db'),
    applicationVersion: '34-a-vitest',
    clock,
    skipFileMigrationSafetyBackup: true,
    databaseConfig: { busyTimeoutMs: 5_000, journalMode: 'WAL', synchronous: 'FULL' }
  });
  runtimes.push(runtime);
  const policyRepository = new SqlitePlatformPolicyTransactionRepository();
  expect(runtime.transactionExecutor.execute(asCorrelationId('34-a-fence'), (transaction) =>
    policyRepository.synchronizeFence(repositoryContext(transaction), {
      fenceName: FENCE, epoch: EPOCH, writable: true, synchronizedAt: NOW
    })).ok).toBe(true);
  runtime.database.prepare('INSERT INTO families(id,name,created_at) VALUES(?,?,?)').run(FAMILY, '34-A Family', NOW);
  const person = runtime.database.prepare(`INSERT INTO people(
    id,family_id,display_name,birth_date,relationship_type,generation,branch,status,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?)`);
  person.run(OWNER, FAMILY, 'Owner', '1985-01-01', 'self', 0, 'main', 'active', NOW);
  person.run(OTHER, FAMILY, 'Other', '1986-01-01', 'partner', 0, 'main', 'active', NOW);
  runtime.database.prepare(`INSERT INTO accounts(
    id,display_name,email,password_record,created_at,role,status,person_id,starts_at
  ) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    ACCOUNT, 'Owner', 'owner-34a@example.test', 'test-password-record', NOW,
    'family_admin', 'active', OWNER, '2026-01-01T00:00:00.000Z'
  );
  runtime.database.prepare(`INSERT INTO trusted_devices(
    id,account_id,device_id,display_name,fingerprint,public_key_pem,trusted_at,last_seen_at,revoked_at,created_at,security_epoch
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
    DEVICE, ACCOUNT, 'device-34-a', 'Owner device', 'f'.repeat(64),
    '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----', NOW, NOW, null, NOW, 0
  );
  return { runtime, repository: new SqliteCommunicationSecurityRepository(), policyRepository };
};

type Harness = ReturnType<typeof openHarness>;
type ResourceType = 'communication_security_center' | 'communication_device_credential' | 'communication_room';
let sequence = 0;
const kernel = new PlatformPolicyKernel({
  policyVersion: '34-a-communication-policy-v1',
  signingKey: Buffer.from('34-a-communication-policy-key-material', 'utf8'),
  applicationCapabilities: { 'windows-desktop': ['family.read', 'family.write'] },
  consentRequiredCapabilities: [],
  onlineOnlyCapabilities: [],
  writeActions: ['create', 'update', 'delete']
});

const withReceipt = async <T>(harness: Harness, input: {
  action: 'read' | 'create' | 'update' | 'delete';
  resourceType: ResourceType;
  resourceId: string;
  ownerPersonId?: string;
}, operation: (repository: SqliteCommunicationSecurityRepository,
  context: PolicyAuthorizedRepositoryExecutionContext) => RepositoryResult<T>) => {
  sequence += 1;
  const correlationId = asCorrelationId(`communication-${input.action}-${sequence}`);
  const capability = input.action === 'read' ? 'family.read' : 'family.write';
  const pep = new PlatformPolicyEnforcementPoint({
    kernel,
    authorityResolver: { resolve: () => ({
      policyVersion: '34-a-communication-policy-v1', accountId: ACCOUNT, personId: OWNER,
      deviceId: 'device-34-a', applicationId: 'windows-desktop', deviceTrusted: true,
      membershipActive: true, roles: ['family_admin'], familyIds: [FAMILY],
      grants: [{
        id: `grant-${sequence}`, subjectAccountId: ACCOUNT, resourceType: input.resourceType,
        resourceId: input.resourceId, actions: [input.action], purposes: ['general'], effect: 'allow',
        startsAt: '2026-01-01T00:00:00.000Z'
      }], online: true, expiresAt: '2027-12-31T23:59:59.999Z'
    }) },
    resourceResolver: { resolve: () => ({
      type: input.resourceType, id: input.resourceId, familyId: FAMILY,
      ownerPersonId: input.ownerPersonId ?? OWNER, sensitivity: 'highly_sensitive',
      dataClasses: ['personal'] as const, classificationSource: 'declared' as const
    }) },
    receiptSink: { append: () => undefined, ensure: () => undefined },
    replayStore: { reserve: (reservation) => {
      const result = harness.runtime.transactionExecutor.execute(asCorrelationId(`communication-reserve-${sequence}`),
        (transaction) => harness.policyRepository.reserveReplayNonce(repositoryContext(transaction), reservation));
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    } },
    clock: () => NOW,
    nonceFactory: () => `nonce-communication-${sequence}`,
    deferAllowedReceiptPersistence: true
  });
  return pep.execute({ correlationId, action: input.action, capability,
    resourceType: input.resourceType, resourceId: input.resourceId, purpose: 'general' },
  () => ({ writable: true, epoch: EPOCH }), (authorization) =>
    harness.runtime.transactionExecutor.execute(correlationId, (transaction) => {
      const context: PolicyAuthorizedRepositoryExecutionContext = {
        ...repositoryContext(transaction), correlationId, policyAuthorization: authorization
      };
      const recorded = harness.policyRepository.recordAuthorizedTransaction(context, {
        record: authorization.receiptRecord, fenceName: FENCE, fenceEpoch: EPOCH, fenceWritable: true
      });
      return recorded.ok ? operation(harness.repository, context) : recorded;
    }));
};

const key: CommunicationSecurityCenterKey = {
  familyId: FAMILY,
  accountId: ACCOUNT,
  actorPersonId: OWNER,
  ownerPersonId: OWNER,
  centerId: `communication-security:${FAMILY}:${OWNER}`
};

const createCredentialRows = () => {
  const mutation: CommunicationSecurityMutationRow = {
    id: '1'.repeat(64), familyId: FAMILY, ownerPersonId: OWNER,
    resourceType: 'communication_device_credential', resourceId: 'comm-device-owner-34-a',
    actorAccountId: ACCOUNT, actorPersonId: OWNER, mutationKind: 'device_credential_register',
    clientOperationId: 'register-owner-device-34-a', requestFingerprint: '2'.repeat(64),
    expectedRevision: 0, revision: 1, resourceStateFingerprint: '3'.repeat(64), occurredAt: NOW
  };
  const credential: CommunicationDeviceCredentialRow = {
    id: mutation.resourceId, familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: OWNER,
    trustedDeviceId: DEVICE, deviceCredentialSha256: '4'.repeat(64), keyPackageSha256: '5'.repeat(64),
    sealedCredentialReference: 'mls-vault:device:owner-34-a', providerId: 'provider-local-34-a',
    providerImplementation: 'rfc9420-test-provider', providerAttestationSha256: '6'.repeat(64),
    providerEvidenceVerified: true, status: 'active', revision: 1,
    stateFingerprint: mutation.resourceStateFingerprint, lastMutationId: mutation.id,
    createdAt: NOW, updatedAt: NOW
  };
  return { mutation, credential };
};

const createRoomRows = (credentialId: string) => {
  const roomId = 'comm-room-family-34-a';
  const mutation: CommunicationSecurityMutationRow = {
    id: '7'.repeat(64), familyId: FAMILY, ownerPersonId: OWNER,
    resourceType: 'communication_room', resourceId: roomId,
    actorAccountId: ACCOUNT, actorPersonId: OWNER, mutationKind: 'room_create',
    clientOperationId: 'create-family-room-34-a', requestFingerprint: '8'.repeat(64),
    expectedRevision: 0, revision: 1, resourceStateFingerprint: '9'.repeat(64), occurredAt: NOW
  };
  const epoch: CommunicationMlsEpochRow = {
    id: 'a'.repeat(64), familyId: FAMILY, ownerPersonId: OWNER, roomId, epoch: 1,
    cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519', groupIdSha256: 'b'.repeat(64),
    commitSha256: 'c'.repeat(64), confirmedTranscriptHashSha256: 'd'.repeat(64),
    groupContextSha256: 'e'.repeat(64), membershipDigestSha256: 'f'.repeat(64),
    sealedStateReference: 'mls-vault:room:family-34-a:epoch:1', providerId: 'provider-local-34-a',
    providerImplementation: 'rfc9420-test-provider', providerAttestationSha256: '0'.repeat(64),
    providerEvidenceVerified: true, activeDeviceCredentialCount: 1, reason: 'room_created',
    mutationId: mutation.id, createdAt: NOW
  };
  const room: CommunicationRoomRow = {
    id: roomId, familyId: FAMILY, accountId: ACCOUNT, ownerPersonId: OWNER,
    displayName: 'Aile odası', roomType: 'family', maskedRoomRefSha256: '1'.repeat(64),
    providerGroupIdSha256: epoch.groupIdSha256, status: 'active', historyAccessMode: 'new_members_no_history',
    currentEpoch: 1, currentEpochId: epoch.id, revision: 1, stateFingerprint: mutation.resourceStateFingerprint,
    lastMutationId: mutation.id, createdAt: NOW, updatedAt: NOW
  };
  const membership: CommunicationRoomMembershipRow = {
    id: 'comm-membership-owner-34-a', familyId: FAMILY, ownerPersonId: OWNER, roomId,
    memberPersonId: OWNER, deviceCredentialId: credentialId, role: 'owner', status: 'active',
    joinedAtEpoch: 1, historyVisibleFromEpoch: 1, revision: 1, stateFingerprint: '2'.repeat(64),
    lastMutationId: mutation.id, createdAt: NOW, updatedAt: NOW
  };
  return { mutation, epoch, room, membership };
};

const persistCredential = (harness: Harness, rows = createCredentialRows()) => withReceipt(harness, {
  action: 'create', resourceType: 'communication_device_credential', resourceId: rows.credential.id
}, (repository, context) => {
  const ledger = repository.insertMutation(context, rows.mutation);
  return ledger.ok ? repository.insertDeviceCredential(context, rows.credential) : ledger;
});

describe('34-A communication security repository policy boundary', () => {
  it('persists a verified credential only for a non-revoked trusted device', async () => {
    const harness = openHarness();
    expect((await persistCredential(harness)).ok).toBe(true);
    const row = harness.runtime.database.prepare(`SELECT status,provider_evidence_verified,
      length(device_credential_sha256) hash_length FROM communication_device_credentials`).get();
    expect(row).toEqual({ status: 'active', provider_evidence_verified: 1, hash_length: 64 });
    expect(() => harness.runtime.database.prepare(`DELETE FROM communication_security_mutations`).run())
      .toThrow(/durable/u);
  });

  it('persists epoch one, the owner membership and default history denial atomically', async () => {
    const harness = openHarness(); const credentialRows = createCredentialRows();
    await persistCredential(harness, credentialRows);
    const rows = createRoomRows(credentialRows.credential.id);
    const scopedRejected = await withReceipt(harness, {
      action: 'create', resourceType: 'communication_room', resourceId: rows.room.id
    }, (repository, context) => {
      const mutation = repository.insertMutation(context, rows.mutation); if (!mutation.ok) return mutation;
      const epoch = repository.insertEpoch(context, rows.epoch); if (!epoch.ok) return epoch;
      return repository.insertRoom(context, { ...rows.room,
        scopeResourceType: 'family', scopeResourceId: 'family-resource-34-a' });
    });
    expect(scopedRejected.ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM communication_rooms').get()).toEqual({ count: 0 });
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM communication_mls_epochs').get()).toEqual({ count: 0 });
    const result = await withReceipt(harness, {
      action: 'create', resourceType: 'communication_room', resourceId: rows.room.id
    }, (repository, context) => {
      const mutation = repository.insertMutation(context, rows.mutation); if (!mutation.ok) return mutation;
      const epoch = repository.insertEpoch(context, rows.epoch); if (!epoch.ok) return epoch;
      const room = repository.insertRoom(context, rows.room); if (!room.ok) return room;
      return repository.insertMembership(context, rows.membership);
    });
    expect(result.ok).toBe(true);
    expect(await withReceipt(harness, {
      action: 'update', resourceType: 'communication_room', resourceId: rows.room.id
    }, (repository, context) => repository.getStorageUsage(context, key, rows.room.id))).toMatchObject({
      ok: true,
      value: { deviceCredentialCount: 1, roomCount: 1, mutationCount: 2, membershipCount: 1, epochCount: 1 }
    });
    expect(await withReceipt(harness, {
      action: 'read', resourceType: 'communication_security_center', resourceId: '*'
    }, (repository, context) => repository.loadCenter(context, key))).toMatchObject({
      ok: true,
      value: {
        deviceCredentials: [{ id: credentialRows.credential.id, status: 'active' }],
        rooms: [{
          room: { id: rows.room.id, currentEpoch: 1, historyAccessMode: 'new_members_no_history' },
          memberships: [{ historyVisibleFromEpoch: 1 }],
          currentEpoch: { epoch: 1, providerEvidenceVerified: true }
        }]
      }
    });
  });

  it('accepts only an exact revision-bound history transition and rejects forged state', async () => {
    const harness = openHarness(); const credentialRows = createCredentialRows();
    await persistCredential(harness, credentialRows);
    const rows = createRoomRows(credentialRows.credential.id);
    await withReceipt(harness, { action: 'create', resourceType: 'communication_room', resourceId: rows.room.id },
      (repository, context) => {
        const mutation = repository.insertMutation(context, rows.mutation); if (!mutation.ok) return mutation;
        const epoch = repository.insertEpoch(context, rows.epoch); if (!epoch.ok) return epoch;
        const room = repository.insertRoom(context, rows.room); if (!room.ok) return room;
        return repository.insertMembership(context, rows.membership);
      });
    const mutation: CommunicationSecurityMutationRow = {
      ...rows.mutation, id: '3'.repeat(64), mutationKind: 'history_policy_update',
      clientOperationId: 'history-policy-34-a', requestFingerprint: '4'.repeat(64),
      expectedRevision: 1, revision: 2, resourceStateFingerprint: '5'.repeat(64)
    };
    const next: CommunicationRoomRow = {
      ...rows.room, historyAccessMode: 'explicit_snapshot_grant', revision: 2,
      stateFingerprint: mutation.resourceStateFingerprint, lastMutationId: mutation.id, updatedAt: NOW
    };
    expect((await withReceipt(harness, {
      action: 'update', resourceType: 'communication_room', resourceId: rows.room.id
    }, (repository, context) => {
      const ledger = repository.insertMutation(context, mutation);
      return ledger.ok ? repository.saveRoom(context, next, 1) : ledger;
    })).ok).toBe(true);
    expect(() => harness.runtime.database.prepare(`UPDATE communication_rooms SET revision=3 WHERE id=?`).run(rows.room.id))
      .toThrow(/exact epoch, history or fail-safe freeze/u);
  });

  it('rejects a credential insert after trusted-device revocation and rolls the transaction back', async () => {
    const harness = openHarness();
    harness.runtime.database.prepare(`UPDATE trusted_devices SET revoked_at=? WHERE id=?`).run(NOW, DEVICE);
    expect((await persistCredential(harness)).ok).toBe(false);
    expect(harness.runtime.database.prepare(`SELECT count(*) count FROM communication_device_credentials`).get()).toEqual({ count: 0 });
    expect(harness.runtime.database.prepare(`SELECT count(*) count FROM communication_security_mutations`).get()).toEqual({ count: 0 });
  });

  it('fails closed for a foreign owner receipt and keeps policy resolution payload-free', async () => {
    const harness = openHarness(); const rows = createCredentialRows();
    expect((await withReceipt(harness, {
      action: 'create', resourceType: 'communication_device_credential', resourceId: rows.credential.id,
      ownerPersonId: OTHER
    }, (repository, context) => repository.insertMutation(context, rows.mutation))).ok).toBe(false);
    const context: RepositoryExecutionContext = {
      transaction: harness.runtime.database,
      actor: { userId: ACCOUNT, personId: OWNER, roles: ['family_admin'] },
      correlationId: asCorrelationId('communication-policy-resolution'), occurredAt: NOW
    };
    await persistCredential(harness, rows);
    const resolved = harness.repository.resolvePolicyResource(context, 'communication_device_credential', rows.credential.id);
    expect(resolved).toMatchObject({ ok: true, value: {
      id: rows.credential.id, familyId: FAMILY, ownerPersonId: OWNER, revision: 1, status: 'active'
    }});
    expect(JSON.stringify(resolved)).not.toMatch(/sealed|deviceCredential|keyPackage|provider/i);
  });

  it('binds epoch advancement to the prior provider chain and atomically restores a sole owner with a replacement device', async () => {
    const harness = openHarness(); const first = createCredentialRows();
    expect((await persistCredential(harness, first)).ok).toBe(true);
    const secondTrustedDevice = 'trusted-device-34-a-replacement';
    harness.runtime.database.prepare(`INSERT INTO trusted_devices(
      id,account_id,device_id,display_name,fingerprint,public_key_pem,trusted_at,last_seen_at,revoked_at,created_at,security_epoch
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      secondTrustedDevice, ACCOUNT, 'device-34-a-replacement', 'Owner replacement device', 'e'.repeat(64),
      '-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----', NOW, NOW, null, NOW, 0
    );
    const secondMutation: CommunicationSecurityMutationRow = {
      ...first.mutation, id: 'a'.repeat(64), resourceId: 'comm-device-owner-replacement-34-a',
      clientOperationId: 'register-owner-replacement-34-a', requestFingerprint: 'b'.repeat(64),
      resourceStateFingerprint: 'c'.repeat(64)
    };
    const secondCredential: CommunicationDeviceCredentialRow = {
      ...first.credential, id: secondMutation.resourceId, trustedDeviceId: secondTrustedDevice,
      deviceCredentialSha256: 'd'.repeat(64), keyPackageSha256: 'e'.repeat(64),
      sealedCredentialReference: 'mls-vault:device:owner-replacement-34-a',
      providerAttestationSha256: 'f'.repeat(64), stateFingerprint: secondMutation.resourceStateFingerprint,
      lastMutationId: secondMutation.id
    };
    expect((await persistCredential(harness, { mutation: secondMutation, credential: secondCredential })).ok).toBe(true);
    const roomRows = createRoomRows(first.credential.id);
    expect((await withReceipt(harness, { action: 'create', resourceType: 'communication_room', resourceId: roomRows.room.id },
      (repository, context) => {
        const mutation = repository.insertMutation(context, roomRows.mutation); if (!mutation.ok) return mutation;
        const epoch = repository.insertEpoch(context, roomRows.epoch); if (!epoch.ok) return epoch;
        const room = repository.insertRoom(context, roomRows.room); if (!room.ok) return room;
        return repository.insertMembership(context, roomRows.membership);
      })).ok).toBe(true);

    const revokeMutation: CommunicationSecurityMutationRow = {
      ...first.mutation, id: '4'.repeat(64), mutationKind: 'device_credential_revoke',
      clientOperationId: 'revoke-owner-lost-34-a', requestFingerprint: '5'.repeat(64),
      expectedRevision: 1, revision: 2, resourceStateFingerprint: '6'.repeat(64)
    };
    const revokedCredential: CommunicationDeviceCredentialRow = {
      ...first.credential, status: 'revoked', revision: 2, stateFingerprint: revokeMutation.resourceStateFingerprint,
      lastMutationId: revokeMutation.id, updatedAt: NOW, revokedAt: NOW
    };
    expect((await withReceipt(harness, {
      action: 'delete', resourceType: 'communication_device_credential', resourceId: first.credential.id
    }, (repository, context) => {
      const mutation = repository.insertMutation(context, revokeMutation); if (!mutation.ok) return mutation;
      return repository.saveDeviceCredential(context, revokedCredential, 1);
    })).ok).toBe(true);

    const rekeyMutation: CommunicationSecurityMutationRow = {
      ...roomRows.mutation, id: 'd'.repeat(64), mutationKind: 'device_revocation_rekey',
      clientOperationId: 'rekey-owner-replacement-34-a', requestFingerprint: 'e'.repeat(64),
      expectedRevision: 1, revision: 2, resourceStateFingerprint: 'f'.repeat(64)
    };
    const epochTwo: CommunicationMlsEpochRow = {
      ...roomRows.epoch, id: '3'.repeat(64), epoch: 2, commitSha256: '4'.repeat(64),
      confirmedTranscriptHashSha256: '5'.repeat(64), groupContextSha256: '6'.repeat(64),
      membershipDigestSha256: '0'.repeat(64), sealedStateReference: 'mls-vault:room:family-34-a:epoch:2',
      activeDeviceCredentialCount: 1, reason: 'device_revoked_recovery', previousEpoch: 1,
      previousCommitSha256: roomRows.epoch.commitSha256,
      previousConfirmedTranscriptHashSha256: roomRows.epoch.confirmedTranscriptHashSha256,
      mutationId: rekeyMutation.id
    };
    const roomTwo: CommunicationRoomRow = {
      ...roomRows.room, currentEpoch: 2, currentEpochId: epochTwo.id, revision: 2,
      stateFingerprint: rekeyMutation.resourceStateFingerprint, lastMutationId: rekeyMutation.id, updatedAt: NOW
    };
    const removedOwner: CommunicationRoomMembershipRow = {
      ...roomRows.membership, status: 'removed', removedAtEpoch: 2, revision: 2,
      stateFingerprint: '1'.repeat(64), lastMutationId: rekeyMutation.id, updatedAt: NOW
    };
    const replacementOwner: CommunicationRoomMembershipRow = {
      ...roomRows.membership, id: 'comm-membership-owner-replacement-34-a', deviceCredentialId: secondCredential.id,
      joinedAtEpoch: 2, historyVisibleFromEpoch: 2, revision: 1, stateFingerprint: '2'.repeat(64),
      lastMutationId: rekeyMutation.id, createdAt: NOW, updatedAt: NOW
    };

    expect((await withReceipt(harness, { action: 'update', resourceType: 'communication_room', resourceId: roomRows.room.id },
      (repository, context) => {
        const mutation = repository.insertMutation(context, rekeyMutation); if (!mutation.ok) return mutation;
        const forgedEpoch = repository.insertEpoch(context, { ...epochTwo, providerId: 'substituted-provider' });
        return forgedEpoch;
      })).ok).toBe(false);
    expect(harness.runtime.database.prepare('SELECT COUNT(*) count FROM communication_mls_epochs WHERE room_id=?')
      .get(roomRows.room.id)).toEqual({ count: 1 });

    expect((await withReceipt(harness, { action: 'update', resourceType: 'communication_room', resourceId: roomRows.room.id },
      (repository, context) => {
        const mutation = repository.insertMutation(context, rekeyMutation); if (!mutation.ok) return mutation;
        const epoch = repository.insertEpoch(context, epochTwo); if (!epoch.ok) return epoch;
        const room = repository.saveRoom(context, roomTwo, 1); if (!room.ok) return room;
        const removed = repository.saveMembership(context, removedOwner, 1); if (!removed.ok) return removed;
        return repository.insertMembership(context, replacementOwner);
      })).ok).toBe(true);
    expect(harness.runtime.database.prepare(`SELECT device_credential_id,status,role,joined_at_epoch
      FROM communication_room_memberships WHERE room_id=? ORDER BY joined_at_epoch,device_credential_id`).all(roomRows.room.id))
      .toEqual([
        { device_credential_id: first.credential.id, status: 'removed', role: 'owner', joined_at_epoch: 1 },
        { device_credential_id: secondCredential.id, status: 'active', role: 'owner', joined_at_epoch: 2 }
      ]);
  });
});
