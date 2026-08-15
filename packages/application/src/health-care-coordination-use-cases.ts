import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  asIsoDateTime,
  asPersonId,
  createAppError,
  err,
  ok,
  type AppError,
  type EventId,
  type Result
} from '@ppt/core';
import {
  HEALTH_CARE_ACCESS_SCOPES,
  HEALTH_CARE_ENTRY_KINDS,
  healthCareAccessScopeForEntryKind,
  healthCareCenterId,
  type HealthCareAccessGrantView,
  type HealthCareAccessScope,
  type HealthCareCoordinationCenterView,
  type HealthCareEntryView,
  type HealthCareMutationKind,
  type HealthCareMutationReceiptView,
  type RecordHealthCareEntryInput,
  type RevokeHealthCareAccessGrantInput,
  type UpsertHealthCareAccessGrantInput
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import type {
  HealthCareAccessGrantRow,
  HealthCareCenterKey,
  HealthCareCenterRow,
  HealthCareEntryRow,
  HealthCareMutationRow,
  ObjectPermissionRow
} from '@ppt/repository-contracts';
import { authorizationRoleMatches } from '@ppt/security';
import type { HealthApplicationContext, HealthPolicyIntent } from './health-use-cases.js';

export interface HealthCareCoordinationQueryPort {
  getHealthCareCoordinationCenter(
    context: HealthApplicationContext,
    ownerPersonId: string
  ): Promise<Result<HealthCareCoordinationCenterView, AppError>>;
}

export interface HealthCareCoordinationWriteScope {
  readonly occurredAt: HealthCareMutationRow['occurredAt'];
  findPerson(personId: string): Result<{ readonly id: string; readonly familyId: string; readonly status: string } | null, AppError>;
  findAccount(accountId: string): Result<{ readonly id: string; readonly personId?: string; readonly role: string; readonly status: string } | null, AppError>;
  findCenter(key: HealthCareCenterKey): Result<HealthCareCenterRow | null, AppError>;
  findMutation(key: HealthCareCenterKey, clientOperationId: string): Result<HealthCareMutationRow | null, AppError>;
  insertMutation(row: HealthCareMutationRow): Result<void, AppError>;
  insertCenter(row: HealthCareCenterRow): Result<void, AppError>;
  saveCenter(row: HealthCareCenterRow, expectedRevision: number): Result<void, AppError>;
  insertEntry(row: HealthCareEntryRow): Result<void, AppError>;
  findGrant(key: HealthCareCenterKey, grantId: string): Result<HealthCareAccessGrantRow | null, AppError>;
  findActiveGrantForActor(key: HealthCareCenterKey): Result<HealthCareAccessGrantRow | null, AppError>;
  upsertGrant(row: HealthCareAccessGrantRow, expectedRevision: number | null): Result<void, AppError>;
  upsertPermission(row: ObjectPermissionRow): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: HealthCareMutationRow['occurredAt'];
    readonly actorId: HealthApplicationContext['actor']['userId'];
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface HealthCareCoordinationUnitOfWork {
  execute<T>(
    context: HealthApplicationContext,
    intent: HealthPolicyIntent,
    operation: (scope: HealthCareCoordinationWriteScope) => Result<T, AppError>
  ): Promise<Result<T, AppError>>;
}

export interface HealthCareMutationIdentifiers {
  readonly mutationId: string;
  readonly targetId: string;
  readonly requestFingerprint: string;
  readonly auditId: string;
  readonly outboxEventId: EventId;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,255}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const measurementKinds = new Set<HealthCareEntryView['kind']>([
  'blood_pressure', 'blood_glucose', 'weight', 'nutrition', 'hydration'
]);

const invalid = (context: HealthApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId: context.correlationId
});

const conflict = (context: HealthApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category: 'conflict',
  correlationId: context.correlationId
});

const denied = (context: HealthApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category: 'authorization',
  correlationId: context.correlationId
});

const notFound = (context: HealthApplicationContext, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId: context.correlationId
});

const iso = (
  context: HealthApplicationContext,
  value: string,
  label: string
): Result<HealthCareMutationRow['occurredAt'], AppError> => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return err(invalid(context, `${label} geçersizdir.`));
  return ok(asIsoDateTime(new Date(parsed).toISOString()));
};

const hash = (value: unknown): string => createHash('sha256')
  .update(JSON.stringify(value), 'utf8')
  .digest('hex');

const canonicalStrings = <T extends string>(
  values: readonly T[],
  allowed: ReadonlySet<string>,
  maximum: number
): readonly T[] | null => {
  if (!Array.isArray(values) || values.length < 1 || values.length > maximum) return null;
  if (values.some((value) => !allowed.has(value))) return null;
  const normalized = [...new Set(values)].sort();
  return normalized.length === values.length ? Object.freeze(normalized) : null;
};

const keyFor = (
  context: HealthApplicationContext,
  ownerPersonId: string
): Result<HealthCareCenterKey, AppError> => {
  if (!context.actor.personId) return err(denied(context, 'Sağlık koordinasyonu için kişi bağlı oturum zorunludur.'));
  if (!SAFE_ID.test(ownerPersonId)) return err(invalid(context, 'Sağlık koordinasyonu sahibi geçersizdir.'));
  return ok(Object.freeze({
    familyId: context.familyId,
    accountId: context.actor.userId,
    ownerPersonId: asPersonId(ownerPersonId),
    centerId: healthCareCenterId(ownerPersonId)
  }));
};

const intentFor = (key: HealthCareCenterKey, action: 'read' | 'update'): HealthPolicyIntent => ({
  action,
  capability: action === 'read' ? 'health.read' : 'health.write',
  resourceType: 'health_care_center',
  resourceId: key.centerId,
  purpose: 'care',
  ownerPersonId: key.ownerPersonId,
  privacy: 'private'
});

const nextCenter = (
  key: HealthCareCenterKey,
  current: HealthCareCenterRow | null,
  mutationId: string,
  targetId: string,
  requestFingerprint: string,
  occurredAt: HealthCareMutationRow['occurredAt']
): HealthCareCenterRow => {
  const revision = (current?.revision ?? 0) + 1;
  return Object.freeze({
    id: key.centerId,
    familyId: key.familyId,
    ownerPersonId: key.ownerPersonId,
    revision,
    stateFingerprint: hash({
      centerId: key.centerId,
      familyId: key.familyId,
      ownerPersonId: key.ownerPersonId,
      revision,
      mutationId,
      targetId,
      requestFingerprint,
      occurredAt
    }),
    lastMutationId: mutationId,
    createdAt: current?.createdAt ?? occurredAt,
    updatedAt: occurredAt
  });
};

const receipt = (
  row: HealthCareMutationRow,
  replayed: boolean
): HealthCareMutationReceiptView => Object.freeze({
  centerId: row.centerId,
  mutationKind: row.mutationKind,
  previousRevision: row.expectedRevision,
  revision: row.revision,
  occurredAt: row.occurredAt,
  replayed,
  localOnly: true,
  externalDelivery: 'not_performed'
});

const replay = (
  context: HealthApplicationContext,
  found: HealthCareMutationRow | null,
  mutationKind: HealthCareMutationKind,
  key: HealthCareCenterKey,
  expectedRevision: number,
  requestFingerprint: string
): Result<HealthCareMutationReceiptView | null, AppError> => {
  if (!found) return ok(null);
  return found.mutationKind === mutationKind
    && found.centerId === key.centerId
    && found.ownerPersonId === key.ownerPersonId
    && found.expectedRevision === expectedRevision
    && found.requestFingerprint === requestFingerprint
    ? ok(receipt(found, true))
    : err(conflict(context, 'Aynı işlem kimliği farklı sağlık koordinasyonu içeriğiyle yeniden kullanılamaz.'));
};

const assertCurrentRevision = (
  context: HealthApplicationContext,
  current: HealthCareCenterRow | null,
  expectedRevision: number
): Result<void, AppError> => {
  const actual = current?.revision ?? 0;
  return actual === expectedRevision
    ? ok(undefined)
    : err(conflict(context, `Sağlık koordinasyonu revizyonu değişti; beklenen ${expectedRevision}, güncel ${actual}.`));
};

const persistCenter = (
  scope: HealthCareCoordinationWriteScope,
  current: HealthCareCenterRow | null,
  next: HealthCareCenterRow
): Result<void, AppError> => current
  ? scope.saveCenter(next, current.revision)
  : scope.insertCenter(next);

const mutationRow = (input: {
  readonly context: HealthApplicationContext;
  readonly key: HealthCareCenterKey;
  readonly identifiers: HealthCareMutationIdentifiers;
  readonly mutationKind: HealthCareMutationKind;
  readonly current: HealthCareCenterRow | null;
  readonly next: HealthCareCenterRow;
  readonly occurredAt: HealthCareMutationRow['occurredAt'];
}): HealthCareMutationRow => ({
  id: input.identifiers.mutationId,
  centerId: input.key.centerId,
  familyId: input.key.familyId,
  ownerPersonId: input.key.ownerPersonId,
  actorAccountId: input.context.actor.userId,
  actorPersonId: input.context.actor.personId!,
  mutationKind: input.mutationKind,
  clientOperationId: input.identifiers.targetId === input.identifiers.mutationId
    ? input.identifiers.mutationId
    : '',
  requestFingerprint: input.identifiers.requestFingerprint,
  expectedRevision: input.current?.revision ?? 0,
  revision: input.next.revision,
  stateFingerprint: input.next.stateFingerprint,
  targetId: input.identifiers.targetId,
  occurredAt: input.occurredAt
});

const withClientOperationId = (
  row: HealthCareMutationRow,
  clientOperationId: string
): HealthCareMutationRow => Object.freeze({ ...row, clientOperationId });

export class GetHealthCareCoordinationCenterUseCase {
  public constructor(private readonly query: HealthCareCoordinationQueryPort) {}

  public execute(input: {
    readonly context: HealthApplicationContext;
    readonly ownerPersonId: string;
  }): Promise<Result<HealthCareCoordinationCenterView, AppError>> {
    const key = keyFor(input.context, input.ownerPersonId);
    return key.ok
      ? this.query.getHealthCareCoordinationCenter(input.context, key.value.ownerPersonId)
      : Promise.resolve(key);
  }
}

export class RecordHealthCareEntryUseCase {
  public constructor(private readonly unitOfWork: HealthCareCoordinationUnitOfWork) {}

  public async execute(input: {
    readonly context: HealthApplicationContext;
    readonly command: RecordHealthCareEntryInput;
    readonly identifiers: HealthCareMutationIdentifiers;
  }): Promise<Result<HealthCareMutationReceiptView, AppError>> {
    const key = keyFor(input.context, input.command.ownerPersonId);
    if (!key.ok) return key;
    if (!Number.isSafeInteger(input.command.expectedRevision) || input.command.expectedRevision < 0) {
      return err(invalid(input.context, 'Sağlık koordinasyonu revizyonu geçersizdir.'));
    }
    if (!SAFE_ID.test(input.command.clientOperationId) || !SHA256.test(input.identifiers.requestFingerprint)
      || !SAFE_ID.test(input.identifiers.mutationId) || !SAFE_ID.test(input.identifiers.targetId)) {
      return err(invalid(input.context, 'Sağlık koordinasyonu işlem kimliği geçersizdir.'));
    }
    if (!HEALTH_CARE_ENTRY_KINDS.includes(input.command.kind)) return err(invalid(input.context, 'Sağlık koordinasyonu kayıt türü geçersizdir.'));
    const title = input.command.title.normalize('NFKC').trim();
    const note = input.command.note?.normalize('NFKC').trim();
    if (title.length < 2 || title.length > 160 || CONTROL.test(title)
      || (note !== undefined && (note.length > 4096 || CONTROL.test(note)))) {
      return err(invalid(input.context, 'Sağlık koordinasyonu başlığı veya notu geçersizdir.'));
    }
    const occurredAt = iso(input.context, input.command.occurredAt, 'Kayıt zamanı');
    if (!occurredAt.ok) return occurredAt;
    const scheduledAt = input.command.scheduledAt
      ? iso(input.context, input.command.scheduledAt, 'Planlanan zaman')
      : undefined;
    if (scheduledAt && !scheduledAt.ok) return scheduledAt;
    const requiresMeasurement = measurementKinds.has(input.command.kind);
    const measurement = input.command.measurement;
    if (requiresMeasurement !== Boolean(measurement)
      || (measurement && (!Number.isFinite(measurement.value) || measurement.value < 0 || measurement.value > 1_000_000_000
        || (measurement.secondaryValue !== undefined && (!Number.isFinite(measurement.secondaryValue) || measurement.secondaryValue < 0 || measurement.secondaryValue > 1_000_000_000))
        || measurement.unit.trim().length < 1 || measurement.unit.trim().length > 32))) {
      return err(invalid(input.context, 'Sağlık ölçümü tür, değer ve birim bakımından geçersizdir.'));
    }
    if (input.command.kind === 'blood_pressure' && measurement?.secondaryValue === undefined) {
      return err(invalid(input.context, 'Tansiyon kaydı iki ölçüm değeri gerektirir.'));
    }

    return this.unitOfWork.execute(input.context, intentFor(key.value, 'update'), (scope) => {
      const currentResult = scope.findCenter(key.value);
      if (!currentResult.ok) return currentResult;
      const replayResult = scope.findMutation(key.value, input.command.clientOperationId);
      if (!replayResult.ok) return replayResult;
      const replayed = replay(input.context, replayResult.value, 'entry_record', key.value, input.command.expectedRevision, input.identifiers.requestFingerprint);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const revision = assertCurrentRevision(input.context, currentResult.value, input.command.expectedRevision);
      if (!revision.ok) return revision;
      const person = scope.findPerson(key.value.ownerPersonId);
      if (!person.ok) return person;
      if (!person.value || person.value.familyId !== key.value.familyId || person.value.status !== 'active') {
        return err(notFound(input.context, 'Sağlık koordinasyonu sahibi etkin ailede bulunamadı.'));
      }
      const accessScope = healthCareAccessScopeForEntryKind(input.command.kind);
      const isOwner = input.context.actor.personId === key.value.ownerPersonId;
      if (!isOwner) {
        const grant = scope.findActiveGrantForActor(key.value);
        if (!grant.ok) return grant;
        if (!grant.value || !grant.value.actions.includes('record') || !grant.value.allowedScopes.includes(accessScope)) {
          return err(denied(input.context, 'Bakım veren bu kayıt türü için minimum-gerekli yazma iznine sahip değildir.'));
        }
      }
      const next = nextCenter(
        key.value,currentResult.value,input.identifiers.mutationId,input.identifiers.targetId,
        input.identifiers.requestFingerprint,scope.occurredAt
      );
      const mutation = withClientOperationId(mutationRow({
        context: input.context,key:key.value,identifiers:input.identifiers,mutationKind:'entry_record',
        current:currentResult.value,next,occurredAt:scope.occurredAt
      }), input.command.clientOperationId);
      const insertedMutation = scope.insertMutation(mutation);
      if (!insertedMutation.ok) return insertedMutation;
      const savedCenter = persistCenter(scope, currentResult.value, next);
      if (!savedCenter.ok) return savedCenter;
      const entry: HealthCareEntryRow = Object.freeze({
        id: input.identifiers.targetId,
        centerId: key.value.centerId,
        familyId: key.value.familyId,
        ownerPersonId: key.value.ownerPersonId,
        kind: input.command.kind,
        accessScope,
        title,
        status: input.command.status,
        occurredAt: occurredAt.value,
        ...(scheduledAt?.ok ? { scheduledAt: scheduledAt.value } : {}),
        ...(note ? { note } : {}),
        ...(measurement ? { measurement: Object.freeze({
          value: measurement.value,
          ...(measurement.secondaryValue !== undefined ? { secondaryValue: measurement.secondaryValue } : {}),
          unit: measurement.unit.trim()
        }) } : {}),
        ...(input.command.relatedHealthRecordId ? { relatedHealthRecordId: input.command.relatedHealthRecordId } : {}),
        ...(input.command.relatedMedicationPlanId ? { relatedMedicationPlanId: input.command.relatedMedicationPlanId } : {}),
        ...(input.command.relatedArchiveItemId ? { relatedArchiveItemId: input.command.relatedArchiveItemId } : {}),
        recordedBy: isOwner ? 'owner' : authorizationRoleMatches(input.context.actor.role, 'family_admin') ? 'family_admin' : 'caregiver',
        recordedByAccountId: key.value.accountId,
        recordedByPersonId: input.context.actor.personId!,
        source: 'manual_local',
        mutationId: mutation.id,
        createdAt: scope.occurredAt
      });
      const insertedEntry = scope.insertEntry(entry);
      if (!insertedEntry.ok) return insertedEntry;
      const audit = scope.appendAudit({
        id: input.identifiers.auditId,action:'health_care.entry_recorded',resourceType:'health_care_center',
        resourceId:key.value.centerId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId
      });
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({
        eventId: input.identifiers.outboxEventId,eventType:'health_care.entry.recorded',eventVersion:1,
        aggregateType:'health_care_center',aggregateId:key.value.centerId,occurredAt:scope.occurredAt,
        actorId:input.context.actor.userId,correlationId:input.context.correlationId,
        payload:{ centerId:key.value.centerId,entryId:entry.id,kind:entry.kind,accessScope,revision:next.revision }
      });
      return event.ok ? ok(receipt(mutation, false)) : event;
    });
  }
}

export class UpsertHealthCareAccessGrantUseCase {
  public constructor(private readonly unitOfWork: HealthCareCoordinationUnitOfWork) {}

  public async execute(input: {
    readonly context: HealthApplicationContext;
    readonly command: UpsertHealthCareAccessGrantInput;
    readonly identifiers: Omit<HealthCareMutationIdentifiers, 'targetId'>;
  }): Promise<Result<HealthCareMutationReceiptView, AppError>> {
    const key = keyFor(input.context, input.command.ownerPersonId);
    if (!key.ok) return key;
    if (!SAFE_ID.test(input.command.grantId) || !SAFE_ID.test(input.command.caregiverAccountId)
      || !SAFE_ID.test(input.command.clientOperationId) || !SHA256.test(input.identifiers.requestFingerprint)) {
      return err(invalid(input.context, 'Bakım veren izin kimliği geçersizdir.'));
    }
    const scopes = canonicalStrings(input.command.allowedScopes, new Set(HEALTH_CARE_ACCESS_SCOPES), 9);
    const actions = canonicalStrings(input.command.actions, new Set(['read','record']), 2);
    if (!scopes || !actions || !actions.includes('read')) {
      return err(invalid(input.context, 'Bakım veren izni en az salt-okunur ve geçerli bir minimum kapsam gerektirir.'));
    }
    const startsAt = iso(input.context, input.command.startsAt, 'İzin başlangıcı');
    if (!startsAt.ok) return startsAt;
    const endsAt = input.command.endsAt ? iso(input.context, input.command.endsAt, 'İzin bitişi') : undefined;
    if (endsAt && !endsAt.ok) return endsAt;
    if (endsAt?.ok && Date.parse(endsAt.value) < Date.parse(startsAt.value)) {
      return err(invalid(input.context, 'Bakım veren izin bitişi başlangıçtan önce olamaz.'));
    }
    const identifiers: HealthCareMutationIdentifiers = { ...input.identifiers, targetId: input.command.grantId };
    return this.unitOfWork.execute(input.context, intentFor(key.value, 'update'), (scope) => {
      const current = scope.findCenter(key.value);
      if (!current.ok) return current;
      const priorMutation = scope.findMutation(key.value, input.command.clientOperationId);
      if (!priorMutation.ok) return priorMutation;
      const replayed = replay(input.context, priorMutation.value, 'grant_upsert', key.value, input.command.expectedRevision, identifiers.requestFingerprint);
      if (!replayed.ok || replayed.value) return replayed.ok ? ok(replayed.value!) : replayed;
      const revision = assertCurrentRevision(input.context, current.value, input.command.expectedRevision);
      if (!revision.ok) return revision;
      const account = scope.findAccount(input.command.caregiverAccountId);
      if (!account.ok) return account;
      if (!account.value || account.value.status !== 'active' || !authorizationRoleMatches(account.value.role, 'caregiver') || !account.value.personId) {
        return err(notFound(input.context, 'Etkin bakım veren hesabı ve kişi bağı bulunamadı.'));
      }
      if (account.value.personId === input.command.ownerPersonId) {
        return err(invalid(input.context, 'Veri sahibi kendisine bakım veren izni veremez.'));
      }
      const caregiverPerson = scope.findPerson(account.value.personId);
      if (!caregiverPerson.ok) return caregiverPerson;
      if (!caregiverPerson.value || caregiverPerson.value.familyId !== key.value.familyId || caregiverPerson.value.status !== 'active') {
        return err(notFound(input.context, 'Bakım veren aynı etkin ailede bulunamadı.'));
      }
      const existing = scope.findGrant(key.value, input.command.grantId);
      if (!existing.ok) return existing;
      if (existing.value?.state === 'revoked') return err(conflict(input.context, 'İptal edilmiş bakım veren izni yeniden etkinleştirilemez.'));
      const next = nextCenter(key.value,current.value,identifiers.mutationId,identifiers.targetId,identifiers.requestFingerprint,scope.occurredAt);
      const mutation = withClientOperationId(mutationRow({
        context:input.context,key:key.value,identifiers,mutationKind:'grant_upsert',current:current.value,next,occurredAt:scope.occurredAt
      }),input.command.clientOperationId);
      const inserted = scope.insertMutation(mutation);
      if (!inserted.ok) return inserted;
      const saved = persistCenter(scope,current.value,next);
      if (!saved.ok) return saved;
      const permissionActions = Object.freeze(actions.includes('record')
        ? ['read','update','record'] as const
        : ['read'] as const);
      const permission = scope.upsertPermission({
        id:`health-care-permission:${input.command.grantId}`,
        subjectAccountId: account.value.id as never,
        resourceType:'health_care_center',resourceId:key.value.centerId,actions:permissionActions,effect:'allow',purpose:'care',
        startsAt:startsAt.value,...(endsAt?.ok?{endsAt:endsAt.value}:{}),createdAt:scope.occurredAt
      });
      if (!permission.ok) return permission;
      const grant: HealthCareAccessGrantRow = Object.freeze({
        id:input.command.grantId,centerId:key.value.centerId,familyId:key.value.familyId,ownerPersonId:key.value.ownerPersonId,
        caregiverAccountId:account.value.id,caregiverPersonId:account.value.personId,
        allowedScopes:scopes,actions,state:'active',startsAt:startsAt.value,...(endsAt?.ok?{endsAt:endsAt.value}:{}),
        revision:(existing.value?.revision??0)+1,mutationId:mutation.id,
        createdAt:existing.value?.createdAt??scope.occurredAt,updatedAt:scope.occurredAt
      });
      const savedGrant = scope.upsertGrant(grant,existing.value?.revision??null);
      if (!savedGrant.ok) return savedGrant;
      const audit = scope.appendAudit({id:input.identifiers.auditId,action:'health_care.caregiver_grant_upserted',resourceType:'health_care_center',resourceId:key.value.centerId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});
      if (!audit.ok) return audit;
      const event = scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:'health_care.caregiver_grant.upserted',eventVersion:1,aggregateType:'health_care_center',aggregateId:key.value.centerId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{centerId:key.value.centerId,grantId:grant.id,caregiverAccountId:grant.caregiverAccountId,allowedScopes:grant.allowedScopes,actions:grant.actions,revision:next.revision}});
      return event.ok?ok(receipt(mutation,false)):event;
    });
  }
}

export class RevokeHealthCareAccessGrantUseCase {
  public constructor(private readonly unitOfWork: HealthCareCoordinationUnitOfWork) {}

  public async execute(input: {
    readonly context: HealthApplicationContext;
    readonly command: RevokeHealthCareAccessGrantInput;
    readonly identifiers: Omit<HealthCareMutationIdentifiers, 'targetId'>;
  }): Promise<Result<HealthCareMutationReceiptView, AppError>> {
    const key = keyFor(input.context,input.command.ownerPersonId);
    if (!key.ok) return key;
    if (!SAFE_ID.test(input.command.grantId) || !SAFE_ID.test(input.command.clientOperationId)
      || !SHA256.test(input.identifiers.requestFingerprint)) return err(invalid(input.context,'Bakım veren iptal kimliği geçersizdir.'));
    const identifiers:HealthCareMutationIdentifiers={...input.identifiers,targetId:input.command.grantId};
    return this.unitOfWork.execute(input.context,intentFor(key.value,'update'),(scope)=>{
      const current=scope.findCenter(key.value);if(!current.ok)return current;
      const prior=scope.findMutation(key.value,input.command.clientOperationId);if(!prior.ok)return prior;
      const replayed=replay(input.context,prior.value,'grant_revoke',key.value,input.command.expectedRevision,identifiers.requestFingerprint);
      if(!replayed.ok||replayed.value)return replayed.ok?ok(replayed.value!):replayed;
      const revision=assertCurrentRevision(input.context,current.value,input.command.expectedRevision);if(!revision.ok)return revision;
      const existing=scope.findGrant(key.value,input.command.grantId);if(!existing.ok)return existing;
      if(!existing.value||existing.value.state!=='active')return err(notFound(input.context,'Etkin bakım veren izni bulunamadı.'));
      const next=nextCenter(key.value,current.value,identifiers.mutationId,identifiers.targetId,identifiers.requestFingerprint,scope.occurredAt);
      const mutation=withClientOperationId(mutationRow({context:input.context,key:key.value,identifiers,mutationKind:'grant_revoke',current:current.value,next,occurredAt:scope.occurredAt}),input.command.clientOperationId);
      const inserted=scope.insertMutation(mutation);if(!inserted.ok)return inserted;
      const saved=persistCenter(scope,current.value,next);if(!saved.ok)return saved;
      const permission=scope.upsertPermission({
        id:`health-care-permission:${existing.value.id}`,
        subjectAccountId:existing.value.caregiverAccountId as never,
        resourceType:'health_care_center',resourceId:key.value.centerId,
        actions:Object.freeze(['read','update','record'] as const),effect:'deny',purpose:'care',
        denialReason:'Bakım veren erişimi veri sahibi tarafından iptal edildi.',
        startsAt:scope.occurredAt,createdAt:scope.occurredAt
      });
      if(!permission.ok)return permission;
      const revoked:HealthCareAccessGrantRow=Object.freeze({...existing.value,state:'revoked',revision:existing.value.revision+1,mutationId:mutation.id,updatedAt:scope.occurredAt,revokedAt:scope.occurredAt});
      const savedGrant=scope.upsertGrant(revoked,existing.value.revision);if(!savedGrant.ok)return savedGrant;
      const audit=scope.appendAudit({id:input.identifiers.auditId,action:'health_care.caregiver_grant_revoked',resourceType:'health_care_center',resourceId:key.value.centerId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId});if(!audit.ok)return audit;
      const event=scope.enqueueEvent({eventId:input.identifiers.outboxEventId,eventType:'health_care.caregiver_grant.revoked',eventVersion:1,aggregateType:'health_care_center',aggregateId:key.value.centerId,occurredAt:scope.occurredAt,actorId:input.context.actor.userId,correlationId:input.context.correlationId,payload:{centerId:key.value.centerId,grantId:existing.value.id,caregiverAccountId:existing.value.caregiverAccountId,revision:next.revision}});
      return event.ok?ok(receipt(mutation,false)):event;
    });
  }
}
