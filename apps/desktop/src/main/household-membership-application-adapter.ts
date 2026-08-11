import type { AppError, Result } from '@ppt/core';
import type {
  HouseholdMembershipApplicationContext,
  HouseholdMembershipUnitOfWork,
  HouseholdMembershipWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import { CentralAuthorizationService } from '@ppt/security';
import type { AuthorizationRole } from '@ppt/security';
import type {
  AccountRepositoryPort,
  AuditRepositoryPort,
  HouseholdMembershipRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  RepositoryExecutionContext,
  TransactionExecutor
} from '@ppt/repository-contracts';

export interface RepositoryBackedHouseholdMembershipDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly accountRepository: AccountRepositoryPort;
  readonly householdMembershipRepository: HouseholdMembershipRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
}

const authorizationRoles = new Set<AuthorizationRole>([
  'family_admin',
  'adult_member',
  'limited_member',
  'caregiver',
  'advisor'
]);

class RepositoryBackedHouseholdMembershipWriteScope implements HouseholdMembershipWriteScope {
  readonly #authorization = new CentralAuthorizationService();

  public constructor(
    private readonly dependencies: RepositoryBackedHouseholdMembershipDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: HouseholdMembershipWriteScope['occurredAt']
  ) {}

  public authorizeAdministration(): ReturnType<HouseholdMembershipWriteScope['authorizeAdministration']> {
    const account = this.dependencies.accountRepository.findById(
      this.repositoryContext,
      this.repositoryContext.actor.userId
    );
    if (!account.ok) return account;
    if (!account.value || account.value.status !== 'active') return { ok: true, value: false };
    if (!authorizationRoles.has(account.value.role as AuthorizationRole)) return { ok: true, value: false };
    const decision = this.#authorization.authorize({
      accountId: account.value.id,
      role: account.value.role as AuthorizationRole,
      action: 'administer',
      resourceType: 'family_membership',
      resourceId: '*',
      occurredAt: this.repositoryContext.occurredAt,
      ...(account.value.personId ? { actorPersonId: account.value.personId } : {})
    });
    return { ok: true, value: decision.allowed };
  }

  public findPerson(personId: Parameters<HouseholdMembershipWriteScope['findPerson']>[0]): ReturnType<HouseholdMembershipWriteScope['findPerson']> {
    const result = this.dependencies.personRepository.findById(this.repositoryContext, personId);
    if (!result.ok || !result.value) return result;
    return { ok: true, value: { id: result.value.id, familyId: result.value.familyId } };
  }

  public findHousehold(householdId: Parameters<HouseholdMembershipWriteScope['findHousehold']>[0]): ReturnType<HouseholdMembershipWriteScope['findHousehold']> {
    return this.dependencies.householdMembershipRepository.findHousehold(this.repositoryContext, householdId);
  }

  public findBranch(branchId: Parameters<HouseholdMembershipWriteScope['findBranch']>[0]): ReturnType<HouseholdMembershipWriteScope['findBranch']> {
    return this.dependencies.householdMembershipRepository.findBranch(this.repositoryContext, branchId);
  }

  public findMembership(membershipId: Parameters<HouseholdMembershipWriteScope['findMembership']>[0]): ReturnType<HouseholdMembershipWriteScope['findMembership']> {
    return this.dependencies.householdMembershipRepository.findMembership(this.repositoryContext, membershipId);
  }

  public listHouseholds(familyId: Parameters<HouseholdMembershipWriteScope['listHouseholds']>[0]): ReturnType<HouseholdMembershipWriteScope['listHouseholds']> {
    return this.dependencies.householdMembershipRepository.listHouseholds(this.repositoryContext, familyId);
  }

  public listBranches(familyId: Parameters<HouseholdMembershipWriteScope['listBranches']>[0]): ReturnType<HouseholdMembershipWriteScope['listBranches']> {
    return this.dependencies.householdMembershipRepository.listBranches(this.repositoryContext, familyId);
  }

  public listMembershipsByPerson(personId: Parameters<HouseholdMembershipWriteScope['listMembershipsByPerson']>[0]): ReturnType<HouseholdMembershipWriteScope['listMembershipsByPerson']> {
    return this.dependencies.householdMembershipRepository.listMembershipsByPerson(this.repositoryContext, personId);
  }

  public listMembershipsByFamily(familyId: Parameters<HouseholdMembershipWriteScope['listMembershipsByFamily']>[0]): ReturnType<HouseholdMembershipWriteScope['listMembershipsByFamily']> {
    return this.dependencies.householdMembershipRepository.listMembershipsByFamily(this.repositoryContext, familyId);
  }

  public hasOverlappingMembership(input: Parameters<HouseholdMembershipWriteScope['hasOverlappingMembership']>[0]): ReturnType<HouseholdMembershipWriteScope['hasOverlappingMembership']> {
    return this.dependencies.householdMembershipRepository.hasOverlappingMembership(this.repositoryContext, input);
  }

  public insertHousehold(household: Parameters<HouseholdMembershipWriteScope['insertHousehold']>[0]): ReturnType<HouseholdMembershipWriteScope['insertHousehold']> {
    return this.dependencies.householdMembershipRepository.insertHousehold(this.repositoryContext, household);
  }

  public insertBranch(branch: Parameters<HouseholdMembershipWriteScope['insertBranch']>[0]): ReturnType<HouseholdMembershipWriteScope['insertBranch']> {
    return this.dependencies.householdMembershipRepository.insertBranch(this.repositoryContext, branch);
  }

  public insertMembership(membership: Parameters<HouseholdMembershipWriteScope['insertMembership']>[0]): ReturnType<HouseholdMembershipWriteScope['insertMembership']> {
    return this.dependencies.householdMembershipRepository.insertMembership(this.repositoryContext, membership);
  }

  public updateMembershipStatus(input: Parameters<HouseholdMembershipWriteScope['updateMembershipStatus']>[0]): ReturnType<HouseholdMembershipWriteScope['updateMembershipStatus']> {
    return this.dependencies.householdMembershipRepository.updateMembershipStatus(this.repositoryContext, input);
  }

  public appendAudit(input: Parameters<HouseholdMembershipWriteScope['appendAudit']>[0]): ReturnType<HouseholdMembershipWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repositoryContext, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repositoryContext, event);
  }
}

export class RepositoryBackedHouseholdMembershipUnitOfWork implements HouseholdMembershipUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedHouseholdMembershipDependencies) {}

  public execute<TValue>(
    context: HouseholdMembershipApplicationContext,
    operation: (scope: HouseholdMembershipWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: context.actor,
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      return operation(new RepositoryBackedHouseholdMembershipWriteScope(
        this.dependencies,
        repositoryContext,
        transaction.occurredAt
      ));
    });
  }
}
