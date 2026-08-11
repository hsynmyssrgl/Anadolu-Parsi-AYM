import { asUserId } from '@ppt/core';
import type {
  GenealogyPersonRecord,
  GenealogyReadModelContext,
  GenealogyReadModelQueryPort,
  GenealogyRelationRecord,
  GenealogyTimelineEventRecord
} from '@ppt/application';
import type { TransactionExecutor } from '@ppt/repository-contracts';
import type {
  GenealogyRepositoryPort,
  PersonRepositoryPort,
  RelationRepositoryPort,
  RepositoryExecutionContext
} from '@ppt/repository-contracts';

export interface RepositoryBackedGenealogyApplicationDependencies {
  readonly transactionExecutor: TransactionExecutor;
  readonly personRepository: PersonRepositoryPort;
  readonly relationRepository: RelationRepositoryPort;
  readonly genealogyRepository: GenealogyRepositoryPort;
}

export class RepositoryBackedGenealogyReadModelQueryPort implements GenealogyReadModelQueryPort {
  public constructor(private readonly dependencies: RepositoryBackedGenealogyApplicationDependencies) {}

  public load(context: GenealogyReadModelContext): ReturnType<GenealogyReadModelQueryPort['load']> {
    return this.dependencies.transactionExecutor.execute(context.correlationId, (transaction) => {
      const repositoryContext: RepositoryExecutionContext = {
        transaction: transaction.transaction,
        actor: { userId: asUserId('genealogy-read-model'), roles: ['reader'] },
        correlationId: context.correlationId,
        occurredAt: transaction.occurredAt
      };
      const people = this.dependencies.personRepository.listByFamily(repositoryContext, context.familyId);
      if (!people.ok) return people;
      const relations = this.dependencies.relationRepository.listByFamily(repositoryContext, context.familyId);
      if (!relations.ok) return relations;
      const events = this.dependencies.genealogyRepository.listTimelineEvents(repositoryContext, context.familyId);
      if (!events.ok) return events;
      return {
        ok: true,
        value: {
          people: people.value.map((person) => ({
            id: person.id,
            familyId: person.familyId,
            displayName: person.displayName,
            ...(person.birthDate ? { birthDate: person.birthDate } : {}),
            generation: person.generation,
            branch: person.branch,
            status: person.status === 'active' ? 'active' : 'archived'
          })) as readonly GenealogyPersonRecord[],
          relations: relations.value as readonly GenealogyRelationRecord[],
          events: events.value as readonly GenealogyTimelineEventRecord[]
        }
      };
    });
  }
}
