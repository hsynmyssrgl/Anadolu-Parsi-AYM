import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyId,
  type IsoDate,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  getFamilyRelationship,
  isFamilyRelationshipCode,
  type CreateFamilyMemberInput,
  CreateFamilyRelationInput,
  FamilyMemberView,
  FamilyRelationView,
  MemberStatus,
  RelationType
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';
import { calculateGenealogyGenerations } from './genealogy-use-cases.js';

export interface FamilyRecord {
  readonly id: FamilyId;
  readonly name: string;
  readonly createdAt: IsoDateTime;
}

export interface FamilyPersonRecord {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly birthDate?: IsoDate;
  readonly relationshipType: string;
  readonly generation: number;
  readonly branch: string;
  readonly status: MemberStatus;
  readonly createdAt: IsoDateTime;
}

export interface FamilyRelationRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly fromPersonId: PersonId;
  readonly toPersonId: PersonId;
  readonly relationType: RelationType;
}

export interface FamilyGraph {
  readonly family: { readonly id: string; readonly name: string };
  readonly people: readonly FamilyMemberView[];
  readonly relations: readonly FamilyRelationView[];
}

export interface FamilyApplicationActor {
  readonly userId: UserId;
  readonly roles: readonly string[];
}

export interface FamilyApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: FamilyApplicationActor;
  readonly correlationId: CorrelationId;
}

export interface FamilyReadScope {
  findFamily(familyId: FamilyId): Result<FamilyRecord | null, AppError>;
  listPeople(familyId: FamilyId): Result<readonly FamilyPersonRecord[], AppError>;
  listRelations(familyId: FamilyId): Result<readonly FamilyRelationRecord[], AppError>;
}

export interface FamilyWriteScope extends FamilyReadScope {
  findPerson(personId: PersonId): Result<FamilyPersonRecord | null, AppError>;
  insertPerson(person: FamilyPersonRecord): Result<void, AppError>;
  relationExists(input: {
    readonly familyId: FamilyId;
    readonly fromPersonId: PersonId;
    readonly toPersonId: PersonId;
    readonly relationType: RelationType;
  }): Result<boolean, AppError>;
  insertRelation(relation: FamilyRelationRecord): Result<void, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
  readonly occurredAt: IsoDateTime;
}

export interface FamilyApplicationUnitOfWork {
  execute<TValue>(
    context: FamilyApplicationContext,
    operation: (scope: FamilyWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError>;
}

export interface FamilyGraphQueryPort {
  load(context: FamilyApplicationContext): Result<{
    readonly family: FamilyRecord | null;
    readonly people: readonly FamilyPersonRecord[];
    readonly relations: readonly FamilyRelationRecord[];
  }, AppError>;
}

export interface CreateFamilyMemberIdentifiers {
  readonly personId: PersonId;
  readonly auditId: string;
  readonly eventId: EventId;
  readonly relationship?: {
    readonly forwardRelationId: string;
    readonly reverseRelationId: string;
    readonly forwardAuditId: string;
    readonly reverseAuditId: string;
    readonly forwardEventId: EventId;
    readonly reverseEventId: EventId;
  };
}

export interface CreateFamilyRelationIdentifiers {
  readonly relationId: string;
  readonly auditId: string;
  readonly eventId: EventId;
}

export interface FamilyMemberCreatedPayload {
  readonly familyId: string;
  readonly personId: string;
  readonly displayName: string;
  readonly generation: number;
  readonly branch: string;
}

export interface FamilyRelationCreatedPayload {
  readonly familyId: string;
  readonly relationId: string;
  readonly fromPersonId: string;
  readonly toPersonId: string;
  readonly relationType: RelationType;
}

const validationError = (correlationId: CorrelationId, message: string, details?: Readonly<Record<string, unknown>>): AppError =>
  createAppError({
    code: ERROR_CODES.CORE_INVALID_ARGUMENT,
    message,
    category: 'validation',
    correlationId,
    ...(details ? { details } : {})
  });

const notFoundError = (correlationId: CorrelationId, message: string, details?: Readonly<Record<string, unknown>>): AppError =>
  createAppError({
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message,
    category: 'not_found',
    correlationId,
    ...(details ? { details } : {})
  });

const conflictError = (correlationId: CorrelationId, message: string, details?: Readonly<Record<string, unknown>>): AppError =>
  createAppError({
    code: ERROR_CODES.RESOURCE_CONFLICT,
    message,
    category: 'conflict',
    correlationId,
    ...(details ? { details } : {})
  });

const initialsOf = (displayName: string): string => displayName
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toLocaleUpperCase('tr-TR') ?? '')
  .join('');

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const allowedRelationTypes = new Set<RelationType>([
  'parent', 'spouse', 'child', 'sibling', 'guardian', 'other'
]);

export class GetFamilyGraphUseCase {
  public constructor(private readonly query: FamilyGraphQueryPort) {}

  public execute(context: FamilyApplicationContext): Result<FamilyGraph, AppError> {
    const loaded = this.query.load(context);
    if (!loaded.ok) return loaded;
    if (!loaded.value.family) {
      return err(notFoundError(context.correlationId, 'Aile kaydı bulunamadı.', {
        familyId: context.familyId
      }));
    }
    const generationAnalysis = calculateGenealogyGenerations({
      people: loaded.value.people,
      relations: loaded.value.relations
    });
    return ok({
      family: {
        id: loaded.value.family.id,
        name: loaded.value.family.name
      },
      people: loaded.value.people.map((person) => ({
        id: person.id,
        displayName: person.displayName,
        ...(person.birthDate ? { birthDate: person.birthDate } : {}),
        relationshipType: person.relationshipType,
        generation: generationAnalysis.generationByPersonId.get(person.id) ?? person.generation,
        branch: person.branch,
        status: person.status,
        initials: initialsOf(person.displayName)
      })),
      relations: loaded.value.relations.map((relation) => ({
        id: relation.id,
        fromPersonId: relation.fromPersonId,
        toPersonId: relation.toPersonId,
        relationType: relation.relationType
      }))
    });
  }
}

export class CreateFamilyMemberUseCase {
  public constructor(private readonly unitOfWork: FamilyApplicationUnitOfWork) {}

  public execute(input: {
    readonly context: FamilyApplicationContext;
    readonly command: CreateFamilyMemberInput;
    readonly identifiers: CreateFamilyMemberIdentifiers;
  }): Result<PersonId, AppError> {
    const displayName = input.command.displayName.trim();
    if (displayName.length < 2 || displayName.length > 120) {
      return err(validationError(input.context.correlationId, 'Ad soyad 2 ile 120 karakter arasında olmalıdır.'));
    }
    if (!Number.isInteger(input.command.generation) || input.command.generation < 1 || input.command.generation > 20) {
      return err(validationError(input.context.correlationId, 'Nesil 1 ile 20 arasında olmalıdır.'));
    }
    const birthDate = input.command.birthDate?.trim();
    if (birthDate && !isValidIsoDate(birthDate)) {
      return err(validationError(input.context.correlationId, 'Doğum tarihi YYYY-AA-GG biçiminde geçerli bir tarih olmalıdır.'));
    }
    const relationshipCode = input.command.relationshipCode;
    if (relationshipCode !== undefined && !isFamilyRelationshipCode(relationshipCode)) {
      return err(validationError(input.context.correlationId, 'Yakınlık kataloğu seçimi geçersiz.'));
    }
    const relationshipDefinition = relationshipCode ? getFamilyRelationship(relationshipCode) : undefined;
    const customRelationshipLabel = input.command.customRelationshipLabel?.trim();
    const relationshipType = relationshipDefinition
      ? (relationshipDefinition.code === 'other' ? (customRelationshipLabel || 'Diğer') : relationshipDefinition.label)
      : (input.command.relationshipType.trim() || 'Aile üyesi');
    if (relationshipType.length > 80) {
      return err(validationError(input.context.correlationId, 'Yakınlık türü 80 karakteri aşamaz.'));
    }
    if (relationshipDefinition?.code === 'other' && customRelationshipLabel && customRelationshipLabel.length < 2) {
      return err(validationError(input.context.correlationId, 'Özel yakınlık adı en az 2 karakter olmalıdır.'));
    }
    if (relationshipDefinition?.referenceRequired && !input.command.referencePersonId) {
      return err(validationError(input.context.correlationId, 'Seçilen yakınlık için referans aile bireyi zorunludur.'));
    }
    const branch = input.command.branch?.trim() || 'Ana Dal';
    if (branch.length > 120) {
      return err(validationError(input.context.correlationId, 'Aile dalı 120 karakteri aşamaz.'));
    }

    return this.unitOfWork.execute(input.context, (scope) => {
      const family = scope.findFamily(input.context.familyId);
      if (!family.ok) return family;
      if (!family.value) {
        return err(notFoundError(input.context.correlationId, 'Aile kaydı bulunamadı.', {
          familyId: input.context.familyId
        }));
      }
      const person: FamilyPersonRecord = {
        id: input.identifiers.personId,
        familyId: input.context.familyId,
        displayName,
        ...(birthDate ? { birthDate: birthDate as IsoDate } : {}),
        relationshipType,
        generation: input.command.generation,
        branch,
        status: 'active',
        createdAt: scope.occurredAt
      };
      const inserted = scope.insertPerson(person);
      if (!inserted.ok) return inserted;

      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'member.created',
        resourceType: 'person',
        resourceId: person.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;

      const event: DomainEvent<FamilyMemberCreatedPayload> = {
        eventId: input.identifiers.eventId,
        eventType: 'family.member.created',
        eventVersion: 1,
        aggregateType: 'person',
        aggregateId: person.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          familyId: input.context.familyId,
          personId: person.id,
          displayName,
          generation: person.generation,
          branch
        }
      };
      const queued = scope.enqueueEvent(event);
      if (!queued.ok) return queued;

      if (relationshipDefinition && input.command.referencePersonId) {
        const relationshipIds = input.identifiers.relationship;
        if (!relationshipIds) {
          return err(validationError(input.context.correlationId, 'Otomatik yakınlık bağlantısı kimlikleri eksik.'));
        }
        const referencePersonId = input.command.referencePersonId as PersonId;
        const referencePerson = scope.findPerson(referencePersonId);
        if (!referencePerson.ok) return referencePerson;
        if (!referencePerson.value || referencePerson.value.familyId !== input.context.familyId) {
          return err(notFoundError(input.context.correlationId, 'Referans aile bireyi bulunamadı.', { referencePersonId }));
        }
        const automaticRelations: readonly [{ readonly relation: FamilyRelationRecord; readonly auditId:string; readonly eventId:EventId }, { readonly relation: FamilyRelationRecord; readonly auditId:string; readonly eventId:EventId }] = [
          {
            relation: { id:relationshipIds.forwardRelationId, familyId:input.context.familyId, fromPersonId:person.id, toPersonId:referencePersonId, relationType:relationshipDefinition.forwardRelationType },
            auditId:relationshipIds.forwardAuditId,
            eventId:relationshipIds.forwardEventId
          },
          {
            relation: { id:relationshipIds.reverseRelationId, familyId:input.context.familyId, fromPersonId:referencePersonId, toPersonId:person.id, relationType:relationshipDefinition.reverseRelationType },
            auditId:relationshipIds.reverseAuditId,
            eventId:relationshipIds.reverseEventId
          }
        ];
        for (const automatic of automaticRelations) {
          const relationInserted = scope.insertRelation(automatic.relation);
          if (!relationInserted.ok) return relationInserted;
          const relationAudited = scope.appendAudit({
            id:automatic.auditId,
            action:'relation.created.automatic',
            resourceType:'relation',
            resourceId:automatic.relation.id,
            occurredAt:scope.occurredAt,
            actorId:input.context.actor.userId
          });
          if (!relationAudited.ok) return relationAudited;
          const relationQueued = scope.enqueueEvent<FamilyRelationCreatedPayload>({
            eventId:automatic.eventId,
            eventType:'family.relation.created',
            eventVersion:1,
            aggregateType:'relation',
            aggregateId:automatic.relation.id,
            occurredAt:scope.occurredAt,
            actorId:input.context.actor.userId,
            correlationId:input.context.correlationId,
            payload:{
              familyId:input.context.familyId,
              relationId:automatic.relation.id,
              fromPersonId:automatic.relation.fromPersonId,
              toPersonId:automatic.relation.toPersonId,
              relationType:automatic.relation.relationType
            }
          });
          if (!relationQueued.ok) return relationQueued;
        }
      }
      return ok(person.id);
    });
  }
}

export class CreateFamilyRelationUseCase {
  public constructor(private readonly unitOfWork: FamilyApplicationUnitOfWork) {}

  public execute(input: {
    readonly context: FamilyApplicationContext;
    readonly command: CreateFamilyRelationInput;
    readonly identifiers: CreateFamilyRelationIdentifiers;
  }): Result<string, AppError> {
    if (input.command.fromPersonId === input.command.toPersonId) {
      return err(validationError(input.context.correlationId, 'Kişi kendisiyle ilişkilendirilemez.'));
    }
    if (!allowedRelationTypes.has(input.command.relationType)) {
      return err(validationError(input.context.correlationId, 'İlişki türü geçersiz.'));
    }
    const fromPersonId = input.command.fromPersonId as PersonId;
    const toPersonId = input.command.toPersonId as PersonId;

    return this.unitOfWork.execute(input.context, (scope) => {
      const family = scope.findFamily(input.context.familyId);
      if (!family.ok) return family;
      if (!family.value) {
        return err(notFoundError(input.context.correlationId, 'Aile kaydı bulunamadı.', {
          familyId: input.context.familyId
        }));
      }

      const from = scope.findPerson(fromPersonId);
      if (!from.ok) return from;
      const to = scope.findPerson(toPersonId);
      if (!to.ok) return to;
      if (!from.value || !to.value) {
        return err(notFoundError(input.context.correlationId, 'Aile üyesi bulunamadı.', {
          fromPersonId,
          toPersonId
        }));
      }
      if (from.value.familyId !== input.context.familyId || to.value.familyId !== input.context.familyId) {
        return err(validationError(input.context.correlationId, 'İlişkilendirilecek kişiler aynı aileye ait olmalıdır.'));
      }

      const duplicate = scope.relationExists({
        familyId: input.context.familyId,
        fromPersonId,
        toPersonId,
        relationType: input.command.relationType
      });
      if (!duplicate.ok) return duplicate;
      if (duplicate.value) {
        return err(conflictError(input.context.correlationId, 'Bu ilişki zaten kayıtlı.'));
      }

      const relation: FamilyRelationRecord = {
        id: input.identifiers.relationId,
        familyId: input.context.familyId,
        fromPersonId,
        toPersonId,
        relationType: input.command.relationType
      };
      const inserted = scope.insertRelation(relation);
      if (!inserted.ok) return inserted;

      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'relation.created',
        resourceType: 'relation',
        resourceId: relation.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;

      const event: DomainEvent<FamilyRelationCreatedPayload> = {
        eventId: input.identifiers.eventId,
        eventType: 'family.relation.created',
        eventVersion: 1,
        aggregateType: 'relation',
        aggregateId: relation.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          familyId: input.context.familyId,
          relationId: relation.id,
          fromPersonId,
          toPersonId,
          relationType: relation.relationType
        }
      };
      const queued = scope.enqueueEvent(event);
      if (!queued.ok) return queued;
      return ok(relation.id);
    });
  }
}
