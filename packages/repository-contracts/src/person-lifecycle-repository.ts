import type { FamilyId, IsoDate, IsoDateTime, PersonId } from '@ppt/core';
import type {
  PersonLifecycleOperation,
  PersonLifecycleProfile,
  PersonReferenceSummary
} from '@ppt/domain';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface PersonLifecycleRepositoryPort {
  findProfile(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<PersonLifecycleProfile | null>;
  findPotentialDuplicate(context: RepositoryExecutionContext, input: {
    readonly familyId: FamilyId;
    readonly displayName: string;
    readonly birthDate?: IsoDate;
    readonly excludePersonId: PersonId;
  }): RepositoryResult<PersonLifecycleProfile | null>;
  inspectReferences(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<PersonReferenceSummary>;
  updateProfile(context: RepositoryExecutionContext, input: {
    readonly profile: PersonLifecycleProfile;
    readonly expectedVersion: number;
  }): RepositoryResult<boolean>;
  insertOperation(context: RepositoryExecutionContext, operation: PersonLifecycleOperation): RepositoryResult<void>;
  findOperation(context: RepositoryExecutionContext, operationId: string): RepositoryResult<PersonLifecycleOperation | null>;
  listOperationsByPerson(context: RepositoryExecutionContext, personId: PersonId): RepositoryResult<readonly PersonLifecycleOperation[]>;
  markOperationUndone(context: RepositoryExecutionContext, input: {
    readonly operationId: string;
    readonly undoneAt: IsoDateTime;
  }): RepositoryResult<boolean>;
}
