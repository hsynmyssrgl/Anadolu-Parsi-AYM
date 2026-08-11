import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type EventId,
  type FamilyBranchId,
  type FamilyId,
  type HouseholdId,
  type IsoDateTime,
  type MembershipId,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  AssignPersonMembershipInput,
  CreateFamilyBranchInput,
  CreateHouseholdInput,
  FamilyBranch,
  Household,
  HouseholdMembershipWorkspaceView,
  PersonMembership
} from '@ppt/domain';
import type { DomainEvent } from '@ppt/events';

export interface HouseholdMembershipApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly roles: readonly string[];
  };
  readonly correlationId: CorrelationId;
}

export interface HouseholdMembershipWriteScope {
  readonly occurredAt: IsoDateTime;
  authorizeAdministration(): Result<boolean, AppError>;
  findPerson(personId: PersonId): Result<{ readonly id: PersonId; readonly familyId: FamilyId } | null, AppError>;
  findHousehold(householdId: HouseholdId): Result<Household | null, AppError>;
  findBranch(branchId: FamilyBranchId): Result<FamilyBranch | null, AppError>;
  findMembership(membershipId: MembershipId): Result<PersonMembership | null, AppError>;
  listHouseholds(familyId: FamilyId): Result<readonly Household[], AppError>;
  listBranches(familyId: FamilyId): Result<readonly FamilyBranch[], AppError>;
  listMembershipsByPerson(personId: PersonId): Result<readonly PersonMembership[], AppError>;
  listMembershipsByFamily(familyId: FamilyId): Result<readonly PersonMembership[], AppError>;
  hasOverlappingMembership(input: {
    readonly personId: PersonId;
    readonly householdId: HouseholdId;
    readonly familyBranchId?: FamilyBranchId;
    readonly validFrom: IsoDateTime;
    readonly validUntil?: IsoDateTime;
    readonly excludeMembershipId?: MembershipId;
  }): Result<boolean, AppError>;
  insertHousehold(household: Household): Result<void, AppError>;
  insertBranch(branch: FamilyBranch): Result<void, AppError>;
  insertMembership(membership: PersonMembership): Result<void, AppError>;
  updateMembershipStatus(input: {
    readonly membershipId: MembershipId;
    readonly status: PersonMembership['status'];
    readonly validUntil?: IsoDateTime;
    readonly updatedAt: IsoDateTime;
  }): Result<boolean, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
  enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError>;
}

export interface HouseholdMembershipUnitOfWork {
  execute<TValue>(
    context: HouseholdMembershipApplicationContext,
    operation: (scope: HouseholdMembershipWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError>;
}

const applicationError = (
  correlationId: CorrelationId,
  code: AppError['code'],
  category: AppError['category'],
  message: string,
  details?: Readonly<Record<string, unknown>>
): AppError => createAppError({
  code,
  category,
  message,
  correlationId,
  ...(details ? { details } : {})
});

const invalid = (context: HouseholdMembershipApplicationContext, message: string): AppError =>
  applicationError(context.correlationId, ERROR_CODES.CORE_INVALID_ARGUMENT, 'validation', message);

const denied = (context: HouseholdMembershipApplicationContext): AppError =>
  applicationError(
    context.correlationId,
    ERROR_CODES.AUTHORIZATION_DENIED,
    'authorization',
    'Hane ve aile dalı üyeliklerini yalnız aile yöneticisi değiştirebilir.'
  );

const missing = (context: HouseholdMembershipApplicationContext, message: string): AppError =>
  applicationError(context.correlationId, ERROR_CODES.RESOURCE_NOT_FOUND, 'not_found', message);

const conflict = (context: HouseholdMembershipApplicationContext, message: string): AppError =>
  applicationError(context.correlationId, ERROR_CODES.RESOURCE_CONFLICT, 'conflict', message);

const isValidIsoDateTime = (value: string): boolean => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const householdKinds = new Set<Household['kind']>(['primary', 'shared', 'extended', 'other']);
const membershipRoles = new Set<PersonMembership['role']>(['resident', 'member', 'guardian', 'dependent', 'other']);

const executeAuthorized = <TValue>(
  unitOfWork: HouseholdMembershipUnitOfWork,
  context: HouseholdMembershipApplicationContext,
  operation: (scope: HouseholdMembershipWriteScope) => Result<TValue, AppError>
): Result<TValue, AppError> => unitOfWork.execute(context, (scope) => {
  const authorized = scope.authorizeAdministration();
  if (!authorized.ok) return authorized;
  return authorized.value ? operation(scope) : err(denied(context));
});

export class CreateHouseholdUseCase {
  public constructor(private readonly unitOfWork: HouseholdMembershipUnitOfWork) {}

  public execute(input: {
    readonly context: HouseholdMembershipApplicationContext;
    readonly command: CreateHouseholdInput;
    readonly identifiers: { readonly householdId: HouseholdId; readonly auditId: string; readonly eventId: EventId };
  }): Result<Household, AppError> {
    const name = input.command.name.trim();
    if (name.length < 2 || name.length > 120) return err(invalid(input.context, 'Hane adı 2 ile 120 karakter arasında olmalıdır.'));
    if (!householdKinds.has(input.command.kind)) return err(invalid(input.context, 'Hane türü geçersiz.'));

    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const household: Household = {
        id: input.identifiers.householdId,
        familyId: input.context.familyId,
        name,
        kind: input.command.kind,
        status: 'active',
        createdAt: scope.occurredAt,
        updatedAt: scope.occurredAt
      };
      const inserted = scope.insertHousehold(household);
      if (!inserted.ok) return inserted;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'household.created',
        resourceType: 'household',
        resourceId: household.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.eventId,
        eventType: 'family.household.created',
        eventVersion: 1,
        aggregateType: 'household',
        aggregateId: household.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { familyId: household.familyId, householdId: household.id, name: household.name, kind: household.kind }
      });
      return queued.ok ? ok(household) : queued;
    });
  }
}

export class CreateFamilyBranchUseCase {
  public constructor(private readonly unitOfWork: HouseholdMembershipUnitOfWork) {}

  public execute(input: {
    readonly context: HouseholdMembershipApplicationContext;
    readonly command: CreateFamilyBranchInput;
    readonly identifiers: { readonly branchId: FamilyBranchId; readonly auditId: string; readonly eventId: EventId };
  }): Result<FamilyBranch, AppError> {
    const name = input.command.name.trim();
    if (name.length < 2 || name.length > 120) return err(invalid(input.context, 'Aile dalı adı 2 ile 120 karakter arasında olmalıdır.'));
    if (input.command.parentBranchId === input.identifiers.branchId) return err(invalid(input.context, 'Aile dalı kendisinin üst dalı olamaz.'));

    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      if (input.command.householdId) {
        const household = scope.findHousehold(input.command.householdId);
        if (!household.ok) return household;
        if (!household.value || household.value.familyId !== input.context.familyId || household.value.status !== 'active') {
          return err(missing(input.context, 'Etkin hane bulunamadı.'));
        }
      }
      if (input.command.parentBranchId) {
        const parent = scope.findBranch(input.command.parentBranchId);
        if (!parent.ok) return parent;
        if (!parent.value || parent.value.familyId !== input.context.familyId || parent.value.status !== 'active') {
          return err(missing(input.context, 'Etkin üst aile dalı bulunamadı.'));
        }
        if (input.command.householdId && parent.value.householdId && parent.value.householdId !== input.command.householdId) {
          return err(invalid(input.context, 'Üst aile dalı farklı bir haneye bağlı olamaz.'));
        }
      }
      const branch: FamilyBranch = {
        id: input.identifiers.branchId,
        familyId: input.context.familyId,
        ...(input.command.householdId ? { householdId: input.command.householdId } : {}),
        ...(input.command.parentBranchId ? { parentBranchId: input.command.parentBranchId } : {}),
        name,
        status: 'active',
        createdAt: scope.occurredAt,
        updatedAt: scope.occurredAt
      };
      const inserted = scope.insertBranch(branch);
      if (!inserted.ok) return inserted;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'family_branch.created',
        resourceType: 'family_branch',
        resourceId: branch.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.eventId,
        eventType: 'family.branch.created',
        eventVersion: 1,
        aggregateType: 'family_branch',
        aggregateId: branch.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          familyId: branch.familyId,
          branchId: branch.id,
          householdId: branch.householdId ?? null,
          parentBranchId: branch.parentBranchId ?? null,
          name: branch.name
        }
      });
      return queued.ok ? ok(branch) : queued;
    });
  }
}

export class AssignPersonMembershipUseCase {
  public constructor(private readonly unitOfWork: HouseholdMembershipUnitOfWork) {}

  public execute(input: {
    readonly context: HouseholdMembershipApplicationContext;
    readonly command: AssignPersonMembershipInput;
    readonly identifiers: { readonly membershipId: MembershipId; readonly auditId: string; readonly eventId: EventId };
  }): Result<PersonMembership, AppError> {
    if (!membershipRoles.has(input.command.role)) return err(invalid(input.context, 'Kişi üyelik rolü geçersiz.'));
    if (!isValidIsoDateTime(input.command.validFrom)) return err(invalid(input.context, 'Üyelik başlangıcı geçerli UTC ISO tarih-saat olmalıdır.'));
    if (input.command.validUntil && !isValidIsoDateTime(input.command.validUntil)) return err(invalid(input.context, 'Üyelik bitişi geçerli UTC ISO tarih-saat olmalıdır.'));
    if (input.command.validUntil && input.command.validUntil <= input.command.validFrom) return err(invalid(input.context, 'Üyelik bitişi başlangıçtan sonra olmalıdır.'));

    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const person = scope.findPerson(input.command.personId);
      if (!person.ok) return person;
      if (!person.value || person.value.familyId !== input.context.familyId) return err(missing(input.context, 'Aile kişisi bulunamadı.'));
      const household = scope.findHousehold(input.command.householdId);
      if (!household.ok) return household;
      if (!household.value || household.value.familyId !== input.context.familyId || household.value.status !== 'active') {
        return err(missing(input.context, 'Etkin hane bulunamadı.'));
      }
      if (input.command.familyBranchId) {
        const branch = scope.findBranch(input.command.familyBranchId);
        if (!branch.ok) return branch;
        if (!branch.value || branch.value.familyId !== input.context.familyId || branch.value.status !== 'active') {
          return err(missing(input.context, 'Etkin aile dalı bulunamadı.'));
        }
        if (branch.value.householdId && branch.value.householdId !== input.command.householdId) {
          return err(invalid(input.context, 'Aile dalı seçilen haneye bağlı değildir.'));
        }
      }
      const overlap = scope.hasOverlappingMembership({
        personId: input.command.personId,
        householdId: input.command.householdId,
        ...(input.command.familyBranchId ? { familyBranchId: input.command.familyBranchId } : {}),
        validFrom: input.command.validFrom,
        ...(input.command.validUntil ? { validUntil: input.command.validUntil } : {})
      });
      if (!overlap.ok) return overlap;
      if (overlap.value) return err(conflict(input.context, 'Aynı kişi, hane ve aile dalı için çakışan bir üyelik dönemi zaten var.'));

      const membership: PersonMembership = {
        id: input.identifiers.membershipId,
        personId: input.command.personId,
        householdId: input.command.householdId,
        ...(input.command.familyBranchId ? { familyBranchId: input.command.familyBranchId } : {}),
        role: input.command.role,
        status: input.command.validUntil ? 'ended' : 'active',
        validFrom: input.command.validFrom,
        ...(input.command.validUntil ? { validUntil: input.command.validUntil } : {}),
        createdAt: scope.occurredAt,
        updatedAt: scope.occurredAt
      };
      const inserted = scope.insertMembership(membership);
      if (!inserted.ok) return inserted;
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'person_membership.assigned',
        resourceType: 'person_membership',
        resourceId: membership.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.eventId,
        eventType: 'family.person_membership.assigned',
        eventVersion: 1,
        aggregateType: 'person_membership',
        aggregateId: membership.id,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: {
          membershipId: membership.id,
          personId: membership.personId,
          householdId: membership.householdId,
          familyBranchId: membership.familyBranchId ?? null,
          role: membership.role,
          validFrom: membership.validFrom,
          validUntil: membership.validUntil ?? null
        }
      });
      return queued.ok ? ok(membership) : queued;
    });
  }
}

export class EndPersonMembershipUseCase {
  public constructor(private readonly unitOfWork: HouseholdMembershipUnitOfWork) {}

  public execute(input: {
    readonly context: HouseholdMembershipApplicationContext;
    readonly membershipId: MembershipId;
    readonly endedAt: IsoDateTime;
    readonly identifiers: { readonly auditId: string; readonly eventId: EventId };
  }): Result<PersonMembership, AppError> {
    if (!isValidIsoDateTime(input.endedAt)) return err(invalid(input.context, 'Üyelik bitişi geçerli UTC ISO tarih-saat olmalıdır.'));
    return executeAuthorized(this.unitOfWork, input.context, (scope) => {
      const current = scope.findMembership(input.membershipId);
      if (!current.ok) return current;
      if (!current.value) return err(missing(input.context, 'Kişi üyeliği bulunamadı.'));
      const person = scope.findPerson(current.value.personId);
      if (!person.ok) return person;
      if (!person.value || person.value.familyId !== input.context.familyId) return err(missing(input.context, 'Kişi üyeliği bu aileye ait değil.'));
      if (current.value.status === 'ended') return err(conflict(input.context, 'Kişi üyeliği daha önce sona ermiş.'));
      if (input.endedAt <= current.value.validFrom) return err(invalid(input.context, 'Üyelik bitişi başlangıçtan sonra olmalıdır.'));
      const updated = scope.updateMembershipStatus({
        membershipId: input.membershipId,
        status: 'ended',
        validUntil: input.endedAt,
        updatedAt: scope.occurredAt
      });
      if (!updated.ok) return updated;
      if (!updated.value) return err(conflict(input.context, 'Kişi üyeliği güncellenemedi.'));
      const audited = scope.appendAudit({
        id: input.identifiers.auditId,
        action: 'person_membership.ended',
        resourceType: 'person_membership',
        resourceId: input.membershipId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId
      });
      if (!audited.ok) return audited;
      const queued = scope.enqueueEvent({
        eventId: input.identifiers.eventId,
        eventType: 'family.person_membership.ended',
        eventVersion: 1,
        aggregateType: 'person_membership',
        aggregateId: input.membershipId,
        occurredAt: scope.occurredAt,
        actorId: input.context.actor.userId,
        correlationId: input.context.correlationId,
        payload: { membershipId: input.membershipId, personId: current.value.personId, endedAt: input.endedAt }
      });
      return queued.ok
        ? ok({ ...current.value, status: 'ended', validUntil: input.endedAt, updatedAt: scope.occurredAt })
        : queued;
    });
  }
}

export class GetPersonMembershipHistoryUseCase {
  public constructor(private readonly unitOfWork: HouseholdMembershipUnitOfWork) {}

  public execute(
    context: HouseholdMembershipApplicationContext,
    personId: PersonId
  ): Result<readonly PersonMembership[], AppError> {
    return executeAuthorized(this.unitOfWork, context, (scope) => {
      const person = scope.findPerson(personId);
      if (!person.ok) return person;
      if (!person.value || person.value.familyId !== context.familyId) return err(missing(context, 'Aile kişisi bulunamadı.'));
      return scope.listMembershipsByPerson(personId);
    });
  }
}

export class GetHouseholdMembershipWorkspaceUseCase {
  public constructor(private readonly unitOfWork: HouseholdMembershipUnitOfWork) {}

  public execute(context: HouseholdMembershipApplicationContext): Result<HouseholdMembershipWorkspaceView, AppError> {
    return executeAuthorized(this.unitOfWork, context, (scope) => {
      const households = scope.listHouseholds(context.familyId);
      if (!households.ok) return households;
      const branches = scope.listBranches(context.familyId);
      if (!branches.ok) return branches;
      const memberships = scope.listMembershipsByFamily(context.familyId);
      if (!memberships.ok) return memberships;
      return ok({
        households: households.value,
        branches: branches.value,
        memberships: memberships.value
      });
    });
  }
}
