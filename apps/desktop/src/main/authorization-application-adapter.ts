import { asIsoDateTime, asUserId, type AppError, type FamilyBranchId, type PersonId, type Result, type UserId } from '@ppt/core';
import type {
  AuthorizationAccountRecord,
  AuthorizationApplicationContext,
  AuthorizationQueryPort,
  AuthorizationUnitOfWork,
  AuthorizationWriteScope
} from '@ppt/application';
import type { TransactionExecutor } from '@ppt/repository-contracts';
import type { AuditEntryView, AuditIntegrityView, ObjectPermissionView } from '@ppt/domain';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  HouseholdMembershipRepositoryPort,
  ObjectPermissionRepositoryPort,
  AccountRow,
  ObjectPermissionRow,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';

export interface RepositoryBackedAuthorizationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly permissionRepository: ObjectPermissionRepositoryPort;
  readonly householdMembershipRepository?: HouseholdMembershipRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
}

const mapAccount = (account: AccountRow): AuthorizationAccountRecord => ({
  id: account.id,
  role: account.role as AuthorizationAccountRecord['role'],
  status: account.status,
  ...(account.personId ? { personId: account.personId } : {}),
  startsAt: account.startsAt,
  ...(account.endsAt ? { endsAt: account.endsAt } : {})
});

const mapPermission = (permission: ObjectPermissionRow): ObjectPermissionView => ({
  id: permission.id,
  subjectAccountId: permission.subjectAccountId,
  resourceType: permission.resourceType,
  resourceId: permission.resourceId,
  actions: permission.actions as ObjectPermissionView['actions'],
  effect: permission.effect,
  purpose: permission.purpose,
  ...(permission.familyBranchId ? { familyBranchId: permission.familyBranchId } : {}),
  ...(permission.denialReason ? { denialReason: permission.denialReason } : {}),
  startsAt: permission.startsAt,
  ...(permission.endsAt ? { endsAt: permission.endsAt } : {}),
  createdAt: permission.createdAt
});

const toRepositoryContext = (
  transaction: Parameters<Parameters<TransactionExecutor['execute']>[1]>[0],
  applicationContext: AuthorizationApplicationContext,
  actorId: UserId
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: actorId, roles: ['authorization'] },
  correlationId: applicationContext.correlationId,
  occurredAt: transaction.occurredAt
});

export class RepositoryBackedAuthorizationQueryPort implements AuthorizationQueryPort {
  public constructor(private readonly dependencies: RepositoryBackedAuthorizationDependencies) {}

  public getAccount(accountId: UserId, context: AuthorizationApplicationContext): ReturnType<AuthorizationQueryPort['getAccount']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const result = this.dependencies.accountRepository.findById(toRepositoryContext(transaction, context, accountId), accountId);
      return result.ok ? { ok: true, value: result.value ? mapAccount(result.value) : null } : result;
    });
  }

  public listActiveGrants(accountId: UserId, occurredAt: AuthorizationAccountRecord['startsAt'], context: AuthorizationApplicationContext): ReturnType<AuthorizationQueryPort['listActiveGrants']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const result = this.dependencies.permissionRepository.listActiveForSubject(toRepositoryContext(transaction, context, accountId), accountId, occurredAt);
      return result.ok ? { ok: true, value: result.value.map(mapPermission) } : result;
    });
  }

  public listActiveBranchIds(personId: PersonId, occurredAt: AuthorizationAccountRecord['startsAt'], context: AuthorizationApplicationContext): Result<readonly FamilyBranchId[], AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      if (!this.dependencies.householdMembershipRepository) return { ok: true, value: [] };
      const actorId = asUserId('authorization-branch-query');
      const result = this.dependencies.householdMembershipRepository.listMembershipsByPerson(toRepositoryContext(transaction, context, actorId), personId);
      if (!result.ok) return result;
      const at = Date.parse(occurredAt);
      const branches = result.value
        .filter((membership) => membership.status === 'active' && Date.parse(membership.validFrom) <= at && (!membership.validUntil || Date.parse(membership.validUntil) >= at))
        .flatMap((membership) => membership.familyBranchId ? [membership.familyBranchId] : []);
      return { ok: true, value: [...new Set<FamilyBranchId>(branches)] };
    });
  }

  public listAllPermissions(context: AuthorizationApplicationContext): ReturnType<AuthorizationQueryPort['listAllPermissions']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const actorId = asUserId('authorization-query');
      const result = this.dependencies.permissionRepository.listAll(toRepositoryContext(transaction, context, actorId));
      return result.ok ? { ok: true, value: result.value.map(mapPermission) } : result;
    });
  }

  public listAuditEntries(context: AuthorizationApplicationContext, limit: number): ReturnType<AuthorizationQueryPort['listAuditEntries']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const actorId = asUserId('audit-reader');
      const result = this.dependencies.auditRepository.listEntriesDescending(toRepositoryContext(transaction, context, actorId), limit);
      if (!result.ok) return result;
      const value: AuditEntryView[] = result.value.map((entry) => ({
        id: entry.id, action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId, occurredAt: entry.occurredAt,
        ...(entry.actorId ? { actorId: entry.actorId } : {}), ...(entry.entryHash ? { entryHash: entry.entryHash } : {})
      }));
      return { ok: true, value };
    });
  }

  public verifyAuditIntegrity(context: AuthorizationApplicationContext): ReturnType<AuthorizationQueryPort['verifyAuditIntegrity']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const actorId = asUserId('audit-verifier');
      const result = this.dependencies.auditRepository.verify(toRepositoryContext(transaction, context, actorId));
      if (!result.ok) return result;
      const value: AuditIntegrityView = {
        valid: result.value.valid,
        checkedEntries: result.value.checkedEntries,
        ...(result.value.firstInvalidEntryId ? { firstInvalidEntryId: result.value.firstInvalidEntryId } : {}),
        headHash: result.value.headHash,
        checkedAt: transaction.occurredAt
      };
      return { ok: true, value };
    });
  }
}

class RepositoryBackedAuthorizationWriteScope implements AuthorizationWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedAuthorizationDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: AuthorizationWriteScope['occurredAt']
  ) {}

  public getAccount(accountId: UserId): ReturnType<AuthorizationWriteScope['getAccount']> {
    const result = this.dependencies.accountRepository.findById(this.repositoryContext, accountId);
    return result.ok ? { ok: true, value: result.value ? mapAccount(result.value) : null } : result;
  }

  public upsertPermission(input: ObjectPermissionView): ReturnType<AuthorizationWriteScope['upsertPermission']> {
    return this.dependencies.permissionRepository.upsert(this.repositoryContext, {
      id: input.id,
      subjectAccountId: input.subjectAccountId as UserId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actions: input.actions,
      effect: input.effect,
      purpose: input.purpose,
      ...(input.familyBranchId ? { familyBranchId: input.familyBranchId as FamilyBranchId } : {}),
      ...(input.denialReason ? { denialReason: input.denialReason } : {}),
      startsAt: asIsoDateTime(input.startsAt),
      ...(input.endsAt ? { endsAt: asIsoDateTime(input.endsAt) } : {}),
      createdAt: asIsoDateTime(input.createdAt)
    });
  }

  public deletePermission(id: string): ReturnType<AuthorizationWriteScope['deletePermission']> {
    return this.dependencies.permissionRepository.delete(this.repositoryContext, id);
  }

  public appendAudit(input: Parameters<AuthorizationWriteScope['appendAudit']>[0]): ReturnType<AuthorizationWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repositoryContext, input);
  }
}

export class RepositoryBackedAuthorizationUnitOfWork implements AuthorizationUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedAuthorizationDependencies) {}
  public execute<T>(context: AuthorizationApplicationContext, actorId: UserId, operation: (scope: AuthorizationWriteScope) => Result<T, AppError>): Result<T, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => operation(
      new RepositoryBackedAuthorizationWriteScope(
        this.dependencies,
        toRepositoryContext(transaction, context, actorId),
        transaction.occurredAt
      )
    ));
  }
}
