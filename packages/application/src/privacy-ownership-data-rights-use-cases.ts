import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  PRIVACY_OWNERSHIP_MAX_ACCESS_HISTORY_ITEMS,
  PRIVACY_OWNERSHIP_MAX_AI_MEMORY_RECORDS,
  PRIVACY_OWNERSHIP_MAX_INCIDENTS,
  PRIVACY_OWNERSHIP_MAX_ENCRYPTED_EXPORTS,
  PRIVACY_OWNERSHIP_MAX_INVENTORY_ITEMS,
  PRIVACY_OWNERSHIP_MAX_LINEAGE_ITEMS,
  PRIVACY_OWNERSHIP_MAX_PROCESSING_OBSERVATIONS,
  PRIVACY_OWNERSHIP_MAX_RIGHTS_REQUESTS,
  PRIVACY_OWNERSHIP_MAX_SELECTED_ACCOUNTS,
  PRIVACY_OWNERSHIP_MAX_TEXT_LENGTH,
  canonicalAiMemoryStateJson,
  canonicalDataRightsRequestStateJson,
  canonicalEncryptedPrivacyExportStateJson,
  canonicalPrivacyIncidentStateJson,
  type AiMemoryRecordView,
  type CorrectAiMemoryInput,
  type CreateDataRightsRequestInput,
  type CreatePrivacyIncidentInput,
  type DataRightsRequestView,
  type DeleteAiMemoryInput,
  type ExpireAiMemoryInput,
  type EncryptedPrivacyExportView,
  type FamilyRole,
  type FinalizeEncryptedPrivacyExportInput,
  type PermissionSimulationItemView,
  type PermissionSimulationTarget,
  type PermissionSimulationView,
  type PrivacyIncidentActionIntent,
  type PrivacyIncidentView,
  type PrivacyOwnershipAggregateKey,
  type PrivacyOwnershipControlCenterView,
  type PrivacyOwnershipMutationReceiptView,
  type RestrictAiMemoryInput,
  type UpdateDataRightsRequestInput,
  type UpdatePrivacyIncidentInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  AiMemoryRecordRow,
  DataRightsRequestRow,
  EncryptedPrivacyExportRow,
  PrivacyIncidentRow,
  PrivacyOwnershipCenterSnapshotRow,
  PrivacyOwnershipMutationKind,
  PrivacyOwnershipMutationRow
} from '@ppt/repository-contracts';

export interface PrivacyOwnershipApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: PersonId;
  };
  readonly correlationId: CorrelationId;
}

export interface PrivacyOwnershipPolicyIntent {
  readonly action: 'read' | 'create' | 'update' | 'delete' | 'administer';
  readonly capability: 'family.read' | 'family.write';
  readonly resourceType: 'privacy_ownership_center' | 'ai_memory_record' | 'data_rights_request' | 'privacy_incident';
  readonly resourceId: string;
  readonly purpose: 'administration' | 'ai_processing';
  readonly familyId: FamilyId;
  readonly ownerPersonId: PersonId;
  readonly privacy: 'private';
  readonly sensitivity: 'highly_sensitive';
}

export interface PrivacyOwnershipWriteScope {
  readonly occurredAt: IsoDateTime;
  loadCenter(key: PrivacyOwnershipAggregateKey): Result<PrivacyOwnershipCenterSnapshotRow, AppError>;
  findAiMemoryRecord(key: PrivacyOwnershipAggregateKey, recordId: string): Result<AiMemoryRecordRow | null, AppError>;
  saveAiMemoryRecord(row: AiMemoryRecordRow, expectedRevision: number): Result<boolean, AppError>;
  propagateAiMemoryDeletion(recordId: string, derivedBindingHash: string): Result<{ readonly locallyCompleted: boolean }, AppError>;
  findRightsRequest(key: PrivacyOwnershipAggregateKey, requestId: string): Result<DataRightsRequestRow | null, AppError>;
  insertRightsRequest(row: DataRightsRequestRow): Result<void, AppError>;
  saveRightsRequest(row: DataRightsRequestRow, expectedRevision: number): Result<boolean, AppError>;
  recordEncryptedExport(row: EncryptedPrivacyExportRow): Result<void, AppError>;
  findIncident(key: PrivacyOwnershipAggregateKey, incidentId: string): Result<PrivacyIncidentRow | null, AppError>;
  insertIncident(row: PrivacyIncidentRow): Result<void, AppError>;
  saveIncident(row: PrivacyIncidentRow, expectedRevision: number): Result<boolean, AppError>;
  findMutationByClientOperationId(key: PrivacyOwnershipAggregateKey, clientOperationId: string): Result<PrivacyOwnershipMutationRow | null, AppError>;
  insertMutation(row: PrivacyOwnershipMutationRow): Result<void, AppError>;
  advanceSecurityEpochAndRevokeLocalSessions(accountId: UserId): Result<{ readonly securityEpoch: number }, AppError>;
  revokeTrustedDevice(trustedDeviceId: string): Result<void, AppError>;
  revokeOfflineCapability(leaseId: string): Result<void, AppError>;
  revokeConsent(consentId: string): Result<void, AppError>;
  revokeCapability(capabilityId: string): Result<void, AppError>;
  quarantineLocalDerivedData(resourceId: string): Result<void, AppError>;
  evaluatePermission(target: PermissionSimulationTarget): Result<{ readonly allowed: boolean; readonly reason: string; readonly obligations: readonly string[] }, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: PrivacyOwnershipPolicyIntent['resourceType'];
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<T>(event: DomainEvent<T>): Result<void, AppError>;
}

export interface PrivacyOwnershipUnitOfWork {
  /** Policy receipt, mutation, current row, local containment effects, audit and outbox commit atomically or all roll back. */
  execute<T>(
    context: PrivacyOwnershipApplicationContext,
    intent: PrivacyOwnershipPolicyIntent,
    operation: (scope: PrivacyOwnershipWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface PrivacyOwnershipMutationIdentifiers {
  readonly mutationId: string;
  readonly resourceId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export interface FinalizeEncryptedPrivacyExportIdentifiers {
  readonly mutationId: string;
  readonly exportId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

export type ManageAiMemoryCommand =
  | { readonly operation: 'correct'; readonly input: CorrectAiMemoryInput }
  | { readonly operation: 'restrict'; readonly input: RestrictAiMemoryInput }
  | { readonly operation: 'delete'; readonly input: DeleteAiMemoryInput }
  | { readonly operation: 'expire'; readonly input: ExpireAiMemoryInput };

export type ManageDataRightsRequestCommand =
  | { readonly operation: 'create'; readonly input: CreateDataRightsRequestInput }
  | { readonly operation: 'update'; readonly input: UpdateDataRightsRequestInput };

export type ManagePrivacyIncidentCommand =
  | { readonly operation: 'create'; readonly input: CreatePrivacyIncidentInput }
  | { readonly operation: 'update'; readonly input: UpdatePrivacyIncidentInput };

const appError = (
  context: PrivacyOwnershipApplicationContext,
  code: typeof ERROR_CODES.CORE_INVALID_ARGUMENT | typeof ERROR_CODES.AUTHORIZATION_DENIED
    | typeof ERROR_CODES.RESOURCE_CONFLICT | typeof ERROR_CODES.RESOURCE_NOT_FOUND,
  category: 'validation' | 'authorization' | 'conflict' | 'not_found',
  message: string
): AppError => createAppError({ code, category, message, correlationId: context.correlationId });
const invalid = (c: PrivacyOwnershipApplicationContext, m: string) => appError(c, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', m);
const denied = (c: PrivacyOwnershipApplicationContext, m: string) => appError(c, ERROR_CODES.AUTHORIZATION_DENIED, 'authorization', m);
const conflict = (c: PrivacyOwnershipApplicationContext, m: string) => appError(c, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', m);
const missing = (c: PrivacyOwnershipApplicationContext, m: string) => appError(c, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', m);

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const nonEmpty = (value: unknown, maximum = 256): value is string => typeof value === 'string'
  && value === value.trim() && value.length > 0 && value.length <= maximum;
const validDate = (value: unknown): value is IsoDateTime => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 2_147_483_647;
const validOperationId = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && /^[A-Za-z0-9._:-]{8,128}$/u.test(value);
const exactObject = (value: unknown, required: readonly string[], optional: readonly string[] = []): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key));
};
const exactKey = (left: PrivacyOwnershipAggregateKey, right: PrivacyOwnershipAggregateKey): boolean =>
  left.familyId === right.familyId && left.accountId === right.accountId && left.ownerPersonId === right.ownerPersonId;

const keyFor = (context: PrivacyOwnershipApplicationContext): Result<PrivacyOwnershipAggregateKey, AppError> => {
  if (!context.actor.personId) return err(denied(context, 'Gizlilik merkezi için kişi bağlı etkin oturum gerekir.'));
  return ok({ familyId: context.familyId, accountId: context.actor.userId, ownerPersonId: context.actor.personId });
};

const policyIntent = (
  key: PrivacyOwnershipAggregateKey,
  action: PrivacyOwnershipPolicyIntent['action'],
  capability: PrivacyOwnershipPolicyIntent['capability'],
  resourceType: PrivacyOwnershipPolicyIntent['resourceType'],
  resourceId: string,
  purpose: PrivacyOwnershipPolicyIntent['purpose']
): PrivacyOwnershipPolicyIntent => ({
  action, capability, resourceType, resourceId, purpose,
  familyId: key.familyId, ownerPersonId: key.ownerPersonId,
  privacy: 'private', sensitivity: 'highly_sensitive'
});

const identifiersValid = (identifiers: PrivacyOwnershipMutationIdentifiers): boolean =>
  exactObject(identifiers, ['mutationId', 'resourceId', 'requestFingerprint', 'auditId', 'outboxEventId'])
  && nonEmpty(identifiers.mutationId) && nonEmpty(identifiers.resourceId)
  && nonEmpty(identifiers.auditId) && /^[0-9a-f]{64}$/u.test(identifiers.requestFingerprint)
  && nonEmpty(String(identifiers.outboxEventId));

const mutationInputValid = (value: { readonly expectedRevision: number; readonly clientOperationId: string }): boolean =>
  validRevision(value.expectedRevision) && validOperationId(value.clientOperationId);

const mutationReceipt = (row: PrivacyOwnershipMutationRow, replayed: boolean): PrivacyOwnershipMutationReceiptView => ({
  clientOperationId: row.clientOperationId,
  mutationKind: row.mutationKind,
  resourceType: row.resourceType,
  resourceId: row.resourceId,
  previousRevision: row.previousRevision,
  revision: row.revision,
  occurredAt: row.createdAt,
  stateFingerprint: row.stateFingerprint,
  replayed
});

interface CurrentMutationState { readonly revision: number; readonly stateFingerprint: string }
interface PreparedMutation {
  readonly previousRevision: number;
  readonly revision: number;
  readonly stateFingerprint: string;
  persist(): Result<void, AppError>;
}

const executeMutation = (
  unitOfWork: PrivacyOwnershipUnitOfWork,
  input: {
    readonly context: PrivacyOwnershipApplicationContext;
    readonly expectedRevision: number;
    readonly clientOperationId: string;
    readonly identifiers: PrivacyOwnershipMutationIdentifiers;
  },
  specification: {
    readonly mutationKind: PrivacyOwnershipMutationKind;
    readonly resourceType: 'ai_memory_record' | 'data_rights_request' | 'privacy_incident';
    readonly intent: PrivacyOwnershipPolicyIntent;
    readonly auditAction: string;
    readonly eventType: `${string}.${string}`;
    loadCurrent(scope: PrivacyOwnershipWriteScope, key: PrivacyOwnershipAggregateKey): Result<CurrentMutationState | null, AppError>;
    prepare(scope: PrivacyOwnershipWriteScope, key: PrivacyOwnershipAggregateKey): Result<PreparedMutation, AppError>;
  }
): Promise<Result<PrivacyOwnershipMutationReceiptView, AppError>> => {
  const key = keyFor(input.context);
  if (!key.ok) return Promise.resolve(key);
  if (!mutationInputValid(input) || !identifiersValid(input.identifiers)) {
    return Promise.resolve(err(invalid(input.context, 'İşlem kimliği, revizyon veya fingerprint geçersiz.')));
  }
  return unitOfWork.execute(input.context, specification.intent, (scope) => {
    const replay = scope.findMutationByClientOperationId(key.value, input.clientOperationId);
    if (!replay.ok) return replay;
    if (replay.value) {
      if (replay.value.requestFingerprint !== input.identifiers.requestFingerprint
        || replay.value.mutationKind !== specification.mutationKind
        || replay.value.resourceType !== specification.resourceType
        || replay.value.resourceId !== input.identifiers.resourceId
        || replay.value.previousRevision !== input.expectedRevision
        || replay.value.familyId !== key.value.familyId || replay.value.accountId !== key.value.accountId
        || replay.value.ownerPersonId !== key.value.ownerPersonId) {
        return err(conflict(input.context, 'İstemci işlem kimliği farklı istek veya kapsamla kullanılmış.'));
      }
      const current = specification.loadCurrent(scope, key.value);
      if (!current.ok) return current;
      if (!current.value || current.value.revision !== replay.value.revision
        || current.value.stateFingerprint !== replay.value.stateFingerprint) {
        return err(conflict(input.context, 'İdempotent işlem sonucu artık exact current state değildir.'));
      }
      return ok(mutationReceipt(replay.value, true));
    }

    const prepared = specification.prepare(scope, key.value);
    if (!prepared.ok) return prepared;
    if (prepared.value.previousRevision !== input.expectedRevision) {
      return err(conflict(input.context, 'Kaynak revizyonu güncel değil.'));
    }
    const mutation: PrivacyOwnershipMutationRow = {
      id: input.identifiers.mutationId,
      clientOperationId: input.clientOperationId,
      requestFingerprint: input.identifiers.requestFingerprint,
      familyId: key.value.familyId,
      accountId: key.value.accountId,
      ownerPersonId: key.value.ownerPersonId,
      mutationKind: specification.mutationKind,
      resourceType: specification.resourceType,
      resourceId: input.identifiers.resourceId,
      previousRevision: prepared.value.previousRevision,
      revision: prepared.value.revision,
      stateFingerprint: prepared.value.stateFingerprint,
      createdAt: scope.occurredAt
    };
    const inserted = scope.insertMutation(mutation);
    if (!inserted.ok) return inserted;
    const persisted = prepared.value.persist();
    if (!persisted.ok) return persisted;
    const audited = scope.appendAudit({
      id: input.identifiers.auditId, action: specification.auditAction,
      resourceType: specification.intent.resourceType, resourceId: input.identifiers.resourceId,
      occurredAt: scope.occurredAt, actorId: input.context.actor.userId
    });
    if (!audited.ok) return audited;
    const event: DomainEvent<{ readonly clientOperationId: string; readonly revision: number; readonly stateFingerprint: string }> = {
      eventId: input.identifiers.outboxEventId,
      eventType: specification.eventType,
      eventVersion: 1,
      aggregateType: specification.resourceType,
      aggregateId: input.identifiers.resourceId,
      occurredAt: scope.occurredAt,
      actorId: input.context.actor.userId,
      correlationId: input.context.correlationId,
      payload: { clientOperationId: input.clientOperationId, revision: mutation.revision, stateFingerprint: mutation.stateFingerprint }
    };
    const queued = scope.enqueueEvent(event);
    return queued.ok ? ok(mutationReceipt(mutation, false)) : queued;
  });
};

const aiView = (row: AiMemoryRecordRow): AiMemoryRecordView => {
  const { familyId: _familyId, accountId: _accountId, ownerPersonId: _personId,
    lastMutationId: _mutationId, stateFingerprint: _fingerprint, derivedBindingHash: _binding, ...view } = row;
  return view;
};
const rightsView = (row: DataRightsRequestRow): DataRightsRequestView => {
  const { familyId: _familyId, accountId: _accountId, ownerPersonId: _personId,
    lastMutationId: _mutationId, stateFingerprint: _fingerprint, ...view } = row;
  return view;
};
const incidentView = (row: PrivacyIncidentRow): PrivacyIncidentView => {
  const { familyId: _familyId, accountId: _accountId, ownerPersonId: _personId,
    lastMutationId: _mutationId, stateFingerprint: _fingerprint, ...view } = row;
  return view;
};
const encryptedExportView = (row: EncryptedPrivacyExportRow): EncryptedPrivacyExportView => {
  const { familyId: _familyId, accountId: _accountId, ownerPersonId: _personId,
    stateFingerprint: _fingerprint, ...view } = row;
  return view;
};

const rowIdentityExact = (
  row: { readonly familyId: FamilyId; readonly accountId: UserId; readonly ownerPersonId: PersonId; readonly key: PrivacyOwnershipAggregateKey },
  key: PrivacyOwnershipAggregateKey
): boolean => row.familyId === key.familyId && row.accountId === key.accountId
  && row.ownerPersonId === key.ownerPersonId && exactKey(row.key, key);

const snapshotValid = (snapshot: PrivacyOwnershipCenterSnapshotRow, key: PrivacyOwnershipAggregateKey): boolean =>
  exactKey(snapshot.key, key)
  && snapshot.aiMemoryRecords.length <= PRIVACY_OWNERSHIP_MAX_AI_MEMORY_RECORDS
  && snapshot.dataInventory.length <= PRIVACY_OWNERSHIP_MAX_INVENTORY_ITEMS
  && snapshot.accessHistory.length <= PRIVACY_OWNERSHIP_MAX_ACCESS_HISTORY_ITEMS
  && snapshot.localProcessingObservations.length <= PRIVACY_OWNERSHIP_MAX_PROCESSING_OBSERVATIONS
  && snapshot.derivedDataLineage.length <= PRIVACY_OWNERSHIP_MAX_LINEAGE_ITEMS
  && snapshot.rightsRequests.length <= PRIVACY_OWNERSHIP_MAX_RIGHTS_REQUESTS
  && snapshot.encryptedExports.length <= PRIVACY_OWNERSHIP_MAX_ENCRYPTED_EXPORTS
  && snapshot.incidents.length <= PRIVACY_OWNERSHIP_MAX_INCIDENTS
  && snapshot.aiMemoryRecords.every((row) => rowIdentityExact(row, key)
    && /^[0-9a-f]{64}$/u.test(row.derivedBindingHash)
    && row.stateFingerprint === sha256(canonicalAiMemoryStateJson(aiView(row))))
  && snapshot.rightsRequests.every((row) => rowIdentityExact(row, key)
    && row.stateFingerprint === sha256(canonicalDataRightsRequestStateJson(rightsView(row))))
  && snapshot.incidents.every((row) => rowIdentityExact(row, key)
    && row.stateFingerprint === sha256(canonicalPrivacyIncidentStateJson(incidentView(row))))
  && snapshot.encryptedExports.every((row) => row.familyId === key.familyId
    && row.accountId === key.accountId && row.ownerPersonId === key.ownerPersonId && exactKey(row.key, key)
    && row.stateFingerprint === sha256(canonicalEncryptedPrivacyExportStateJson(encryptedExportView(row))))
  && snapshot.dataInventory.every((row) => exactKey(row.key, key))
  && snapshot.accessHistory.every((row) => exactKey(row.key, key))
  && snapshot.localDeviceActivity.every((row) => exactKey(row.key, key) && row.observationSource === 'local_runtime')
  && snapshot.localProcessingObservations.every((row) => exactKey(row.key, key)
    && row.observationSource === 'local_runtime' && row.networkDeliveryObserved === false)
  && snapshot.derivedDataLineage.every((row) => exactKey(row.key, key) && row.payloadExposed === false);

export class GetPrivacyOwnershipControlCenterUseCase {
  public constructor(private readonly unitOfWork: PrivacyOwnershipUnitOfWork) {}
  public execute(context: PrivacyOwnershipApplicationContext): Promise<Result<PrivacyOwnershipControlCenterView, AppError>> {
    const key = keyFor(context);
    if (!key.ok) return Promise.resolve(key);
    return this.unitOfWork.execute(context,
      policyIntent(key.value, 'read', 'family.read', 'privacy_ownership_center', key.value.accountId, 'administration'),
      (scope) => {
        const loaded = scope.loadCenter(key.value);
        if (!loaded.ok) return loaded;
        if (!snapshotValid(loaded.value, key.value)) return err(denied(context, 'Gizlilik merkezi snapshot kapsamı veya mühürü geçersiz.'));
        return ok({
          schemaVersion: 1,
          key: key.value,
          aiMemoryRecords: loaded.value.aiMemoryRecords.map(aiView),
          dataInventory: loaded.value.dataInventory,
          accessHistory: loaded.value.accessHistory,
          localDeviceActivity: loaded.value.localDeviceActivity,
          localProcessingObservations: loaded.value.localProcessingObservations,
          derivedDataLineage: loaded.value.derivedDataLineage,
          rightsRequests: loaded.value.rightsRequests.map(rightsView),
          encryptedExports: loaded.value.encryptedExports.map(encryptedExportView),
          incidents: loaded.value.incidents.map(incidentView),
          truth: {
            scope: 'local_observation_and_authority_only', remoteWipeAvailable: false, mdmAvailable: false,
            networkDeliveryGuaranteed: false, processingShownOnlyWhenLocallyObserved: true,
            trustedDeviceDoesNotMeanOpenSession: true, simulationCreatesNoGrant: true,
            simulationPerformsNoAccess: true, externalCopiesErasureGuaranteed: false, derivedPayloadExposed: false
          },
          generatedAt: loaded.value.generatedAt
        });
      });
  }
}

const restrictionValid = (value: RestrictAiMemoryInput['restriction']): boolean => {
  if (!exactObject(value, ['visibility', 'selectedAccountIds', 'allowedPurposes', 'processingAllowed'])
    || !Array.isArray(value.selectedAccountIds) || !Array.isArray(value.allowedPurposes)
    || !['owner_only', 'selected_accounts', 'family'].includes(value.visibility)
    || !value.allowedPurposes.every((item) => ['general', 'care', 'finance', 'health', 'archive', 'legacy', 'ai_processing'].includes(item))) {
    return false;
  }
  const uniqueAccounts = new Set(value.selectedAccountIds);
  const uniquePurposes = new Set(value.allowedPurposes);
  return value.selectedAccountIds.length <= PRIVACY_OWNERSHIP_MAX_SELECTED_ACCOUNTS
    && uniqueAccounts.size === value.selectedAccountIds.length
    && value.selectedAccountIds.every((item) => nonEmpty(item))
    && uniquePurposes.size === value.allowedPurposes.length
    && value.allowedPurposes.length > 0
    && (value.visibility === 'selected_accounts' ? value.selectedAccountIds.length > 0 : value.selectedAccountIds.length === 0)
    && (!value.processingAllowed || value.allowedPurposes.includes('ai_processing'));
};

const rightsTransitionAllowed = (
  current: DataRightsRequestView['status'],
  next: DataRightsRequestView['status']
): boolean => current === 'requested'
  ? next === 'in_review' || next === 'rejected' || next === 'cancelled'
  : current === 'in_review'
    ? next === 'locally_completed' || next === 'rejected' || next === 'cancelled'
    : false;

const incidentTransitionAllowed = (
  current: PrivacyIncidentView['status'],
  next: PrivacyIncidentView['status']
): boolean => current === 'open'
  ? next === 'contained_locally' || next === 'resolved' || next === 'cancelled'
  : current === 'contained_locally'
    ? next === 'resolved' || next === 'cancelled'
    : false;

export class ManageAiMemoryUseCase {
  public constructor(private readonly unitOfWork: PrivacyOwnershipUnitOfWork) {}
  public execute(input: {
    readonly context: PrivacyOwnershipApplicationContext;
    readonly command: ManageAiMemoryCommand;
    readonly identifiers: PrivacyOwnershipMutationIdentifiers;
  }): Promise<Result<PrivacyOwnershipMutationReceiptView, AppError>> {
    const value = input.command.input;
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    const commandKeysValid = exactObject(input.command, ['operation', 'input'])
      && (input.command.operation === 'correct'
        ? exactObject(value, ['recordId', 'expectedRevision', 'clientOperationId', 'title', 'statement'])
        : input.command.operation === 'restrict'
          ? exactObject(value, ['recordId', 'expectedRevision', 'clientOperationId', 'restriction'])
          : input.command.operation === 'delete'
            ? exactObject(value, ['recordId', 'expectedRevision', 'clientOperationId', 'reason'])
            : input.command.operation === 'expire'
              ? exactObject(value, ['recordId', 'expectedRevision', 'clientOperationId', 'retentionUntil'])
              : false);
    if (!commandKeysValid || !mutationInputValid(value) || !nonEmpty(value.recordId) || input.identifiers.resourceId !== value.recordId) {
      return Promise.resolve(err(invalid(input.context, 'AI hafıza komutu kimliği veya revizyonu geçersiz.')));
    }
    if (input.command.operation === 'correct'
      && (!nonEmpty(input.command.input.title, 256) || !nonEmpty(input.command.input.statement, PRIVACY_OWNERSHIP_MAX_TEXT_LENGTH))) {
      return Promise.resolve(err(invalid(input.context, 'AI hafıza düzeltme metni geçersiz.')));
    }
    if (input.command.operation === 'restrict' && !restrictionValid(input.command.input.restriction)) {
      return Promise.resolve(err(invalid(input.context, 'AI hafıza sınırı geçersiz.')));
    }
    if (input.command.operation === 'delete' && !nonEmpty(input.command.input.reason, 1_000)) {
      return Promise.resolve(err(invalid(input.context, 'AI hafıza silme nedeni zorunludur.')));
    }
    if (input.command.operation === 'expire' && !validDate(input.command.input.retentionUntil)) {
      return Promise.resolve(err(invalid(input.context, 'AI hafıza süre sonu tarihi geçersiz.')));
    }
    const kind = `ai_memory_${input.command.operation}` as PrivacyOwnershipMutationKind;
    const action = input.command.operation === 'delete' ? 'delete' : 'update';
    return executeMutation(this.unitOfWork, {
      context: input.context, expectedRevision: value.expectedRevision,
      clientOperationId: value.clientOperationId, identifiers: input.identifiers
    }, {
      mutationKind: kind, resourceType: 'ai_memory_record',
      intent: policyIntent(key.value, action, 'family.write', 'ai_memory_record', value.recordId, 'ai_processing'),
      auditAction: `privacy.ai_memory_${input.command.operation}`,
      eventType: `privacy.ai_memory.${input.command.operation}`,
      loadCurrent: (scope, exact) => scope.findAiMemoryRecord(exact, value.recordId),
      prepare: (scope, exact) => {
        const found = scope.findAiMemoryRecord(exact, value.recordId);
        if (!found.ok) return found;
        if (!found.value) return err(missing(input.context, 'AI hafıza kaydı bulunamadı; kullanıcı düzeltmesi yeni kayıt yaratmaz.'));
        const current = found.value;
        if (!rowIdentityExact(current, exact) || !/^[0-9a-f]{64}$/u.test(current.derivedBindingHash)) {
          return err(denied(input.context, 'AI hafıza kaydı exact scope veya sealed PPK-016 binding ile eşleşmiyor.'));
        }
        if (current.revision !== value.expectedRevision) return err(conflict(input.context, 'AI hafıza revizyonu güncel değil.'));
        if (current.status === 'deleted' || current.status === 'pending_deletion') {
          return err(conflict(input.context, 'Silinmiş veya silinmekte olan AI hafıza kaydı değiştirilemez.'));
        }
        const revision = current.revision + 1;
        let nextView: AiMemoryRecordView;
        if (input.command.operation === 'correct') {
          nextView = { ...aiView(current), revision, title: input.command.input.title,
            statement: input.command.input.statement, updatedAt: scope.occurredAt };
        } else if (input.command.operation === 'restrict') {
          nextView = { ...aiView(current), revision, restriction: input.command.input.restriction,
            status: 'restricted', updatedAt: scope.occurredAt };
        } else if (input.command.operation === 'expire') {
          const due = Date.parse(input.command.input.retentionUntil) <= Date.parse(scope.occurredAt);
          nextView = { ...aiView(current), revision, retentionUntil: input.command.input.retentionUntil,
            ...(due ? { status: 'expired' as const, expiredAt: scope.occurredAt,
              restriction: { ...current.restriction, processingAllowed: false } } : {}),
            updatedAt: scope.occurredAt };
        } else {
          nextView = { ...aiView(current), revision, title: '', statement: '', status: 'deleted',
            deletionRequestedAt: scope.occurredAt, deletedAt: scope.occurredAt,
            restriction: { visibility: 'owner_only', selectedAccountIds: [], allowedPurposes: ['general'], processingAllowed: false },
            updatedAt: scope.occurredAt };
        }
        const stateFingerprint = sha256(canonicalAiMemoryStateJson(nextView));
        const row: AiMemoryRecordRow = { ...nextView, familyId: exact.familyId, accountId: exact.accountId,
          ownerPersonId: exact.ownerPersonId, lastMutationId: input.identifiers.mutationId,
          stateFingerprint, derivedBindingHash: current.derivedBindingHash };
        return ok({ previousRevision: current.revision, revision, stateFingerprint,
          persist: () => {
            if (input.command.operation === 'delete') {
              const propagated = scope.propagateAiMemoryDeletion(current.id, current.derivedBindingHash);
              if (!propagated.ok) return propagated;
              if (!propagated.value.locallyCompleted) {
                return err(conflict(input.context, 'Yerel AI hafıza silme yayılımı tamamlanmadı.'));
              }
            }
            const saved = scope.saveAiMemoryRecord(row, current.revision);
            return saved.ok ? (saved.value ? ok(undefined) : err(conflict(input.context, 'AI hafıza kaydı eşzamanlı değişti.'))) : saved;
          } });
      }
    });
  }
}

export class ManageDataRightsRequestUseCase {
  public constructor(private readonly unitOfWork: PrivacyOwnershipUnitOfWork) {}
  public execute(input: {
    readonly context: PrivacyOwnershipApplicationContext;
    readonly command: ManageDataRightsRequestCommand;
    readonly identifiers: PrivacyOwnershipMutationIdentifiers;
  }): Promise<Result<PrivacyOwnershipMutationReceiptView, AppError>> {
    const value = input.command.input;
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    const resourceId = input.command.operation === 'create' ? input.identifiers.resourceId : input.command.input.requestId;
    const commandKeysValid = exactObject(input.command, ['operation', 'input'])
      && (input.command.operation === 'create'
        ? exactObject(value, ['expectedRevision', 'clientOperationId', 'kind', 'scopeResourceType', 'scopeResourceId', 'reason'], ['requestedRetentionUntil'])
        : input.command.operation === 'update'
          ? exactObject(value, ['requestId', 'expectedRevision', 'clientOperationId', 'status'], ['resolutionNote'])
          : false);
    if (!commandKeysValid || !mutationInputValid(value) || !nonEmpty(resourceId) || input.identifiers.resourceId !== resourceId) {
      return Promise.resolve(err(invalid(input.context, 'Veri hakkı talep kimliği veya revizyonu geçersiz.')));
    }
    if (input.command.operation === 'create') {
      const command = input.command.input;
      if (command.expectedRevision !== 0 || !['encrypted_export', 'retention_change', 'erasure', 'legacy_export'].includes(command.kind)
        || !nonEmpty(command.scopeResourceType) || !nonEmpty(command.scopeResourceId)
        || !nonEmpty(command.reason, 1_000)
        || (command.kind === 'encrypted_export'
          && (command.scopeResourceType !== 'privacy_inventory' || command.scopeResourceId !== key.value.ownerPersonId))
        || (command.kind === 'legacy_export'
          && (command.scopeResourceType !== 'digital_legacy' || command.scopeResourceId !== key.value.ownerPersonId))
        || (command.kind === 'retention_change' ? !validDate(command.requestedRetentionUntil) : command.requestedRetentionUntil !== undefined)) {
        return Promise.resolve(err(invalid(input.context, 'Veri hakkı talebi eksik veya geçersiz alan içeriyor.')));
      }
    } else {
      if (!['requested', 'in_review', 'locally_completed', 'rejected', 'cancelled'].includes(input.command.input.status)) {
        return Promise.resolve(err(invalid(input.context, 'Veri hakkı talep durumu geçersiz.')));
      }
      if (input.command.input.status === 'locally_completed' && !nonEmpty(input.command.input.resolutionNote, 1_000)) {
        return Promise.resolve(err(invalid(input.context, 'Tamamlanan talep için yerel çözüm notu gerekir.')));
      }
    }
    const mutationKind: PrivacyOwnershipMutationKind = input.command.operation === 'create' ? 'rights_request_create' : 'rights_request_update';
    return executeMutation(this.unitOfWork, {
      context: input.context, expectedRevision: value.expectedRevision,
      clientOperationId: value.clientOperationId, identifiers: input.identifiers
    }, {
      mutationKind, resourceType: 'data_rights_request',
      intent: policyIntent(key.value, input.command.operation === 'create' ? 'create' : 'update', 'family.write', 'data_rights_request', resourceId, 'administration'),
      auditAction: `privacy.rights_request_${input.command.operation}`,
      eventType: `privacy.rights_request.${input.command.operation}`,
      loadCurrent: (scope, exact) => scope.findRightsRequest(exact, resourceId),
      prepare: (scope, exact) => {
        const found = scope.findRightsRequest(exact, resourceId);
        if (!found.ok) return found;
        let view: DataRightsRequestView;
        if (input.command.operation === 'create') {
          if (found.value) return err(conflict(input.context, 'Veri hakkı talebi zaten var.'));
          const command = input.command.input;
          view = { id: resourceId, key: exact, revision: 1, kind: command.kind,
            scopeResourceType: command.scopeResourceType, scopeResourceId: command.scopeResourceId,
            ...(command.requestedRetentionUntil ? { requestedRetentionUntil: command.requestedRetentionUntil } : {}),
            status: 'requested', reason: command.reason,
            encryptedExportRequired: command.kind === 'encrypted_export' || command.kind === 'legacy_export',
            externalCopiesErasureGuaranteed: false, createdAt: scope.occurredAt, updatedAt: scope.occurredAt };
        } else {
          if (!found.value) return err(missing(input.context, 'Veri hakkı talebi bulunamadı.'));
          if (!rowIdentityExact(found.value, exact)) return err(denied(input.context, 'Veri hakkı talebi exact scope ile eşleşmiyor.'));
          if (found.value.revision !== input.command.input.expectedRevision) return err(conflict(input.context, 'Veri hakkı talep revizyonu güncel değil.'));
          if (!rightsTransitionAllowed(found.value.status, input.command.input.status)) {
            return err(conflict(input.context, 'Veri hakkı talep durum geçişi geçersiz.'));
          }
          view = { ...rightsView(found.value), revision: found.value.revision + 1,
            status: input.command.input.status,
            ...(input.command.input.resolutionNote ? { resolutionNote: input.command.input.resolutionNote } : {}),
            updatedAt: scope.occurredAt };
        }
        const stateFingerprint = sha256(canonicalDataRightsRequestStateJson(view));
        const row: DataRightsRequestRow = { ...view, familyId: exact.familyId, accountId: exact.accountId,
          ownerPersonId: exact.ownerPersonId, lastMutationId: input.identifiers.mutationId, stateFingerprint };
        return ok({ previousRevision: found.value?.revision ?? 0, revision: view.revision, stateFingerprint,
          persist: () => {
            if (!found.value) return scope.insertRightsRequest(row);
            const saved = scope.saveRightsRequest(row, found.value.revision);
            return saved.ok ? (saved.value ? ok(undefined) : err(conflict(input.context, 'Veri hakkı talebi eşzamanlı değişti.'))) : saved;
          } });
      }
    });
  }
}

export class FinalizeEncryptedPrivacyExportUseCase {
  public constructor(private readonly unitOfWork: PrivacyOwnershipUnitOfWork) {}
  public execute(input: {
    readonly context: PrivacyOwnershipApplicationContext;
    readonly command: FinalizeEncryptedPrivacyExportInput;
    readonly identifiers: FinalizeEncryptedPrivacyExportIdentifiers;
  }): Promise<Result<PrivacyOwnershipMutationReceiptView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    const commandValid = exactObject(input.command, [
      'requestId', 'expectedRevision', 'clientOperationId', 'artifactSha256', 'envelopeSha256',
      'lineageSha256', 'itemCount', 'plaintextSizeBytes', 'sizeBytes'
    ]) && mutationInputValid(input.command) && nonEmpty(input.command.requestId)
      && /^[0-9a-f]{64}$/u.test(input.command.artifactSha256)
      && /^[0-9a-f]{64}$/u.test(input.command.envelopeSha256)
      && /^[0-9a-f]{64}$/u.test(input.command.lineageSha256)
      && Number.isSafeInteger(input.command.itemCount) && input.command.itemCount >= 0 && input.command.itemCount <= 10_000
      && Number.isSafeInteger(input.command.plaintextSizeBytes) && input.command.plaintextSizeBytes >= 1
      && input.command.plaintextSizeBytes <= 33_554_432
      && Number.isSafeInteger(input.command.sizeBytes) && input.command.sizeBytes >= 1 && input.command.sizeBytes <= 52_428_800;
    const identifiersValidForExport = exactObject(input.identifiers,
      ['mutationId', 'exportId', 'requestFingerprint', 'auditId', 'outboxEventId'])
      && nonEmpty(input.identifiers.exportId);
    if (!commandValid || !identifiersValidForExport) {
      return Promise.resolve(err(invalid(input.context, 'Şifreli dışa aktarım finalizasyon metadata veya kimlikleri geçersiz.')));
    }
    const mutationIdentifiers: PrivacyOwnershipMutationIdentifiers = {
      mutationId: input.identifiers.mutationId,
      resourceId: input.command.requestId,
      requestFingerprint: input.identifiers.requestFingerprint,
      auditId: input.identifiers.auditId,
      outboxEventId: input.identifiers.outboxEventId
    };
    return executeMutation(this.unitOfWork, {
      context: input.context, expectedRevision: input.command.expectedRevision,
      clientOperationId: input.command.clientOperationId, identifiers: mutationIdentifiers
    }, {
      mutationKind: 'rights_export_finalize', resourceType: 'data_rights_request',
      intent: policyIntent(key.value, 'update', 'family.write', 'data_rights_request', input.command.requestId, 'administration'),
      auditAction: 'privacy.encrypted_export_finalized',
      eventType: 'privacy.encrypted_export.finalized',
      loadCurrent: (scope, exact) => scope.findRightsRequest(exact, input.command.requestId),
      prepare: (scope, exact) => {
        const found = scope.findRightsRequest(exact, input.command.requestId);
        if (!found.ok) return found;
        if (!found.value) return err(missing(input.context, 'Şifreli dışa aktarım talebi bulunamadı.'));
        const current = found.value;
        if (!rowIdentityExact(current, exact)) return err(denied(input.context, 'Dışa aktarım talebi exact owner scope ile eşleşmiyor.'));
        if (current.revision !== input.command.expectedRevision) return err(conflict(input.context, 'Dışa aktarım talep revizyonu güncel değil.'));
        if (current.kind !== 'encrypted_export' && current.kind !== 'legacy_export') {
          return err(conflict(input.context, 'Yalnız şifreli veya miras dışa aktarım talebi finalize edilebilir.'));
        }
        if (current.status !== 'requested' && current.status !== 'in_review') {
          return err(conflict(input.context, 'Sonlanmış dışa aktarım talebi finalize edilemez.'));
        }
        const nextView: DataRightsRequestView = { ...rightsView(current), revision: current.revision + 1,
          status: 'locally_completed', resolutionNote: 'Şifreli paket yerel readback doğrulamasıyla tamamlandı.',
          updatedAt: scope.occurredAt };
        const stateFingerprint = sha256(canonicalDataRightsRequestStateJson(nextView));
        const nextRow: DataRightsRequestRow = { ...nextView, familyId: exact.familyId, accountId: exact.accountId,
          ownerPersonId: exact.ownerPersonId, lastMutationId: input.identifiers.mutationId, stateFingerprint };
        const exportView: EncryptedPrivacyExportView = {
          id: input.identifiers.exportId, key: exact, requestId: current.id, requestKind: current.kind,
          requestRevision: nextView.revision, artifactSha256: input.command.artifactSha256,
          envelopeSha256: input.command.envelopeSha256, lineageSha256: input.command.lineageSha256,
          itemCount: input.command.itemCount, plaintextSizeBytes: input.command.plaintextSizeBytes,
          sizeBytes: input.command.sizeBytes,
          readbackVerified: true, encrypted: true, localUserSelected: true,
          networkDeliveryGuaranteed: false, recipientReadGuaranteed: false,
          localArtifactPathExposed: false, passphraseExposed: false,
          createdAt: scope.occurredAt
        };
        const exportRow: EncryptedPrivacyExportRow = { ...exportView, familyId: exact.familyId,
          accountId: exact.accountId, ownerPersonId: exact.ownerPersonId,
          stateFingerprint: sha256(canonicalEncryptedPrivacyExportStateJson(exportView)) };
        return ok({ previousRevision: current.revision, revision: nextView.revision, stateFingerprint,
          persist: () => {
            const saved = scope.saveRightsRequest(nextRow, current.revision);
            if (!saved.ok) return saved;
            if (!saved.value) return err(conflict(input.context, 'Dışa aktarım talebi eşzamanlı değişti.'));
            return scope.recordEncryptedExport(exportRow);
          } });
      }
    });
  }
}

const applyIncidentActions = (scope: PrivacyOwnershipWriteScope, actions: readonly PrivacyIncidentActionIntent[]): Result<void, AppError> => {
  for (const item of actions) {
    const result = item.action === 'revoke_local_session_authority' ? scope.advanceSecurityEpochAndRevokeLocalSessions(item.targetId as UserId)
      : item.action === 'revoke_trusted_device' ? scope.revokeTrustedDevice(item.targetId)
      : item.action === 'revoke_offline_capability' ? scope.revokeOfflineCapability(item.targetId)
      : item.action === 'revoke_consent' ? scope.revokeConsent(item.targetId)
      : item.action === 'revoke_capability' ? scope.revokeCapability(item.targetId)
      : scope.quarantineLocalDerivedData(item.targetId);
    if (!result.ok) return result;
  }
  return ok(undefined);
};

export class ManagePrivacyIncidentUseCase {
  public constructor(private readonly unitOfWork: PrivacyOwnershipUnitOfWork) {}
  public execute(input: {
    readonly context: PrivacyOwnershipApplicationContext;
    readonly command: ManagePrivacyIncidentCommand;
    readonly identifiers: PrivacyOwnershipMutationIdentifiers;
  }): Promise<Result<PrivacyOwnershipMutationReceiptView, AppError>> {
    const value = input.command.input;
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    const resourceId = input.command.operation === 'create' ? input.identifiers.resourceId : input.command.input.incidentId;
    const commandKeysValid = exactObject(input.command, ['operation', 'input'])
      && (input.command.operation === 'create'
        ? exactObject(value, ['expectedRevision', 'clientOperationId', 'title', 'severity', 'suspectedAt', 'actions', 'evidenceReferenceIds'])
        : input.command.operation === 'update'
          ? exactObject(value, ['incidentId', 'expectedRevision', 'clientOperationId', 'status'], ['resolutionNote'])
          : false);
    if (!commandKeysValid || !mutationInputValid(value) || !nonEmpty(resourceId) || input.identifiers.resourceId !== resourceId) {
      return Promise.resolve(err(invalid(input.context, 'Olay komutu kimliği veya revizyonu geçersiz.')));
    }
    if (input.command.operation === 'create') {
      const command = input.command.input;
      if (command.expectedRevision !== 0 || !nonEmpty(command.title, 256)
        || !['low', 'medium', 'high', 'critical'].includes(command.severity) || !validDate(command.suspectedAt)
        || !Array.isArray(command.actions) || !Array.isArray(command.evidenceReferenceIds)
        || command.actions.length === 0 || command.actions.length > 5
        || command.actions.some((item) => !exactObject(item, ['action', 'targetId'])
          || !['revoke_local_session_authority', 'revoke_trusted_device', 'revoke_offline_capability', 'revoke_consent', 'revoke_capability', 'quarantine_local_derived_data'].includes(item.action)
          || !nonEmpty(item.targetId))
        || command.evidenceReferenceIds.length > 32 || command.evidenceReferenceIds.some((item) => !nonEmpty(item))) {
        return Promise.resolve(err(invalid(input.context, 'Olay containment komutu eksik veya geçersiz.')));
      }
    } else {
      if (!['open', 'contained_locally', 'resolved', 'cancelled'].includes(input.command.input.status)) {
        return Promise.resolve(err(invalid(input.context, 'Gizlilik olayı durumu geçersiz.')));
      }
      if (input.command.input.status === 'resolved' && !nonEmpty(input.command.input.resolutionNote, 1_000)) {
        return Promise.resolve(err(invalid(input.context, 'Çözülen olay için çözüm notu gerekir.')));
      }
    }
    return executeMutation(this.unitOfWork, {
      context: input.context, expectedRevision: value.expectedRevision,
      clientOperationId: value.clientOperationId, identifiers: input.identifiers
    }, {
      mutationKind: input.command.operation === 'create' ? 'incident_create' : 'incident_update',
      resourceType: 'privacy_incident',
      intent: policyIntent(key.value, input.command.operation === 'create' ? 'create' : 'update', 'family.write', 'privacy_incident', resourceId, 'administration'),
      auditAction: `privacy.incident_${input.command.operation}`,
      eventType: `privacy.incident.${input.command.operation}`,
      loadCurrent: (scope, exact) => scope.findIncident(exact, resourceId),
      prepare: (scope, exact) => {
        const found = scope.findIncident(exact, resourceId);
        if (!found.ok) return found;
        let view: PrivacyIncidentView;
        if (input.command.operation === 'create') {
          if (found.value) return err(conflict(input.context, 'Gizlilik olayı zaten var.'));
          const command = input.command.input;
          view = { id: resourceId, key: exact, revision: 1, title: command.title,
            severity: command.severity, status: 'contained_locally', suspectedAt: command.suspectedAt,
            actions: command.actions, evidenceReferenceIds: command.evidenceReferenceIds,
            remoteWipePerformed: false, mdmOperationPerformed: false, networkDeliveryGuaranteed: false,
            createdAt: scope.occurredAt, updatedAt: scope.occurredAt };
        } else {
          if (!found.value) return err(missing(input.context, 'Gizlilik olayı bulunamadı.'));
          if (!rowIdentityExact(found.value, exact)) return err(denied(input.context, 'Gizlilik olayı exact scope ile eşleşmiyor.'));
          if (found.value.revision !== input.command.input.expectedRevision) return err(conflict(input.context, 'Gizlilik olayı revizyonu güncel değil.'));
          if (!incidentTransitionAllowed(found.value.status, input.command.input.status)) {
            return err(conflict(input.context, 'Gizlilik olayı durum geçişi geçersiz.'));
          }
          view = { ...incidentView(found.value), revision: found.value.revision + 1,
            status: input.command.input.status,
            ...(input.command.input.resolutionNote ? { resolutionNote: input.command.input.resolutionNote } : {}),
            updatedAt: scope.occurredAt };
        }
        const stateFingerprint = sha256(canonicalPrivacyIncidentStateJson(view));
        const row: PrivacyIncidentRow = { ...view, familyId: exact.familyId, accountId: exact.accountId,
          ownerPersonId: exact.ownerPersonId, lastMutationId: input.identifiers.mutationId, stateFingerprint };
        return ok({ previousRevision: found.value?.revision ?? 0, revision: view.revision, stateFingerprint,
          persist: () => {
            if (!found.value) {
              const inserted = scope.insertIncident(row);
              if (!inserted.ok) return inserted;
              return applyIncidentActions(scope, row.actions);
            }
            const saved = scope.saveIncident(row, found.value.revision);
            return saved.ok ? (saved.value ? ok(undefined) : err(conflict(input.context, 'Gizlilik olayı eşzamanlı değişti.'))) : saved;
          } });
      }
    });
  }
}

export class SimulatePermissionVisibilityUseCase {
  public constructor(private readonly unitOfWork: PrivacyOwnershipUnitOfWork) {}
  public execute(input: {
    readonly context: PrivacyOwnershipApplicationContext;
    readonly targets: readonly PermissionSimulationTarget[];
  }): Promise<Result<PermissionSimulationView, AppError>> {
    const key = keyFor(input.context);
    if (!key.ok) return Promise.resolve(key);
    if (!Array.isArray(input.targets) || input.targets.length === 0 || input.targets.length > 100
      || input.targets.some((target) => !exactObject(target, ['subjectAccountId', 'resourceType', 'resourceId', 'action', 'purpose', 'occurredAt'])
        || !nonEmpty(target.subjectAccountId) || !nonEmpty(target.resourceType)
        || target.resourceType !== 'privacy_inventory' || target.resourceId !== key.value.ownerPersonId
        || target.action !== 'read'
        || !['general','care','finance','health','archive','legacy','ai_processing','administration'].includes(target.purpose)
        || !validDate(target.occurredAt))) {
      return Promise.resolve(err(invalid(input.context, 'İzin simülasyonu hedefleri geçersiz.')));
    }
    return this.unitOfWork.execute(input.context,
      policyIntent(key.value, 'read', 'family.read', 'privacy_ownership_center', key.value.accountId, 'administration'),
      (scope) => {
        const items: PermissionSimulationItemView[] = [];
        for (const target of input.targets) {
          const decision = scope.evaluatePermission(target);
          if (!decision.ok) return decision;
          items.push({ ...target, visible: decision.value.allowed, reason: decision.value.reason,
            obligations: decision.value.obligations });
        }
        return ok({ key: key.value, items, simulatedAt: scope.occurredAt,
          grantsCreated: false, accessPerformed: false, auditAccessRecorded: false });
      });
  }
}

export class CorrectAiMemoryUseCase extends ManageAiMemoryUseCase {}
export class RestrictAiMemoryUseCase extends ManageAiMemoryUseCase {}
export class DeleteAiMemoryUseCase extends ManageAiMemoryUseCase {}
export class ExpireAiMemoryUseCase extends ManageAiMemoryUseCase {}
export class CreateOrUpdateDataRightsRequestUseCase extends ManageDataRightsRequestUseCase {}
export class CreateOrUpdatePrivacyIncidentUseCase extends ManagePrivacyIncidentUseCase {}
