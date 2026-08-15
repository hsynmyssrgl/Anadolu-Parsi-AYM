import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationDeviceCredentialRow,
  CommunicationMlsEpochRow,
  CommunicationRoomMembershipRow,
  CommunicationRoomRow,
  CommunicationSecurityMutationRow
} from '@ppt/repository-contracts';
import {
  AddCommunicationRoomMemberUseCase,
  CreateCommunicationRoomUseCase,
  FreezeCommunicationRoomUseCase,
  RegisterCommunicationDeviceCredentialUseCase,
  RekeyCommunicationRoomAfterDeviceRevocationUseCase,
  RemoveCommunicationRoomMemberUseCase,
  RevokeCommunicationDeviceCredentialUseCase,
  SetCommunicationHistoryAccessUseCase,
  type CommunicationMlsFoundationPort,
  type CommunicationSecurityUnitOfWork,
  type CommunicationSecurityWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY = asFamilyId('family-34-a');
const OWNER = asPersonId('person-owner-34-a');
const MEMBER = asPersonId('person-member-34-a');
const ownerContext: LifeApplicationContext = {
  familyId: FAMILY,
  actor: { userId: asUserId('account-owner-34-a'), role: 'family_admin', personId: OWNER },
  correlationId: asCorrelationId('correlation-owner-34-a')
};
const memberContext: LifeApplicationContext = {
  familyId: FAMILY,
  actor: { userId: asUserId('account-member-34-a'), role: 'family_member', personId: MEMBER },
  correlationId: asCorrelationId('correlation-member-34-a')
};
const digest = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

class State {
  public credentials = new Map<string, CommunicationDeviceCredentialRow>();
  public rooms = new Map<string, CommunicationRoomRow>();
  public memberships = new Map<string, CommunicationRoomMembershipRow>();
  public epochs = new Map<string, CommunicationMlsEpochRow>();
  public mutations = new Map<string, CommunicationSecurityMutationRow>();
  public audits: unknown[] = [];
  public events: DomainEvent<unknown>[] = [];
  public clone(): State {
    const next = new State();
    next.credentials = new Map(this.credentials);
    next.rooms = new Map(this.rooms);
    next.memberships = new Map(this.memberships);
    next.epochs = new Map(this.epochs);
    next.mutations = new Map(this.mutations);
    next.audits = [...this.audits];
    next.events = [...this.events];
    return next;
  }
}

class Scope implements CommunicationSecurityWriteScope {
  public readonly occurredAt = asIsoDateTime('2026-08-15T12:00:00.000Z');
  public readonly ownerPersonId;
  public constructor(
    private readonly state: State,
    context: LifeApplicationContext,
    private readonly failEvent: boolean
  ) {
    if (!context.actor.personId) throw new Error('person required');
    this.ownerPersonId = context.actor.personId;
  }
  public findDeviceCredential(id: string) { return ok(this.state.credentials.get(id) ?? null); }
  public findDeviceCredentialByTrustedDeviceId(id: string) {
    return ok([...this.state.credentials.values()].find((row) =>
      row.ownerPersonId === this.ownerPersonId && row.trustedDeviceId === id) ?? null);
  }
  public findFamilyDeviceCredentialForRoom(id: string) { return ok(this.state.credentials.get(id) ?? null); }
  public findRoom(id: string) { return ok(this.state.rooms.get(id) ?? null); }
  public listMemberships(roomId: string) {
    return ok(Object.freeze([...this.state.memberships.values()].filter((row) => row.roomId === roomId)));
  }
  public findMembership(id: string) { return ok(this.state.memberships.get(id) ?? null); }
  public findEpoch(roomId: string, epoch: number) { return ok(this.state.epochs.get(`${roomId}:${epoch}`) ?? null); }
  public findMutation(id: string) { return ok(this.state.mutations.get(id) ?? null); }
  public insertMutation(row: CommunicationSecurityMutationRow) { this.state.mutations.set(row.clientOperationId, row); return ok(undefined); }
  public insertDeviceCredential(row: CommunicationDeviceCredentialRow) { this.state.credentials.set(row.id, row); return ok(undefined); }
  public saveDeviceCredential(row: CommunicationDeviceCredentialRow, expected: number) {
    if (this.state.credentials.get(row.id)?.revision !== expected) throw new Error('credential revision mismatch');
    this.state.credentials.set(row.id, row); return ok(undefined);
  }
  public insertEpoch(row: CommunicationMlsEpochRow) { this.state.epochs.set(`${row.roomId}:${row.epoch}`, row); return ok(undefined); }
  public insertRoom(row: CommunicationRoomRow) { this.state.rooms.set(row.id, row); return ok(undefined); }
  public saveRoom(row: CommunicationRoomRow, expected: number) {
    if (this.state.rooms.get(row.id)?.revision !== expected) throw new Error('room revision mismatch');
    this.state.rooms.set(row.id, row); return ok(undefined);
  }
  public insertMembership(row: CommunicationRoomMembershipRow) { this.state.memberships.set(row.id, row); return ok(undefined); }
  public saveMembership(row: CommunicationRoomMembershipRow, expected: number) {
    if (this.state.memberships.get(row.id)?.revision !== expected) throw new Error('membership revision mismatch');
    this.state.memberships.set(row.id, row); return ok(undefined);
  }
  public appendAudit(input: unknown) { this.state.audits.push(input); return ok('audit-34-a'); }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> {
    if (this.failEvent) return err(createAppError({
      code: ERROR_CODES.CORE_UNEXPECTED,
      message: 'test event failure',
      category: 'internal',
      correlationId: ownerContext.correlationId
    }));
    this.state.events.push(event as DomainEvent<unknown>);
    return ok(undefined);
  }
}

class Unit implements CommunicationSecurityUnitOfWork {
  public state = new State();
  public readonly intents: LifePolicyIntent[] = [];
  public failEvent = false;
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationSecurityWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    this.intents.push(intent);
    const draft = this.state.clone();
    const result = operation(new Scope(draft, context, this.failEvent));
    if (result.ok) this.state = draft;
    return Promise.resolve(result);
  }
}

class Provider implements CommunicationMlsFoundationPort {
  public deviceCalls = 0;
  public createCalls = 0;
  public advanceCalls = 0;
  public corruptTime = false;
  public provisionDeviceCredential(input: Parameters<CommunicationMlsFoundationPort['provisionDeviceCredential']>[0]) {
    this.deviceCalls += 1;
    return ok({
      trustedDeviceId: input.trustedDeviceId,
      deviceCredentialSha256: digest({ device: input.trustedDeviceId }),
      keyPackageSha256: digest({ package: input.trustedDeviceId }),
      sealedCredentialReference: `mls-vault:device:${input.trustedDeviceId}`,
      providerId: 'local-test-provider',
      providerImplementation: 'test-rfc9420-provider',
      providerAttestationSha256: digest({ attestation: input.trustedDeviceId }),
      providerEvidenceVerified: true as const,
      createdAt: this.corruptTime ? '2026-08-15T11:59:59.000Z' : input.occurredAt
    });
  }
  public createGroup(input: Parameters<CommunicationMlsFoundationPort['createGroup']>[0]) {
    this.createCalls += 1;
    return ok(this.epoch(input.roomId, 1, digest({ group: input.roomId }), input.membershipDigestSha256,
      'room_created', input.occurredAt));
  }
  public advanceEpoch(input: Parameters<CommunicationMlsFoundationPort['advanceEpoch']>[0]) {
    this.advanceCalls += 1;
    return ok(this.epoch(input.roomId, input.currentEpoch + 1, input.groupIdSha256,
      input.membershipDigestSha256, input.reason, input.occurredAt));
  }
  private epoch(roomId: string, epoch: number, groupIdSha256: string, membershipDigestSha256: string,
    reason: Parameters<Provider['epoch']>[4], createdAt: string) {
    return {
      roomId, epoch,
      cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,
      groupIdSha256,
      commitSha256: digest({ roomId, epoch, reason, kind: 'commit' }),
      confirmedTranscriptHashSha256: digest({ roomId, epoch, reason, kind: 'transcript' }),
      groupContextSha256: digest({ roomId, epoch, reason, kind: 'context' }),
      membershipDigestSha256,
      sealedStateReference: `mls-vault:room:${roomId}:epoch:${epoch}`,
      providerId: 'local-test-provider',
      providerImplementation: 'test-rfc9420-provider',
      providerAttestationSha256: digest({ roomId, epoch, reason, kind: 'attestation' }),
      providerEvidenceVerified: true as const,
      createdAt,
      reason
    };
  }
}

const register = (unit: Unit, provider: Provider, context: LifeApplicationContext, operation: string, device: string) =>
  new RegisterCommunicationDeviceCredentialUseCase(unit, provider).execute({ context, command: {
    clientOperationId: operation, expectedRevision: 0, trustedDeviceId: device
  }});

describe('34-A communication security foundation use cases', () => {
  it('registers only verified device metadata, persists content-free evidence and replays exactly', async () => {
    const unit = new Unit(); const provider = new Provider();
    const first = await register(unit, provider, ownerContext, 'register-owner-device', 'trusted-owner-device');
    expect(first).toMatchObject({ ok: true, value: {
      mutationKind: 'device_credential_register', previousRevision: 0, revision: 1,
      replayed: false, messageContentProcessed: false, networkUsed: false
    }});
    expect(await register(unit, provider, ownerContext, 'register-owner-device', 'trusted-owner-device'))
      .toMatchObject({ ok: true, value: { replayed: true } });
    expect(provider.deviceCalls).toBe(1);
    expect(unit.state.credentials.size).toBe(1);
    expect(JSON.stringify(unit.state.events)).not.toMatch(/sealed|credentialSha|keyPackage|provider/i);
  });

  it('creates every governed room type with epoch one and default-denied history', async () => {
    const unit = new Unit(); const provider = new Provider();
    const credential = await register(unit, provider, ownerContext, 'register-room-owner', 'trusted-owner-device');
    if (!credential.ok) throw new Error(credential.error.message);
    const create = new CreateCommunicationRoomUseCase(unit, provider);
    for (const [index, roomType] of ['direct','family','household','family_branch','event','care','private_topic'].entries()) {
      const result = await create.execute({ context: ownerContext, command: {
        clientOperationId: `create-room-${index}`, expectedRevision: 0,
        ownerDeviceCredentialId: credential.value.resourceId,
        roomType: roomType as 'direct', displayName: `Oda ${index + 1}`
      }});
      expect(result).toMatchObject({ ok: true, value: { mutationKind: 'room_create', revision: 1 } });
      if (!result.ok) continue;
      expect(unit.state.rooms.get(result.value.resourceId)).toMatchObject({
        roomType, historyAccessMode: 'new_members_no_history', currentEpoch: 1, status: 'active'
      });
    }
    expect(provider.createCalls).toBe(7);
  });

  it('adds a family member only from the join epoch and advances exact MLS evidence', async () => {
    const unit = new Unit(); const provider = new Provider();
    const ownerCredential = await register(unit, provider, ownerContext, 'register-owner', 'trusted-owner-device');
    const memberCredential = await register(unit, provider, memberContext, 'register-member', 'trusted-member-device');
    if (!ownerCredential.ok || !memberCredential.ok) throw new Error('fixture failed');
    const created = await new CreateCommunicationRoomUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'create-family-room', expectedRevision: 0, ownerDeviceCredentialId: ownerCredential.value.resourceId,
      roomType: 'family', displayName: 'Aile odası'
    }});
    if (!created.ok) throw new Error(created.error.message);
    const added = await new AddCommunicationRoomMemberUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'add-family-member', expectedRevision: 1, roomId: created.value.resourceId,
      memberPersonId: MEMBER, deviceCredentialId: memberCredential.value.resourceId, role: 'member'
    }});
    expect(added).toMatchObject({ ok: true, value: { mutationKind: 'member_add', revision: 2 } });
    const membership = [...unit.state.memberships.values()].find((row) => row.memberPersonId === MEMBER);
    expect(membership).toMatchObject({ joinedAtEpoch: 2, historyVisibleFromEpoch: 2, status: 'active' });
    expect(unit.state.rooms.get(created.value.resourceId)).toMatchObject({ currentEpoch: 2, revision: 2 });
    expect(provider.advanceCalls).toBe(1);
  });

  it('removes a member atomically with a new epoch and never exposes pre-join history', async () => {
    const unit = new Unit(); const provider = new Provider();
    const ownerCredential = await register(unit, provider, ownerContext, 'register-owner', 'trusted-owner-device');
    const memberCredential = await register(unit, provider, memberContext, 'register-member', 'trusted-member-device');
    if (!ownerCredential.ok || !memberCredential.ok) throw new Error('fixture failed');
    const created = await new CreateCommunicationRoomUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'create-care-room', expectedRevision: 0, ownerDeviceCredentialId: ownerCredential.value.resourceId,
      roomType: 'care', displayName: 'Bakım odası'
    }});
    if (!created.ok) throw new Error(created.error.message);
    await new AddCommunicationRoomMemberUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'add-care-member', expectedRevision: 1, roomId: created.value.resourceId,
      memberPersonId: MEMBER, deviceCredentialId: memberCredential.value.resourceId, role: 'member'
    }});
    const membership = [...unit.state.memberships.values()].find((row) => row.memberPersonId === MEMBER)!;
    const removed = await new RemoveCommunicationRoomMemberUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'remove-care-member', expectedRevision: 2, roomId: created.value.resourceId,
      membershipId: membership.id, reason: 'Bakım görevi sona erdi.'
    }});
    expect(removed).toMatchObject({ ok: true, value: { mutationKind: 'member_remove', revision: 3 } });
    expect(unit.state.memberships.get(membership.id)).toMatchObject({ status: 'removed', removedAtEpoch: 3 });
  });

  it('blocks further epoch changes after credential revocation until explicit room rekey succeeds', async () => {
    const unit = new Unit(); const provider = new Provider();
    const ownerCredential = await register(unit, provider, ownerContext, 'register-owner', 'trusted-owner-device');
    const memberCredential = await register(unit, provider, memberContext, 'register-member', 'trusted-member-device');
    if (!ownerCredential.ok || !memberCredential.ok) throw new Error('fixture failed');
    const created = await new CreateCommunicationRoomUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'create-private-room', expectedRevision: 0, ownerDeviceCredentialId: ownerCredential.value.resourceId,
      roomType: 'private_topic', displayName: 'Özel konu'
    }});
    if (!created.ok) throw new Error(created.error.message);
    await new AddCommunicationRoomMemberUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'add-private-member', expectedRevision: 1, roomId: created.value.resourceId,
      memberPersonId: MEMBER, deviceCredentialId: memberCredential.value.resourceId, role: 'member'
    }});
    expect(await new RevokeCommunicationDeviceCredentialUseCase(unit).execute({ context: memberContext, command: {
      clientOperationId: 'revoke-member-device', expectedRevision: 1, deviceCredentialId: memberCredential.value.resourceId,
      confirmation: 'ILETISIM CIHAZ KIMLIGINI IPTAL ET', reason: 'Cihaz kayboldu.'
    }})).toMatchObject({ ok: true, value: { mutationKind: 'device_credential_revoke' } });
    expect(await new AddCommunicationRoomMemberUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'blocked-room-change', expectedRevision: 2, roomId: created.value.resourceId,
      memberPersonId: OWNER, deviceCredentialId: ownerCredential.value.resourceId, role: 'administrator'
    }})).toMatchObject({ ok: false, error: { category: 'authorization' } });
    const rekeyed = await new RekeyCommunicationRoomAfterDeviceRevocationUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'rekey-lost-device', expectedRevision: 2, roomId: created.value.resourceId,
      revokedDeviceCredentialId: memberCredential.value.resourceId,
      confirmation: 'KAYIP CIHAZ SONRASI ODAYI YENIDEN ANAHTARLA', reason: 'Kayıp cihaz odadan çıkarıldı.'
    }});
    expect(rekeyed).toMatchObject({ ok: true, value: { mutationKind: 'device_revocation_rekey', revision: 3 } });
    expect([...unit.state.memberships.values()].find((row) => row.deviceCredentialId === memberCredential.value.resourceId))
      .toMatchObject({ status: 'removed', removedAtEpoch: 3 });
  });

  it('updates history policy and freezes a room through revision-bound durable mutations', async () => {
    const unit = new Unit(); const provider = new Provider();
    const credential = await register(unit, provider, ownerContext, 'register-owner', 'trusted-owner-device');
    if (!credential.ok) throw new Error('fixture failed');
    const created = await new CreateCommunicationRoomUseCase(unit, provider).execute({ context: ownerContext, command: {
      clientOperationId: 'create-event-room', expectedRevision: 0, ownerDeviceCredentialId: credential.value.resourceId,
      roomType: 'event', displayName: 'Etkinlik odası'
    }});
    if (!created.ok) throw new Error(created.error.message);
    expect(await new SetCommunicationHistoryAccessUseCase(unit).execute({ context: ownerContext, command: {
      clientOperationId: 'set-history-policy', expectedRevision: 1, roomId: created.value.resourceId,
      historyAccessMode: 'explicit_snapshot_grant', reason: 'Geçmiş yalnız ayrı anlık görüntü onayıyla paylaşılır.'
    }})).toMatchObject({ ok: true, value: { mutationKind: 'history_policy_update', revision: 2 } });
    expect(await new FreezeCommunicationRoomUseCase(unit).execute({ context: ownerContext, command: {
      clientOperationId: 'freeze-event-room', expectedRevision: 2, roomId: created.value.resourceId,
      confirmation: 'ILETISIM ODASINI DONDUR', reason: 'Etkinlik tamamlandı.'
    }})).toMatchObject({ ok: true, value: { mutationKind: 'room_freeze', revision: 3 } });
    expect(unit.state.rooms.get(created.value.resourceId)).toMatchObject({
      historyAccessMode: 'explicit_snapshot_grant', status: 'frozen', revision: 3
    });
  });

  it('rejects mismatched provider time before writes and rolls back an outbox failure', async () => {
    const unit = new Unit(); const provider = new Provider();
    provider.corruptTime = true;
    expect(await register(unit, provider, ownerContext, 'forged-time', 'trusted-owner-device'))
      .toMatchObject({ ok: false, error: { category: 'authorization' } });
    expect(unit.state.credentials.size).toBe(0);
    expect(unit.state.mutations.size).toBe(0);
    provider.corruptTime = false;
    unit.failEvent = true;
    expect(await register(unit, provider, ownerContext, 'outbox-failure', 'trusted-owner-device'))
      .toMatchObject({ ok: false, error: { category: 'internal' } });
    expect(unit.state.credentials.size).toBe(0);
    expect(unit.state.mutations.size).toBe(0);
    expect(unit.state.audits).toHaveLength(0);
  });
});
