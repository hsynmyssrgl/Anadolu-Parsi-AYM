import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asEventId,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import {
  localTranslationCenterId,
  localTranslationProfileId,
  localTranslationTruth,
  type AddLocalTranslationDictionaryEntryInput,
  type CancelLocalTranslationRequestInput,
  type DeleteLocalTranslationDictionaryEntryInput,
  type LocalTranslationCenterView,
  type LocalTranslationDictionaryEntryView,
  type LocalTranslationMutationKind,
  type LocalTranslationMutationReceiptView,
  type LocalTranslationRequestView,
  type LocalTranslationResourceType,
  type PrepareLocalTranslationRequestInput,
  type RecordLocalTranslationCorrectionInput,
  type UpdateLocalTranslationDictionaryEntryInput,
  type UpdateLocalTranslationProfileInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  LocalTranslationCenterKey,
  LocalTranslationCenterSnapshotRow,
  LocalTranslationDictionaryEntryRow,
  LocalTranslationEventRow,
  LocalTranslationMutationRow,
  LocalTranslationProfileRow,
  LocalTranslationRequestRow
} from '@ppt/repository-contracts';
import type { LifeApplicationContext, LifePolicyIntent } from './life-use-cases.js';

export interface TranslationProviderRequest {
  readonly sourceKind: 'message' | 'live_caption' | 'document' | 'meeting_summary';
  readonly sourceResourceId: string;
  readonly targetLanguage: string;
  readonly providerMode: 'local_offline' | 'external_preview';
}

export interface TranslationProviderResult {
  readonly providerId: string;
  readonly sealedResultId: string;
  readonly detectedLanguage: string;
  readonly confidenceBasisPoints: number | null;
  readonly qualityFlags: readonly ('ambiguous' | 'low_confidence' | 'possible_error')[];
  readonly originalSha256: string;
  readonly translationSha256: string;
  readonly localOffline: boolean;
  readonly networkUsed: boolean;
  readonly cloudUsed: boolean;
}

/** Shared future provider seam. The current production composition intentionally provides no implementation. */
export interface TranslationProviderPort {
  readonly providerId: string;
  readonly configured: boolean;
  execute(input: TranslationProviderRequest): Promise<Result<TranslationProviderResult, AppError>>;
}

export interface LocalTranslationQueryPort {
  getCenter(context: LifeApplicationContext): Promise<Result<LocalTranslationCenterView, AppError>>;
}

export interface LocalTranslationWriteScope {
  readonly occurredAt: LocalTranslationMutationRow['occurredAt'];
  readonly ownerPersonId: LocalTranslationCenterKey['ownerPersonId'];
  findProfile(): Result<LocalTranslationProfileRow | null, AppError>;
  findDictionaryEntry(entryId: string): Result<LocalTranslationDictionaryEntryRow | null, AppError>;
  findRequest(requestId: string): Result<LocalTranslationRequestRow | null, AppError>;
  findMutation(clientOperationId: string): Result<LocalTranslationMutationRow | null, AppError>;
  insertMutation(row: LocalTranslationMutationRow): Result<void, AppError>;
  insertProfile(row: LocalTranslationProfileRow): Result<void, AppError>;
  saveProfile(row: LocalTranslationProfileRow, expectedRevision: number): Result<void, AppError>;
  insertDictionaryEntry(row: LocalTranslationDictionaryEntryRow): Result<void, AppError>;
  saveDictionaryEntry(row: LocalTranslationDictionaryEntryRow, expectedRevision: number): Result<void, AppError>;
  insertRequest(row: LocalTranslationRequestRow): Result<void, AppError>;
  saveRequest(row: LocalTranslationRequestRow, expectedRevision: number): Result<void, AppError>;
  appendEvent(row: LocalTranslationEventRow): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: LocalTranslationMutationRow['occurredAt'];
    readonly actorId: LifeApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface LocalTranslationUnitOfWork {
  execute<T>(
    context: LifeApplicationContext,
    intent: LifePolicyIntent,
    operation: (scope: LocalTranslationWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,255}$/u;
const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
const normalizedText = (value: unknown, minimum: number, maximum: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return normalized.length >= minimum && normalized.length <= maximum && !CONTROL.test(normalized) ? normalized : null;
};
const language = (value: unknown): string | null => typeof value === 'string' && LANGUAGE.test(value)
  ? value.toLowerCase() : null;
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
  ? ok(context.actor.personId) : err(denied(context, 'Dil ve çeviri merkezi kişi bağlı oturum gerektirir.'));
const exactRevision = (context: LifeApplicationContext, value: unknown, allowZero = false): Result<number, AppError> =>
  Number.isSafeInteger(value) && Number(value) >= (allowZero ? 0 : 1)
    ? ok(Number(value)) : err(invalid(context, 'Beklenen dil profili sürümü geçersizdir.'));

export const localTranslationReadIntent = (): LifePolicyIntent => ({
  action: 'read', capability: 'family.read', resourceType: 'local_translation_center', resourceId: '*', purpose: 'general'
});
export const localTranslationWriteIntent = (
  resourceType: LocalTranslationResourceType,
  resourceId: string,
  action: 'create' | 'update' | 'delete',
  ownerPersonId?: string
): LifePolicyIntent => ({
  action, capability: 'family.write', resourceType, resourceId, purpose: 'general',
  ...(action === 'create' && ownerPersonId ? { ownerPersonId: asPersonId(ownerPersonId), privacy: 'private' as const } : {})
});

export const localTranslationKey = (
  context: LifeApplicationContext,
  ownerPersonId: NonNullable<LifeApplicationContext['actor']['personId']>
): LocalTranslationCenterKey => Object.freeze({
  familyId: context.familyId,
  accountId: context.actor.userId,
  actorPersonId: context.actor.personId ?? ownerPersonId,
  ownerPersonId,
  centerId: localTranslationCenterId(context.familyId, ownerPersonId),
  profileId: localTranslationProfileId(context.familyId, ownerPersonId)
});

const defaultProfile = (key: LocalTranslationCenterKey, occurredAt: LocalTranslationMutationRow['occurredAt']): LocalTranslationProfileRow =>
  Object.freeze({ id: key.profileId, familyId: key.familyId, ownerPersonId: key.ownerPersonId,
    preferredLanguage: 'tr', secondaryLanguages: Object.freeze([]), localFirstRequired: true,
    liveCaptionTranslationEnabled: false, translatedSpeechEnabled: false, preserveOriginalAudio: true,
    externalProviderAllowed: false, encryptedSyncRequested: false, encryptedSyncExecuted: false,
    revision: 0, stateFingerprint: hash({ default: key.profileId }), lastMutationId: '', createdAt: occurredAt, updatedAt: occurredAt });
const dictionaryView = (row: LocalTranslationDictionaryEntryRow): LocalTranslationDictionaryEntryView => Object.freeze({
  id: row.id, category: row.category, sourceLanguage: row.sourceLanguage, targetLanguage: row.targetLanguage,
  sourceTerm: row.sourceTerm, preferredTerm: row.preferredTerm, explicitPermissionRecorded: true,
  enabled: row.state === 'active', revision: row.revision, updatedAt: row.updatedAt
});
const requestView = (row: LocalTranslationRequestRow): LocalTranslationRequestView => Object.freeze({
  id: row.id, sourceKind: row.sourceKind, sourceResourceId: row.sourceResourceId, targetLanguage: row.targetLanguage,
  providerMode: row.providerMode, state: row.state, originalPreservationRequired: true,
  separateTranslationViewRequired: true, machineTranslationLabelRequired: true, qualityFlag: row.qualityFlag,
  externalPreviewAcknowledged: row.externalPreviewAcknowledged, explicitExternalConsent: row.explicitExternalConsent,
  correctionRecorded: row.correctionSha256 !== undefined,
  ...(row.correctionSha256 ? { correctionSha256: row.correctionSha256, correctionCharacterCount: row.correctionCharacterCount } : {}),
  languageDetectionExecuted: false, translationExecuted: false, speechToTextExecuted: false,
  speakerSeparationExecuted: false, liveCaptionTranslationExecuted: false, textToSpeechExecuted: false,
  networkUsed: false, cloudUsed: false, revision: row.revision, createdAt: row.createdAt, updatedAt: row.updatedAt
});
export const localTranslationSnapshotToCenterView = (
  snapshot: LocalTranslationCenterSnapshotRow,
  key: LocalTranslationCenterKey,
  occurredAt: LocalTranslationMutationRow['occurredAt']
): LocalTranslationCenterView => {
  const profile = snapshot.profile ?? defaultProfile(key, occurredAt);
  return Object.freeze({ schemaVersion: 1, centerId: key.centerId, ownerPersonId: key.ownerPersonId,
    profile: Object.freeze({ id: profile.id, preferredLanguage: profile.preferredLanguage,
      secondaryLanguages: Object.freeze([...profile.secondaryLanguages]), localFirstRequired: true,
      liveCaptionTranslationEnabled: profile.liveCaptionTranslationEnabled,
      translatedSpeechEnabled: profile.translatedSpeechEnabled, preserveOriginalAudio: true,
      externalProviderAllowed: profile.externalProviderAllowed, externalPreviewRequired: true,
      externalConsentRequired: true, encryptedSyncRequested: profile.encryptedSyncRequested,
      encryptedSyncExecuted: false, revision: profile.revision, updatedAt: profile.updatedAt }),
    dictionary: Object.freeze(snapshot.dictionary.filter((row) => row.state === 'active').map(dictionaryView)),
    requests: Object.freeze(snapshot.requests.map(requestView)), truth: localTranslationTruth, generatedAt: occurredAt });
};

const mutationIdentity = (context: LifeApplicationContext, clientOperationId: string, fingerprint: string): string =>
  hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId, fingerprint });
const requestId = (context: LifeApplicationContext, clientOperationId: string): string =>
  `local-translation-request-${hash({ familyId: context.familyId, accountId: context.actor.userId, clientOperationId }).slice(0, 48)}`;
const dictionaryId = (context: LifeApplicationContext, sourceLanguage: string, targetLanguage: string, sourceTerm: string): string =>
  `local-translation-dictionary-${hash({ familyId: context.familyId, ownerPersonId: context.actor.personId,
    sourceLanguage, targetLanguage, sourceTerm }).slice(0, 48)}`;
const rowFingerprint = <T extends object>(row: T): string => hash(row);
const receipt = (row: LocalTranslationMutationRow, replayed: boolean): LocalTranslationMutationReceiptView => Object.freeze({
  resourceType: row.resourceType, resourceId: row.resourceId, mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision, revision: row.revision, occurredAt: row.occurredAt,
  replayed, providerConfigured: false, translationExecuted: false, networkUsed: false, cloudUsed: false
});
const replay = (
  context: LifeApplicationContext,
  row: LocalTranslationMutationRow | null,
  resourceType: LocalTranslationResourceType,
  resourceId: string,
  mutationKind: LocalTranslationMutationKind,
  fingerprint: string,
  expectedRevision: number
): Result<LocalTranslationMutationReceiptView | null, AppError> => {
  if (!row) return ok(null);
  return row.resourceType === resourceType && row.resourceId === resourceId && row.mutationKind === mutationKind
    && row.requestFingerprint === fingerprint && row.expectedRevision === expectedRevision
    ? ok(receipt(row, true)) : err(conflict(context, 'Aynı clientOperationId farklı bir dil veya çeviri komutuna aittir.'));
};
const event = (row: LocalTranslationMutationRow): LocalTranslationEventRow => Object.freeze({
  id: hash({ event: row.id }), familyId: row.familyId, ownerPersonId: row.ownerPersonId,
  resourceType: row.resourceType, resourceId: row.resourceId, eventKind: row.mutationKind,
  resourceRevision: row.revision, stateFingerprint: row.resourceStateFingerprint,
  mutationId: row.id, occurredAt: row.occurredAt
});
const finish = (
  context: LifeApplicationContext,
  scope: LocalTranslationWriteScope,
  row: LocalTranslationMutationRow
): Result<LocalTranslationMutationReceiptView, AppError> => {
  const recorded = scope.appendEvent(event(row)); if (!recorded.ok) return recorded;
  const audit = scope.appendAudit({ id: hash({ audit: row.id }), action: row.mutationKind,
    resourceType: row.resourceType, resourceId: row.resourceId, occurredAt: row.occurredAt, actorId: context.actor.userId });
  if (!audit.ok) return audit;
  const queued = scope.enqueueEvent({ eventId: asEventId(hash({ outbox: row.id })),
    eventType: 'local.translation.metadata.changed', eventVersion: 1, aggregateType: row.resourceType,
    aggregateId: row.resourceId, occurredAt: row.occurredAt, correlationId: context.correlationId,
    payload: Object.freeze({ mutationKind: row.mutationKind, revision: row.revision }) });
  return queued.ok ? ok(receipt(row, false)) : queued;
};
const mutation = (
  context: LifeApplicationContext,
  scope: LocalTranslationWriteScope,
  input: { readonly clientOperationId: string; readonly expectedRevision: number },
  resourceType: LocalTranslationResourceType,
  resourceId: string,
  mutationKind: LocalTranslationMutationKind,
  requestFingerprint: string,
  resourceStateFingerprint: string
): LocalTranslationMutationRow => Object.freeze({
  id: mutationIdentity(context, input.clientOperationId, requestFingerprint), familyId: context.familyId,
  ownerPersonId: scope.ownerPersonId, resourceType, resourceId, actorAccountId: context.actor.userId,
  actorPersonId: context.actor.personId!, mutationKind, clientOperationId: input.clientOperationId,
  requestFingerprint, expectedRevision: input.expectedRevision, revision: input.expectedRevision + 1,
  resourceStateFingerprint, occurredAt: scope.occurredAt
});

export class GetLocalTranslationCenterUseCase {
  public constructor(private readonly query: LocalTranslationQueryPort) {}
  public execute(context: LifeApplicationContext) { return this.query.getCenter(context); }
}

type ProfileMutationBuild = {
  readonly nextProfile: Omit<LocalTranslationProfileRow, 'stateFingerprint'>;
  readonly persistRelated: (mutationId: string) => Result<void, AppError>;
};
const executeProfileMutation = (
  unitOfWork: LocalTranslationUnitOfWork,
  context: LifeApplicationContext,
  input: { readonly clientOperationId: string; readonly expectedRevision: number },
  kind: Extract<LocalTranslationMutationKind, 'profile_update' | 'dictionary_add' | 'dictionary_update' | 'dictionary_delete'>,
  fingerprintValue: unknown,
  build: (scope: LocalTranslationWriteScope, current: LocalTranslationProfileRow | null, mutationId: string) => Result<ProfileMutationBuild, AppError>
): Promise<Result<LocalTranslationMutationReceiptView, AppError>> => {
  const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
  const revision = exactRevision(context, input.expectedRevision, true); if (!revision.ok) return Promise.resolve(revision);
  const profileId = localTranslationProfileId(context.familyId, person.value); const fingerprint = hash(fingerprintValue);
  const action = input.expectedRevision === 0 ? 'create' : 'update';
  return unitOfWork.execute(context, localTranslationWriteIntent('local_translation_profile', profileId, action, person.value), (scope) => {
    if (scope.ownerPersonId !== person.value) return err(denied(context, 'Dil profili yalnız sahibi tarafından değiştirilebilir.'));
    const prior = scope.findMutation(input.clientOperationId); if (!prior.ok) return prior;
    const repeated = replay(context, prior.value, 'local_translation_profile', profileId, kind, fingerprint, input.expectedRevision);
    if (!repeated.ok || repeated.value) return repeated as Result<LocalTranslationMutationReceiptView, AppError>;
    const current = scope.findProfile(); if (!current.ok) return current;
    if ((current.value?.revision ?? 0) !== input.expectedRevision) return err(conflict(context, 'Dil profili sürümü değişmiştir.'));
    const identity = mutationIdentity(context, input.clientOperationId, fingerprint);
    const built = build(scope, current.value, identity); if (!built.ok) return built;
    const stateFingerprint = rowFingerprint(built.value.nextProfile);
    const mutationRow = mutation(context, scope, input, 'local_translation_profile', profileId, kind, fingerprint, stateFingerprint);
    const mutationSaved = scope.insertMutation(mutationRow); if (!mutationSaved.ok) return mutationSaved;
    const profile: LocalTranslationProfileRow = Object.freeze({ ...built.value.nextProfile, stateFingerprint });
    const profileSaved = current.value ? scope.saveProfile(profile, input.expectedRevision) : scope.insertProfile(profile);
    if (!profileSaved.ok) return profileSaved;
    const related = built.value.persistRelated(identity); if (!related.ok) return related;
    return finish(context, scope, mutationRow);
  });
};
const nextProfileBase = (
  key: LocalTranslationCenterKey,
  current: LocalTranslationProfileRow | null,
  mutationId: string,
  occurredAt: LocalTranslationMutationRow['occurredAt']
): Omit<LocalTranslationProfileRow, 'stateFingerprint'> => {
  const base = current ?? defaultProfile(key, occurredAt);
  return Object.freeze({ ...base, revision: base.revision + 1, lastMutationId: mutationId,
    createdAt: current?.createdAt ?? occurredAt, updatedAt: occurredAt });
};

export class UpdateLocalTranslationProfileUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: UpdateLocalTranslationProfileInput) {
    const preferred = language(input.preferredLanguage);
    const secondary = [...new Set(input.secondaryLanguages.map((item) => language(item)).filter((item): item is string => Boolean(item)))].sort();
    if (!SAFE_ID.test(input.clientOperationId) || !preferred || secondary.length !== input.secondaryLanguages.length
      || secondary.length > 8 || secondary.includes(preferred) || input.preserveOriginalAudio !== true)
      return Promise.resolve(err(invalid(context, 'Dil profili girdisi geçersizdir.')));
    const normalized = Object.freeze({ ...input, preferredLanguage: preferred, secondaryLanguages: secondary });
    return executeProfileMutation(this.unitOfWork, context, input, 'profile_update', normalized, (scope, current, identity) => {
      const person = context.actor.personId!; const key = localTranslationKey(context, person);
      const base = nextProfileBase(key, current, identity, scope.occurredAt);
      return ok({ nextProfile: Object.freeze({ ...base, preferredLanguage: preferred,
        secondaryLanguages: Object.freeze(secondary), liveCaptionTranslationEnabled: input.liveCaptionTranslationEnabled,
        translatedSpeechEnabled: input.translatedSpeechEnabled, externalProviderAllowed: input.externalProviderAllowed,
        encryptedSyncRequested: input.encryptedSyncRequested, encryptedSyncExecuted: false }), persistRelated: () => ok(undefined) });
    });
  }
}

export class AddLocalTranslationDictionaryEntryUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: AddLocalTranslationDictionaryEntryInput) {
    const sourceLanguage = language(input.sourceLanguage); const targetLanguage = language(input.targetLanguage);
    const sourceTerm = normalizedText(input.sourceTerm, 1, 120); const preferredTerm = normalizedText(input.preferredTerm, 1, 120);
    if (!SAFE_ID.test(input.clientOperationId) || !sourceLanguage || !targetLanguage || !sourceTerm || !preferredTerm
      || input.explicitPermission !== true || !['family_name','nickname','place','medical_term'].includes(input.category))
      return Promise.resolve(err(invalid(context, 'Kişisel sözlük girdisi geçersizdir.')));
    const normalized = Object.freeze({ ...input, sourceLanguage, targetLanguage, sourceTerm, preferredTerm });
    return executeProfileMutation(this.unitOfWork, context, input, 'dictionary_add', normalized, (scope, current, identity) => {
      const person = context.actor.personId!; const key = localTranslationKey(context, person);
      const id = dictionaryId(context, sourceLanguage, targetLanguage, sourceTerm);
      const existing = scope.findDictionaryEntry(id); if (!existing.ok) return existing;
      if (existing.value) return err(conflict(context, 'Bu kişisel sözlük girdisi zaten vardır.'));
      const nextProfile = nextProfileBase(key, current, identity, scope.occurredAt);
      const row: LocalTranslationDictionaryEntryRow = Object.freeze({ id, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, profileId: key.profileId, category: input.category, sourceLanguage,
        targetLanguage, sourceTerm, preferredTerm, explicitPermissionRecorded: true, state: 'active', revision: 1,
        lastMutationId: identity, createdAt: scope.occurredAt, updatedAt: scope.occurredAt });
      return ok({ nextProfile, persistRelated: () => scope.insertDictionaryEntry(row) });
    });
  }
}

export class UpdateLocalTranslationDictionaryEntryUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: UpdateLocalTranslationDictionaryEntryInput) {
    const sourceLanguage = language(input.sourceLanguage); const targetLanguage = language(input.targetLanguage);
    const sourceTerm = normalizedText(input.sourceTerm, 1, 120); const preferredTerm = normalizedText(input.preferredTerm, 1, 120);
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.entryId) || !sourceLanguage || !targetLanguage
      || !sourceTerm || !preferredTerm || input.explicitPermission !== true
      || !['family_name','nickname','place','medical_term'].includes(input.category))
      return Promise.resolve(err(invalid(context, 'Kişisel sözlük güncellemesi geçersizdir.')));
    const normalized = Object.freeze({ ...input, sourceLanguage, targetLanguage, sourceTerm, preferredTerm });
    return executeProfileMutation(this.unitOfWork, context, input, 'dictionary_update', normalized, (scope, current, identity) => {
      const found = scope.findDictionaryEntry(input.entryId); if (!found.ok) return found;
      if (!found.value || found.value.state !== 'active') return err(missing(context, 'Etkin kişisel sözlük girdisi bulunamadı.'));
      const key = localTranslationKey(context, context.actor.personId!);
      const row: LocalTranslationDictionaryEntryRow = Object.freeze({ ...found.value, category: input.category,
        sourceLanguage, targetLanguage, sourceTerm, preferredTerm, revision: found.value.revision + 1,
        lastMutationId: identity, updatedAt: scope.occurredAt });
      return ok({ nextProfile: nextProfileBase(key, current, identity, scope.occurredAt),
        persistRelated: () => scope.saveDictionaryEntry(row, found.value!.revision) });
    });
  }
}

export class DeleteLocalTranslationDictionaryEntryUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: DeleteLocalTranslationDictionaryEntryInput) {
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.entryId) || !normalizedText(input.reason, 2, 300))
      return Promise.resolve(err(invalid(context, 'Kişisel sözlük silme girdisi geçersizdir.')));
    return executeProfileMutation(this.unitOfWork, context, input, 'dictionary_delete', input, (scope, current, identity) => {
      const found = scope.findDictionaryEntry(input.entryId); if (!found.ok) return found;
      if (!found.value || found.value.state !== 'active') return err(missing(context, 'Etkin kişisel sözlük girdisi bulunamadı.'));
      const key = localTranslationKey(context, context.actor.personId!);
      const row: LocalTranslationDictionaryEntryRow = Object.freeze({ ...found.value, sourceTerm: '', preferredTerm: '',
        state: 'deleted', revision: found.value.revision + 1, lastMutationId: identity, updatedAt: scope.occurredAt });
      return ok({ nextProfile: nextProfileBase(key, current, identity, scope.occurredAt),
        persistRelated: () => scope.saveDictionaryEntry(row, found.value!.revision) });
    });
  }
}

const executeRequestMutation = (
  unitOfWork: LocalTranslationUnitOfWork,
  context: LifeApplicationContext,
  input: { readonly clientOperationId: string; readonly expectedRevision: number; readonly requestId: string },
  kind: Extract<LocalTranslationMutationKind, 'correction_record' | 'request_cancel'>,
  fingerprintValue: unknown,
  build: (scope: LocalTranslationWriteScope, current: LocalTranslationRequestRow, identity: string) => Result<Omit<LocalTranslationRequestRow, 'stateFingerprint'>, AppError>
) => {
  const fingerprint = hash(fingerprintValue); const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
  return unitOfWork.execute(context, localTranslationWriteIntent('local_translation_request', input.requestId, 'update'), (scope) => {
    const prior = scope.findMutation(input.clientOperationId); if (!prior.ok) return prior;
    const repeated = replay(context, prior.value, 'local_translation_request', input.requestId, kind, fingerprint, input.expectedRevision);
    if (!repeated.ok || repeated.value) return repeated as Result<LocalTranslationMutationReceiptView, AppError>;
    const found = scope.findRequest(input.requestId); if (!found.ok) return found;
    if (!found.value) return err(missing(context, 'Çeviri hazırlık talebi bulunamadı.'));
    if (found.value.revision !== input.expectedRevision) return err(conflict(context, 'Çeviri talebi sürümü değişmiştir.'));
    const identity = mutationIdentity(context, input.clientOperationId, fingerprint);
    const built = build(scope, found.value, identity); if (!built.ok) return built;
    const stateFingerprint = rowFingerprint(built.value);
    const mutationRow = mutation(context, scope, input, 'local_translation_request', input.requestId, kind, fingerprint, stateFingerprint);
    const mutationSaved = scope.insertMutation(mutationRow); if (!mutationSaved.ok) return mutationSaved;
    const saved = scope.saveRequest(Object.freeze({ ...built.value, stateFingerprint }), input.expectedRevision); if (!saved.ok) return saved;
    return finish(context, scope, mutationRow);
  });
};

export class PrepareLocalTranslationRequestUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: PrepareLocalTranslationRequestInput) {
    const person = actorPerson(context); if (!person.ok) return Promise.resolve(person);
    const targetLanguage = language(input.targetLanguage);
    if (!SAFE_ID.test(input.clientOperationId) || input.expectedRevision !== 0 || !SAFE_ID.test(input.sourceResourceId)
      || !targetLanguage || !['message','live_caption','document','meeting_summary'].includes(input.sourceKind)
      || !['local_offline','external_preview'].includes(input.providerMode)
      || (input.providerMode === 'local_offline' && (input.externalPreviewAcknowledged || input.explicitExternalConsent))
      || (input.providerMode === 'external_preview' && (!input.externalPreviewAcknowledged || !input.explicitExternalConsent)))
      return Promise.resolve(err(invalid(context, 'Çeviri hazırlık talebi geçersizdir.')));
    const id = requestId(context, input.clientOperationId); const fingerprint = hash({ ...input, targetLanguage });
    return this.unitOfWork.execute(context, localTranslationWriteIntent('local_translation_request', id, 'create', person.value), (scope) => {
      const prior = scope.findMutation(input.clientOperationId); if (!prior.ok) return prior;
      const repeated = replay(context, prior.value, 'local_translation_request', id, 'request_prepare', fingerprint, 0);
      if (!repeated.ok || repeated.value) return repeated as Result<LocalTranslationMutationReceiptView, AppError>;
      const identity = mutationIdentity(context, input.clientOperationId, fingerprint);
      const base: Omit<LocalTranslationRequestRow, 'stateFingerprint'> = Object.freeze({ id, familyId: context.familyId,
        ownerPersonId: scope.ownerPersonId, sourceKind: input.sourceKind, sourceResourceId: input.sourceResourceId,
        targetLanguage, providerMode: input.providerMode, state: 'provider_unavailable',
        originalPreservationRequired: true, separateTranslationViewRequired: true, machineTranslationLabelRequired: true,
        qualityFlag: 'not_evaluated', externalPreviewAcknowledged: input.externalPreviewAcknowledged,
        explicitExternalConsent: input.explicitExternalConsent, languageDetectionExecuted: false, translationExecuted: false,
        speechToTextExecuted: false, speakerSeparationExecuted: false, liveCaptionTranslationExecuted: false,
        textToSpeechExecuted: false, networkUsed: false, cloudUsed: false, revision: 1, lastMutationId: identity,
        createdAt: scope.occurredAt, updatedAt: scope.occurredAt });
      const stateFingerprint = rowFingerprint(base);
      const mutationRow = mutation(context, scope, input, 'local_translation_request', id, 'request_prepare', fingerprint, stateFingerprint);
      const mutationSaved = scope.insertMutation(mutationRow); if (!mutationSaved.ok) return mutationSaved;
      const inserted = scope.insertRequest(Object.freeze({ ...base, stateFingerprint })); if (!inserted.ok) return inserted;
      return finish(context, scope, mutationRow);
    });
  }
}

export class RecordLocalTranslationCorrectionUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: RecordLocalTranslationCorrectionInput) {
    const corrected = normalizedText(input.correctedText, 1, 10_000);
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.requestId) || !corrected || input.explicitPermission !== true)
      return Promise.resolve(err(invalid(context, 'Çeviri düzeltme girdisi geçersizdir.')));
    const fingerprintValue = Object.freeze({ ...input, correctedTextSha256: hash(corrected), correctedText: undefined });
    return executeRequestMutation(this.unitOfWork, context, input, 'correction_record', fingerprintValue, (scope, current, identity) => {
      if (current.state === 'cancelled') return err(conflict(context, 'İptal edilmiş çeviri talebi düzeltilemez.'));
      return ok(Object.freeze({ ...current, state: 'correction_recorded', qualityFlag: 'not_evaluated',
        correctionSha256: hash(corrected), correctionCharacterCount: [...corrected].length,
        revision: current.revision + 1, lastMutationId: identity, updatedAt: scope.occurredAt }));
    });
  }
}

export class CancelLocalTranslationRequestUseCase {
  public constructor(private readonly unitOfWork: LocalTranslationUnitOfWork) {}
  public execute(context: LifeApplicationContext, input: CancelLocalTranslationRequestInput) {
    if (!SAFE_ID.test(input.clientOperationId) || !SAFE_ID.test(input.requestId) || !normalizedText(input.reason, 2, 300))
      return Promise.resolve(err(invalid(context, 'Çeviri talebi iptal girdisi geçersizdir.')));
    return executeRequestMutation(this.unitOfWork, context, input, 'request_cancel', input, (scope, current, identity) => {
      if (current.state === 'cancelled') return err(conflict(context, 'Çeviri talebi zaten iptal edilmiştir.'));
      return ok(Object.freeze({ ...current, state: 'cancelled', revision: current.revision + 1,
        lastMutationId: identity, updatedAt: scope.occurredAt }));
    });
  }
}

export const isLocalTranslationCorrectionSha256 = (value: unknown): value is string =>
  typeof value === 'string' && SHA256.test(value);
