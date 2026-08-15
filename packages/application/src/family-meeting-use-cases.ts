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
import type {
  AddFamilyMeetingCollaborationInput,
  CastFamilyMeetingVoteInput,
  CreateFamilyMeetingInput,
  CreateFamilyMeetingPollInput,
  FamilyMeetingCenterView,
  FamilyMeetingMinutesContentView,
  FamilyMeetingMutationKind,
  FamilyMeetingMutationReceiptView,
  FamilyMeetingRole,
  FamilyMeetingView,
  FinalizeFamilyMeetingMinutesInput,
  PrepareFamilyMeetingAiMinutesInput,
  RecordFamilyMeetingDecisionInput,
  SetFamilyMeetingStateInput,
  UpdateFamilyMeetingPlanInput,
  UpsertFamilyMeetingAgendaItemInput,
  UpsertFamilyMeetingParticipantInput,
  UpsertFamilyMeetingTaskInput
} from '@ppt/domain';
import { familyMeetingCenterId, familyMeetingTruth } from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  FamilyMeetingAgendaItemRow,
  FamilyMeetingCenterKey,
  FamilyMeetingCenterSnapshotRow,
  FamilyMeetingCollaborationRow,
  FamilyMeetingDecisionRow,
  FamilyMeetingEventRow,
  FamilyMeetingMinutesRow,
  FamilyMeetingMutationRow,
  FamilyMeetingParticipantRow,
  FamilyMeetingPollRow,
  FamilyMeetingSnapshotRow,
  FamilyMeetingTaskRow,
  FamilyMeetingVoteRow,
  RepositoryResult
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface VerifiedSealedFamilyMeetingMinutesInput {
  readonly sealedPayloadReference: string;
  readonly payloadSha256: string;
  readonly payloadSizeBytes: number;
  readonly providerId: 'protected-side-artifact-store-v1';
  readonly providerEvidenceSha256: string;
  readonly payloadRevision: number;
  readonly payloadCreatedAt: FamilyMeetingMinutesRow['createdAt'];
}

export interface FamilyMeetingMinutesArtifactPort {
  seal(input: {
    readonly familyId: FamilyMeetingMinutesRow['familyId'];
    readonly ownerPersonId: FamilyMeetingMinutesRow['ownerPersonId'];
    readonly meetingId: string;
    readonly minutesRevision: number;
    readonly summary: string;
    readonly decisions: readonly string[];
    readonly tasks: readonly string[];
    readonly participantAccessPersonIds: readonly string[];
    readonly selectedRecordingSegmentIds: readonly string[];
    readonly machineGeneratedSource: boolean;
    readonly humanApproved: boolean;
    readonly occurredAt: FamilyMeetingMinutesRow['createdAt'];
    readonly correlationId: LifeApplicationContext['correlationId'];
  }): Result<VerifiedSealedFamilyMeetingMinutesInput, AppError>;
  open(
    row: FamilyMeetingMinutesRow,
    actorPersonId: string,
    correlationId: LifeApplicationContext['correlationId']
  ): Result<FamilyMeetingMinutesContentView, AppError>;
  discard(reference: string, correlationId: LifeApplicationContext['correlationId']): Result<void, AppError>;
}

export interface FamilyMeetingRecordingConsentEvidence {
  readonly verified: boolean;
  readonly evidenceSha256?: string;
}

export interface FamilyMeetingRecordingConsentPort {
  verify(
    context: LifeApplicationContext,
    recordingRequestId: string
  ): Promise<Result<FamilyMeetingRecordingConsentEvidence, AppError>>;
}

export interface FamilyMeetingAiMinutesProviderPort {
  readonly configured: boolean;
  generate(input: {
    readonly meetingId: string;
    readonly recordingRequestId: string;
    readonly correlationId: LifeApplicationContext['correlationId'];
  }): Result<{
    readonly summary: string;
    readonly decisions: readonly string[];
    readonly tasks: readonly string[];
  }, AppError>;
}

export const unavailableFamilyMeetingAiMinutesProvider: FamilyMeetingAiMinutesProviderPort = Object.freeze({
  configured: false,
  generate(input: Parameters<FamilyMeetingAiMinutesProviderPort['generate']>[0]) {
    return err(createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Üretim AI toplantı tutanağı sağlayıcısı yapılandırılmamıştır.',
      category: 'security',
      correlationId: input.correlationId
    }));
  }
});

export interface FamilyMeetingQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<FamilyMeetingCenterView, AppError>>;
  getMinutes(context: LifeApplicationContext, meetingId: string): Promise<Result<FamilyMeetingMinutesContentView, AppError>>;
}

export interface FamilyMeetingWriteScope {
  readonly ownerPersonId: FamilyMeetingCenterKey['ownerPersonId'];
  readonly actorPersonId: FamilyMeetingCenterKey['actorPersonId'];
  readonly occurredAt: FamilyMeetingMinutesRow['createdAt'];
  findPerson(personId: string): RepositoryResult<{ readonly id: string; readonly familyId: string; readonly status: string } | null>;
  findMeeting(meetingId: string): RepositoryResult<FamilyMeetingSnapshotRow | null>;
  findMutation(clientOperationId: string): RepositoryResult<FamilyMeetingMutationRow | null>;
  insertMutation(row: FamilyMeetingMutationRow): RepositoryResult<void>;
  insertMeeting(row: FamilyMeetingSnapshotRow['meeting']): RepositoryResult<void>;
  saveMeeting(row: FamilyMeetingSnapshotRow['meeting'], expectedRevision: number): RepositoryResult<void>;
  upsertParticipant(row: FamilyMeetingParticipantRow, expectedRevision: number): RepositoryResult<void>;
  upsertAgendaItem(row: FamilyMeetingAgendaItemRow, expectedRevision: number): RepositoryResult<void>;
  insertPoll(row: FamilyMeetingPollRow): RepositoryResult<void>;
  insertVote(row: FamilyMeetingVoteRow): RepositoryResult<void>;
  insertDecision(row: FamilyMeetingDecisionRow): RepositoryResult<void>;
  upsertTask(row: FamilyMeetingTaskRow, expectedRevision: number): RepositoryResult<void>;
  insertCollaboration(row: FamilyMeetingCollaborationRow): RepositoryResult<void>;
  upsertMinutes(row: FamilyMeetingMinutesRow, expectedRevision: number): RepositoryResult<void>;
  appendEvent(row: FamilyMeetingEventRow): RepositoryResult<void>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: FamilyMeetingMinutesRow['createdAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): RepositoryResult<string>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface FamilyMeetingUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: FamilyMeetingWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@-]{1,255}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const MEETING_ROLES = Object.freeze<readonly FamilyMeetingRole[]>(
  ['host','facilitator','note_taker','translator','caregiver','attendee']
);
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const normalizedText = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim();
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized) ? normalized : null;
};
const canonicalStrings = (values: readonly string[], maximum: number): readonly string[] | null => {
  if (!Array.isArray(values) || values.length > maximum) return null;
  const normalized = values.map((value) => normalizedText(value, 2, 256));
  if (normalized.some((value) => value === null)) return null;
  const unique = [...new Set(normalized as string[])].sort();
  return unique.length === values.length ? Object.freeze(unique) : null;
};
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value));
const appError = (
  context: LifeApplicationContext,
  code: AppError['code'],
  message: string,
  category: AppError['category']
): AppError => createAppError({ code, message, category, correlationId: context.correlationId });
const invalid = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.CORE_INVALID_ARGUMENT, message, 'validation');
const conflict = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.RESOURCE_CONFLICT, message, 'conflict');
const missing = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.RESOURCE_NOT_FOUND, message, 'not_found');
const denied = (context: LifeApplicationContext, message: string) => appError(context, ERROR_CODES.AUTHORIZATION_DENIED, message, 'authorization');
const actorPerson = (context: LifeApplicationContext): Result<string, AppError> => context.actor.personId
  ? ok(context.actor.personId) : err(denied(context, 'Aile toplantısı kişi bağlı oturum gerektirir.'));
const revision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen toplantı sürümü geçersizdir.'));
const deterministicId = (prefix: string, context: LifeApplicationContext, clientOperationId: string): string =>
  `${prefix}-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;
const mutationId = (context: LifeApplicationContext, clientOperationId: string, fingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, fingerprint });
const participantId = (meetingId: string, personId: string): string => `meeting-participant-${hash({ meetingId, personId }).slice(0, 40)}`;

export const familyMeetingReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'family_meeting_center', resourceId: '*', purpose: 'general'
});
export const familyMeetingWriteIntent = (
  meetingId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action,
  capability: 'family.write',
  resourceType: 'family_meeting',
  resourceId: meetingId,
  purpose: 'general',
  ...(action === 'create' && ownerPersonId
    ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'family' as const }
    : {})
});
export const familyMeetingKey = (context: LifeApplicationContext, ownerPersonId: string): FamilyMeetingCenterKey => ({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: asPersonId(context.actor.personId!),
  ownerPersonId: asPersonId(ownerPersonId),
  centerId: familyMeetingCenterId(context.familyId, context.actor.personId!)
});

const meetingFingerprint = (row: Omit<FamilyMeetingSnapshotRow['meeting'], 'stateFingerprint'>): string => hash(row);
const minutesFingerprint = (row: Omit<FamilyMeetingMinutesRow, 'stateFingerprint'>): string => hash(row);
const receipt = (
  row: FamilyMeetingMutationRow,
  replayed: boolean,
  encryptedMinutesPackageWritten: boolean
): FamilyMeetingMutationReceiptView => Object.freeze({
  resourceType: 'family_meeting', resourceId: row.resourceId, mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt,
  replayed, encryptedMinutesPackageWritten, aiProviderConfigured: false, networkUsed: false, cloudUsed: false
});
const replay = (
  context: LifeApplicationContext,
  found: FamilyMeetingMutationRow | null,
  meetingId: string,
  kind: FamilyMeetingMutationKind,
  requestFingerprint: string,
  expectedRevision: number,
  encryptedMinutesPackageWritten = false
): Result<FamilyMeetingMutationReceiptView | null, AppError> => {
  if (!found) return ok(null);
  return found.resourceId === meetingId && found.mutationKind === kind
    && found.requestFingerprint === requestFingerprint && found.expectedRevision === expectedRevision
    ? ok(receipt(found, true, encryptedMinutesPackageWritten))
    : err(conflict(context, 'Aynı clientOperationId farklı bir toplantı komutuna aittir.'));
};
const event = (row: FamilyMeetingMutationRow): FamilyMeetingEventRow => Object.freeze({
  id: hash({ mutationId: row.id, event: 'family-meeting' }), familyId: row.familyId,
  ownerPersonId: row.ownerPersonId, meetingId: row.resourceId, eventKind: row.mutationKind,
  meetingRevision: row.revision, stateFingerprint: row.resourceStateFingerprint,
  mutationId: row.id, occurredAt: row.occurredAt
});
const finish = (
  context: LifeApplicationContext,
  scope: FamilyMeetingWriteScope,
  row: FamilyMeetingMutationRow,
  encryptedMinutesPackageWritten = false
): Result<FamilyMeetingMutationReceiptView, AppError> => {
  const audit = scope.appendAudit({ id: hash({ audit: row.id }), action: `family.meeting.${row.mutationKind}`,
    resourceType: row.resourceType, resourceId: row.resourceId, occurredAt: row.occurredAt,
    actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const queued = scope.enqueueEvent({ eventId: asEventId(hash({ event: row.id })), eventType: 'family.meeting.changed',
    eventVersion: 1, aggregateType: row.resourceType, aggregateId: row.resourceId,
    occurredAt: row.occurredAt, correlationId: context.correlationId,
    payload: Object.freeze({ mutationKind: row.mutationKind, revision: row.revision }) });
  return queued.ok ? ok(receipt(row, false, encryptedMinutesPackageWritten)) : queued;
};

const minutesMetadata = (snapshot: FamilyMeetingSnapshotRow): FamilyMeetingView['minutes'] => snapshot.minutes
  ? Object.freeze({ id: snapshot.minutes.id, state: snapshot.minutes.state,
      ...(snapshot.minutes.recordingRequestId ? { recordingRequestId: snapshot.minutes.recordingRequestId } : {}),
      transcriptConsentVerified: snapshot.minutes.transcriptConsentVerified,
      aiSuggestionGenerated: snapshot.minutes.aiSuggestionGenerated,
      humanApprovalRecorded: snapshot.minutes.humanApprovalRecorded,
      encryptedPackageAvailable: snapshot.minutes.state === 'sealed_local' && snapshot.minutes.sealedPayloadReference !== undefined,
      participantAccessPersonIds: snapshot.minutes.participantAccessPersonIds,
      selectedRecordingSegmentIds: snapshot.minutes.selectedRecordingSegmentIds,
      revision: snapshot.minutes.revision, updatedAt: snapshot.minutes.updatedAt, networkUsed: false, cloudUsed: false })
  : Object.freeze({ id: `${snapshot.meeting.id}:minutes`, state: 'not_prepared' as const,
      transcriptConsentVerified: false, aiSuggestionGenerated: false, humanApprovalRecorded: false,
      encryptedPackageAvailable: false, participantAccessPersonIds: Object.freeze([]),
      selectedRecordingSegmentIds: Object.freeze([]), revision: 0, updatedAt: snapshot.meeting.updatedAt,
      networkUsed: false as const, cloudUsed: false as const });

export const familyMeetingSnapshotToView = (snapshot: FamilyMeetingSnapshotRow): FamilyMeetingView => Object.freeze({
  id: snapshot.meeting.id, ownerPersonId: snapshot.meeting.ownerPersonId, title: snapshot.meeting.title,
  recurrenceKind: snapshot.meeting.recurrenceKind, recurrenceInterval: snapshot.meeting.recurrenceInterval,
  startsAt: snapshot.meeting.startsAt, endsAt: snapshot.meeting.endsAt,
  reminderMinutes: snapshot.meeting.reminderMinutes, state: snapshot.meeting.state,
  participants: Object.freeze(snapshot.participants.map((item) => Object.freeze({ personId: item.participantPersonId,
    roles: item.roles, attendance: item.attendance, reminderEnabled: item.reminderEnabled,
    revision: item.revision, updatedAt: item.updatedAt }))),
  agenda: Object.freeze(snapshot.agenda.map((item) => Object.freeze({ id: item.id, title: item.title,
    ...(item.note ? { note: item.note } : {}), order: item.order, preRead: item.preRead,
    carryForwardToNextMeeting: item.carryForwardToNextMeeting, revision: item.revision, updatedAt: item.updatedAt }))),
  polls: Object.freeze(snapshot.polls.map((poll) => Object.freeze({ id: poll.id, question: poll.question,
    options: poll.options, state: poll.state, createdAt: poll.createdAt,
    votes: Object.freeze(snapshot.votes.filter((vote) => vote.pollId === poll.id).map((vote) => Object.freeze({
      voterPersonId: vote.voterPersonId, ...(vote.optionId ? { optionId: vote.optionId } : {}),
      abstained: vote.abstained, ...(vote.opinionNote ? { opinionNote: vote.opinionNote } : {}), castAt: vote.castAt
    }))) }))),
  decisions: Object.freeze(snapshot.decisions.map((item) => Object.freeze({ id: item.id, statement: item.statement,
    ...(item.sourcePollId ? { sourcePollId: item.sourcePollId } : {}), responsiblePersonIds: item.responsiblePersonIds,
    ledgerReference: item.ledgerReference, recordedAt: item.recordedAt }))),
  tasks: Object.freeze(snapshot.tasks.map((item) => Object.freeze({ id: item.id,
    ...(item.decisionId ? { decisionId: item.decisionId } : {}), title: item.title,
    responsiblePersonId: item.responsiblePersonId, dueAt: item.dueAt, state: item.state,
    ...(item.followUpNote ? { followUpNote: item.followUpNote } : {}),
    carryForwardToNextMeeting: item.carryForwardToNextMeeting, revision: item.revision, updatedAt: item.updatedAt }))),
  collaboration: Object.freeze(snapshot.collaboration.map((item) => Object.freeze({ id: item.id, kind: item.kind,
    resourceType: item.resourceType, resourceId: item.resourceId, ...(item.annotation ? { annotation: item.annotation } : {}),
    addedByPersonId: item.addedByPersonId, addedAt: item.addedAt }))),
  minutes: minutesMetadata(snapshot), revision: snapshot.meeting.revision,
  createdAt: snapshot.meeting.createdAt, updatedAt: snapshot.meeting.updatedAt
});

export const familyMeetingSnapshotToCenter = (
  snapshot: FamilyMeetingCenterSnapshotRow,
  key: FamilyMeetingCenterKey,
  generatedAt: FamilyMeetingMinutesRow['createdAt']
): FamilyMeetingCenterView => Object.freeze({ schemaVersion: 1, centerId: key.centerId,
  ownerPersonId: key.actorPersonId, meetings: Object.freeze(snapshot.meetings.map(familyMeetingSnapshotToView)),
  truth: familyMeetingTruth, generatedAt });

export class GetFamilyMeetingCenterUseCase {
  public constructor(private readonly query: FamilyMeetingQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}

export class GetFamilyMeetingMinutesUseCase {
  public constructor(private readonly query: FamilyMeetingQueryPort) {}
  public execute(context: LifeApplicationContext, meetingId: string) {
    return SAFE_ID.test(meetingId) ? this.query.getMinutes(context, meetingId)
      : Promise.resolve(err(invalid(context, 'Toplantı tutanağı kimliği geçersizdir.')));
  }
}

const validPerson = (
  context: LifeApplicationContext,
  scope: FamilyMeetingWriteScope,
  personId: string
): Result<void, AppError> => {
  if (!SAFE_ID.test(personId)) return err(invalid(context, 'Katılımcı kişi kimliği geçersizdir.'));
  const found = scope.findPerson(personId);
  if (!found.ok) return found;
  return found.value && found.value.familyId === context.familyId && found.value.status === 'active'
    ? ok(undefined) : err(denied(context, 'Katılımcı aynı etkin ailede değildir.'));
};
const participantFor = (snapshot: FamilyMeetingSnapshotRow, personId: string) =>
  snapshot.participants.find((item) => item.participantPersonId === personId);
const hasAnyRole = (snapshot: FamilyMeetingSnapshotRow, personId: string, permittedRoles: readonly FamilyMeetingRole[]): boolean => {
  if (snapshot.meeting.ownerPersonId === personId && permittedRoles.indexOf('host') >= 0) return true;
  const participant = participantFor(snapshot, personId);
  return !!participant && participant.attendance !== 'declined'
    && participant.roles.some((assignedRole) => permittedRoles.indexOf(assignedRole) >= 0);
};
const ensureRoles = (context: LifeApplicationContext, roles: readonly FamilyMeetingRole[]): Result<readonly FamilyMeetingRole[], AppError> => {
  if (!Array.isArray(roles) || roles.length < 1 || roles.length > 6
    || roles.some((candidate) => MEETING_ROLES.indexOf(candidate) < 0))
    return err(invalid(context, 'Toplantı rol listesi geçersizdir.'));
  const unique = [...new Set(roles)].sort() as FamilyMeetingRole[];
  return unique.length === roles.length ? ok(Object.freeze(unique)) : err(invalid(context, 'Toplantı rolleri yinelenemez.'));
};
const advanceMeeting = (
  current: FamilyMeetingSnapshotRow['meeting'],
  lastMutationId: string,
  updatedAt: FamilyMeetingWriteScope['occurredAt'],
  patch: Partial<Pick<FamilyMeetingSnapshotRow['meeting'], 'title'|'recurrenceKind'|'recurrenceInterval'|'startsAt'|'endsAt'|'reminderMinutes'|'state'>> = {}
): FamilyMeetingSnapshotRow['meeting'] => {
  const base = Object.freeze({ ...current, ...patch, revision: current.revision + 1, lastMutationId, updatedAt });
  const { stateFingerprint: _stateFingerprint, ...withoutFingerprint } = base;
  return Object.freeze({ ...withoutFingerprint, stateFingerprint: meetingFingerprint(withoutFingerprint) });
};

interface ExistingMutationPlan {
  readonly next: FamilyMeetingSnapshotRow['meeting'];
  readonly persist: (scope: FamilyMeetingWriteScope, mutation: FamilyMeetingMutationRow) => Result<void, AppError>;
  readonly encryptedMinutesPackageWritten?: boolean;
}

const executeExistingMutation = <TCommand extends {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly meetingId: string;
}>(input: {
  readonly context: LifeApplicationContext;
  readonly command: TCommand;
  readonly kind: FamilyMeetingMutationKind;
  readonly uow: FamilyMeetingUnitOfWork;
  readonly allowedRoles: readonly FamilyMeetingRole[];
  readonly build: (
    scope: FamilyMeetingWriteScope,
    snapshot: FamilyMeetingSnapshotRow,
    mutationId: string
  ) => Result<ExistingMutationPlan, AppError>;
}): Promise<Result<FamilyMeetingMutationReceiptView, AppError>> => {
  const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return Promise.resolve(actor);
  const expected = revision(context, command.expectedRevision);
  if (!expected.ok || !SAFE_ID.test(command.clientOperationId) || !SAFE_ID.test(command.meetingId))
    return Promise.resolve(err(invalid(context, 'Toplantı mutasyon kimliği veya sürümü geçersizdir.')));
  const requestFingerprint = hash(command);
  return input.uow.execute(context, familyMeetingWriteIntent(command.meetingId, input.kind === 'meeting_state_update'
    && (command as unknown as {state?:string}).state === 'cancelled' ? 'delete' : 'update'), (scope) => {
    const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
    const replayed = replay(context, prior.value, command.meetingId, input.kind, requestFingerprint, expected.value,
      input.kind === 'minutes_finalize');
    if (!replayed.ok || replayed.value) return replayed as Result<FamilyMeetingMutationReceiptView, AppError>;
    const found = scope.findMeeting(command.meetingId); if (!found.ok) return found;
    if (!found.value) return err(missing(context, 'Aile toplantısı bulunamadı.'));
    if (found.value.meeting.revision !== expected.value) return err(conflict(context, 'Toplantı sürümü değişti.'));
    if (!hasAnyRole(found.value, actor.value, input.allowedRoles)) return err(denied(context, 'Toplantı rolü bu işleme izin vermiyor.'));
    const id = mutationId(context, command.clientOperationId, requestFingerprint);
    const plan = input.build(scope, found.value, id); if (!plan.ok) return plan;
    const mutation: FamilyMeetingMutationRow = Object.freeze({ id, familyId: context.familyId,
      ownerPersonId: scope.ownerPersonId, resourceType: 'family_meeting', resourceId: command.meetingId,
      actorAccountId: context.actor.userId, actorPersonId: asPersonId(actor.value), mutationKind: input.kind,
      clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: expected.value,
      revision: expected.value + 1, resourceStateFingerprint: plan.value.next.stateFingerprint,
      occurredAt: scope.occurredAt });
    for (const write of [() => scope.insertMutation(mutation),
      () => scope.saveMeeting(plan.value.next, expected.value), () => plan.value.persist(scope, mutation),
      () => scope.appendEvent(event(mutation))]) {
      const result = write(); if (!result.ok) return result;
    }
    return finish(context, scope, mutation, plan.value.encryptedMinutesPackageWritten === true);
  });
};

export class CreateFamilyMeetingUseCase {
  public constructor(private readonly uow: FamilyMeetingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: CreateFamilyMeetingInput }) {
    const { context, command } = input; const actor = actorPerson(context); if (!actor.ok) return Promise.resolve(actor);
    const title = normalizedText(command.title, 2, 200); const expected = revision(context, command.expectedRevision, true);
    const participants = canonicalStrings(command.participantPersonIds, 32);
    if (!title || !expected.ok || expected.value !== 0 || !SAFE_ID.test(command.clientOperationId)
      || !['once','daily','weekly','monthly'].includes(command.recurrenceKind)
      || !Number.isSafeInteger(command.recurrenceInterval) || command.recurrenceInterval < 1 || command.recurrenceInterval > 52
      || !validIso(command.startsAt) || !validIso(command.endsAt) || Date.parse(command.endsAt) <= Date.parse(command.startsAt)
      || !Number.isSafeInteger(command.reminderMinutes) || command.reminderMinutes < 0 || command.reminderMinutes > 10080
      || !participants) return Promise.resolve(err(invalid(context, 'Toplantı planı geçersizdir.')));
    const id = deterministicId('family-meeting', context, command.clientOperationId);
    const canonicalParticipants = Object.freeze([...new Set([actor.value, ...participants])].sort());
    const requestFingerprint = hash({ ...command, title, participantPersonIds: canonicalParticipants });
    return this.uow.execute(context, familyMeetingWriteIntent(id, 'create', actor.value), (scope) => {
      const prior = scope.findMutation(command.clientOperationId); if (!prior.ok) return prior;
      const replayed = replay(context, prior.value, id, 'meeting_create', requestFingerprint, 0);
      if (!replayed.ok || replayed.value) return replayed as Result<FamilyMeetingMutationReceiptView, AppError>;
      for (const personId of canonicalParticipants) { const valid = validPerson(context, scope, personId); if (!valid.ok) return valid; }
      const existing = scope.findMeeting(id); if (!existing.ok) return existing;
      if (existing.value) return err(conflict(context, 'Toplantı kimliği zaten kullanılıyor.'));
      const lastMutationId = mutationId(context, command.clientOperationId, requestFingerprint);
      const base = Object.freeze({ id, familyId: context.familyId, ownerPersonId: scope.ownerPersonId,
        title, recurrenceKind: command.recurrenceKind, recurrenceInterval: command.recurrenceInterval,
        startsAt: asIsoDateTime(command.startsAt), endsAt: asIsoDateTime(command.endsAt),
        reminderMinutes: command.reminderMinutes, state: 'scheduled' as const, revision: 1,
        lastMutationId, createdAt: scope.occurredAt, updatedAt: scope.occurredAt });
      const meeting = Object.freeze({ ...base, stateFingerprint: meetingFingerprint(base) });
      const mutation: FamilyMeetingMutationRow = Object.freeze({ id: lastMutationId, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, resourceType: 'family_meeting', resourceId: id,
        actorAccountId: context.actor.userId, actorPersonId: asPersonId(actor.value), mutationKind: 'meeting_create',
        clientOperationId: command.clientOperationId, requestFingerprint, expectedRevision: 0, revision: 1,
        resourceStateFingerprint: meeting.stateFingerprint, occurredAt: scope.occurredAt });
      for (const write of [() => scope.insertMutation(mutation), () => scope.insertMeeting(meeting)]) {
        const result = write(); if (!result.ok) return result;
      }
      for (const personId of canonicalParticipants) {
        const row: FamilyMeetingParticipantRow = Object.freeze({ id: participantId(id, personId), familyId: context.familyId,
          ownerPersonId: scope.ownerPersonId, meetingId: id, participantPersonId: asPersonId(personId),
          roles: Object.freeze(personId === actor.value ? ['host','attendee'] as const : ['attendee'] as const),
          attendance: personId === actor.value ? 'accepted' : 'invited', reminderEnabled: true,
          revision: 1, lastMutationId, createdAt: scope.occurredAt, updatedAt: scope.occurredAt });
        const saved = scope.upsertParticipant(row, 0); if (!saved.ok) return saved;
      }
      const appended = scope.appendEvent(event(mutation)); if (!appended.ok) return appended;
      return finish(context, scope, mutation);
    });
  }
}

export class UpdateFamilyMeetingPlanUseCase {
  public constructor(private readonly uow: FamilyMeetingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: UpdateFamilyMeetingPlanInput }) {
    const title = normalizedText(input.command.title, 2, 200);
    if (!title || !['once','daily','weekly','monthly'].includes(input.command.recurrenceKind)
      || !Number.isSafeInteger(input.command.recurrenceInterval) || input.command.recurrenceInterval < 1 || input.command.recurrenceInterval > 52
      || !validIso(input.command.startsAt) || !validIso(input.command.endsAt)
      || Date.parse(input.command.endsAt) <= Date.parse(input.command.startsAt)
      || !Number.isSafeInteger(input.command.reminderMinutes) || input.command.reminderMinutes < 0 || input.command.reminderMinutes > 10080)
      return Promise.resolve(err(invalid(input.context, 'Toplantı planı güncellemesi geçersizdir.')));
    return executeExistingMutation({ ...input, uow: this.uow, kind: 'meeting_plan_update', allowedRoles: ['host'],
      build: (scope, snapshot, id) => snapshot.meeting.state === 'scheduled'
        ? ok({ next: advanceMeeting(snapshot.meeting, id, scope.occurredAt, { title,
            recurrenceKind: input.command.recurrenceKind, recurrenceInterval: input.command.recurrenceInterval,
            startsAt: asIsoDateTime(input.command.startsAt), endsAt: asIsoDateTime(input.command.endsAt),
            reminderMinutes: input.command.reminderMinutes }), persist: () => ok(undefined) })
        : err(conflict(input.context, 'Yalnız planlanmış toplantı değiştirilebilir.')) });
  }
}

export class SetFamilyMeetingStateUseCase {
  public constructor(private readonly uow: FamilyMeetingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: SetFamilyMeetingStateInput }) {
    const reason = normalizedText(input.command.reason, 3, 500);
    if (!reason || !['in_progress','completed','cancelled'].includes(input.command.state))
      return Promise.resolve(err(invalid(input.context, 'Toplantı durum geçişi geçersizdir.')));
    return executeExistingMutation({ ...input, uow: this.uow, kind: 'meeting_state_update', allowedRoles: ['host','facilitator'],
      build: (scope, snapshot, id) => {
        const transition = `${snapshot.meeting.state}:${input.command.state}`;
        if (!['scheduled:in_progress','scheduled:cancelled','in_progress:completed','in_progress:cancelled'].includes(transition))
          return err(conflict(input.context, 'Toplantı durum geçişi izinli değildir.'));
        return ok({ next: advanceMeeting(snapshot.meeting, id, scope.occurredAt, { state: input.command.state }),
          persist: () => ok(undefined) });
      } });
  }
}

export class UpsertFamilyMeetingParticipantUseCase {
  public constructor(private readonly uow: FamilyMeetingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: UpsertFamilyMeetingParticipantInput }) {
    const roles = ensureRoles(input.context, input.command.roles);
    if (!roles.ok || !['invited','accepted','tentative','declined','attended','absent'].includes(input.command.attendance))
      return Promise.resolve(roles.ok ? err(invalid(input.context, 'Katılım durumu geçersizdir.')) : roles);
    return executeExistingMutation({ ...input, uow: this.uow, kind: 'participant_upsert', allowedRoles: ['host','facilitator'],
      build: (scope, snapshot, id) => {
        if (snapshot.meeting.state === 'completed' || snapshot.meeting.state === 'cancelled')
          return err(conflict(input.context, 'Tamamlanmış toplantı katılımcısı değiştirilemez.'));
        const valid = validPerson(input.context, scope, input.command.participantPersonId); if (!valid.ok) return valid;
        if (input.command.participantPersonId === snapshot.meeting.ownerPersonId && !roles.value.includes('host'))
          return err(denied(input.context, 'Toplantı sahibinin ev sahibi rolü kaldırılamaz.'));
        const current = participantFor(snapshot, input.command.participantPersonId);
        const row: FamilyMeetingParticipantRow = Object.freeze({ id: participantId(snapshot.meeting.id,input.command.participantPersonId),
          familyId: snapshot.meeting.familyId, ownerPersonId: snapshot.meeting.ownerPersonId, meetingId: snapshot.meeting.id,
          participantPersonId: asPersonId(input.command.participantPersonId), roles: roles.value,
          attendance: input.command.attendance, reminderEnabled: input.command.reminderEnabled,
          revision: (current?.revision ?? 0) + 1, lastMutationId: id,
          createdAt: current?.createdAt ?? scope.occurredAt, updatedAt: scope.occurredAt });
        return ok({ next: advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist: (writeScope:FamilyMeetingWriteScope) => writeScope.upsertParticipant(row,current?.revision ?? 0) });
      } });
  }
}

export class UpsertFamilyMeetingAgendaItemUseCase {
  public constructor(private readonly uow: FamilyMeetingUnitOfWork) {}
  public execute(input: { readonly context: LifeApplicationContext; readonly command: UpsertFamilyMeetingAgendaItemInput }) {
    const title = normalizedText(input.command.title, 2, 500);
    const note = input.command.note === undefined ? undefined : normalizedText(input.command.note, 1, 4000);
    if (!title || (input.command.note !== undefined && !note) || !Number.isSafeInteger(input.command.order)
      || input.command.order < 1 || input.command.order > 256 || !Array.isArray(input.command.preRead)
      || input.command.preRead.length > 16 || input.command.preRead.some((item) =>
        !['archive_item','communication_message','memory_studio_record'].includes(item.resourceType) || !SAFE_ID.test(item.resourceId)))
      return Promise.resolve(err(invalid(input.context, 'Gündem maddesi geçersizdir.')));
    return executeExistingMutation({ ...input, uow: this.uow, kind: 'agenda_upsert', allowedRoles: ['host','facilitator','note_taker'],
      build: (scope,snapshot,id) => {
        const itemId=input.command.agendaItemId ?? deterministicId('meeting-agenda',input.context,input.command.clientOperationId);
        if (!SAFE_ID.test(itemId)) return err(invalid(input.context,'Gündem kimliği geçersizdir.'));
        const current=snapshot.agenda.find((item)=>item.id===itemId);
        const row:FamilyMeetingAgendaItemRow=Object.freeze({id:itemId,familyId:snapshot.meeting.familyId,
          ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,title,
          ...(note?{note}:{}),order:input.command.order,
          preRead:Object.freeze([...input.command.preRead].map((item)=>Object.freeze({...item}))
            .sort((a,b)=>`${a.resourceType}:${a.resourceId}`.localeCompare(`${b.resourceType}:${b.resourceId}`))),
          carryForwardToNextMeeting:input.command.carryForwardToNextMeeting,revision:(current?.revision??0)+1,
          lastMutationId:id,createdAt:current?.createdAt??scope.occurredAt,updatedAt:scope.occurredAt});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.upsertAgendaItem(row,current?.revision??0)});
      }});
  }
}

export class CreateFamilyMeetingPollUseCase {
  public constructor(private readonly uow: FamilyMeetingUnitOfWork) {}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:CreateFamilyMeetingPollInput}){
    const question=normalizedText(input.command.question,2,1000);
    const options=canonicalStrings(input.command.options,12);
    if(!question||!options||options.length<2)return Promise.resolve(err(invalid(input.context,'Toplantı anketi geçersizdir.')));
    return executeExistingMutation({...input,uow:this.uow,kind:'poll_create',allowedRoles:['host','facilitator'],
      build:(scope,snapshot,id)=>{
        if(snapshot.meeting.state==='completed'||snapshot.meeting.state==='cancelled')return err(conflict(input.context,'Kapalı toplantıda anket açılamaz.'));
        const pollId=deterministicId('meeting-poll',input.context,input.command.clientOperationId);
        const row:FamilyMeetingPollRow=Object.freeze({id:pollId,familyId:snapshot.meeting.familyId,
          ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,question,
          options:Object.freeze(options.map((label,index)=>Object.freeze({id:`${pollId}:option:${index+1}`,label}))),
          state:'open',mutationId:id,createdAt:scope.occurredAt});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.insertPoll(row)});
      }});
  }
}

export class CastFamilyMeetingVoteUseCase {
  public constructor(private readonly uow:FamilyMeetingUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:CastFamilyMeetingVoteInput}){
    const opinion=input.command.opinionNote===undefined?undefined:normalizedText(input.command.opinionNote,1,2000);
    if((input.command.opinionNote!==undefined&&!opinion)||(input.command.abstain===true)!==(input.command.optionId===undefined)
      ||(input.command.optionId!==undefined&&!SAFE_ID.test(input.command.optionId)))
      return Promise.resolve(err(invalid(input.context,'Oy, çekimserlik veya görüş notu geçersizdir.')));
    return executeExistingMutation({...input,uow:this.uow,kind:'vote_cast',allowedRoles:['host','facilitator','note_taker','translator','caregiver','attendee'],
      build:(scope,snapshot,id)=>{
        const poll=snapshot.polls.find((item)=>item.id===input.command.pollId);
        if(!poll||poll.state!=='open')return err(missing(input.context,'Açık toplantı anketi bulunamadı.'));
        if(input.command.optionId&&!poll.options.some((item)=>item.id===input.command.optionId))return err(invalid(input.context,'Oy seçeneği ankete ait değildir.'));
        if(snapshot.votes.some((item)=>item.pollId===poll.id&&item.voterPersonId===scope.actorPersonId))return err(conflict(input.context,'Katılımcı bu ankette daha önce oy kullandı.'));
        const row:FamilyMeetingVoteRow=Object.freeze({id:hash({pollId:poll.id,voter:scope.actorPersonId}),
          familyId:snapshot.meeting.familyId,ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,
          pollId:poll.id,voterPersonId:scope.actorPersonId,...(input.command.optionId?{optionId:input.command.optionId}:{}),
          abstained:input.command.abstain,...(opinion?{opinionNote:opinion}:{}),mutationId:id,castAt:scope.occurredAt});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.insertVote(row)});
      }});
  }
}

export class RecordFamilyMeetingDecisionUseCase {
  public constructor(private readonly uow:FamilyMeetingUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:RecordFamilyMeetingDecisionInput}){
    const statement=normalizedText(input.command.statement,2,4000);
    const responsible=canonicalStrings(input.command.responsiblePersonIds,32);
    if(!statement||!responsible||(input.command.sourcePollId!==undefined&&!SAFE_ID.test(input.command.sourcePollId)))
      return Promise.resolve(err(invalid(input.context,'Toplantı kararı geçersizdir.')));
    return executeExistingMutation({...input,uow:this.uow,kind:'decision_record',allowedRoles:['host','facilitator','note_taker'],
      build:(scope,snapshot,id)=>{
        if(input.command.sourcePollId&&!snapshot.polls.some((item)=>item.id===input.command.sourcePollId))return err(missing(input.context,'Karara bağlı anket bulunamadı.'));
        for(const personId of responsible){if(!participantFor(snapshot,personId))return err(denied(input.context,'Karar sorumlusu toplantı katılımcısı değildir.'));}
        const decisionId=deterministicId('meeting-decision',input.context,input.command.clientOperationId);
        const row:FamilyMeetingDecisionRow=Object.freeze({id:decisionId,familyId:snapshot.meeting.familyId,
          ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,statement,
          ...(input.command.sourcePollId?{sourcePollId:input.command.sourcePollId}:{}),responsiblePersonIds:responsible,
          ledgerReference:hash({meetingId:snapshot.meeting.id,decisionId,statement,responsible}),mutationId:id,recordedAt:scope.occurredAt});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.insertDecision(row)});
      }});
  }
}

export class UpsertFamilyMeetingTaskUseCase {
  public constructor(private readonly uow:FamilyMeetingUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:UpsertFamilyMeetingTaskInput}){
    const title=normalizedText(input.command.title,2,1000);
    const follow=input.command.followUpNote===undefined?undefined:normalizedText(input.command.followUpNote,1,2000);
    if(!title||(input.command.followUpNote!==undefined&&!follow)||!validIso(input.command.dueAt)
      ||!['open','in_progress','completed','cancelled'].includes(input.command.state))
      return Promise.resolve(err(invalid(input.context,'Toplantı görevi geçersizdir.')));
    return executeExistingMutation({...input,uow:this.uow,kind:'task_upsert',allowedRoles:['host','facilitator','note_taker'],
      build:(scope,snapshot,id)=>{
        if(!participantFor(snapshot,input.command.responsiblePersonId))return err(denied(input.context,'Görev sorumlusu toplantı katılımcısı değildir.'));
        if(input.command.decisionId&&!snapshot.decisions.some((item)=>item.id===input.command.decisionId))return err(missing(input.context,'Göreve bağlı karar bulunamadı.'));
        const taskId=input.command.taskId??deterministicId('meeting-task',input.context,input.command.clientOperationId);
        if(!SAFE_ID.test(taskId))return err(invalid(input.context,'Görev kimliği geçersizdir.'));
        const current=snapshot.tasks.find((item)=>item.id===taskId);
        const row:FamilyMeetingTaskRow=Object.freeze({id:taskId,familyId:snapshot.meeting.familyId,
          ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,
          ...(input.command.decisionId?{decisionId:input.command.decisionId}:{}),title,
          responsiblePersonId:asPersonId(input.command.responsiblePersonId),dueAt:asIsoDateTime(input.command.dueAt),
          state:input.command.state,...(follow?{followUpNote:follow}:{}),
          carryForwardToNextMeeting:input.command.carryForwardToNextMeeting,revision:(current?.revision??0)+1,
          lastMutationId:id,createdAt:current?.createdAt??scope.occurredAt,updatedAt:scope.occurredAt});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.upsertTask(row,current?.revision??0)});
      }});
  }
}

export class AddFamilyMeetingCollaborationUseCase {
  public constructor(private readonly uow:FamilyMeetingUnitOfWork){}
  public execute(input:{readonly context:LifeApplicationContext;readonly command:AddFamilyMeetingCollaborationInput}){
    const annotation=input.command.annotation===undefined?undefined:normalizedText(input.command.annotation,1,4000);
    if(!['whiteboard','photo_album','document_annotation'].includes(input.command.kind)
      ||!['archive_item','album','whiteboard'].includes(input.command.resourceType)||!SAFE_ID.test(input.command.resourceId)
      ||(input.command.annotation!==undefined&&!annotation))return Promise.resolve(err(invalid(input.context,'Ortak çalışma kaynağı geçersizdir.')));
    return executeExistingMutation({...input,uow:this.uow,kind:'collaboration_add',allowedRoles:['host','facilitator','note_taker','translator','caregiver','attendee'],
      build:(scope,snapshot,id)=>{
        const row:FamilyMeetingCollaborationRow=Object.freeze({id:deterministicId('meeting-collaboration',input.context,input.command.clientOperationId),
          familyId:snapshot.meeting.familyId,ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,
          kind:input.command.kind,resourceType:input.command.resourceType,resourceId:input.command.resourceId,
          ...(annotation?{annotation}:{}),addedByPersonId:scope.actorPersonId,mutationId:id,addedAt:scope.occurredAt});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.insertCollaboration(row)});
      }});
  }
}

export class PrepareFamilyMeetingAiMinutesUseCase {
  public constructor(
    private readonly uow:FamilyMeetingUnitOfWork,
    private readonly recordingConsent:FamilyMeetingRecordingConsentPort,
    private readonly provider:FamilyMeetingAiMinutesProviderPort,
    private readonly artifacts:FamilyMeetingMinutesArtifactPort
  ){}
  public async execute(input:{readonly context:LifeApplicationContext;readonly command:PrepareFamilyMeetingAiMinutesInput}){
    if(!SAFE_ID.test(input.command.recordingRequestId))return err(invalid(input.context,'Kayıt rıza kaynağı geçersizdir.'));
    const evidence=await this.recordingConsent.verify(input.context,input.command.recordingRequestId);
    if(!evidence.ok)return evidence;
    if(!evidence.value.verified||!evidence.value.evidenceSha256||!SHA256.test(evidence.value.evidenceSha256))
      return err(denied(input.context,'Rızalı transkript kanıtı doğrulanmadan AI tutanak önerisi hazırlanamaz.'));
    const consentEvidenceSha256 = evidence.value.evidenceSha256;
    let sealed:VerifiedSealedFamilyMeetingMinutesInput|undefined;
    const result=await executeExistingMutation({...input,uow:this.uow,kind:'ai_minutes_prepare',allowedRoles:['host','note_taker'],
      build:(scope,snapshot,id)=>{
        if(snapshot.meeting.state!=='completed')return err(conflict(input.context,'AI tutanak önerisi yalnız tamamlanmış toplantıda hazırlanabilir.'));
        const current=snapshot.minutes;
        if(current?.state==='sealed_local')return err(conflict(input.context,'Mühürlü toplantı tutanağı yeniden hazırlanamaz.'));
        let generated=false;
        if(this.provider.configured){
          const output=this.provider.generate({meetingId:snapshot.meeting.id,recordingRequestId:input.command.recordingRequestId,
            correlationId:input.context.correlationId});
          if(!output.ok)return output;
          const sealedResult=this.artifacts.seal({familyId:snapshot.meeting.familyId,ownerPersonId:snapshot.meeting.ownerPersonId,
            meetingId:snapshot.meeting.id,minutesRevision:(current?.revision??0)+1,summary:output.value.summary,
            decisions:output.value.decisions,tasks:output.value.tasks,participantAccessPersonIds:[snapshot.meeting.ownerPersonId],
            selectedRecordingSegmentIds:[],machineGeneratedSource:true,humanApproved:false,occurredAt:scope.occurredAt,
            correlationId:input.context.correlationId});
          if(!sealedResult.ok)return sealedResult;sealed=sealedResult.value;generated=true;
        }
        const base:Omit<FamilyMeetingMinutesRow,'stateFingerprint'>=Object.freeze({id:`${snapshot.meeting.id}:minutes`,
          familyId:snapshot.meeting.familyId,ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,
          state:generated?'pending_human_review':'provider_unavailable',recordingRequestId:input.command.recordingRequestId,
          transcriptConsentVerified:true,consentEvidenceSha256,
          aiSuggestionGenerated:generated,humanApprovalRecorded:false,
          ...(sealed?{sealedPayloadReference:sealed.sealedPayloadReference,payloadSha256:sealed.payloadSha256,
            payloadSizeBytes:sealed.payloadSizeBytes,providerId:sealed.providerId,
            providerEvidenceSha256:sealed.providerEvidenceSha256,payloadRevision:sealed.payloadRevision,
            payloadCreatedAt:sealed.payloadCreatedAt}:{}),participantAccessPersonIds:Object.freeze([snapshot.meeting.ownerPersonId]),
          selectedRecordingSegmentIds:Object.freeze([]),networkUsed:false,cloudUsed:false,revision:(current?.revision??0)+1,
          lastMutationId:id,createdAt:current?.createdAt??scope.occurredAt,updatedAt:scope.occurredAt});
        const row=Object.freeze({...base,stateFingerprint:minutesFingerprint(base)});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.upsertMinutes(row,current?.revision??0)});
      }});
    if(!result.ok&&sealed){const discarded=this.artifacts.discard(sealed.sealedPayloadReference,input.context.correlationId);if(!discarded.ok)return discarded;}
    return result;
  }
}

export class FinalizeFamilyMeetingMinutesUseCase {
  public constructor(private readonly uow:FamilyMeetingUnitOfWork,private readonly artifacts:FamilyMeetingMinutesArtifactPort){}
  public async execute(input:{readonly context:LifeApplicationContext;readonly command:FinalizeFamilyMeetingMinutesInput}){
    const summary=normalizedText(input.command.summary,2,32_768);
    const decisions=canonicalStrings(input.command.decisions,128);const tasks=canonicalStrings(input.command.tasks,128);
    const access=canonicalStrings(input.command.participantAccessPersonIds,32);
    const segments=canonicalStrings(input.command.selectedRecordingSegmentIds,64);
    if(!summary||!decisions||!tasks||!access||access.length<1||!segments||input.command.explicitHumanApproval!==true)
      return err(invalid(input.context,'Onaylı toplantı tutanağı girdisi geçersizdir.'));
    let sealed:VerifiedSealedFamilyMeetingMinutesInput|undefined;
    const result=await executeExistingMutation({...input,uow:this.uow,kind:'minutes_finalize',allowedRoles:['host','note_taker'],
      build:(scope,snapshot,id)=>{
        if(snapshot.meeting.state!=='completed')return err(conflict(input.context,'Tutanak yalnız tamamlanmış toplantıda mühürlenebilir.'));
        for(const personId of access){if(!participantFor(snapshot,personId))return err(denied(input.context,'Tutanak erişimi yalnız toplantı katılımcılarına verilebilir.'));}
        const current=snapshot.minutes;
        if(current?.state==='sealed_local')
          return err(conflict(input.context,'Muhurlu toplanti tutanagi yeni bir komutla degistirilemez.'));
        const verifiedMachineSource=current?.aiSuggestionGenerated===true;
        if(input.command.machineGeneratedSource!==verifiedMachineSource)
          return err(conflict(input.context,'Tutanak kaynak turu dogrulanmis AI oneri durumuyla uyusmuyor.'));
        const sealedResult=this.artifacts.seal({familyId:snapshot.meeting.familyId,ownerPersonId:snapshot.meeting.ownerPersonId,
          meetingId:snapshot.meeting.id,minutesRevision:(current?.revision??0)+1,summary,decisions,tasks,
          participantAccessPersonIds:access,selectedRecordingSegmentIds:segments,
          machineGeneratedSource:verifiedMachineSource,humanApproved:true,
          occurredAt:scope.occurredAt,correlationId:input.context.correlationId});
        if(!sealedResult.ok)return sealedResult;sealed=sealedResult.value;
        const base:Omit<FamilyMeetingMinutesRow,'stateFingerprint'>=Object.freeze({id:`${snapshot.meeting.id}:minutes`,
          familyId:snapshot.meeting.familyId,ownerPersonId:snapshot.meeting.ownerPersonId,meetingId:snapshot.meeting.id,
          state:'sealed_local',...(current?.recordingRequestId?{recordingRequestId:current.recordingRequestId}:{}),
          transcriptConsentVerified:current?.transcriptConsentVerified??false,
          ...(current?.consentEvidenceSha256?{consentEvidenceSha256:current.consentEvidenceSha256}:{}),
          aiSuggestionGenerated:current?.aiSuggestionGenerated??false,humanApprovalRecorded:true,
          sealedPayloadReference:sealed.sealedPayloadReference,payloadSha256:sealed.payloadSha256,
          payloadSizeBytes:sealed.payloadSizeBytes,providerId:sealed.providerId,
          providerEvidenceSha256:sealed.providerEvidenceSha256,payloadRevision:sealed.payloadRevision,
          payloadCreatedAt:sealed.payloadCreatedAt,participantAccessPersonIds:Object.freeze(access.map(asPersonId)),
          selectedRecordingSegmentIds:segments,networkUsed:false,cloudUsed:false,revision:(current?.revision??0)+1,
          lastMutationId:id,createdAt:current?.createdAt??scope.occurredAt,updatedAt:scope.occurredAt});
        const row=Object.freeze({...base,stateFingerprint:minutesFingerprint(base)});
        return ok({next:advanceMeeting(snapshot.meeting,id,scope.occurredAt),encryptedMinutesPackageWritten:true,
          persist:(writeScope:FamilyMeetingWriteScope)=>writeScope.upsertMinutes(row,current?.revision??0)});
      }});
    if(!result.ok&&sealed){const discarded=this.artifacts.discard(sealed.sealedPayloadReference,input.context.correlationId);if(!discarded.ok)return discarded;}
    return result;
  }
}
