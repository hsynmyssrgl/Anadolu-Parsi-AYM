import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  COMMUNICATION_MESSAGE_ORPHAN_GRACE_MS,
  COMMUNICATION_MESSAGE_CONTENT_KINDS,
  communicationMessagingCenterId,
  type AnnotateCommunicationMessageInput,
  type CommunicationMessageContentView,
  type CommunicationMessageView,
  type CommunicationMessagingCenterView,
  type CommunicationMessagingMutationKind,
  type CommunicationMessagingMutationReceiptView,
  type CommunicationMessagingResourceType,
  type CreateCommunicationMessageInput,
  type EditCommunicationMessageInput,
  type SearchCommunicationMessagesInput,
  type SetCommunicationMessageLifecycleInput,
  type SetCommunicationPresenceInput,
  type SetCommunicationRetentionPolicyInput,
  type UpdateCommunicationDeliveryInput,
  type VerifiedSealedCommunicationPayloadInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationDeliveryQueueRow,
  CommunicationMessageEventRow,
  CommunicationMessageRow,
  CommunicationMessagingCenterKey,
  CommunicationMessagingAttachmentGuardRow,
  CommunicationMessagingMutationRow,
  CommunicationMessagingRoomGuardRow,
  CommunicationPresenceRow,
  CommunicationRetentionPolicyRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationMessagingQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<CommunicationMessagingCenterView, AppError>>;
  search(context: LifeApplicationContext, input: SearchCommunicationMessagesInput): Promise<Result<readonly CommunicationMessageView[], AppError>>;
  getContent(context: LifeApplicationContext, messageId: string): Promise<Result<CommunicationMessageContentView, AppError>>;
  getMaintenanceState(context: LifeApplicationContext): Promise<Result<Readonly<{
    rows: readonly CommunicationMessageRow[];
    occurredAt: CommunicationMessagingMutationRow['occurredAt'];
  }>, AppError>>;
}

export interface CommunicationMessagePayloadPort {
  seal(input: Readonly<{
    familyId: string;
    ownerPersonId: string;
    roomId: string;
    messageId: string;
    revision: number;
    contentKind: CreateCommunicationMessageInput['contentKind'];
    contentMime: string;
    text?: string;
    opaqueAttachmentHandle?: string;
    occurredAt: string;
    correlationId: LifeApplicationContext['correlationId'];
  }>): Result<VerifiedSealedCommunicationPayloadInput, AppError>;
  open(row: CommunicationMessageRow, correlationId: LifeApplicationContext['correlationId']): Result<CommunicationMessageContentView, AppError>;
  discard(sealedPayloadReference: string, correlationId: LifeApplicationContext['correlationId']): Result<void, AppError>;
  sweepOrphans(input: Readonly<{ familyId: string; ownerPersonId: string; referencedPayloads: readonly string[];
    completedBefore: string; maximumCandidates: number; correlationId: LifeApplicationContext['correlationId'] }>)
  : Result<Readonly<{ scannedFiles: number; deletedFiles: number; rejectedFiles: number }>, AppError>;
}

export interface CommunicationMessagingWriteScope {
  readonly occurredAt: CommunicationMessagingMutationRow['occurredAt'];
  readonly ownerPersonId: CommunicationMessagingCenterKey['ownerPersonId'];
  findRoomGuard(roomId: string): Result<CommunicationMessagingRoomGuardRow | null, AppError>;
  findAttachmentGuard(fileId: string): Result<CommunicationMessagingAttachmentGuardRow | null, AppError>;
  findMessage(messageId: string): Result<CommunicationMessageRow | null, AppError>;
  findPresence(): Result<CommunicationPresenceRow | null, AppError>;
  findRetentionPolicy(roomId: string): Result<CommunicationRetentionPolicyRow | null, AppError>;
  findDeliveryQueue(messageId: string): Result<CommunicationDeliveryQueueRow | null, AppError>;
  findMutation(clientOperationId: string): Result<CommunicationMessagingMutationRow | null, AppError>;
  insertMutation(row: CommunicationMessagingMutationRow): Result<void, AppError>;
  insertMessage(row: CommunicationMessageRow): Result<void, AppError>;
  saveMessage(row: CommunicationMessageRow, expectedRevision: number): Result<void, AppError>;
  appendMessageEvent(row: CommunicationMessageEventRow): Result<void, AppError>;
  upsertDeliveryQueue(row: CommunicationDeliveryQueueRow, expectedRevision: number): Result<void, AppError>;
  savePresence(row: CommunicationPresenceRow, expectedRevision: number): Result<void, AppError>;
  saveRetentionPolicy(row: CommunicationRetentionPolicyRow, expectedRevision: number): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: CommunicationMessagingMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface CommunicationMessagingUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: CommunicationMessagingWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const MIME = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const COMMUNICATION_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'text/plain', 'application/json', 'text/csv']);
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const validIsoDateTime = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const text = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized) ? normalized : null;
};
const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT |
    typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string): AppError =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');
const actorPerson = (context: LifeApplicationContext) => context.actor.personId
  ? ok(context.actor.personId)
  : err(denied(context, 'İletişim mesaj merkezi kişi bağlı oturum gerektirir.'));
const validRevision = (context: LifeApplicationContext, value: unknown, zero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (zero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen mesaj sürümü geçersizdir.'));

export const communicationMessagingReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'communication_messaging_center',
  resourceId: '*', purpose: 'general'
});
export const communicationMessagingWriteIntent = (
  resourceType: CommunicationMessagingResourceType,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType, resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId
    ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const }
    : {})
});

export const communicationMessageId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `comm-message-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;
export const communicationPresenceId = (personId: string): string => `comm-presence-${personId}`;
export const communicationRetentionPolicyId = (roomId: string): string => `comm-retention-${roomId}`;
const mutationId = (context: LifeApplicationContext, clientOperationId: string, fingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, fingerprint });
const eventId = (mutation: string): string => hash({ mutation, kind: 'communication-message-event' });

const messageFingerprint = (row: Omit<CommunicationMessageRow, 'stateFingerprint'>): string => hash({
  id: row.id, familyId: row.familyId, ownerPersonId: row.ownerPersonId, roomId: row.roomId,
  senderAccountId: row.senderAccountId, senderPersonId: row.senderPersonId, contentKind: row.contentKind,
  contentMime: row.contentMime, sealedPayloadReference: row.sealedPayloadReference, payloadSha256: row.payloadSha256,
  payloadSizeBytes: row.payloadSizeBytes, providerId: row.providerId, providerEvidenceSha256: row.providerEvidenceSha256,
  payloadRevision: row.payloadRevision, payloadCreatedAt: row.payloadCreatedAt,
  replyToMessageId: row.replyToMessageId ?? null, quotedMessageId: row.quotedMessageId ?? null,
  threadRootMessageId: row.threadRootMessageId ?? null, state: row.state, deliveryState: row.deliveryState,
  scheduledAt: row.scheduledAt ?? null, silent: row.silent, pinned: row.pinned, bookmarked: row.bookmarked,
  reactionCode: row.reactionCode ?? null, editCount: row.editCount, revision: row.revision,
  lastMutationId: row.lastMutationId, createdAt: row.createdAt, updatedAt: row.updatedAt,
  deletedAt: row.deletedAt ?? null, expiresAt: row.expiresAt ?? null
});
const presenceFingerprint = (row: Omit<CommunicationPresenceRow, 'stateFingerprint'>): string => hash(row);
const retentionFingerprint = (row: Omit<CommunicationRetentionPolicyRow, 'stateFingerprint'>): string => hash(row);
const receipt = (
  row: CommunicationMessagingMutationRow,
  replayed: boolean,
  payloadSealedLocally: boolean
): CommunicationMessagingMutationReceiptView => Object.freeze({
  resourceType: row.resourceType, resourceId: row.resourceId, mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt,
  replayed, payloadSealedLocally, remoteDeliveryPerformed: false, networkUsed: false
});
const replay = (
  context: LifeApplicationContext,
  found: CommunicationMessagingMutationRow | null,
  resourceType: CommunicationMessagingResourceType,
  resourceId: string,
  kind: CommunicationMessagingMutationKind,
  fingerprint: string,
  expectedRevision: number,
  payloadSealedLocally: boolean
): Result<CommunicationMessagingMutationReceiptView | null, AppError> => {
  if (!found) return ok(null);
  return found.resourceType === resourceType && found.resourceId === resourceId && found.mutationKind === kind
    && found.requestFingerprint === fingerprint && found.expectedRevision === expectedRevision
    ? ok(receipt(found, true, payloadSealedLocally))
    : err(conflict(context, 'Aynı clientOperationId farklı bir iletişim komutuna aittir.'));
};
const ownerMembershipActive = (guard: CommunicationMessagingRoomGuardRow, actorPersonId: string): boolean =>
  guard.room.status === 'active' && guard.memberships.some((item) => item.memberPersonId === actorPersonId && item.status === 'active');
const event = (
  context: LifeApplicationContext,
  scope: CommunicationMessagingWriteScope,
  row: CommunicationMessagingMutationRow,
  kind: CommunicationMessageEventRow['eventKind'],
  roomId: string
): CommunicationMessageEventRow => Object.freeze({
  id: eventId(row.id), familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
  messageId: row.resourceId, roomId, actorAccountId: context.actor.userId,
  actorPersonId: context.actor.personId!, eventKind: kind, messageRevision: row.revision,
  stateFingerprint: row.resourceStateFingerprint, mutationId: row.id, occurredAt: row.occurredAt
});
const finish = (
  context: LifeApplicationContext,
  scope: CommunicationMessagingWriteScope,
  row: CommunicationMessagingMutationRow,
  auditAction: string,
  payloadSealedLocally: boolean
): Result<CommunicationMessagingMutationReceiptView, AppError> => {
  const audit = scope.appendAudit({ id: hash({ audit: row.id }), action: auditAction,
    resourceType: row.resourceType, resourceId: row.resourceId, occurredAt: row.occurredAt, actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const queued = scope.enqueueEvent({ eventId: asEventId(hash({ event: row.id })), eventType: 'communication.messaging.changed',
    eventVersion: 1, aggregateType: row.resourceType, aggregateId: row.resourceId, occurredAt: row.occurredAt,
    correlationId: context.correlationId,
    payload: Object.freeze({ mutationKind: row.mutationKind, revision: row.revision }) });
  return queued.ok ? ok(receipt(row, false, payloadSealedLocally)) : queued;
};

export class GetCommunicationMessagingCenterUseCase {
  public constructor(private readonly query: CommunicationMessagingQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}
export class SearchCommunicationMessagesUseCase {
  public constructor(private readonly query: CommunicationMessagingQueryPort) {}
  public execute(context: LifeApplicationContext, input: SearchCommunicationMessagesInput) { return this.query.search(context, input); }
}
export class GetCommunicationMessageContentUseCase {
  public constructor(private readonly query: CommunicationMessagingQueryPort) {}
  public execute(context: LifeApplicationContext, messageId: string) { return this.query.getContent(context, messageId); }
}

export class MaintainCommunicationMessagePayloadVaultUseCase {
  public constructor(
    private readonly query: CommunicationMessagingQueryPort,
    private readonly payloads: CommunicationMessagePayloadPort
  ) {}
  public async execute(context: LifeApplicationContext): Promise<Result<Readonly<{
    scannedFiles: number; deletedFiles: number; rejectedFiles: number; completedAt: CommunicationMessagingMutationRow['occurredAt'];
  }>, AppError>> {
    const actor = actorPerson(context); if (!actor.ok) return actor;
    const loaded = await this.query.getMaintenanceState(context); if (!loaded.ok) return loaded;
    const referencedPayloads = Object.freeze([...new Set(loaded.value.rows.map((row) => row.sealedPayloadReference))]
      .sort((left, right) => left.localeCompare(right)));
    const completedBefore = new Date(Date.parse(loaded.value.occurredAt) - COMMUNICATION_MESSAGE_ORPHAN_GRACE_MS).toISOString();
    const swept = this.payloads.sweepOrphans({ familyId: context.familyId, ownerPersonId: actor.value,
      referencedPayloads, completedBefore, maximumCandidates: 64, correlationId: context.correlationId });
    return swept.ok ? ok(Object.freeze({ ...swept.value, completedAt: loaded.value.occurredAt })) : swept;
  }
}

export class CreateCommunicationMessageUseCase {
  public constructor(private readonly uow: CommunicationMessagingUnitOfWork, private readonly payloads: CommunicationMessagePayloadPort) {}
  public async execute(input: { context: LifeApplicationContext; command: CreateCommunicationMessageInput }) {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return Promise.resolve(actor);
    if (!SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.roomId)
      || !COMMUNICATION_MESSAGE_CONTENT_KINDS.includes(command.contentKind) || !MIME.test(command.contentMime)
      || !validRevision(context, command.expectedRevision, true).ok)
      return Promise.resolve(err(invalid(context, 'Mesaj oluşturma komutu geçersizdir.')));
    const normalizedTextValue = command.text === undefined ? undefined : text(command.text, 1, 32_768);
    if (command.text !== undefined && normalizedTextValue === null)
      return Promise.resolve(err(invalid(context, 'Mesaj metni geçersizdir.')));
    const normalizedText = normalizedTextValue ?? undefined;
    const textual = command.contentKind === 'text' || command.contentKind === 'location';
    if (textual && !normalizedText) return Promise.resolve(err(invalid(context, 'Metin veya konum mesajı boş ya da sınır dışıdır.')));
    if (!textual && (!command.opaqueAttachmentHandle || !SAFE_ID.test(command.opaqueAttachmentHandle)))
      return Promise.resolve(err(invalid(context, 'Medya mesajı main-process tarafından verilmiş opaque handle gerektirir.')));
    if (textual && command.opaqueAttachmentHandle !== undefined)
      return Promise.resolve(err(invalid(context, 'Metin veya konum mesajı dosya handle alanı taşıyamaz.')));
    const id = communicationMessageId(context, command.clientOperationId);
    if (command.scheduledAt !== undefined && !validIsoDateTime(command.scheduledAt))
      return Promise.resolve(err(invalid(context, 'Zamanlanmış mesaj tarihi geçersizdir.')));
    const requestFingerprint = hash({ ...command, text: normalizedText === undefined ? null : hash(normalizedText) });
    let sealedReference: string | null = null;
    const result = await this.uow.execute(context, communicationMessagingWriteIntent('communication_message', id, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, 'communication_message', id, 'message_create', requestFingerprint, 0, true);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationMessagingMutationReceiptView, AppError>;
      const guard = scope.findRoomGuard(command.roomId); if (!guard.ok) return guard;
      if (!guard.value || !ownerMembershipActive(guard.value, actor.value)) return err(denied(context, 'Etkin oda üyeliği bulunamadı.'));
      if (!textual) {
        const attachment = scope.findAttachmentGuard(command.opaqueAttachmentHandle!); if (!attachment.ok) return attachment;
        const mimeAllowed = command.contentKind === 'voice' ? command.contentMime.startsWith('audio/')
          : command.contentKind === 'photo' ? command.contentMime.startsWith('image/')
            : command.contentKind === 'video' ? command.contentMime.startsWith('video/')
              : command.contentKind === 'document' && COMMUNICATION_DOCUMENT_MIME_TYPES.has(command.contentMime);
        if (!attachment.value || attachment.value.ownerPersonId !== actor.value || attachment.value.roomId !== command.roomId
          || attachment.value.mimeType !== command.contentMime || attachment.value.state !== 'ready_local'
          || attachment.value.scanState !== 'clean' || !mimeAllowed)
          return err(denied(context, 'Mesaj eki aynı odada temiz ve yerel olarak hazır bir dosya olmalıdır.'));
      }
      for (const related of [command.replyToMessageId, command.quotedMessageId, command.threadRootMessageId]) {
        if (!related) continue;
        const found = scope.findMessage(related); if (!found.ok) return found;
        if (!found.value || found.value.roomId !== command.roomId || found.value.state === 'deleted')
          return err(missing(context, 'İlişkili mesaj aynı etkin odada bulunamadı.'));
      }
      const occurredAt = scope.occurredAt;
      if (command.scheduledAt && Date.parse(command.scheduledAt) <= Date.parse(occurredAt))
        return err(invalid(context, 'Zamanlanmış mesaj gelecekte olmalıdır.'));
      const retention = scope.findRetentionPolicy(command.roomId); if (!retention.ok) return retention;
      const expiryDays = retention.value && ['duration','auto_delete'].includes(retention.value.mode)
        ? retention.value.durationDays : undefined;
      const expiresAt = expiryDays === undefined ? undefined
        : asIsoDateTime(new Date(Date.parse(occurredAt) + expiryDays * 24 * 60 * 60 * 1_000).toISOString());
      if (expiresAt && command.scheduledAt && Date.parse(command.scheduledAt) >= Date.parse(expiresAt))
        return err(invalid(context, 'Mesaj zamanlaması oda saklama süresinin dışında kalamaz.'));
      const sealed = this.payloads.seal({ familyId: context.familyId, ownerPersonId: actor.value,
        roomId: command.roomId, messageId: id, revision: 1, contentKind: command.contentKind,
        contentMime: command.contentMime, ...(normalizedText === undefined ? {} : { text: normalizedText }),
        ...(command.opaqueAttachmentHandle ? { opaqueAttachmentHandle: command.opaqueAttachmentHandle } : {}),
        occurredAt, correlationId: context.correlationId });
      if (!sealed.ok) return sealed;
      sealedReference = sealed.value.sealedPayloadReference;
      const base: Omit<CommunicationMessageRow, 'stateFingerprint'> = Object.freeze({
        id, familyId: context.familyId, ownerPersonId: scope.ownerPersonId, roomId: command.roomId,
        senderAccountId: context.actor.userId, senderPersonId: actor.value, contentKind: sealed.value.contentKind,
        contentMime: sealed.value.contentMime, sealedPayloadReference: sealed.value.sealedPayloadReference,
        payloadSha256: sealed.value.payloadSha256, payloadSizeBytes: sealed.value.payloadSizeBytes,
        providerId: sealed.value.providerId, providerEvidenceSha256: sealed.value.providerEvidenceSha256,
        payloadRevision: 1, payloadCreatedAt: occurredAt,
        ...(command.replyToMessageId ? { replyToMessageId: command.replyToMessageId } : {}),
        ...(command.quotedMessageId ? { quotedMessageId: command.quotedMessageId } : {}),
        ...(command.threadRootMessageId ? { threadRootMessageId: command.threadRootMessageId } : {}),
        state: command.scheduledAt ? 'scheduled' : 'sealed_local', deliveryState: 'transport_not_configured',
        ...(command.scheduledAt ? { scheduledAt: asIsoDateTime(command.scheduledAt) } : {}),
        silent: command.silent === true, pinned: false, bookmarked: false, editCount: 0, revision: 1,
        lastMutationId: mutationId(context, command.clientOperationId, requestFingerprint), createdAt: occurredAt, updatedAt: occurredAt,
        ...(expiresAt ? { expiresAt } : {})
      });
      const row: CommunicationMessageRow = Object.freeze({ ...base, stateFingerprint: messageFingerprint(base) });
      const mutation: CommunicationMessagingMutationRow = Object.freeze({
        id: row.lastMutationId, familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
        resourceType: 'communication_message', resourceId: id, actorAccountId: context.actor.userId,
        actorPersonId: actor.value, mutationKind: 'message_create', clientOperationId: command.clientOperationId,
        requestFingerprint, expectedRevision: 0, revision: 1, resourceStateFingerprint: row.stateFingerprint, occurredAt
      });
      for (const write of [() => scope.insertMutation(mutation), () => scope.insertMessage(row),
        () => scope.appendMessageEvent(event(context, scope, mutation, 'message_created', row.roomId)),
        () => scope.upsertDeliveryQueue(Object.freeze({ messageId: id, familyId: context.familyId,
          ownerPersonId: scope.ownerPersonId, state: row.deliveryState, attemptCount: 0, revision: 1,
          lastMutationId: mutation.id, createdAt: occurredAt, updatedAt: occurredAt }), 0)]) {
        const result = write(); if (!result.ok) return result;
      }
      return finish(context, scope, mutation, 'communication.message.create', true);
    });
    if (!result.ok && sealedReference) {
      const discarded = this.payloads.discard(sealedReference, context.correlationId);
      if (!discarded.ok) return discarded;
    }
    return result;
  }
}

abstract class MessageMutationUseCase<TCommand extends { clientOperationId: string; expectedRevision: number; messageId: string }> {
  protected constructor(protected readonly uow: CommunicationMessagingUnitOfWork) {}
  protected executeMutation(
    context: LifeApplicationContext,
    command: TCommand,
    kind: CommunicationMessagingMutationKind,
    action: 'update' | 'delete',
    eventKind: CommunicationMessageEventRow['eventKind'],
    payloadSealedLocally: boolean,
    build: (scope: CommunicationMessagingWriteScope, current: CommunicationMessageRow,
      mutationId: string, occurredAt: CommunicationMessagingWriteScope['occurredAt']) => Result<CommunicationMessageRow, AppError>,
    afterSave?: (scope: CommunicationMessagingWriteScope, next: CommunicationMessageRow,
      mutation: CommunicationMessagingMutationRow) => Result<void, AppError>
  ) {
    const actor = actorPerson(context); if (!actor.ok) return Promise.resolve(actor);
    const expected = validRevision(context, command.expectedRevision); if (!expected.ok || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.messageId))
      return Promise.resolve(err(invalid(context, 'Mesaj değişikliği komutu geçersizdir.')));
    const fingerprint = hash(command);
    return this.uow.execute(context, communicationMessagingWriteIntent('communication_message', command.messageId, action), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, 'communication_message', command.messageId, kind, fingerprint, expected.value, payloadSealedLocally);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationMessagingMutationReceiptView, AppError>;
      const current = scope.findMessage(command.messageId); if (!current.ok) return current;
      if (!current.value) return err(missing(context, 'Mesaj bulunamadı.'));
      if (current.value.senderPersonId !== actor.value && kind !== 'message_annotate') return err(denied(context, 'Bu mesaj değişikliği gönderen kişiye aittir.'));
      if (current.value.revision !== expected.value) return err(conflict(context, 'Mesaj sürümü değişti.'));
      const id = mutationId(context, command.clientOperationId, fingerprint);
      const next = build(scope, current.value, id, scope.occurredAt); if (!next.ok) return next;
      const mutation: CommunicationMessagingMutationRow = Object.freeze({ id, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, resourceType: 'communication_message', resourceId: command.messageId,
        actorAccountId: context.actor.userId, actorPersonId: actor.value, mutationKind: kind,
        clientOperationId: command.clientOperationId, requestFingerprint: fingerprint, expectedRevision: expected.value,
        revision: expected.value + 1, resourceStateFingerprint: next.value.stateFingerprint, occurredAt: scope.occurredAt });
      for (const write of [() => scope.insertMutation(mutation), () => scope.saveMessage(next.value, expected.value),
        () => afterSave ? afterSave(scope, next.value, mutation) : ok(undefined),
        () => scope.appendMessageEvent(event(context, scope, mutation, eventKind, next.value.roomId))]) {
        const result = write(); if (!result.ok) return result;
      }
      return finish(context, scope, mutation, `communication.message.${kind}`, payloadSealedLocally);
    });
  }
}

export class EditCommunicationMessageUseCase extends MessageMutationUseCase<EditCommunicationMessageInput> {
  public constructor(uow: CommunicationMessagingUnitOfWork, private readonly payloads: CommunicationMessagePayloadPort) { super(uow); }
  public async execute(input: { context: LifeApplicationContext; command: EditCommunicationMessageInput }) {
    const normalized = text(input.command.text, 1, 32_768); const why = text(input.command.reason, 3, 500);
    if (!normalized || !why) return Promise.resolve(err(invalid(input.context, 'Mesaj düzenleme girdisi geçersizdir.')));
    let sealed: VerifiedSealedCommunicationPayloadInput | undefined;
    const result = await this.executeMutation(input.context, { ...input.command, text: normalized, reason: why }, 'message_edit', 'update', 'message_edited', true,
      (scope, current, id, occurredAt) => {
        if (current.state === 'deleted' || current.contentKind !== 'text') return err(conflict(input.context, 'Silinmiş veya metin olmayan mesaj düzenlenemez.'));
        const result = this.payloads.seal({ familyId: current.familyId, ownerPersonId: scope.ownerPersonId,
          roomId: current.roomId, messageId: current.id, revision: current.revision + 1,
          contentKind: 'text', contentMime: current.contentMime, text: normalized, occurredAt,
          correlationId: input.context.correlationId });
        if (!result.ok) return result; sealed = result.value;
        const base: Omit<CommunicationMessageRow, 'stateFingerprint'> = Object.freeze({ ...current,
          sealedPayloadReference: sealed.sealedPayloadReference, payloadSha256: sealed.payloadSha256,
          payloadSizeBytes: sealed.payloadSizeBytes, providerId: sealed.providerId,
          providerEvidenceSha256: sealed.providerEvidenceSha256, payloadRevision: current.revision + 1,
          payloadCreatedAt: occurredAt, editCount: current.editCount + 1,
          revision: current.revision + 1, lastMutationId: id, updatedAt: occurredAt });
        return ok(Object.freeze({ ...base, stateFingerprint: messageFingerprint(base) }));
      });
    if (!result.ok && sealed) {
      const discarded = this.payloads.discard(sealed.sealedPayloadReference, input.context.correlationId);
      if (!discarded.ok) return discarded;
    }
    return result;
  }
}

export class SetCommunicationMessageLifecycleUseCase extends MessageMutationUseCase<SetCommunicationMessageLifecycleInput> {
  public constructor(uow: CommunicationMessagingUnitOfWork) { super(uow); }
  public execute(input: { context: LifeApplicationContext; command: SetCommunicationMessageLifecycleInput }) {
    const why = text(input.command.reason, 3, 500);
    if (!why || !['delete','restore'].includes(input.command.action)) return Promise.resolve(err(invalid(input.context, 'Mesaj yaşam döngüsü girdisi geçersizdir.')));
    const deleting = input.command.action === 'delete';
    return this.executeMutation(input.context, { ...input.command, reason: why }, deleting ? 'message_delete' : 'message_restore',
      deleting ? 'delete' : 'update', deleting ? 'message_deleted' : 'message_restored', false,
      (_scope, current, id, occurredAt) => {
        if ((deleting && current.state === 'deleted') || (!deleting && current.state !== 'deleted'))
          return err(conflict(input.context, 'Mesaj yaşam döngüsü geçişi geçersizdir.'));
        const { deletedAt: _deletedAt, ...withoutDeletedAt } = current;
        const base: Omit<CommunicationMessageRow, 'stateFingerprint'> = Object.freeze({ ...withoutDeletedAt,
          state: deleting ? 'deleted' : 'sealed_local', deliveryState: deleting ? 'cancelled' : 'transport_not_configured',
          revision: current.revision + 1, lastMutationId: id, updatedAt: occurredAt,
          ...(deleting ? { deletedAt: occurredAt } : {}) });
        return ok(Object.freeze({ ...base, stateFingerprint: messageFingerprint(base) }));
      });
  }
}

export class AnnotateCommunicationMessageUseCase extends MessageMutationUseCase<AnnotateCommunicationMessageInput> {
  public constructor(uow: CommunicationMessagingUnitOfWork) { super(uow); }
  public execute(input: { context: LifeApplicationContext; command: AnnotateCommunicationMessageInput }) {
    const fieldCount = [input.command.reactionCode !== undefined, input.command.pinned !== undefined,
      input.command.bookmarked !== undefined].filter(Boolean).length;
    const reaction = input.command.reactionCode === undefined ? undefined : text(input.command.reactionCode, 1, 32);
    if (fieldCount !== 1 || (input.command.reactionCode !== undefined && !reaction))
      return Promise.resolve(err(invalid(input.context, 'Tam olarak bir tepki, sabitleme veya yer imi değişikliği gereklidir.')));
    return this.executeMutation(input.context, { ...input.command, ...(reaction ? { reactionCode: reaction } : {}) },
      'message_annotate', 'update', input.command.pinned === undefined && input.command.bookmarked === undefined ? 'reaction_changed'
        : input.command.pinned !== undefined ? 'pin_changed' : 'bookmark_changed', false,
      (_scope, current, id, occurredAt) => {
        if (current.state === 'deleted') return err(conflict(input.context, 'Silinmiş mesaj işaretlenemez.'));
        const { reactionCode: _reactionCode, ...withoutReaction } = current;
        const base: Omit<CommunicationMessageRow, 'stateFingerprint'> = Object.freeze({
          ...(input.command.reactionCode === undefined ? current : withoutReaction),
          ...(reaction ? { reactionCode: reaction } : {}),
          ...(input.command.pinned === undefined ? {} : { pinned: input.command.pinned }),
          ...(input.command.bookmarked === undefined ? {} : { bookmarked: input.command.bookmarked }),
          revision: current.revision + 1, lastMutationId: id, updatedAt: occurredAt });
        return ok(Object.freeze({ ...base, stateFingerprint: messageFingerprint(base) }));
      });
  }
}

export class UpdateCommunicationDeliveryUseCase extends MessageMutationUseCase<UpdateCommunicationDeliveryInput> {
  public constructor(uow: CommunicationMessagingUnitOfWork) { super(uow); }
  public execute(input: { context: LifeApplicationContext; command: UpdateCommunicationDeliveryInput }) {
    if (!['queue_offline','retry','mark_ready_local','cancel'].includes(input.command.action))
      return Promise.resolve(err(invalid(input.context, 'Teslim kuyruğu komutu geçersizdir.')));
    let nextQueue: CommunicationDeliveryQueueRow | null = null;
    return this.executeMutation(input.context, input.command, 'delivery_update', 'update', 'delivery_changed', false,
      (scope, current, id, occurredAt) => {
        if (current.state === 'deleted') return err(conflict(input.context, 'Silinmiş mesaj teslim kuyruğuna alınamaz.'));
        const currentQueue = scope.findDeliveryQueue(current.id); if (!currentQueue.ok) return currentQueue;
        if (!currentQueue.value) return err(missing(input.context, 'Mesaj teslim kuyruğu bulunamadı.'));
        const state = input.command.action === 'queue_offline' ? 'queued_offline'
          : input.command.action === 'retry' ? 'retry_wait'
            : input.command.action === 'mark_ready_local' ? 'ready_local' : 'cancelled';
        const nextRevision = current.revision + 1;
        nextQueue = Object.freeze({ messageId: current.id, familyId: current.familyId,
          ownerPersonId: current.ownerPersonId, state,
          attemptCount: input.command.action === 'retry' ? currentQueue.value.attemptCount + 1 : currentQueue.value.attemptCount,
          revision: nextRevision, lastMutationId: id, createdAt: currentQueue.value.createdAt, updatedAt: occurredAt,
          ...(input.command.action === 'retry' ? { nextAttemptAt: occurredAt } : {}) });
        const base: Omit<CommunicationMessageRow, 'stateFingerprint'> = Object.freeze({ ...current,
          deliveryState: state, revision: nextRevision, lastMutationId: id, updatedAt: occurredAt });
        return ok(Object.freeze({ ...base, stateFingerprint: messageFingerprint(base) }));
      }, (scope, next, mutation) => nextQueue
        ? scope.upsertDeliveryQueue(nextQueue, mutation.expectedRevision)
        : err(conflict(input.context, 'Teslim kuyruğu değişikliği oluşturulamadı.')));
  }
}

export class SetCommunicationPresenceUseCase {
  public constructor(private readonly uow: CommunicationMessagingUnitOfWork) {}
  public execute(input: { context: LifeApplicationContext; command: SetCommunicationPresenceInput }) {
    const actor = actorPerson(input.context); if (!actor.ok) return Promise.resolve(actor);
    const expected = validRevision(input.context, input.command.expectedRevision, true);
    if (!expected.ok || !SAFE_ID.test(input.command.clientOperationId)
      || !['online','away','busy','in_meeting','do_not_disturb','invisible','offline'].includes(input.command.status)
      || !['nobody','room_members','selected_people'].includes(input.command.audience)
      || (input.command.expiresAt !== undefined && !validIsoDateTime(input.command.expiresAt)))
      return Promise.resolve(err(invalid(input.context, 'Presence komutu geçersizdir.')));
    const id = communicationPresenceId(actor.value); const fingerprint = hash(input.command);
    return this.uow.execute(input.context, communicationMessagingWriteIntent('communication_presence', id,
      expected.value === 0 ? 'create' : 'update', actor.value), (scope) => {
      const prior = scope.findMutation(input.command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(input.context, prior.value, 'communication_presence', id, 'presence_update', fingerprint, expected.value, false);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationMessagingMutationReceiptView, AppError>;
      const current = scope.findPresence(); if (!current.ok) return current;
      if ((current.value?.revision ?? 0) !== expected.value) return err(conflict(input.context, 'Presence sürümü değişti.'));
      const mutation = mutationId(input.context, input.command.clientOperationId, fingerprint);
      const publicAvailability: CommunicationPresenceRow['publicAvailability'] = input.command.status === 'invisible' ? 'hidden'
        : ['online','away'].includes(input.command.status) ? 'available' : 'unavailable';
      const base: Omit<CommunicationPresenceRow, 'stateFingerprint'> = Object.freeze({
        id, familyId: input.context.familyId, ownerPersonId: scope.ownerPersonId, personId: actor.value,
        status: input.command.status, publicAvailability, audience: input.command.audience,
        lastSeenShared: input.command.lastSeenShared, typingIndicatorsEnabled: input.command.typingIndicatorsEnabled,
        readReceiptsEnabled: input.command.readReceiptsEnabled,
        emergencyReachabilityEnabled: input.command.emergencyReachabilityEnabled,
        ...(input.command.expiresAt ? { expiresAt: asIsoDateTime(input.command.expiresAt) } : {}),
        revision: expected.value + 1, lastMutationId: mutation,
        createdAt: current.value?.createdAt ?? scope.occurredAt, updatedAt: scope.occurredAt
      });
      const row: CommunicationPresenceRow = Object.freeze({ ...base, stateFingerprint: presenceFingerprint(base) });
      const mutationRow: CommunicationMessagingMutationRow = Object.freeze({ id: mutation, familyId: input.context.familyId,
        ownerPersonId: scope.ownerPersonId, resourceType: 'communication_presence', resourceId: id,
        actorAccountId: input.context.actor.userId, actorPersonId: actor.value, mutationKind: 'presence_update',
        clientOperationId: input.command.clientOperationId, requestFingerprint: fingerprint, expectedRevision: expected.value,
        revision: expected.value + 1, resourceStateFingerprint: row.stateFingerprint, occurredAt: scope.occurredAt });
      const inserted = scope.insertMutation(mutationRow); if (!inserted.ok) return inserted;
      const saved = scope.savePresence(row, expected.value); if (!saved.ok) return saved;
      return finish(input.context, scope, mutationRow, 'communication.presence.update', false);
    });
  }
}

export class SetCommunicationRetentionPolicyUseCase {
  public constructor(private readonly uow: CommunicationMessagingUnitOfWork) {}
  public execute(input: { context: LifeApplicationContext; command: SetCommunicationRetentionPolicyInput }) {
    const actor = actorPerson(input.context); if (!actor.ok) return Promise.resolve(actor);
    const expected = validRevision(input.context, input.command.expectedRevision, true); const why = text(input.command.reason, 3, 500);
    if (!expected.ok || !why || !SAFE_ID.test(input.command.clientOperationId) || !SAFE_ID.test(input.command.roomId)
      || !['permanent','duration','auto_delete','legal_hold'].includes(input.command.mode)
      || ((input.command.mode === 'duration' || input.command.mode === 'auto_delete')
        && (!Number.isSafeInteger(input.command.durationDays) || Number(input.command.durationDays) < 1 || Number(input.command.durationDays) > 3650)))
      return Promise.resolve(err(invalid(input.context, 'Saklama politikası komutu geçersizdir.')));
    const id = communicationRetentionPolicyId(input.command.roomId); const fingerprint = hash({ ...input.command, reason: why });
    return this.uow.execute(input.context, communicationMessagingWriteIntent('communication_retention_policy', id,
      expected.value === 0 ? 'create' : 'update', actor.value), (scope) => {
      const prior = scope.findMutation(input.command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(input.context, prior.value, 'communication_retention_policy', id, 'retention_update', fingerprint, expected.value, false);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationMessagingMutationReceiptView, AppError>;
      const guard = scope.findRoomGuard(input.command.roomId); if (!guard.ok) return guard;
      if (!guard.value || guard.value.room.ownerPersonId !== actor.value) return err(denied(input.context, 'Oda saklama politikası sahibi doğrulanamadı.'));
      const current = scope.findRetentionPolicy(input.command.roomId); if (!current.ok) return current;
      if ((current.value?.revision ?? 0) !== expected.value) return err(conflict(input.context, 'Saklama politikası sürümü değişti.'));
      const mutation = mutationId(input.context, input.command.clientOperationId, fingerprint);
      const base: Omit<CommunicationRetentionPolicyRow, 'stateFingerprint'> = Object.freeze({ id,
        familyId: input.context.familyId, ownerPersonId: scope.ownerPersonId, roomId: input.command.roomId,
        mode: input.command.mode,
        ...((input.command.mode === 'duration' || input.command.mode === 'auto_delete')
          ? { durationDays: Number(input.command.durationDays) } : {}),
        ...(input.command.mode === 'legal_hold' ? { legalHoldReasonSha256: hash(why) } : {}),
        revision: expected.value + 1, lastMutationId: mutation,
        createdAt: current.value?.createdAt ?? scope.occurredAt, updatedAt: scope.occurredAt });
      const row: CommunicationRetentionPolicyRow = Object.freeze({ ...base, stateFingerprint: retentionFingerprint(base) });
      const mutationRow: CommunicationMessagingMutationRow = Object.freeze({ id: mutation, familyId: input.context.familyId,
        ownerPersonId: scope.ownerPersonId, resourceType: 'communication_retention_policy', resourceId: id,
        actorAccountId: input.context.actor.userId, actorPersonId: actor.value, mutationKind: 'retention_update',
        clientOperationId: input.command.clientOperationId, requestFingerprint: fingerprint, expectedRevision: expected.value,
        revision: expected.value + 1, resourceStateFingerprint: row.stateFingerprint, occurredAt: scope.occurredAt });
      const inserted = scope.insertMutation(mutationRow); if (!inserted.ok) return inserted;
      const saved = scope.saveRetentionPolicy(row, expected.value); if (!saved.ok) return saved;
      return finish(input.context, scope, mutationRow, 'communication.retention.update', false);
    });
  }
}

export const communicationMessageRowToView = (row: CommunicationMessageRow): CommunicationMessageView => Object.freeze({
  id: row.id, roomId: row.roomId, senderPersonId: row.senderPersonId, contentKind: row.contentKind,
  contentMime: row.contentMime, payloadSizeBytes: row.payloadSizeBytes, state: row.state,
  deliveryState: row.deliveryState, ...(row.replyToMessageId ? { replyToMessageId: row.replyToMessageId } : {}),
  ...(row.quotedMessageId ? { quotedMessageId: row.quotedMessageId } : {}),
  ...(row.threadRootMessageId ? { threadRootMessageId: row.threadRootMessageId } : {}),
  ...(row.scheduledAt ? { scheduledAt: row.scheduledAt } : {}), silent: row.silent, pinned: row.pinned,
  bookmarked: row.bookmarked, ...(row.reactionCode ? { reactionCode: row.reactionCode } : {}),
  edited: row.editCount > 0, deleted: row.state === 'deleted', revision: row.revision,
  createdAt: row.createdAt, updatedAt: row.updatedAt, ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
  sealedPayloadStoredOutsideDatabase: true, plaintextPersistedInDatabase: false
});

export const communicationMessagingKey = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): CommunicationMessagingCenterKey => Object.freeze({ familyId: context.familyId, accountId: context.actor.userId,
  actorPersonId: context.actor.personId!, ownerPersonId,
  centerId: communicationMessagingCenterId(context.familyId, ownerPersonId) });
