import type { FamilyId, IsoDate, IsoDateTime, PersonId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface PersonRecord {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly birthDate?: IsoDate;
  readonly relationshipType: string;
  readonly generation: number;
  readonly branch: string;
  readonly status: 'active' | 'inactive' | 'deceased';
  readonly createdAt: IsoDateTime;
}

export interface PersonRepositoryPort {
    insert(context: RepositoryExecutionContext, person: PersonRecord): RepositoryResult<void>;
    findById(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<PersonRecord | null>;
    listByFamily(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<readonly PersonRecord[]>;
}
