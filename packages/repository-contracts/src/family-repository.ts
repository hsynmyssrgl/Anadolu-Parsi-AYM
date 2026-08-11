import type { FamilyId, IsoDateTime } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface FamilyRecord {
  readonly id: FamilyId;
  readonly name: string;
  readonly createdAt: IsoDateTime;
}

export interface FamilyRepositoryPort {
    findById(context: RepositoryExecutionContext, familyId: FamilyId): RepositoryResult<FamilyRecord | null>;
}
