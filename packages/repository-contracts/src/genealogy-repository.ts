import type { FamilyId, PersonId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface GenealogyTimelineEventRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly date: string;
  readonly title: string;
  readonly participantPersonIds: readonly PersonId[];
}

export interface GenealogyRepositoryPort {
    listTimelineEvents(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly GenealogyTimelineEventRecord[]>;
}
