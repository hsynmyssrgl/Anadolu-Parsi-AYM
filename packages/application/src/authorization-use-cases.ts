import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyBranchId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  OBJECT_PERMISSION_ACTIONS,
  type ObjectPermissionAction,
  type AuditEntryView,
  type AuditIntegrityView,
  type FamilyRole,
  type ObjectPermissionView,
  type UpsertObjectPermissionInput
} from '@ppt/domain';
import {
  CentralAuthorizationService,
  type AuthorizationAction,
  type AuthorizationDecision,
  type AuthorizationGrant
} from '@ppt/security';

export interface AuthorizationAccountRecord {
  readonly id: UserId;
  readonly role: FamilyRole;
  readonly status: string;
  readonly personId?: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt?: IsoDateTime;
}

export interface AuthorizationApplicationContext { readonly correlationId: CorrelationId; }

export interface AuthorizationQueryPort {
  getAccount(accountId: UserId, context: AuthorizationApplicationContext): Result<AuthorizationAccountRecord | null, AppError>;
  listActiveGrants(accountId: UserId, occurredAt: IsoDateTime, context: AuthorizationApplicationContext): Result<readonly ObjectPermissionView[], AppError>;
  listActiveBranchIds?(personId: PersonId, occurredAt: IsoDateTime, context: AuthorizationApplicationContext): Result<readonly FamilyBranchId[], AppError>;
  listAllPermissions(context: AuthorizationApplicationContext): Result<readonly ObjectPermissionView[], AppError>;
  verifyAuditIntegrity(context: AuthorizationApplicationContext): Result<AuditIntegrityView, AppError>;
  listAuditEntries(context: AuthorizationApplicationContext, limit: number): Result<readonly AuditEntryView[], AppError>;
}

export interface AuthorizationWriteScope {
  readonly occurredAt: IsoDateTime;
  getAccount(accountId: UserId): Result<AuthorizationAccountRecord | null, AppError>;
  upsertPermission(input: ObjectPermissionView): Result<void, AppError>;
  deletePermission(id: string): Result<boolean, AppError>;
  appendAudit(input: {
    readonly id: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly occurredAt: IsoDateTime;
    readonly actorId: UserId;
  }): Result<string, AppError>;
}

export interface AuthorizationUnitOfWork {
  execute<T>(context: AuthorizationApplicationContext, actorId: UserId, operation: (scope: AuthorizationWriteScope) => Result<T, AppError>): Result<T, AppError>;
}

const denied = (correlationId: CorrelationId): AppError => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'Bu işlem için yetkiniz bulunmuyor.',
  category: 'authorization',
  correlationId
});
const invalid = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId
});
const notFound = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category: 'not_found',
  correlationId
});

const isActive = (account: AuthorizationAccountRecord, now: IsoDateTime): boolean => account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(now)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(now));

const objectPermissionActionSet = new Set<string>(OBJECT_PERMISSION_ACTIONS);
const isObjectPermissionAction = (value: unknown): value is ObjectPermissionAction =>
  typeof value === 'string' && objectPermissionActionSet.has(value);

const toGrant = (permission: ObjectPermissionView): AuthorizationGrant => ({
  id: permission.id,
  subjectAccountId: permission.subjectAccountId,
  resourceType: permission.resourceType,
  resourceId: permission.resourceId,
  actions: permission.actions,
  effect: permission.effect,
  purpose: permission.purpose,
  ...(permission.familyBranchId ? { familyBranchId: permission.familyBranchId } : {}),
  ...(permission.denialReason ? { denialReason: permission.denialReason } : {}),
  startsAt: permission.startsAt,
  ...(permission.endsAt ? { endsAt: permission.endsAt } : {})
});

export class EvaluateAuthorizationUseCase {
  public constructor(private readonly query: AuthorizationQueryPort, private readonly service = new CentralAuthorizationService()) {}
  public execute(input: {
    readonly context: AuthorizationApplicationContext;
    readonly accountId: UserId;
    readonly occurredAt: IsoDateTime;
    readonly action: AuthorizationAction;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly ownerPersonId?: string;
    readonly purpose?: AuthorizationGrant['purpose'];
    readonly resourceBranchId?: FamilyBranchId;
  }): Result<AuthorizationDecision, AppError> {
    const account = this.query.getAccount(input.accountId, input.context);
    if (!account.ok) return account;
    if (!account.value || !isActive(account.value, input.occurredAt)) return ok({ allowed: false, reason: 'inactive_membership' });
    const grants = this.query.listActiveGrants(input.accountId, input.occurredAt, input.context);
    if (!grants.ok) return grants;
    const branches = account.value.personId && this.query.listActiveBranchIds
      ? this.query.listActiveBranchIds(account.value.personId as PersonId, input.occurredAt, input.context)
      : ok<readonly FamilyBranchId[]>([]);
    if (!branches.ok) return branches;
    return ok(this.service.authorize({
      accountId: account.value.id,
      role: account.value.role,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      occurredAt: input.occurredAt,
      purpose: input.purpose ?? 'general',
      actorBranchIds: branches.value,
      ...(input.resourceBranchId ? { resourceBranchId: input.resourceBranchId } : {}),
      ...(account.value.personId ? { actorPersonId: account.value.personId } : {}),
      ...(input.ownerPersonId ? { ownerPersonId: input.ownerPersonId } : {}),
      grants: grants.value.map(toGrant)
    }));
  }
}

const requireAdmin = (
  scope: AuthorizationWriteScope,
  actorId: UserId,
  context: AuthorizationApplicationContext,
  service: CentralAuthorizationService
): Result<AuthorizationAccountRecord, AppError> => {
  const account = scope.getAccount(actorId);
  if (!account.ok) return account;
  if (!account.value) return err(notFound(context.correlationId, 'Hesap bulunamadı.'));
  if (!isActive(account.value, scope.occurredAt)) return err(denied(context.correlationId));
  const decision = service.authorize({
    accountId: actorId,
    role: account.value.role,
    action: 'administer',
    resourceType: 'object_permission',
    resourceId: '*',
    occurredAt: scope.occurredAt,
    ...(account.value.personId ? { actorPersonId: account.value.personId } : {})
  });
  return decision.allowed ? ok(account.value) : err(denied(context.correlationId));
};

export class ListObjectPermissionsUseCase {
  public constructor(private readonly query: AuthorizationQueryPort, private readonly service = new CentralAuthorizationService()) {}
  public execute(context: AuthorizationApplicationContext, actorId: UserId, occurredAt: IsoDateTime): Result<readonly ObjectPermissionView[], AppError> {
    const account = this.query.getAccount(actorId, context);
    if (!account.ok) return account;
    if (!account.value || !isActive(account.value, occurredAt)) return err(denied(context.correlationId));
    const decision = this.service.authorize({ accountId: actorId, role: account.value.role, action: 'administer', resourceType: 'object_permission', resourceId: '*', occurredAt });
    return decision.allowed ? this.query.listAllPermissions(context) : err(denied(context.correlationId));
  }
}

export class UpsertObjectPermissionUseCase {
  public constructor(private readonly unitOfWork: AuthorizationUnitOfWork, private readonly service = new CentralAuthorizationService()) {}
  public execute(input: { readonly context: AuthorizationApplicationContext; readonly actorId: UserId; readonly command: UpsertObjectPermissionInput; readonly permissionId: string; readonly auditId: string }): Result<void, AppError> {
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const admin = requireAdmin(scope, input.actorId, input.context, this.service);
      if (!admin.ok) return admin;
      const resourceType = input.command.resourceType.trim();
      const resourceId = input.command.resourceId.trim();
      const requestedActions: readonly unknown[] = Array.isArray(input.command.actions) ? input.command.actions : [];
      if (!Array.isArray(input.command.actions) || requestedActions.some((action) => !isObjectPermissionAction(action))) {
        return err(invalid(input.context.correlationId, 'İzin eylemi geçersiz.'));
      }
      const actions = [...new Set(requestedActions)] as ObjectPermissionAction[];
      if (!resourceType || !resourceId || actions.length === 0) return err(invalid(input.context.correlationId, 'Kaynak ve en az bir izin eylemi zorunludur.'));
      const startsAt = input.command.startsAt ? new Date(input.command.startsAt) : new Date(scope.occurredAt);
      const endsAt = input.command.endsAt ? new Date(input.command.endsAt) : undefined;
      if (Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))) return err(invalid(input.context.correlationId, 'İzin tarihleri geçersiz.'));
      if (
        resourceType === 'location'
        && (
          actions.length !== 1
          || actions[0] !== 'read'
          || (input.command.purpose ?? 'general') !== 'general'
          || input.command.familyBranchId !== undefined
        )
      ) return err(invalid(input.context.correlationId, 'Konum izinleri yalnız genel amaçlı, dal kapsamı olmayan tek bir okuma eylemi taşıyabilir.'));
      if (
        resourceType === 'location'
        && input.command.effect === 'allow'
        && !endsAt
      ) return err(invalid(input.context.correlationId, 'Konum okuma izni sonlu bir bitiş tarihi gerektirir.'));
      const denialReason = input.command.denialReason?.trim();
      if (input.command.effect === 'deny' && (!denialReason || denialReason.length < 5 || denialReason.length > 500)) return err(invalid(input.context.correlationId, 'Açık ret gerekçesi 5 ile 500 karakter arasında olmalıdır.'));
      if (input.command.effect === 'allow' && denialReason) return err(invalid(input.context.correlationId, 'İzin veren kayıt ret gerekçesi taşıyamaz.'));
      const account = scope.getAccount(input.command.subjectAccountId as UserId);
      if (!account.ok) return account;
      if (!account.value) return err(notFound(input.context.correlationId, 'İzin verilecek hesap bulunamadı.'));
      const permission: ObjectPermissionView = {
        id: input.permissionId,
        subjectAccountId: input.command.subjectAccountId,
        resourceType,
        resourceId,
        actions,
        effect: input.command.effect,
        purpose: input.command.purpose ?? 'general',
        ...(input.command.familyBranchId ? { familyBranchId: input.command.familyBranchId } : {}),
        ...(denialReason ? { denialReason } : {}),
        startsAt: startsAt.toISOString(),
        ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
        createdAt: scope.occurredAt
      };
      const saved = scope.upsertPermission(permission);
      if (!saved.ok) return saved;
      const audit = scope.appendAudit({ id: input.auditId, action: 'permission.upserted', resourceType: 'object_permission', resourceId: permission.id, occurredAt: scope.occurredAt, actorId: input.actorId });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export class DeleteObjectPermissionUseCase {
  public constructor(private readonly unitOfWork: AuthorizationUnitOfWork, private readonly service = new CentralAuthorizationService()) {}
  public execute(input: { readonly context: AuthorizationApplicationContext; readonly actorId: UserId; readonly permissionId: string; readonly auditId: string }): Result<void, AppError> {
    return this.unitOfWork.execute(input.context, input.actorId, (scope) => {
      const admin = requireAdmin(scope, input.actorId, input.context, this.service);
      if (!admin.ok) return admin;
      const deleted = scope.deletePermission(input.permissionId);
      if (!deleted.ok) return deleted;
      if (!deleted.value) return err(notFound(input.context.correlationId, 'İzin kaydı bulunamadı.'));
      const audit = scope.appendAudit({ id: input.auditId, action: 'permission.deleted', resourceType: 'object_permission', resourceId: input.permissionId, occurredAt: scope.occurredAt, actorId: input.actorId });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}


export class ListAuditEntriesUseCase {
  public constructor(private readonly query: AuthorizationQueryPort, private readonly service = new CentralAuthorizationService()) {}
  public execute(context: AuthorizationApplicationContext, actorId: UserId, occurredAt: IsoDateTime, limit = 100): Result<readonly AuditEntryView[], AppError> {
    const account = this.query.getAccount(actorId, context);
    if (!account.ok) return account;
    if (!account.value || !isActive(account.value, occurredAt)) return err(denied(context.correlationId));
    const decision = this.service.authorize({ accountId: actorId, role: account.value.role, action: 'administer', resourceType: 'audit_log', resourceId: '*', occurredAt });
    return decision.allowed ? this.query.listAuditEntries(context, Math.max(1, Math.min(limit, 500))) : err(denied(context.correlationId));
  }
}

export class VerifyAuditIntegrityUseCase {
  public constructor(private readonly query: AuthorizationQueryPort) {}
  public execute(context: AuthorizationApplicationContext, actorId: UserId, occurredAt: IsoDateTime): Result<AuditIntegrityView, AppError> {
    const account = this.query.getAccount(actorId, context);
    if (!account.ok) return account;
    if (!account.value || !isActive(account.value, occurredAt)) return err(denied(context.correlationId));
    return this.query.verifyAuditIntegrity(context);
  }
}
