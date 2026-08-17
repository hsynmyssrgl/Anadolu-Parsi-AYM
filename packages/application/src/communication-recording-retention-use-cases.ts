import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type PersonId,
  type Result
} from '@ppt/core';
import {
  communicationRecordingCenterId,
  type AddCommunicationRecordingLateJoinerInput,
  type CommunicationRecordingCenterView,
  type CommunicationRecordingMutationKind,
  type CommunicationRecordingMutationReceiptView,
  type CommunicationRecordingRequestView,
  type CreateCommunicationRecordingRequestInput,
  type DecideCommunicationRecordingConsentInput,
  type RequestCommunicationRecordingDeletionInput,
  type SetCommunicationRecordingSegmentInput,
  type UpdateCommunicationRecordingRetentionInput,
  type WithdrawCommunicationRecordingConsentInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationRecordingCallGuardRow,
  CommunicationRecordingCenterKey,
  CommunicationRecordingConsentRow,
  CommunicationRecordingEventRow,
  CommunicationRecordingMutationRow,
  CommunicationRecordingRequestRow,
  CommunicationRecordingRequestSnapshotRow,
  CommunicationRecordingRetentionRow,
  CommunicationRecordingSegmentRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationRecordingQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<CommunicationRecordingCenterView, AppError>>;
}

export interface CommunicationRecordingWriteScope {
  readonly occurredAt: CommunicationRecordingMutationRow['occurredAt'];
  readonly ownerPersonId: CommunicationRecordingCenterKey['ownerPersonId'];
  findRequest(requestId: string): Result<CommunicationRecordingRequestSnapshotRow | null, AppError>;
  findCallGuard(callSessionId: string): Result<CommunicationRecordingCallGuardRow | null, AppError>;
  isEligibleLateJoiner(callSessionId: string, participantPersonId: PersonId): Result<boolean, AppError>;
  findMutation(clientOperationId: string): Result<CommunicationRecordingMutationRow | null, AppError>;
  insertMutation(row: CommunicationRecordingMutationRow): Result<void, AppError>;
  insertRequest(row: CommunicationRecordingRequestRow): Result<void, AppError>;
  saveRequest(row: CommunicationRecordingRequestRow, expectedRevision: number): Result<void, AppError>;
  insertConsents(rows: readonly CommunicationRecordingConsentRow[]): Result<void, AppError>;
  insertLateJoinerConsent(row: CommunicationRecordingConsentRow): Result<void, AppError>;
  saveConsent(row: CommunicationRecordingConsentRow, expectedRevision: number): Result<void, AppError>;
  saveRetention(row: CommunicationRecordingRetentionRow, expectedRevision: number): Result<void, AppError>;
  appendSegment(row: CommunicationRecordingSegmentRow): Result<void, AppError>;
  appendEvent(row: CommunicationRecordingEventRow): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: CommunicationRecordingMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface CommunicationRecordingUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: CommunicationRecordingWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const SAFE_NOTICE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const text = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized) ? normalized : null;
};
const retentionDaysValid = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 3650;
const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT
    | typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');
const actorPerson = (context: LifeApplicationContext) => context.actor.personId
  ? ok(context.actor.personId) : err(denied(context, 'Kayıt ve rıza merkezi kişi bağlı oturum gerektirir.'));
const validRevision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen kayıt sürümü geçersizdir.'));

export const communicationRecordingReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'communication_recording_center', resourceId: '*', purpose: 'general'
});
export const communicationRecordingWriteIntent = (
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType: 'communication_recording_request', resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId
    ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const }
    : {})
});

export const communicationRecordingKey = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): CommunicationRecordingCenterKey => Object.freeze({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: context.actor.personId ?? ownerPersonId,
  ownerPersonId,
  centerId: communicationRecordingCenterId(context.familyId, ownerPersonId)
});
export const communicationRecordingRequestId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `communication-recording-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;
const mutationId = (context: LifeApplicationContext, clientOperationId: string, fingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, fingerprint });
const consentId = (requestId: string, personId: string): string =>
  `communication-recording-consent-${hash({ requestId, personId }).slice(0, 48)}`;
const retentionId = (requestId: string): string => `${requestId}:retention`;
const requestFingerprint = (row: Omit<CommunicationRecordingRequestRow, 'stateFingerprint'>): string => hash(row);
const receipt = (row: CommunicationRecordingMutationRow, replayed: boolean): CommunicationRecordingMutationReceiptView => Object.freeze({
  resourceType: row.resourceType, resourceId: row.resourceId, mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt,
  replayed, mediaCaptureStarted: false, mediaArtifactCreated: false, networkUsed: false
});
const replay = (
  context: LifeApplicationContext,
  row: CommunicationRecordingMutationRow | null,
  resourceId: string,
  kind: CommunicationRecordingMutationKind,
  fingerprint: string,
  expectedRevision: number
): Result<CommunicationRecordingMutationReceiptView | null, AppError> => {
  if (!row) return ok(null);
  return row.resourceId === resourceId && row.mutationKind === kind && row.requestFingerprint === fingerprint
    && row.expectedRevision === expectedRevision
    ? ok(receipt(row, true))
    : err(conflict(context, 'Aynı clientOperationId farklı bir kayıt komutuna aittir.'));
};

const view = (snapshot: CommunicationRecordingRequestSnapshotRow): CommunicationRecordingRequestView => Object.freeze({
  id: snapshot.request.id, callSessionId: snapshot.request.callSessionId, state: snapshot.request.state,
  noticeVersion: snapshot.request.noticeVersion, lateJoinerPauseRequired: true, anyDeclineKeepsCallOffRecord: true,
  visibleRecordingIndicatorActive: false, audibleRecordingAnnouncementExecuted: false,
  recordingRoleBoundToE2eeGroup: false, mediaCaptureStarted: false,
  participants: Object.freeze(snapshot.consents.map((row) => Object.freeze({
    personId: row.participantPersonId, state: row.state, noticeVersion: row.noticeVersion,
    explicitConsent: row.explicitConsent, ageCategory: row.ageCategory,
    ageAppropriateNoticeAcknowledged: row.ageAppropriateNoticeAcknowledged,
    guardianPolicyVerified: false as const, revision: row.revision, updatedAt: row.updatedAt,
    ...(row.decidedAt ? { decidedAt: row.decidedAt } : {})
  }))),
  retention: Object.freeze({ audioDays: snapshot.retention.audioDays, videoDays: snapshot.retention.videoDays,
    transcriptDays: snapshot.retention.transcriptDays, translationDays: snapshot.retention.translationDays,
    persistTranscript: snapshot.retention.persistTranscript, persistTranslation: snapshot.retention.persistTranslation,
    secureDeletionRequested: snapshot.retention.secureDeletionRequested,
    revision: snapshot.retention.revision, updatedAt: snapshot.retention.updatedAt }),
  segments: Object.freeze(snapshot.segments.map((row) => Object.freeze({ mode: row.mode,
    captureStarted: false as const, transcriptPersisted: false as const, translationPersisted: false as const,
    revision: row.requestRevision, occurredAt: row.occurredAt }))),
  revision: snapshot.request.revision, createdAt: snapshot.request.createdAt, updatedAt: snapshot.request.updatedAt
});

export const communicationRecordingSnapshotToView = view;

const event = (row: CommunicationRecordingMutationRow): CommunicationRecordingEventRow => Object.freeze({
  id: hash({ event: row.id }), familyId: row.familyId, ownerPersonId: row.ownerPersonId,
  requestId: row.resourceId, eventKind: row.mutationKind, requestRevision: row.revision,
  stateFingerprint: row.resourceStateFingerprint, mutationId: row.id, occurredAt: row.occurredAt
});
const finish = (
  context: LifeApplicationContext,
  scope: CommunicationRecordingWriteScope,
  row: CommunicationRecordingMutationRow,
  action: string
): Result<CommunicationRecordingMutationReceiptView, AppError> => {
  const audit = scope.appendAudit({ id: hash({ audit: row.id }), action, resourceType: row.resourceType,
    resourceId: row.resourceId, occurredAt: row.occurredAt, actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const queued = scope.enqueueEvent({ eventId: asEventId(hash({ outbox: row.id })),
    eventType: 'communication.recording.changed', eventVersion: 1, aggregateType: row.resourceType,
    aggregateId: row.resourceId, occurredAt: row.occurredAt, correlationId: context.correlationId,
    payload: Object.freeze({ mutationKind: row.mutationKind, revision: row.revision }) });
  return queued.ok ? ok(receipt(row, false)) : queued;
};
const mutation = (
  context: LifeApplicationContext,
  scope: CommunicationRecordingWriteScope,
  input: { readonly clientOperationId: string; readonly expectedRevision: number },
  resourceId: string,
  kind: CommunicationRecordingMutationKind,
  fingerprint: string,
  stateFingerprint: string
): CommunicationRecordingMutationRow => Object.freeze({
  id: mutationId(context, input.clientOperationId, fingerprint), familyId: context.familyId,
  ownerPersonId: scope.ownerPersonId, resourceType: 'communication_recording_request', resourceId,
  actorAccountId: context.actor.userId, actorPersonId: context.actor.personId!, mutationKind: kind,
  clientOperationId: input.clientOperationId, requestFingerprint: fingerprint,
  expectedRevision: input.expectedRevision, revision: input.expectedRevision + 1,
  resourceStateFingerprint: stateFingerprint, occurredAt: scope.occurredAt
});
const requireOwner = (context: LifeApplicationContext, scope: CommunicationRecordingWriteScope): Result<void, AppError> =>
  context.actor.personId === scope.ownerPersonId ? ok(undefined) : err(denied(context, 'Bu kayıt komutu yalnız görüşme sahibi tarafından uygulanabilir.'));

export class GetCommunicationRecordingCenterUseCase {
  public constructor(private readonly query: CommunicationRecordingQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}

export class CreateCommunicationRecordingRequestUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: CreateCommunicationRecordingRequestInput) {
    const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
    if (!SAFE_ID.test(input.clientOperationId) || input.expectedRevision !== 0 || !SAFE_ID.test(input.callSessionId)
      || !SAFE_NOTICE.test(input.noticeVersion) || !Array.isArray(input.participantPersonIds)
      || ![input.audioDays,input.videoDays,input.transcriptDays,input.translationDays].every(retentionDaysValid))
      return Promise.resolve(err(invalid(context, 'Kayıt talebi girdisi geçersizdir.')));
    const participants = [...new Set(input.participantPersonIds)].sort();
    if (participants.length < 2 || participants.length > 16 || participants.some((id) => !SAFE_ID.test(id))
      || !participants.includes(person.value)) return Promise.resolve(err(invalid(context, 'Kayıt katılımcı listesi geçersizdir.')));
    const resourceId = communicationRecordingRequestId(context, input.clientOperationId);
    const fingerprint = hash({ ...input, participantPersonIds: participants });
    return this.unitOfWork.execute(context, communicationRecordingWriteIntent(resourceId, 'create', person.value), (scope) => {
      const prior = scope.findMutation(input.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, resourceId, 'recording_request_create', fingerprint, 0);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRecordingMutationReceiptView, AppError>;
      const guard = scope.findCallGuard(input.callSessionId); if (!guard.ok) return guard;
      if (!guard.value || guard.value.ownerPersonId !== person.value
        || ['ended','cancelled'].includes(guard.value.state))
        return err(missing(context, 'Aktif ve sahipliği doğrulanmış çağrı oturumu bulunamadı.'));
      const callParticipants = [...new Set(guard.value.participantPersonIds)].sort();
      if (callParticipants.length !== participants.length || callParticipants.some((id, index) => id !== participants[index]))
        return err(conflict(context, 'Kayıt rızası çağrıdaki tüm katılımcıları exact kapsamalıdır.'));
      const mutationIdentity = mutationId(context, input.clientOperationId, fingerprint);
      const base: Omit<CommunicationRecordingRequestRow, 'stateFingerprint'> = Object.freeze({
        id: resourceId, familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
        callSessionId: input.callSessionId, state: 'consent_pending', noticeVersion: input.noticeVersion,
        revision: 1, lastMutationId: mutationIdentity, createdAt: scope.occurredAt, updatedAt: scope.occurredAt
      });
      const row = Object.freeze({ ...base, stateFingerprint: requestFingerprint(base) });
      const mutationRow = mutation(context, scope, input, resourceId, 'recording_request_create', fingerprint, row.stateFingerprint);
      const insertedMutation = scope.insertMutation(mutationRow); if (!insertedMutation.ok) return insertedMutation;
      const insertedRequest = scope.insertRequest(row); if (!insertedRequest.ok) return insertedRequest;
      const consents = participants.map((participantPersonId): CommunicationRecordingConsentRow => Object.freeze({
        id: consentId(resourceId, participantPersonId), familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
        requestId: resourceId, participantPersonId: asPersonId(participantPersonId), state: 'pending',
        noticeVersion: input.noticeVersion, explicitConsent: false, ageCategory: 'minor_or_unknown',
        ageAppropriateNoticeAcknowledged: false, guardianPolicyVerified: false, revision: 1,
        lastMutationId: mutationIdentity, createdAt: scope.occurredAt, updatedAt: scope.occurredAt
      }));
      const insertedConsents = scope.insertConsents(consents); if (!insertedConsents.ok) return insertedConsents;
      const retention: CommunicationRecordingRetentionRow = Object.freeze({ id: retentionId(resourceId), familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, requestId: resourceId, audioDays: input.audioDays, videoDays: input.videoDays,
        transcriptDays: input.transcriptDays, translationDays: input.translationDays,
        persistTranscript: input.persistTranscript, persistTranslation: input.persistTranslation,
        secureDeletionRequested: true, revision: 1, lastMutationId: mutationIdentity,
        createdAt: scope.occurredAt, updatedAt: scope.occurredAt });
      const savedRetention = scope.saveRetention(retention, 0); if (!savedRetention.ok) return savedRetention;
      const appended = scope.appendEvent(event(mutationRow)); if (!appended.ok) return appended;
      return finish(context, scope, mutationRow, 'communication.recording_request_created');
    });
  }
}

type RequestMutationInput = { readonly clientOperationId: string; readonly expectedRevision: number; readonly requestId: string };
interface CommunicationRecordingMutationPlan {
  readonly next: CommunicationRecordingRequestRow;
  persistAfterMutation(): Result<void, AppError>;
}
const executeRequestMutation = (
  unitOfWork: CommunicationRecordingUnitOfWork,
  context: LifeApplicationContext,
  input: RequestMutationInput,
  kind: CommunicationRecordingMutationKind,
  commandFingerprint: unknown,
  action: 'update' | 'delete',
  operation: (
    scope: CommunicationRecordingWriteScope,
    snapshot: CommunicationRecordingRequestSnapshotRow,
    mutationIdentity: string,
    fingerprint: string
  ) => Result<CommunicationRecordingMutationPlan, AppError>
) => {
  const expected = validRevision(context, input.expectedRevision); if (!expected.ok) return Promise.resolve(expected);
  if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.requestId))
    return Promise.resolve(err(invalid(context, 'Kayıt komutu kimliği geçersizdir.')));
  const fingerprint = hash(commandFingerprint);
  return unitOfWork.execute(context, communicationRecordingWriteIntent(input.requestId, action), (scope) => {
    const prior = scope.findMutation(input.clientOperationId); if (!prior.ok) return prior;
    const replayed = replay(context, prior.value, input.requestId, kind, fingerprint, expected.value);
    if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRecordingMutationReceiptView, AppError>;
    const found = scope.findRequest(input.requestId); if (!found.ok) return found;
    if (!found.value) return err(missing(context, 'Kayıt talebi bulunamadı.'));
    if (found.value.request.revision !== expected.value) return err(conflict(context, 'Kayıt talebi sürümü değişmiştir.'));
    const identity = mutationId(context, input.clientOperationId, fingerprint);
    const next = operation(scope, found.value, identity, fingerprint); if (!next.ok) return next;
    const mutationRow = mutation(context, scope, input, input.requestId, kind, fingerprint, next.value.next.stateFingerprint);
    const inserted = scope.insertMutation(mutationRow); if (!inserted.ok) return inserted;
    const child = next.value.persistAfterMutation(); if (!child.ok) return child;
    const saved = scope.saveRequest(next.value.next, expected.value); if (!saved.ok) return saved;
    const appended = scope.appendEvent(event(mutationRow)); if (!appended.ok) return appended;
    return finish(context, scope, mutationRow, `communication.${kind}`);
  });
};
const nextRequest = (
  current: CommunicationRecordingRequestRow,
  state: CommunicationRecordingRequestRow['state'],
  mutationIdentity: string,
  occurredAt: CommunicationRecordingRequestRow['updatedAt']
): CommunicationRecordingRequestRow => {
  const base: Omit<CommunicationRecordingRequestRow, 'stateFingerprint'> = Object.freeze({ ...current, state,
    revision: current.revision + 1, lastMutationId: mutationIdentity, updatedAt: occurredAt });
  return Object.freeze({ ...base, stateFingerprint: requestFingerprint(base) });
};

export class DecideCommunicationRecordingConsentUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: DecideCommunicationRecordingConsentInput) {
    if (!['grant','decline'].includes(input.decision) || input.explicitConsent !== true
      || !SAFE_NOTICE.test(input.noticeVersion) || input.ageAppropriateNoticeAcknowledged !== true
      || !['adult','minor_or_unknown'].includes(input.ageCategory))
      return Promise.resolve(err(invalid(context, 'Katılımcı kayıt rızası girdisi geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'participant_consent_decide', input, 'update',
      (scope, snapshot, identity) => {
        const actor = context.actor.personId;
        if (!actor) return err(denied(context, 'Katılımcı kayıt rızası kişi bağlı oturum gerektirir.'));
        const consent = snapshot.consents.find((item) => item.participantPersonId === actor);
        if (!consent) return err(denied(context, 'Yalnız kendi kayıt rızanız için karar verebilirsiniz.'));
        if (input.noticeVersion !== snapshot.request.noticeVersion || consent.noticeVersion !== input.noticeVersion)
          return err(conflict(context, 'Rıza aydınlatma sürümü güncel taleple eşleşmiyor.'));
        if (input.ageCategory === 'minor_or_unknown')
          return err(denied(context, 'Çocuk veya yaşı doğrulanmamış katılımcı için veli ve hukuk politikası yapılandırılmamıştır.'));
        const nextConsent: CommunicationRecordingConsentRow = Object.freeze({ ...consent,
          state: input.decision === 'grant' ? 'granted' : 'declined', explicitConsent: true,
          ageCategory: 'adult', ageAppropriateNoticeAcknowledged: true, guardianPolicyVerified: false,
          revision: consent.revision + 1, lastMutationId: identity, updatedAt: scope.occurredAt, decidedAt: scope.occurredAt });
        const all = snapshot.consents.map((item) => item.id === consent.id ? nextConsent : item);
        const state = all.some((item) => item.state === 'declined' || item.state === 'withdrawn')
          ? 'off_record' : all.every((item) => item.state === 'granted') ? 'ready_not_recording' : 'consent_pending';
        return ok(Object.freeze({ next: nextRequest(snapshot.request, state, identity, scope.occurredAt),
          persistAfterMutation: () => scope.saveConsent(nextConsent, consent.revision) }));
      });
  }
}

export class WithdrawCommunicationRecordingConsentUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: WithdrawCommunicationRecordingConsentInput) {
    if (!text(input.reason, 2, 300)) return Promise.resolve(err(invalid(context, 'Rıza geri çekme gerekçesi geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'participant_consent_withdraw', input, 'update',
      (scope, snapshot, identity) => {
        const actor = context.actor.personId;
        const consent = snapshot.consents.find((item) => item.participantPersonId === actor);
        if (!actor || !consent || consent.state !== 'granted')
          return err(denied(context, 'Yalnız kendi etkin kayıt rızanızı geri çekebilirsiniz.'));
        const nextConsent = Object.freeze({ ...consent, state: 'withdrawn' as const, revision: consent.revision + 1,
          lastMutationId: identity, updatedAt: scope.occurredAt, decidedAt: scope.occurredAt });
        return ok(Object.freeze({ next: nextRequest(snapshot.request, 'off_record', identity, scope.occurredAt),
          persistAfterMutation: () => scope.saveConsent(nextConsent, consent.revision) }));
      });
  }
}

export class AddCommunicationRecordingLateJoinerUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: AddCommunicationRecordingLateJoinerInput) {
    if (!SAFE_ID.test(input.participantPersonId)) return Promise.resolve(err(invalid(context, 'Geç katılan kişi kimliği geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'late_joiner_add', input, 'update',
      (scope, snapshot, identity) => {
        const owner = requireOwner(context, scope); if (!owner.ok) return owner;
        if (snapshot.consents.some((item) => item.participantPersonId === input.participantPersonId))
          return err(conflict(context, 'Katılımcı kayıt rızası listesinde zaten vardır.'));
        if (snapshot.consents.length >= 16) return err(conflict(context, 'Kayıt katılımcı sınırı aşılmıştır.'));
        const guard = scope.findCallGuard(snapshot.request.callSessionId); if (!guard.ok) return guard;
        if (!guard.value || ['ended','cancelled'].includes(guard.value.state))
          return err(conflict(context, 'Sona ermiş veya bulunamayan çağrıya geç katılımcı eklenemez.'));
        const eligible = scope.isEligibleLateJoiner(snapshot.request.callSessionId, asPersonId(input.participantPersonId));
        if (!eligible.ok) return eligible;
        if (!eligible.value) return err(denied(context, 'Geç katılan kişi çağrının etkin oda üyeliğiyle doğrulanamadı.'));
        const lateConsent: CommunicationRecordingConsentRow = Object.freeze({ id: consentId(input.requestId, input.participantPersonId),
          familyId: context.familyId, ownerPersonId: scope.ownerPersonId, requestId: input.requestId,
          participantPersonId: asPersonId(input.participantPersonId), state: 'pending',
          noticeVersion: snapshot.request.noticeVersion, explicitConsent: false, ageCategory: 'minor_or_unknown',
          ageAppropriateNoticeAcknowledged: false, guardianPolicyVerified: false, revision: 1,
          lastMutationId: identity, createdAt: scope.occurredAt, updatedAt: scope.occurredAt });
        return ok(Object.freeze({ next: nextRequest(snapshot.request, 'paused_for_joiner', identity, scope.occurredAt),
          persistAfterMutation: () => scope.insertLateJoinerConsent(lateConsent) }));
      });
  }
}

export class SetCommunicationRecordingSegmentUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: SetCommunicationRecordingSegmentInput) {
    if (!['on_record_requested','off_record'].includes(input.mode) || !text(input.reason, 2, 300))
      return Promise.resolve(err(invalid(context, 'Kayıt bölümü girdisi geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'recording_segment_change', input, 'update',
      (scope, snapshot, identity) => {
        const owner = requireOwner(context, scope); if (!owner.ok) return owner;
        const guard = scope.findCallGuard(snapshot.request.callSessionId); if (!guard.ok) return guard;
        if (!guard.value || ['ended','cancelled'].includes(guard.value.state))
          return err(conflict(context, 'Sona ermiş veya bulunamayan çağrıda kayıt bölümü değiştirilemez.'));
        const callParticipants = [...new Set(guard.value.participantPersonIds)].sort();
        const consentParticipants = snapshot.consents.map((item) => item.participantPersonId).sort();
        if (callParticipants.some((personId) => !consentParticipants.includes(personId)))
          return err(denied(context, 'Çağrıdaki her katılımcı için ayrı kayıt rızası olmadan bölüm değiştirilemez.'));
        const allGranted = snapshot.consents.length >= 2 && snapshot.consents.every((item) => item.state === 'granted');
        if (input.mode === 'on_record_requested' && (!allGranted || snapshot.request.state !== 'ready_not_recording'))
          return err(denied(context, 'Tüm katılımcılar açık rıza vermeden on-record bölümü istenemez.'));
        if (snapshot.segments.at(-1)?.mode === input.mode)
          return err(conflict(context, 'Kayıt bölümü zaten istenen moddadır.'));
        const next = nextRequest(snapshot.request, input.mode === 'off_record' ? 'off_record' : 'ready_not_recording', identity, scope.occurredAt);
        const segment: CommunicationRecordingSegmentRow = Object.freeze({ id: hash({ segment: identity }),
          familyId: context.familyId, ownerPersonId: scope.ownerPersonId, requestId: input.requestId,
          mode: input.mode, captureStarted: false, transcriptPersisted: false, translationPersisted: false,
          requestRevision: next.revision, mutationId: identity, occurredAt: scope.occurredAt });
        return ok(Object.freeze({ next, persistAfterMutation: () => scope.appendSegment(segment) }));
      });
  }
}

export class UpdateCommunicationRecordingRetentionUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: UpdateCommunicationRecordingRetentionInput) {
    if (![input.audioDays,input.videoDays,input.transcriptDays,input.translationDays].every(retentionDaysValid))
      return Promise.resolve(err(invalid(context, 'Kayıt saklama süresi geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'recording_retention_update', input, 'update',
      (scope, snapshot, identity) => {
        const owner = requireOwner(context, scope); if (!owner.ok) return owner;
        const retention: CommunicationRecordingRetentionRow = Object.freeze({ ...snapshot.retention,
          audioDays: input.audioDays, videoDays: input.videoDays, transcriptDays: input.transcriptDays,
          translationDays: input.translationDays, persistTranscript: input.persistTranscript,
          persistTranslation: input.persistTranslation, secureDeletionRequested: input.secureDeletionRequested,
          revision: snapshot.retention.revision + 1, lastMutationId: identity, updatedAt: scope.occurredAt });
        return ok(Object.freeze({ next: nextRequest(snapshot.request, snapshot.request.state, identity, scope.occurredAt),
          persistAfterMutation: () => scope.saveRetention(retention, snapshot.retention.revision) }));
      });
  }
}

export class RequestCommunicationRecordingDeletionUseCase {
  public constructor(private readonly unitOfWork: CommunicationRecordingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: RequestCommunicationRecordingDeletionInput) {
    if (!text(input.reason, 2, 300)) return Promise.resolve(err(invalid(context, 'Kayıt silme gerekçesi geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'recording_delete_request', input, 'delete',
      (scope, snapshot, identity) => {
        const owner = requireOwner(context, scope); if (!owner.ok) return owner;
        if (snapshot.request.state === 'deletion_requested') return err(conflict(context, 'Kayıt silme talebi zaten oluşturulmuştur.'));
        return ok(Object.freeze({ next: nextRequest(snapshot.request, 'deletion_requested', identity, scope.occurredAt),
          persistAfterMutation: () => ok(undefined) }));
      });
  }
}
