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
  COMMUNICATION_CALL_MEDIA_MODES,
  COMMUNICATION_CALL_TOPOLOGIES,
  communicationCallPreferencesId,
  communicationRealtimeCallingCenterId,
  type AdvanceCommunicationCallInput,
  type CommunicationCallPreferencesView,
  type CommunicationCallSessionView,
  type CommunicationRealtimeCallingCenterView,
  type CommunicationRealtimeCallingMutationKind,
  type CommunicationRealtimeCallingMutationReceiptView,
  type CommunicationRealtimeCallingResourceType,
  type CreateCommunicationCallInput,
  type RecordCommunicationCallQualityInput,
  type RunCommunicationCallPreflightInput,
  type SetCommunicationCallPreferencesInput,
  type UpdateCommunicationCallControlsInput,
  type VerifiedCommunicationCallPreflightInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  CommunicationCallEventRow,
  CommunicationCallParticipantRow,
  CommunicationCallPreferencesRow,
  CommunicationCallQualityObservationRow,
  CommunicationCallSessionRow,
  CommunicationRealtimeCallingCenterKey,
  CommunicationRealtimeCallingMutationRow,
  CommunicationRealtimeCallingRoomGuardRow,
  CommunicationRealtimeCallingSessionSnapshotRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface CommunicationRealtimeCallingQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<CommunicationRealtimeCallingCenterView, AppError>>;
}

export interface CommunicationCallPreflightPort {
  run(
    context: LifeApplicationContext,
    input: Readonly<{ sessionId: string }>
  ): Promise<Result<VerifiedCommunicationCallPreflightInput, AppError>>;
}

export interface CommunicationRealtimeCallingWriteScope {
  readonly occurredAt: CommunicationRealtimeCallingMutationRow['occurredAt'];
  readonly ownerPersonId: CommunicationRealtimeCallingCenterKey['ownerPersonId'];
  findRoomGuard(roomId: string): Result<CommunicationRealtimeCallingRoomGuardRow | null, AppError>;
  findSession(sessionId: string): Result<CommunicationRealtimeCallingSessionSnapshotRow | null, AppError>;
  findPreferences(): Result<CommunicationCallPreferencesRow | null, AppError>;
  findMutation(clientOperationId: string): Result<CommunicationRealtimeCallingMutationRow | null, AppError>;
  insertMutation(row: CommunicationRealtimeCallingMutationRow): Result<void, AppError>;
  insertSession(row: CommunicationCallSessionRow): Result<void, AppError>;
  saveSession(row: CommunicationCallSessionRow, expectedRevision: number): Result<void, AppError>;
  insertParticipants(rows: readonly CommunicationCallParticipantRow[]): Result<void, AppError>;
  appendEvent(row: CommunicationCallEventRow): Result<void, AppError>;
  savePreferences(row: CommunicationCallPreferencesRow, expectedRevision: number): Result<void, AppError>;
  appendQualityObservation(row: CommunicationCallQualityObservationRow): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: CommunicationRealtimeCallingMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface CommunicationRealtimeCallingUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: CommunicationRealtimeCallingWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const normalizedText = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized) ? normalized : null;
};
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)
  && Number.isFinite(Date.parse(value));
const appError = (
  context: LifeApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.RESOURCE_CONFLICT
    | typeof ERROR_CODES.RESOURCE_NOT_FOUND | typeof ERROR_CODES.AUTHORIZATION_DENIED,
  message: string,
  category: 'validation' | 'conflict' | 'not_found' | 'authorization'
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string) =>
  appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string) =>
  appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string) =>
  appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string) =>
  appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');
const actorPerson = (context: LifeApplicationContext): Result<NonNullable<LifeApplicationContext['actor']['personId']>, AppError> =>
  context.actor.personId ? ok(context.actor.personId) : err(denied(context, 'Çağrı merkezi kişi bağlı oturum gerektirir.'));
const revision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen çağrı sürümü geçersizdir.'));

export const communicationRealtimeCallingReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'communication_call_center', resourceId: '*', purpose: 'general'
});
export const communicationRealtimeCallingWriteIntent = (
  resourceType: CommunicationRealtimeCallingResourceType,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType, resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId
    ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const }
    : {})
});

export const communicationRealtimeCallingKey = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): CommunicationRealtimeCallingCenterKey => Object.freeze({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: ownerPersonId,
  ownerPersonId,
  centerId: communicationRealtimeCallingCenterId(context.familyId, ownerPersonId)
});
export const communicationCallSessionId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `communication-call-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;
const mutationId = (context: LifeApplicationContext, clientOperationId: string, fingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, fingerprint });
const participantId = (sessionId: string, personId: string): string =>
  `communication-call-participant-${hash({ sessionId, personId }).slice(0, 48)}`;

const sessionFingerprint = (row: Omit<CommunicationCallSessionRow, 'stateFingerprint'>): string => hash(row);
const preferencesFingerprint = (row: Omit<CommunicationCallPreferencesRow, 'stateFingerprint'>): string => hash(row);
const receipt = (row: CommunicationRealtimeCallingMutationRow, replayed: boolean): CommunicationRealtimeCallingMutationReceiptView =>
  Object.freeze({ resourceType: row.resourceType, resourceId: row.resourceId, mutationKind: row.mutationKind,
    previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt, replayed,
    mediaTransportStarted: false, networkUsed: false });
const replay = (
  context: LifeApplicationContext,
  row: CommunicationRealtimeCallingMutationRow | null,
  resourceType: CommunicationRealtimeCallingResourceType,
  resourceId: string,
  kind: CommunicationRealtimeCallingMutationKind,
  fingerprint: string,
  expectedRevision: number
): Result<CommunicationRealtimeCallingMutationReceiptView | null, AppError> => {
  if (!row) return ok(null);
  return row.resourceType === resourceType && row.resourceId === resourceId && row.mutationKind === kind
    && row.requestFingerprint === fingerprint && row.expectedRevision === expectedRevision
    ? ok(receipt(row, true))
    : err(conflict(context, 'Aynı clientOperationId farklı bir çağrı komutuna aittir.'));
};
const activeMember = (guard: CommunicationRealtimeCallingRoomGuardRow, personId: string): boolean =>
  guard.room.status === 'active' && guard.memberships.some((item) => item.memberPersonId === personId && item.status === 'active');
const callEvent = (
  row: CommunicationRealtimeCallingMutationRow,
  stateFingerprint: string
): CommunicationCallEventRow => Object.freeze({
  id: hash({ mutationId: row.id, event: row.mutationKind }), familyId: row.familyId, ownerPersonId: row.ownerPersonId,
  sessionId: row.resourceId, eventKind: row.mutationKind, sessionRevision: row.revision,
  stateFingerprint, mutationId: row.id, occurredAt: row.occurredAt
});
const finish = (
  context: LifeApplicationContext,
  scope: CommunicationRealtimeCallingWriteScope,
  row: CommunicationRealtimeCallingMutationRow,
  auditAction: string
): Result<CommunicationRealtimeCallingMutationReceiptView, AppError> => {
  const audit = scope.appendAudit({ id: hash({ audit: row.id }), action: auditAction,
    resourceType: row.resourceType, resourceId: row.resourceId, occurredAt: row.occurredAt, actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const queued = scope.enqueueEvent({ eventId: asEventId(hash({ outbox: row.id })), eventType: 'communication.calling.changed',
    eventVersion: 1, aggregateType: row.resourceType, aggregateId: row.resourceId, occurredAt: row.occurredAt,
    correlationId: context.correlationId, payload: Object.freeze({ mutationKind: row.mutationKind, revision: row.revision }) });
  return queued.ok ? ok(receipt(row, false)) : queued;
};

export const communicationCallSessionRowToView = (
  snapshot: CommunicationRealtimeCallingSessionSnapshotRow
): CommunicationCallSessionView => Object.freeze({
  id: snapshot.session.id, roomId: snapshot.session.roomId, topology: snapshot.session.topology,
  requestedMediaMode: snapshot.session.requestedMediaMode, state: snapshot.session.state,
  networkState: snapshot.session.networkState, waitingRoomEnabled: snapshot.session.waitingRoomEnabled,
  meetingLocked: snapshot.session.meetingLocked, audioOnly: snapshot.session.audioOnly,
  automaticAudioFallbackEnabled: snapshot.session.automaticAudioFallbackEnabled,
  backgroundEffect: snapshot.session.backgroundEffect, captionsRequested: snapshot.session.captionsRequested,
  realtimeTextRequested: snapshot.session.realtimeTextRequested, screenShareRequested: snapshot.session.screenShareRequested,
  localHandRaised: snapshot.session.localHandRaised,
  ...(snapshot.session.pinnedPersonId ? { pinnedPersonId: snapshot.session.pinnedPersonId } : {}),
  ...(snapshot.session.signLanguagePinnedPersonId ? { signLanguagePinnedPersonId: snapshot.session.signLanguagePinnedPersonId } : {}),
  preflight: Object.freeze({ microphone: snapshot.session.microphoneCheck, camera: snapshot.session.cameraCheck,
    speaker: snapshot.session.speakerCheck, noiseReductionRequested: snapshot.session.noiseReductionRequested,
    echoCancellationRequested: snapshot.session.echoCancellationRequested,
    automaticGainControlRequested: snapshot.session.automaticGainControlRequested,
    providerVerified: snapshot.session.preflightEvidenceSha256 !== undefined, networkUsed: false,
    ...(snapshot.session.preflightObservedAt ? { observedAt: snapshot.session.preflightObservedAt } : {}) }),
  participants: Object.freeze(snapshot.participants.map((row) => Object.freeze({ personId: row.personId, role: row.role,
    state: row.state, handRaised: row.handRaised, pinnedLocally: row.pinnedLocally,
    signLanguageSpeakerPinnedLocally: row.signLanguageSpeakerPinnedLocally,
    ...(row.reactionCode ? { reactionCode: row.reactionCode } : {}), revision: row.revision, updatedAt: row.updatedAt }))),
  revision: snapshot.session.revision, createdAt: snapshot.session.createdAt, updatedAt: snapshot.session.updatedAt,
  ...(snapshot.session.endedAt ? { endedAt: snapshot.session.endedAt } : {})
});

export const communicationCallPreferencesRowToView = (
  row: CommunicationCallPreferencesRow | null,
  generatedAt: CommunicationCallPreferencesView['updatedAt']
): CommunicationCallPreferencesView => row ? Object.freeze({
  simpleMode: row.simpleMode, ...(row.favoritePersonId ? { favoritePersonId: row.favoritePersonId } : {}),
  largePersonCards: row.largePersonCards, captionScalePercent: row.captionScalePercent,
  screenReaderAnnouncements: row.screenReaderAnnouncements, keyboardShortcuts: row.keyboardShortcuts,
  automaticAudioFallbackEnabled: row.automaticAudioFallbackEnabled,
  noiseReductionRequested: row.noiseReductionRequested, echoCancellationRequested: row.echoCancellationRequested,
  automaticGainControlRequested: row.automaticGainControlRequested, backgroundEffect: row.backgroundEffect,
  revision: row.revision, updatedAt: row.updatedAt
}) : Object.freeze({ simpleMode: false, largePersonCards: true, captionScalePercent: 125,
  screenReaderAnnouncements: true, keyboardShortcuts: true, automaticAudioFallbackEnabled: true,
  noiseReductionRequested: true, echoCancellationRequested: true, automaticGainControlRequested: true,
  backgroundEffect: 'off', revision: 0, updatedAt: generatedAt });

export class GetCommunicationRealtimeCallingCenterUseCase {
  public constructor(private readonly query: CommunicationRealtimeCallingQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}

export class CreateCommunicationCallUseCase {
  public constructor(private readonly unitOfWork: CommunicationRealtimeCallingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: CreateCommunicationCallInput) {
    const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.roomId)
      || !COMMUNICATION_CALL_TOPOLOGIES.includes(input.topology) || !COMMUNICATION_CALL_MEDIA_MODES.includes(input.requestedMediaMode)
      || input.expectedRevision !== 0 || !Array.isArray(input.invitedPersonIds))
      return Promise.resolve(err(invalid(context, 'Çağrı oluşturma girdisi geçersizdir.')));
    const invited = [...new Set(input.invitedPersonIds)].sort();
    if (invited.some((id) => !SAFE_ID.test(id) || id === person.value) || invited.length < 1 || invited.length > 15
      || (input.topology === 'direct_p2p' && invited.length !== 1) || (input.topology === 'family_group_sfu' && invited.length < 2))
      return Promise.resolve(err(invalid(context, 'Çağrı katılımcı listesi geçersizdir.')));
    const resourceId = communicationCallSessionId(context, input.clientOperationId);
    const requestFingerprint = hash({ ...input, invitedPersonIds: invited });
    return this.unitOfWork.execute(context,
      communicationRealtimeCallingWriteIntent('communication_call_session', resourceId, 'create', person.value), (scope) => {
        const foundMutation = scope.findMutation(input.clientOperationId); if (!foundMutation.ok) return foundMutation;
        const replayed = replay(context, foundMutation.value, 'communication_call_session', resourceId, 'call_create', requestFingerprint, 0);
        if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRealtimeCallingMutationReceiptView, AppError>;
        const guard = scope.findRoomGuard(input.roomId); if (!guard.ok) return guard;
        if (!guard.value || !activeMember(guard.value, person.value) || invited.some((id) => !activeMember(guard.value!, id)))
          return err(denied(context, 'Çağrı odası ve katılımcı üyelikleri doğrulanamadı.'));
        if ((input.topology === 'direct_p2p') !== (guard.value.room.roomType === 'direct'))
          return err(conflict(context, 'Çağrı topolojisi oda türüyle eşleşmiyor.'));
        const mutation = mutationId(context, input.clientOperationId, requestFingerprint);
        const base: Omit<CommunicationCallSessionRow, 'stateFingerprint'> = Object.freeze({
          id: resourceId, familyId: context.familyId, ownerPersonId: scope.ownerPersonId, roomId: input.roomId,
          topology: input.topology, requestedMediaMode: input.requestedMediaMode, state: 'planned', networkState: 'not_started',
          waitingRoomEnabled: input.waitingRoomEnabled, meetingLocked: false, audioOnly: input.requestedMediaMode === 'audio',
          automaticAudioFallbackEnabled: input.automaticAudioFallbackEnabled, backgroundEffect: 'off', captionsRequested: false,
          realtimeTextRequested: false, screenShareRequested: false, localHandRaised: false,
          microphoneCheck: 'not_run', cameraCheck: 'not_run', speakerCheck: 'not_run', noiseReductionRequested: true,
          echoCancellationRequested: true, automaticGainControlRequested: true, revision: 1, lastMutationId: mutation,
          createdAt: scope.occurredAt, updatedAt: scope.occurredAt
        });
        const row: CommunicationCallSessionRow = Object.freeze({ ...base, stateFingerprint: sessionFingerprint(base) });
        const mutationRow: CommunicationRealtimeCallingMutationRow = Object.freeze({ id: mutation, familyId: context.familyId,
          ownerPersonId: scope.ownerPersonId, resourceType: 'communication_call_session', resourceId,
          actorAccountId: context.actor.userId, actorPersonId: person.value, mutationKind: 'call_create',
          clientOperationId: input.clientOperationId, requestFingerprint, expectedRevision: 0, revision: 1,
          resourceStateFingerprint: row.stateFingerprint, occurredAt: scope.occurredAt });
        const participants: readonly CommunicationCallParticipantRow[] = Object.freeze([person.value, ...invited].map((personId) => Object.freeze({
          id: participantId(resourceId, personId), familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
          sessionId: resourceId, personId: asPersonId(personId), role: personId === person.value ? 'host' as const : 'participant' as const,
          state: personId === person.value ? 'local_ready' as const : 'invited' as const, handRaised: false,
          pinnedLocally: false, signLanguageSpeakerPinnedLocally: false, revision: 1,
          createdAt: scope.occurredAt, updatedAt: scope.occurredAt
        })));
        for (const result of [scope.insertMutation(mutationRow), scope.insertSession(row), scope.insertParticipants(participants),
          scope.appendEvent(callEvent(mutationRow, row.stateFingerprint))]) if (!result.ok) return result;
        return finish(context, scope, mutationRow, 'communication.call.create');
      });
  }
}

export class RunCommunicationCallPreflightUseCase {
  public constructor(
    private readonly unitOfWork: CommunicationRealtimeCallingUnitOfWork,
    private readonly preflight: CommunicationCallPreflightPort
  ) {}
  public async execute(context: LifeApplicationContext, input: RunCommunicationCallPreflightInput) {
    const person = actorPerson(context); if (!person.ok) return person;
    const expected = revision(context, input.expectedRevision); if (!expected.ok) return expected;
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.sessionId)) return err(invalid(context, 'Preflight girdisi geçersizdir.'));
    const evidence = await this.preflight.run(context, Object.freeze({ sessionId: input.sessionId }));
    if (!evidence.ok) return evidence;
    if (evidence.value.sessionId !== input.sessionId || evidence.value.providerVerified !== true || evidence.value.networkUsed !== false
      || !SAFE_ID.test(evidence.value.providerId) || !SHA256.test(evidence.value.providerEvidenceSha256) || !validIso(evidence.value.observedAt))
      return err(denied(context, 'Preflight kanıtı güvenilir değildir.'));
    const requestFingerprint = hash({ input, evidence: evidence.value });
    return this.unitOfWork.execute(context,
      communicationRealtimeCallingWriteIntent('communication_call_session', input.sessionId, 'update'), (scope) => {
        const foundMutation = scope.findMutation(input.clientOperationId); if (!foundMutation.ok) return foundMutation;
        const replayed = replay(context, foundMutation.value, 'communication_call_session', input.sessionId,
          'call_preflight_update', requestFingerprint, expected.value);
        if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRealtimeCallingMutationReceiptView, AppError>;
        const found = scope.findSession(input.sessionId); if (!found.ok) return found;
        if (!found.value) return err(missing(context, 'Çağrı oturumu bulunamadı.'));
        const current = found.value.session;
        if (current.revision !== expected.value || !['planned', 'preflight_ready'].includes(current.state))
          return err(conflict(context, 'Çağrı preflight sürümü veya durumu uyuşmuyor.'));
        const cameraAccepted = current.requestedMediaMode === 'audio' || evidence.value.camera === 'passed';
        const ready = evidence.value.microphone === 'passed' && evidence.value.speaker === 'passed' && cameraAccepted;
        const mutation = mutationId(context, input.clientOperationId, requestFingerprint);
        const base: Omit<CommunicationCallSessionRow, 'stateFingerprint'> = Object.freeze({ ...current,
          state: ready ? 'preflight_ready' as const : 'planned' as const, microphoneCheck: evidence.value.microphone,
          cameraCheck: evidence.value.camera, speakerCheck: evidence.value.speaker, preflightProviderId: evidence.value.providerId,
          preflightEvidenceSha256: evidence.value.providerEvidenceSha256, preflightObservedAt: asIsoDateTime(evidence.value.observedAt),
          revision: current.revision + 1, lastMutationId: mutation, updatedAt: scope.occurredAt });
        const next: CommunicationCallSessionRow = Object.freeze({ ...base, stateFingerprint: sessionFingerprint(base) });
        const mutationRow: CommunicationRealtimeCallingMutationRow = Object.freeze({ id: mutation, familyId: context.familyId,
          ownerPersonId: scope.ownerPersonId, resourceType: 'communication_call_session', resourceId: input.sessionId,
          actorAccountId: context.actor.userId, actorPersonId: person.value, mutationKind: 'call_preflight_update',
          clientOperationId: input.clientOperationId, requestFingerprint, expectedRevision: expected.value,
          revision: next.revision, resourceStateFingerprint: next.stateFingerprint, occurredAt: scope.occurredAt });
        for (const result of [scope.insertMutation(mutationRow), scope.saveSession(next, expected.value),
          scope.appendEvent(callEvent(mutationRow, next.stateFingerprint))]) if (!result.ok) return result;
        return finish(context, scope, mutationRow, 'communication.call.preflight');
      });
  }
}

abstract class CommunicationCallSessionMutationUseCase<TInput extends { clientOperationId: string; expectedRevision: number; sessionId: string }> {
  protected constructor(private readonly unitOfWork: CommunicationRealtimeCallingUnitOfWork) {}
  protected executeMutation(
    context: LifeApplicationContext,
    input: TInput,
    kind: CommunicationRealtimeCallingMutationKind,
    action: 'update' | 'delete',
    auditAction: string,
    mutate: (current: CommunicationRealtimeCallingSessionSnapshotRow, scope: CommunicationRealtimeCallingWriteScope) =>
      Result<Omit<CommunicationCallSessionRow, 'stateFingerprint' | 'lastMutationId' | 'revision' | 'updatedAt'>, AppError>
  ) {
    const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
    const expected = revision(context, input.expectedRevision); if (!expected.ok) return Promise.resolve(expected);
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.sessionId)) return Promise.resolve(err(invalid(context, 'Çağrı komutu geçersizdir.')));
    const requestFingerprint = hash(input);
    return this.unitOfWork.execute(context, communicationRealtimeCallingWriteIntent('communication_call_session', input.sessionId, action), (scope) => {
      const foundMutation = scope.findMutation(input.clientOperationId); if (!foundMutation.ok) return foundMutation;
      const replayed = replay(context, foundMutation.value, 'communication_call_session', input.sessionId, kind, requestFingerprint, expected.value);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRealtimeCallingMutationReceiptView, AppError>;
      const found = scope.findSession(input.sessionId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Çağrı oturumu bulunamadı.'));
      if (found.value.session.revision !== expected.value) return err(conflict(context, 'Çağrı oturumu sürümü uyuşmuyor.'));
      const changed = mutate(found.value, scope); if (!changed.ok) return changed;
      const mutation = mutationId(context, input.clientOperationId, requestFingerprint);
      const base: Omit<CommunicationCallSessionRow, 'stateFingerprint'> = Object.freeze({ ...changed.value,
        revision: expected.value + 1, lastMutationId: mutation, updatedAt: scope.occurredAt });
      const next: CommunicationCallSessionRow = Object.freeze({ ...base, stateFingerprint: sessionFingerprint(base) });
      const mutationRow: CommunicationRealtimeCallingMutationRow = Object.freeze({ id: mutation, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, resourceType: 'communication_call_session', resourceId: input.sessionId,
        actorAccountId: context.actor.userId, actorPersonId: person.value, mutationKind: kind,
        clientOperationId: input.clientOperationId, requestFingerprint, expectedRevision: expected.value,
        revision: next.revision, resourceStateFingerprint: next.stateFingerprint, occurredAt: scope.occurredAt });
      for (const result of [scope.insertMutation(mutationRow), scope.saveSession(next, expected.value),
        scope.appendEvent(callEvent(mutationRow, next.stateFingerprint))]) if (!result.ok) return result;
      return finish(context, scope, mutationRow, auditAction);
    });
  }
}

export class UpdateCommunicationCallControlsUseCase extends CommunicationCallSessionMutationUseCase<UpdateCommunicationCallControlsInput> {
  public constructor(unitOfWork: CommunicationRealtimeCallingUnitOfWork) { super(unitOfWork); }
  public execute(context: LifeApplicationContext, input: UpdateCommunicationCallControlsInput) {
    if (input.backgroundEffect && !['off', 'blur', 'virtual_background'].includes(input.backgroundEffect))
      return Promise.resolve(err(invalid(context, 'Arka plan tercihi geçersizdir.')));
    if (input.reactionCode !== undefined && !normalizedText(input.reactionCode, 1, 32))
      return Promise.resolve(err(invalid(context, 'Tepki kodu geçersizdir.')));
    for (const optionalId of [input.pinnedPersonId, input.signLanguagePinnedPersonId])
      if (optionalId !== undefined && !SAFE_ID.test(optionalId)) return Promise.resolve(err(invalid(context, 'Sabitlenen kişi kimliği geçersizdir.')));
    return this.executeMutation(context, input, 'call_controls_update', 'update', 'communication.call.controls', (current) => {
      if (['ended', 'cancelled'].includes(current.session.state)) return err(conflict(context, 'Sona ermiş çağrı denetimleri değiştirilemez.'));
      const activeIds = new Set(current.participants.filter((row) => row.state !== 'left').map((row) => row.personId));
      if ((input.pinnedPersonId && !activeIds.has(asPersonId(input.pinnedPersonId)))
        || (input.signLanguagePinnedPersonId && !activeIds.has(asPersonId(input.signLanguagePinnedPersonId))))
        return err(denied(context, 'Sabitlenen kişi çağrı katılımcısı değildir.'));
      return ok(Object.freeze({ ...current.session,
        ...(input.audioOnly === undefined ? {} : { audioOnly: input.audioOnly }),
        ...(input.meetingLocked === undefined ? {} : { meetingLocked: input.meetingLocked }),
        ...(input.backgroundEffect === undefined ? {} : { backgroundEffect: input.backgroundEffect }),
        ...(input.captionsRequested === undefined ? {} : { captionsRequested: input.captionsRequested }),
        ...(input.realtimeTextRequested === undefined ? {} : { realtimeTextRequested: input.realtimeTextRequested }),
        ...(input.screenShareRequested === undefined ? {} : { screenShareRequested: input.screenShareRequested }),
        ...(input.localHandRaised === undefined ? {} : { localHandRaised: input.localHandRaised }),
        ...(input.pinnedPersonId === undefined ? {} : { pinnedPersonId: asPersonId(input.pinnedPersonId) }),
        ...(input.signLanguagePinnedPersonId === undefined ? {} : { signLanguagePinnedPersonId: asPersonId(input.signLanguagePinnedPersonId) }),
        ...(input.reactionCode === undefined ? {} : { reactionCode: normalizedText(input.reactionCode, 1, 32)! })
      }));
    });
  }
}

export class AdvanceCommunicationCallUseCase extends CommunicationCallSessionMutationUseCase<AdvanceCommunicationCallInput> {
  public constructor(unitOfWork: CommunicationRealtimeCallingUnitOfWork) { super(unitOfWork); }
  public execute(context: LifeApplicationContext, input: AdvanceCommunicationCallInput) {
    const reason = normalizedText(input.reason, 3, 500);
    if (!reason || !['enter_local_waiting_room', 'end', 'cancel'].includes(input.action))
      return Promise.resolve(err(invalid(context, 'Çağrı yaşam döngüsü komutu geçersizdir.')));
    return this.executeMutation(context, input, 'call_lifecycle_update', input.action === 'cancel' ? 'delete' : 'update',
      `communication.call.${input.action}`, (current, scope) => {
        const state = current.session.state;
        if (input.action === 'enter_local_waiting_room') {
          if (state !== 'preflight_ready') return err(conflict(context, 'Yerel bekleme alanı için başarılı preflight gerekir.'));
          return ok(Object.freeze({ ...current.session, state: 'waiting_local' as const, networkState: 'local_waiting_only' as const }));
        }
        if (['ended', 'cancelled'].includes(state)) return err(conflict(context, 'Çağrı zaten sona ermiştir.'));
        return ok(Object.freeze({ ...current.session, state: input.action === 'end' ? 'ended' as const : 'cancelled' as const,
          networkState: 'ended' as const, endedAt: scope.occurredAt }));
      });
  }
}

export class SetCommunicationCallPreferencesUseCase {
  public constructor(private readonly unitOfWork: CommunicationRealtimeCallingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: SetCommunicationCallPreferencesInput) {
    const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
    const expected = revision(context, input.expectedRevision, true); if (!expected.ok) return Promise.resolve(expected);
    if (!SAFE_ID.test(input.clientOperationId) || (input.favoritePersonId !== undefined && !SAFE_ID.test(input.favoritePersonId))
      || !Number.isSafeInteger(input.captionScalePercent) || input.captionScalePercent < 100 || input.captionScalePercent > 300
      || !['off', 'blur', 'virtual_background'].includes(input.backgroundEffect))
      return Promise.resolve(err(invalid(context, 'Erişilebilir çağrı tercihleri geçersizdir.')));
    const resourceId = communicationCallPreferencesId(person.value);
    const requestFingerprint = hash(input);
    return this.unitOfWork.execute(context,
      communicationRealtimeCallingWriteIntent('communication_call_preferences', resourceId, expected.value === 0 ? 'create' : 'update', person.value), (scope) => {
        const foundMutation = scope.findMutation(input.clientOperationId); if (!foundMutation.ok) return foundMutation;
        const replayed = replay(context, foundMutation.value, 'communication_call_preferences', resourceId,
          'call_preferences_update', requestFingerprint, expected.value);
        if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRealtimeCallingMutationReceiptView, AppError>;
        const found = scope.findPreferences(); if (!found.ok) return found;
        if ((found.value?.revision ?? 0) !== expected.value) return err(conflict(context, 'Çağrı tercih sürümü uyuşmuyor.'));
        const mutation = mutationId(context, input.clientOperationId, requestFingerprint);
        const base: Omit<CommunicationCallPreferencesRow, 'stateFingerprint'> = Object.freeze({
          id: resourceId, familyId: context.familyId, ownerPersonId: scope.ownerPersonId, simpleMode: input.simpleMode,
          ...(input.favoritePersonId ? { favoritePersonId: asPersonId(input.favoritePersonId) } : {}),
          largePersonCards: input.largePersonCards, captionScalePercent: input.captionScalePercent,
          screenReaderAnnouncements: input.screenReaderAnnouncements, keyboardShortcuts: input.keyboardShortcuts,
          automaticAudioFallbackEnabled: input.automaticAudioFallbackEnabled,
          noiseReductionRequested: input.noiseReductionRequested, echoCancellationRequested: input.echoCancellationRequested,
          automaticGainControlRequested: input.automaticGainControlRequested, backgroundEffect: input.backgroundEffect,
          revision: expected.value + 1, lastMutationId: mutation, createdAt: found.value?.createdAt ?? scope.occurredAt,
          updatedAt: scope.occurredAt
        });
        const row: CommunicationCallPreferencesRow = Object.freeze({ ...base, stateFingerprint: preferencesFingerprint(base) });
        const mutationRow: CommunicationRealtimeCallingMutationRow = Object.freeze({ id: mutation, familyId: context.familyId,
          ownerPersonId: scope.ownerPersonId, resourceType: 'communication_call_preferences', resourceId,
          actorAccountId: context.actor.userId, actorPersonId: person.value, mutationKind: 'call_preferences_update',
          clientOperationId: input.clientOperationId, requestFingerprint, expectedRevision: expected.value,
          revision: row.revision, resourceStateFingerprint: row.stateFingerprint, occurredAt: scope.occurredAt });
        for (const result of [scope.insertMutation(mutationRow), scope.savePreferences(row, expected.value)]) if (!result.ok) return result;
        return finish(context, scope, mutationRow, 'communication.call.preferences');
      });
  }
}

export class RecordCommunicationCallQualityObservationUseCase {
  public constructor(private readonly unitOfWork: CommunicationRealtimeCallingUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: RecordCommunicationCallQualityInput) {
    const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
    const expected = revision(context, input.expectedRevision); if (!expected.ok) return Promise.resolve(expected);
    const observation = input.verifiedObservation;
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.sessionId)
      || observation.sessionId !== input.sessionId || observation.providerVerified !== true || !SAFE_ID.test(observation.providerId)
      || !SHA256.test(observation.providerEvidenceSha256) || !validIso(observation.observedAt)
      || !Number.isSafeInteger(observation.roundTripMs) || observation.roundTripMs < 0 || observation.roundTripMs > 60_000
      || !Number.isSafeInteger(observation.packetLossPermille) || observation.packetLossPermille < 0 || observation.packetLossPermille > 1_000
      || !Number.isSafeInteger(observation.jitterMs) || observation.jitterMs < 0 || observation.jitterMs > 60_000
      || !Number.isSafeInteger(observation.uplinkKbps) || observation.uplinkKbps < 0 || observation.uplinkKbps > 10_000_000
      || !Number.isSafeInteger(observation.downlinkKbps) || observation.downlinkKbps < 0 || observation.downlinkKbps > 10_000_000)
      return Promise.resolve(err(invalid(context, 'Çağrı kalite kanıtı geçersizdir.')));
    const requestFingerprint = hash(input);
    return this.unitOfWork.execute(context,
      communicationRealtimeCallingWriteIntent('communication_call_session', input.sessionId, 'update'), (scope) => {
      const foundMutation = scope.findMutation(input.clientOperationId); if (!foundMutation.ok) return foundMutation;
      const replayed = replay(context, foundMutation.value, 'communication_call_session', input.sessionId,
        'call_quality_observation', requestFingerprint, expected.value);
      if (!replayed.ok || replayed.value) return replayed as Result<CommunicationRealtimeCallingMutationReceiptView, AppError>;
      const found = scope.findSession(input.sessionId); if (!found.ok) return found;
      if (!found.value) return err(missing(context, 'Çağrı oturumu bulunamadı.'));
      if (found.value.session.revision !== expected.value || ['ended', 'cancelled'].includes(found.value.session.state))
        return err(conflict(context, 'Çağrı kalite gözlemi sürümü veya durumu uyuşmuyor.'));
      const mutation = mutationId(context, input.clientOperationId, requestFingerprint);
      const base: Omit<CommunicationCallSessionRow, 'stateFingerprint'> = Object.freeze({ ...found.value.session,
        revision: expected.value + 1, lastMutationId: mutation, updatedAt: scope.occurredAt });
      const next: CommunicationCallSessionRow = Object.freeze({ ...base, stateFingerprint: sessionFingerprint(base) });
      const mutationRow: CommunicationRealtimeCallingMutationRow = Object.freeze({ id: mutation, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, resourceType: 'communication_call_session', resourceId: input.sessionId,
        actorAccountId: context.actor.userId, actorPersonId: person.value, mutationKind: 'call_quality_observation',
        clientOperationId: input.clientOperationId, requestFingerprint, expectedRevision: expected.value,
        revision: next.revision, resourceStateFingerprint: next.stateFingerprint, occurredAt: scope.occurredAt });
      const quality: CommunicationCallQualityObservationRow = Object.freeze({ id: hash({ mutation, quality: observation.observedAt }),
        familyId: context.familyId, ownerPersonId: scope.ownerPersonId, sessionId: input.sessionId,
        roundTripMs: observation.roundTripMs, packetLossPermille: observation.packetLossPermille,
        jitterMs: observation.jitterMs, uplinkKbps: observation.uplinkKbps, downlinkKbps: observation.downlinkKbps,
        providerId: observation.providerId, providerEvidenceSha256: observation.providerEvidenceSha256,
        mutationId: mutation, observedAt: asIsoDateTime(observation.observedAt) });
      for (const result of [scope.insertMutation(mutationRow), scope.saveSession(next, expected.value),
        scope.appendQualityObservation(quality), scope.appendEvent(callEvent(mutationRow, next.stateFingerprint))]) if (!result.ok) return result;
      return finish(context, scope, mutationRow, 'communication.call.quality');
    });
  }
}
