import type { FamilyId, PersonId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export type RelationType = 'parent' | 'spouse' | 'child' | 'sibling' | 'guardian' | 'other';

export interface RelationRecord {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly fromPersonId: PersonId;
  readonly toPersonId: PersonId;
  readonly relationType: RelationType;
}

export interface RelationRepositoryPort {
    insert(context: RepositoryExecutionContext, relation: RelationRecord): RepositoryResult<void>;
    listByFamily(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly RelationRecord[]>;
    existsExact(context: RepositoryExecutionContext, input: {
        readonly familyId: FamilyId;
        readonly fromPersonId: PersonId;
        readonly toPersonId: PersonId;
        readonly relationType: RelationType;
    }): RepositoryResult<boolean>;
}
