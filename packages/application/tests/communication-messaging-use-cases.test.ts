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
import type { CommunicationMessageContentView, VerifiedSealedCommunicationPayloadInput } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationDeliveryQueueRow,
  CommunicationMessageEventRow,
  CommunicationMessageRow,
  CommunicationMessagingMutationRow,
  CommunicationPresenceRow,
  CommunicationRetentionPolicyRow,
  CommunicationRoomMembershipRow,
  CommunicationRoomRow
} from '@ppt/repository-contracts';
import {
  AnnotateCommunicationMessageUseCase,
  CreateCommunicationMessageUseCase,
  EditCommunicationMessageUseCase,
  SetCommunicationMessageLifecycleUseCase,
  SetCommunicationPresenceUseCase,
  SetCommunicationRetentionPolicyUseCase,
  UpdateCommunicationDeliveryUseCase,
  type CommunicationMessagePayloadPort,
  type CommunicationMessagingUnitOfWork,
  type CommunicationMessagingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY = asFamilyId('family-34-b');
const OWNER = asPersonId('person-owner-34-b');
const CONTEXT: LifeApplicationContext = Object.freeze({
  familyId: FAMILY,
  actor: Object.freeze({ userId: asUserId('account-owner-34-b'), role: 'family_admin', personId: OWNER }),
  correlationId: asCorrelationId('correlation-owner-34-b')
});
const NOW = asIsoDateTime('2026-08-15T12:00:00.000Z');
const ROOM: CommunicationRoomRow = Object.freeze({
  id: 'room-owner-34-b', familyId: FAMILY, accountId: CONTEXT.actor.userId, ownerPersonId: OWNER,
  displayName: 'Aile mesajları', roomType: 'family', maskedRoomRefSha256: '1'.repeat(64),
  providerGroupIdSha256: '2'.repeat(64), status: 'active', historyAccessMode: 'new_members_no_history',
  currentEpoch: 1, currentEpochId: '3'.repeat(64), revision: 1, stateFingerprint: '4'.repeat(64),
  lastMutationId: '5'.repeat(64), createdAt: NOW, updatedAt: NOW
});
const MEMBERSHIP: CommunicationRoomMembershipRow = Object.freeze({
  id: 'membership-owner-34-b', familyId: FAMILY, ownerPersonId: OWNER, roomId: ROOM.id,
  memberPersonId: OWNER, deviceCredentialId: 'device-credential-owner-34-b', role: 'owner', status: 'active',
  joinedAtEpoch: 1, historyVisibleFromEpoch: 1, revision: 1, stateFingerprint: '6'.repeat(64),
  lastMutationId: '7'.repeat(64), createdAt: NOW, updatedAt: NOW
});
const sha = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

class State {
  public messages = new Map<string, CommunicationMessageRow>();
  public mutations = new Map<string, CommunicationMessagingMutationRow>();
  public events: CommunicationMessageEventRow[] = [];
  public queues = new Map<string, CommunicationDeliveryQueueRow>();
  public presence: CommunicationPresenceRow | null = null;
  public retention = new Map<string, CommunicationRetentionPolicyRow>();
  public audits: unknown[] = [];
  public outbox: DomainEvent<unknown>[] = [];
  public clone(): State {
    const next = new State(); next.messages = new Map(this.messages); next.mutations = new Map(this.mutations);
    next.events = [...this.events]; next.queues = new Map(this.queues); next.presence = this.presence;
    next.retention = new Map(this.retention); next.audits = [...this.audits]; next.outbox = [...this.outbox]; return next;
  }
}

class Scope implements CommunicationMessagingWriteScope {
  public readonly occurredAt = NOW;
  public readonly ownerPersonId = OWNER;
  public constructor(private readonly state: State, private readonly failOutbox: boolean) {}
  public findRoomGuard(roomId: string) { return ok(roomId === ROOM.id ? Object.freeze({ room: ROOM, memberships: Object.freeze([MEMBERSHIP]) }) : null); }
  public findAttachmentGuard(fileId: string) { return ok(fileId === 'comm-file-clean-voice-34-b' ? Object.freeze({ id: fileId,
    ownerPersonId: OWNER, roomId: ROOM.id, mimeType: 'audio/mpeg', totalBytes: 1024,
    state: 'ready_local' as const, scanState: 'clean' as const }) : null); }
  public findMessage(id: string) { return ok(this.state.messages.get(id) ?? null); }
  public findPresence() { return ok(this.state.presence); }
  public findRetentionPolicy(roomId: string) { return ok(this.state.retention.get(roomId) ?? null); }
  public findDeliveryQueue(messageId: string) { return ok(this.state.queues.get(messageId) ?? null); }
  public findMutation(clientOperationId: string) { return ok(this.state.mutations.get(clientOperationId) ?? null); }
  public insertMutation(row: CommunicationMessagingMutationRow) { this.state.mutations.set(row.clientOperationId, row); return ok(undefined); }
  public insertMessage(row: CommunicationMessageRow) { this.state.messages.set(row.id, row); return ok(undefined); }
  public saveMessage(row: CommunicationMessageRow, expectedRevision: number) {
    if (this.state.messages.get(row.id)?.revision !== expectedRevision) throw new Error('message revision mismatch');
    this.state.messages.set(row.id, row); return ok(undefined);
  }
  public appendMessageEvent(row: CommunicationMessageEventRow) { this.state.events.push(row); return ok(undefined); }
  public upsertDeliveryQueue(row: CommunicationDeliveryQueueRow) { this.state.queues.set(row.messageId, row); return ok(undefined); }
  public savePresence(row: CommunicationPresenceRow, expectedRevision: number) {
    if ((this.state.presence?.revision ?? 0) !== expectedRevision) throw new Error('presence revision mismatch');
    this.state.presence = row; return ok(undefined);
  }
  public saveRetentionPolicy(row: CommunicationRetentionPolicyRow, expectedRevision: number) {
    if ((this.state.retention.get(row.roomId)?.revision ?? 0) !== expectedRevision) throw new Error('retention revision mismatch');
    this.state.retention.set(row.roomId, row); return ok(undefined);
  }
  public appendAudit(input: unknown) { this.state.audits.push(input); return ok('audit-34-b'); }
  public enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError> {
    if (this.failOutbox) return err(createAppError({ code: ERROR_CODES.CORE_UNEXPECTED, message: 'outbox failed',
      category: 'internal', correlationId: CONTEXT.correlationId }));
    this.state.outbox.push(event as DomainEvent<unknown>); return ok(undefined);
  }
}

class Unit implements CommunicationMessagingUnitOfWork {
  public state = new State(); public intents: LifePolicyIntent[] = []; public failOutbox = false;
  public execute<T>(context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationMessagingWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    this.intents.push(intent); const draft = this.state.clone(); const result = operation(new Scope(draft, this.failOutbox));
    if (result.ok) this.state = draft; return Promise.resolve(result);
  }
}

class Payloads implements CommunicationMessagePayloadPort {
  public calls = 0; public discarded: string[] = []; public values = new Map<string, CommunicationMessageContentView>();
  public seal(input: Parameters<CommunicationMessagePayloadPort['seal']>[0]): Result<VerifiedSealedCommunicationPayloadInput, AppError> {
    this.calls += 1; const reference = `sealed-message-${input.messageId}-${input.revision}`;
    const content: CommunicationMessageContentView = Object.freeze({ messageId: input.messageId, revision: input.revision,
      contentKind: input.contentKind, contentMime: input.contentMime, ...(input.text ? { text: input.text } : {}),
      ...(input.opaqueAttachmentHandle ? { opaqueAttachmentHandle: input.opaqueAttachmentHandle } : {}),
      payloadSource: 'local_sealed_store', networkUsed: false, cloudUsed: false });
    this.values.set(reference, content);
    return ok(Object.freeze({ sealedPayloadReference: reference, payloadSha256: sha(content),
      payloadSizeBytes: Buffer.byteLength(JSON.stringify(content), 'utf8'), contentKind: input.contentKind,
      contentMime: input.contentMime, providerId: 'test-local-sealed-provider', providerEvidenceSha256: sha({ reference }),
      verified: true, createdAt: input.occurredAt }));
  }
  public open(row: CommunicationMessageRow) {
    const value = this.values.get(row.sealedPayloadReference);
    return value ? ok(value) : err(createAppError({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'sealed value missing',
      category: 'not_found', correlationId: CONTEXT.correlationId }));
  }
  public discard(reference: string) { this.discarded.push(reference); this.values.delete(reference); return ok(undefined); }
  public sweepOrphans() { return ok(Object.freeze({ scannedFiles: 0, deletedFiles: 0, rejectedFiles: 0 })); }
}

const createMessage = (unit: Unit, payloads: Payloads, clientOperationId = 'create-message-34-b') =>
  new CreateCommunicationMessageUseCase(unit, payloads).execute({ context: CONTEXT, command: {
    clientOperationId, expectedRevision: 0, roomId: ROOM.id, contentKind: 'text', contentMime: 'text/plain',
    text: 'Aile içi güvenli mesaj', silent: true
  }});

describe('34-B communication messaging use cases', () => {
  it('seals a text message outside database state, writes append-only metadata and replays without resealing', async () => {
    const unit = new Unit(); const payloads = new Payloads(); const created = await createMessage(unit, payloads);
    expect(created).toMatchObject({ ok: true, value: { mutationKind: 'message_create', revision: 1,
      payloadSealedLocally: true, remoteDeliveryPerformed: false, networkUsed: false } });
    expect(await createMessage(unit, payloads)).toMatchObject({ ok: true, value: { replayed: true } });
    expect(payloads.calls).toBe(1); expect(unit.state.messages.size).toBe(1); expect(unit.state.events).toHaveLength(1);
    expect(unit.state.queues.values().next().value).toMatchObject({ state: 'transport_not_configured', attemptCount: 0 });
    expect(JSON.stringify({ messages: [...unit.state.messages.values()], mutations: [...unit.state.mutations.values()],
      events: unit.state.events, outbox: unit.state.outbox })).not.toContain('Aile içi güvenli mesaj');
  });

  it('rejects a mismatched idempotent replay and validates future-only scheduling before sealing', async () => {
    const unit = new Unit(); const payloads = new Payloads(); await createMessage(unit, payloads);
    expect(await new CreateCommunicationMessageUseCase(unit, payloads).execute({ context: CONTEXT, command: {
      clientOperationId: 'create-message-34-b', expectedRevision: 0, roomId: ROOM.id, contentKind: 'text',
      contentMime: 'text/plain', text: 'Farklı mesaj'
    }})).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect(await new CreateCommunicationMessageUseCase(unit, payloads).execute({ context: CONTEXT, command: {
      clientOperationId: 'scheduled-message-34-b', expectedRevision: 0, roomId: ROOM.id, contentKind: 'text',
      contentMime: 'text/plain', text: 'Geçmiş tarihli', scheduledAt: '2026-08-14T12:00:00.000Z'
    }})).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(payloads.calls).toBe(1);
  });

  it('accepts only a clean same-room attachment and derives expiry from the active room retention decision', async () => {
    const unit = new Unit(); const payloads = new Payloads();
    expect(await new SetCommunicationRetentionPolicyUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'retention-before-media-34-b', expectedRevision: 0, roomId: ROOM.id,
      mode: 'auto_delete', durationDays: 7, reason: 'Yedi günlük yerel saklama.'
    }})).toMatchObject({ ok: true });
    const created = await new CreateCommunicationMessageUseCase(unit, payloads).execute({ context: CONTEXT, command: {
      clientOperationId: 'create-voice-34-b', expectedRevision: 0, roomId: ROOM.id, contentKind: 'voice',
      contentMime: 'audio/mpeg', opaqueAttachmentHandle: 'comm-file-clean-voice-34-b'
    }});
    expect(created).toMatchObject({ ok: true, value: { payloadSealedLocally: true } });
    if (!created.ok) throw new Error(created.error.message);
    expect(unit.state.messages.get(created.value.resourceId)).toMatchObject({ contentKind: 'voice',
      expiresAt: '2026-08-22T12:00:00.000Z' });
    expect(await new CreateCommunicationMessageUseCase(unit, payloads).execute({ context: CONTEXT, command: {
      clientOperationId: 'create-foreign-voice-34-b', expectedRevision: 0, roomId: ROOM.id, contentKind: 'voice',
      contentMime: 'audio/mpeg', opaqueAttachmentHandle: 'comm-file-foreign-voice-34-b'
    }})).toMatchObject({ ok: false, error: { category: 'authorization' } });
  });

  it('edits, deletes and restores with exact revision-bound event history', async () => {
    const unit = new Unit(); const payloads = new Payloads(); const created = await createMessage(unit, payloads);
    if (!created.ok) throw new Error(created.error.message); const messageId = created.value.resourceId;
    expect(await new EditCommunicationMessageUseCase(unit, payloads).execute({ context: CONTEXT, command: {
      clientOperationId: 'edit-message-34-b', expectedRevision: 1, messageId, text: 'Düzeltilmiş mesaj', reason: 'Yazım düzeltildi.'
    }})).toMatchObject({ ok: true, value: { revision: 2, payloadSealedLocally: true } });
    expect(await new SetCommunicationMessageLifecycleUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'delete-message-34-b', expectedRevision: 2, messageId, action: 'delete', reason: 'Kullanıcı sildi.'
    }})).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(await new SetCommunicationMessageLifecycleUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'restore-message-34-b', expectedRevision: 3, messageId, action: 'restore', reason: 'Kullanıcı geri aldı.'
    }})).toMatchObject({ ok: true, value: { revision: 4 } });
    expect(unit.state.messages.get(messageId)).toMatchObject({ state: 'sealed_local', editCount: 1, revision: 4 });
    expect(unit.state.messages.get(messageId)).not.toHaveProperty('deletedAt');
    expect(unit.state.events.map((item) => item.eventKind)).toEqual(['message_created','message_edited','message_deleted','message_restored']);
  });

  it('tracks offline retry attempts and permits exactly one annotation field per mutation', async () => {
    const unit = new Unit(); const payloads = new Payloads(); const created = await createMessage(unit, payloads);
    if (!created.ok) throw new Error(created.error.message); const messageId = created.value.resourceId;
    expect(await new UpdateCommunicationDeliveryUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'queue-message-34-b', expectedRevision: 1, messageId, action: 'queue_offline'
    }})).toMatchObject({ ok: true, value: { revision: 2 } });
    expect(await new UpdateCommunicationDeliveryUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'retry-message-34-b', expectedRevision: 2, messageId, action: 'retry'
    }})).toMatchObject({ ok: true, value: { revision: 3 } });
    expect(unit.state.queues.get(messageId)).toMatchObject({ state: 'retry_wait', attemptCount: 1, revision: 3 });
    expect(await new AnnotateCommunicationMessageUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'bad-annotation-34-b', expectedRevision: 3, messageId, pinned: true, bookmarked: true
    }})).toMatchObject({ ok: false, error: { category: 'validation' } });
    expect(await new AnnotateCommunicationMessageUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'pin-message-34-b', expectedRevision: 3, messageId, pinned: true
    }})).toMatchObject({ ok: true, value: { revision: 4 } });
  });

  it('stores privacy-minimized presence and room retention metadata without disclosure overclaims', async () => {
    const unit = new Unit();
    expect(await new SetCommunicationPresenceUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'presence-invisible-34-b', expectedRevision: 0, status: 'invisible', audience: 'nobody',
      lastSeenShared: false, typingIndicatorsEnabled: false, readReceiptsEnabled: false, emergencyReachabilityEnabled: false
    }})).toMatchObject({ ok: true, value: { resourceType: 'communication_presence', revision: 1 } });
    expect(unit.state.presence).toMatchObject({ status: 'invisible', publicAvailability: 'hidden', audience: 'nobody',
      lastSeenShared: false, typingIndicatorsEnabled: false, readReceiptsEnabled: false });
    expect(await new SetCommunicationRetentionPolicyUseCase(unit).execute({ context: CONTEXT, command: {
      clientOperationId: 'retention-room-34-b', expectedRevision: 0, roomId: ROOM.id,
      mode: 'auto_delete', durationDays: 30, reason: 'Aile kararı ile otuz gün.'
    }})).toMatchObject({ ok: true, value: { resourceType: 'communication_retention_policy', revision: 1 } });
    expect(unit.state.retention.get(ROOM.id)).toMatchObject({ mode: 'auto_delete', durationDays: 30 });
    expect(JSON.stringify(unit.state)).not.toContain('Aile kararı ile otuz gün.');
  });

  it('rolls back database metadata and discards a newly sealed payload when outbox persistence fails', async () => {
    const unit = new Unit(); const payloads = new Payloads(); unit.failOutbox = true;
    expect(await createMessage(unit, payloads, 'rollback-message-34-b')).toMatchObject({ ok: false, error: { category: 'internal' } });
    expect(unit.state.messages.size).toBe(0); expect(unit.state.mutations.size).toBe(0); expect(unit.state.audits).toHaveLength(0);
    expect(payloads.values.size).toBe(0); expect(payloads.discarded).toHaveLength(1);
  });
});
