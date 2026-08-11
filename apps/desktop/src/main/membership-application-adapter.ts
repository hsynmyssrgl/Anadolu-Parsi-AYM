import { createAppError, ERROR_CODES, type AppError, type Result, type UserId } from '@ppt/core';
import type {
  MembershipApplicationContext,
  MembershipInvitationRecord,
  MembershipQueryPort,
  MembershipUnitOfWork,
  MembershipWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import { isAdministrativeRole } from '@ppt/security';
import type { TransactionExecutor, TransactionContext } from '@ppt/repository-contracts';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  InvitationRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  InvitationRecord,
  RepositoryExecutionContext,
  AccountRow
} from '@ppt/repository-contracts';

export interface RepositoryBackedMembershipApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly invitationRepository: InvitationRepositoryPort;
  readonly accountRepository: AccountRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
}

const toApplicationInvitation = (value: InvitationRecord): MembershipInvitationRecord => ({
  id: value.id,
  email: value.email,
  role: value.role,
  ...(value.personId ? { personId: value.personId } : {}),
  startsAt: value.startsAt,
  ...(value.endsAt ? { endsAt: value.endsAt } : {}),
  status: value.status,
  tokenHash: value.tokenHash,
  createdAt: value.createdAt,
  ...(value.acceptedAt ? { acceptedAt: value.acceptedAt } : {}),
  ...(value.revokedAt ? { revokedAt: value.revokedAt } : {}),
  ...(value.revocationReason ? { revocationReason: value.revocationReason } : {}),
  ...(value.resentFromInvitationId ? { resentFromInvitationId: value.resentFromInvitationId } : {}),
  ...(value.supersededByInvitationId ? { supersededByInvitationId: value.supersededByInvitationId } : {})
});


const toApplicationAccount = (value: AccountRow) => ({
  id: value.id,
  displayName: value.displayName,
  email: value.email,
  role: value.role as import('@ppt/domain').FamilyRole,
  status: value.status as import('@ppt/domain').FamilyAccountView['status'],
  ...(value.personId ? { personId: value.personId as import('@ppt/core').PersonId } : {}),
  startsAt: value.startsAt,
  ...(value.endsAt ? { endsAt: value.endsAt } : {}),
  createdAt: value.createdAt
});

const repositoryContext = (
  context: MembershipApplicationContext,
  actorId: UserId,
  transaction: TransactionContext
): RepositoryExecutionContext => ({
  transaction: transaction.transaction,
  actor: { userId: actorId, roles: ['membership'] },
  correlationId: context.correlationId,
  occurredAt: transaction.occurredAt
});

class RepositoryBackedMembershipWriteScope implements MembershipWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedMembershipApplicationDependencies,
    private readonly context: RepositoryExecutionContext,
    public readonly occurredAt: MembershipWriteScope['occurredAt']
  ) {}

  public findAccountByEmail(email: string): ReturnType<MembershipWriteScope['findAccountByEmail']> {
    const result = this.dependencies.accountRepository.findByEmail(this.context, email);
    return result.ok ? { ok: true, value: result.value ? toApplicationAccount(result.value) : null } : result;
  }

  public findAccount(accountId: UserId): ReturnType<MembershipWriteScope['findAccount']> {
    const result = this.dependencies.accountRepository.findById(this.context, accountId);
    return result.ok ? { ok: true, value: result.value ? toApplicationAccount(result.value) : null } : result;
  }

  public findPerson(personId: Parameters<MembershipWriteScope['findPerson']>[0]): ReturnType<MembershipWriteScope['findPerson']> {
    const result = this.dependencies.personRepository.findById(this.context, personId);
    return result.ok ? { ok: true, value: result.value ? { id: result.value.id } : null } : result;
  }

  public findPendingInvitationByEmail(email: string): ReturnType<MembershipWriteScope['findPendingInvitationByEmail']> {
    const result = this.dependencies.invitationRepository.findPendingByEmail(this.context, email);
    return result.ok ? { ok: true, value: result.value ? toApplicationInvitation(result.value) : null } : result;
  }

  public findInvitationById(invitationId: string): ReturnType<MembershipWriteScope['findInvitationById']> {
    const result = this.dependencies.invitationRepository.findById(this.context, invitationId);
    return result.ok ? { ok: true, value: result.value ? toApplicationInvitation(result.value) : null } : result;
  }

  public findInvitationByTokenHash(tokenHash: string): ReturnType<MembershipWriteScope['findInvitationByTokenHash']> {
    const result = this.dependencies.invitationRepository.findByTokenHash(this.context, tokenHash);
    return result.ok ? { ok: true, value: result.value ? toApplicationInvitation(result.value) : null } : result;
  }

  public insertInvitation(invitation: MembershipInvitationRecord): ReturnType<MembershipWriteScope['insertInvitation']> {
    return this.dependencies.invitationRepository.insert(this.context, invitation);
  }

  public revokeInvitation(...args: Parameters<MembershipWriteScope['revokeInvitation']>): ReturnType<MembershipWriteScope['revokeInvitation']> {
    return this.dependencies.invitationRepository.revokePending(this.context, ...args);
  }

  public acceptInvitation(invitationId: string, acceptedAt: MembershipWriteScope['occurredAt']): ReturnType<MembershipWriteScope['acceptInvitation']> {
    return this.dependencies.invitationRepository.markAccepted(this.context, invitationId, acceptedAt);
  }

  public updateAccount(input: Parameters<MembershipWriteScope['updateAccount']>[0]): ReturnType<MembershipWriteScope['updateAccount']> {
    return this.dependencies.accountRepository.updateMembership(this.context, input);
  }

  public insertAccount(input: Parameters<MembershipWriteScope['insertAccount']>[0]): ReturnType<MembershipWriteScope['insertAccount']> {
    return this.dependencies.accountRepository.insert(this.context, input);
  }

  public appendAudit(input: Parameters<MembershipWriteScope['appendAudit']>[0]): ReturnType<MembershipWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.context, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.context, event);
  }
}

export class RepositoryBackedMembershipUnitOfWork implements MembershipUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedMembershipApplicationDependencies) {}

  public execute<T>(
    context: MembershipApplicationContext,
    actorId: UserId,
    operation: (scope: MembershipWriteScope) => Result<T, AppError>
  ): Result<T, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => operation(
      new RepositoryBackedMembershipWriteScope(
        this.dependencies,
        repositoryContext(context, actorId, transaction),
        transaction.occurredAt
      )
    ));
  }
}

export class RepositoryBackedMembershipQueryPort implements MembershipQueryPort {
  public constructor(private readonly dependencies: RepositoryBackedMembershipApplicationDependencies) {}

  public list(context: MembershipApplicationContext): ReturnType<MembershipQueryPort['list']> {
    const actorId = 'membership-query' as UserId;
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const result = this.dependencies.invitationRepository.list(repositoryContext(context, actorId, transaction));
      return result.ok ? { ok: true, value: result.value.map(toApplicationInvitation) } : result;
    });
  }

  public findInvitationByTokenHash(context: MembershipApplicationContext, tokenHash: string): ReturnType<MembershipQueryPort['findInvitationByTokenHash']> {
    const actorId = 'anonymous-invitation-inspection' as UserId;
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const result = this.dependencies.invitationRepository.findByTokenHash(repositoryContext(context, actorId, transaction), tokenHash);
      return result.ok ? { ok: true, value: result.value ? toApplicationInvitation(result.value) : null } : result;
    });
  }

  public listAccounts(context: MembershipApplicationContext, actorId: UserId): ReturnType<MembershipQueryPort['listAccounts']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repository = repositoryContext(context, actorId, transaction);
      const actor = this.dependencies.accountRepository.findById(repository, actorId);
      if (!actor.ok) return actor;
      if (!actor.value || !isAdministrativeRole(actor.value.role) || actor.value.status !== 'active') {
        return { ok: false, error: createAppError({ code: ERROR_CODES.AUTHORIZATION_DENIED, message: 'Bu işlem aile yöneticisi yetkisi gerektirir.', category: 'authorization', correlationId: context.correlationId }) };
      }
      const result = this.dependencies.accountRepository.list(repository);
      return result.ok ? { ok: true, value: result.value.map(toApplicationAccount) } : result;
    });
  }

}
