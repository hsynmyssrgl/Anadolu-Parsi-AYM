import type { AppError, Result } from '@ppt/core';
import type {
  FamilyApplicationContext,
  FamilyApplicationUnitOfWork,
  FamilyGraphQueryPort,
  FamilyPersonRecord,
  FamilyRecord,
  FamilyRelationRecord,
  FamilyWriteScope
} from '@ppt/application';
import type { DomainEvent } from '@ppt/events';
import type { TransactionExecutor } from '@ppt/repository-contracts';
import type {
  AuditRepositoryPort,
  FamilyRepositoryPort,
  OutboxRepositoryPort,
  PersonRepositoryPort,
  RelationRepositoryPort,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';

export interface RepositoryBackedFamilyApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly familyRepository: FamilyRepositoryPort;
  readonly personRepository: PersonRepositoryPort;
  readonly relationRepository: RelationRepositoryPort;
  readonly auditRepository: AuditRepositoryPort;
  readonly outboxRepository: OutboxRepositoryPort;
}

class RepositoryBackedFamilyWriteScope implements FamilyWriteScope {
  public constructor(
    private readonly dependencies: RepositoryBackedFamilyApplicationDependencies,
    private readonly repositoryContext: RepositoryExecutionContext,
    public readonly occurredAt: FamilyWriteScope['occurredAt']
  ) {}

  public findFamily(familyId: Parameters<FamilyWriteScope['findFamily']>[0]): ReturnType<FamilyWriteScope['findFamily']> {
    return this.dependencies.familyRepository.findById(this.repositoryContext, familyId);
  }

  public listPeople(familyId: Parameters<FamilyWriteScope['listPeople']>[0]): ReturnType<FamilyWriteScope['listPeople']> {
    const result = this.dependencies.personRepository.listByFamily(this.repositoryContext, familyId);
    if (!result.ok) return result;
    return {
      ok: true,
      value: result.value.map((person) => ({
        ...person,
        status: person.status === 'active' ? 'active' : 'archived'
      }))
    };
  }

  public listRelations(familyId: Parameters<FamilyWriteScope['listRelations']>[0]): ReturnType<FamilyWriteScope['listRelations']> {
    return this.dependencies.relationRepository.listByFamily(this.repositoryContext, familyId);
  }

  public findPerson(personId: Parameters<FamilyWriteScope['findPerson']>[0]): ReturnType<FamilyWriteScope['findPerson']> {
    const result = this.dependencies.personRepository.findById(this.repositoryContext, personId);
    if (!result.ok || !result.value) return result as ReturnType<FamilyWriteScope['findPerson']>;
    return {
      ok: true,
      value: {
        ...result.value,
        status: result.value.status === 'active' ? 'active' : 'archived'
      }
    };
  }

  public insertPerson(person: FamilyPersonRecord): ReturnType<FamilyWriteScope['insertPerson']> {
    return this.dependencies.personRepository.insert(this.repositoryContext, {
      ...person,
      status: person.status === 'active' ? 'active' : 'inactive'
    });
  }

  public relationExists(input: Parameters<FamilyWriteScope['relationExists']>[0]): ReturnType<FamilyWriteScope['relationExists']> {
    return this.dependencies.relationRepository.existsExact(this.repositoryContext, input);
  }

  public insertRelation(relation: FamilyRelationRecord): ReturnType<FamilyWriteScope['insertRelation']> {
    return this.dependencies.relationRepository.insert(this.repositoryContext, relation);
  }

  public appendAudit(input: Parameters<FamilyWriteScope['appendAudit']>[0]): ReturnType<FamilyWriteScope['appendAudit']> {
    return this.dependencies.auditRepository.append(this.repositoryContext, input);
  }

  public enqueueEvent<TPayload>(event: DomainEvent<TPayload>): Result<void, AppError> {
    return this.dependencies.outboxRepository.enqueue(this.repositoryContext, event);
  }
}

export class RepositoryBackedFamilyApplicationUnitOfWork implements FamilyApplicationUnitOfWork {
  public constructor(private readonly dependencies: RepositoryBackedFamilyApplicationDependencies) {}

  public execute<TValue>(
    context: FamilyApplicationContext,
    operation: (scope: FamilyWriteScope) => Result<TValue, AppError>
  ): Result<TValue, AppError> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: context.actor,
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      return operation(new RepositoryBackedFamilyWriteScope(
        this.dependencies,
        repositoryContext,
        transaction.occurredAt
      ));
    });
  }
}

export class RepositoryBackedFamilyGraphQueryPort implements FamilyGraphQueryPort {
  public constructor(private readonly dependencies: RepositoryBackedFamilyApplicationDependencies) {}

  public load(context: FamilyApplicationContext): ReturnType<FamilyGraphQueryPort['load']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: context.actor,
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      const family = this.dependencies.familyRepository.findById(repositoryContext, context.familyId);
      if (!family.ok) return family;
      const people = this.dependencies.personRepository.listByFamily(repositoryContext, context.familyId);
      if (!people.ok) return people;
      const relations = this.dependencies.relationRepository.listByFamily(repositoryContext, context.familyId);
      if (!relations.ok) return relations;
      return {
        ok: true,
        value: {
          family: family.value as FamilyRecord | null,
          people: people.value.map((person) => ({
            ...person,
            status: person.status === 'active' ? 'active' : 'archived'
          })) as readonly FamilyPersonRecord[],
          relations: relations.value as readonly FamilyRelationRecord[]
        }
      };
    });
  }
}
