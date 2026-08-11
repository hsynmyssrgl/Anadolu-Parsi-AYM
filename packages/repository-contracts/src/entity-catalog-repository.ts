import type { FamilyId, PersonId } from '@ppt/core';
import type { RepositoryExecutionContext, RepositoryResult } from './repository-context.js';

export interface PersonCatalogCursor {
  readonly displayName: string;
  readonly id: string;
}

export interface EventCatalogCursor {
  readonly startAt: string;
  readonly id: string;
}

export interface PersonCatalogRow {
  readonly id: PersonId;
  readonly familyId: FamilyId;
  readonly displayName: string;
  readonly birthDate?: string;
  readonly relationshipType: string;
  readonly generation: number;
  readonly branch: string;
  readonly status: 'active' | 'inactive' | 'deceased';
}

export interface EventCatalogRow {
  readonly id: string;
  readonly familyId: FamilyId;
  readonly title: string;
  readonly kind: string;
  readonly startAt: string;
  readonly archivedAt?: string;
}

export interface EntityCatalogRepositoryPort {
  listPeoplePage(context: RepositoryExecutionContext, input: {
    readonly familyId: FamilyId;
    readonly limit: number;
    readonly query: string;
    readonly cursor?: PersonCatalogCursor;
  }): RepositoryResult<readonly PersonCatalogRow[]>;

  listEventsPage(context: RepositoryExecutionContext, input: {
    readonly familyId: FamilyId;
    readonly limit: number;
    readonly query: string;
    readonly personId?: PersonId;
    readonly kind: string;
    readonly archiveMode: 'active' | 'archived' | 'all';
    readonly cursor?: EventCatalogCursor;
  }): RepositoryResult<readonly EventCatalogRow[]>;

  findPeopleByIds(context: RepositoryExecutionContext, familyId: FamilyId, personIds: readonly PersonId[]): RepositoryResult<readonly PersonCatalogRow[]>;
  findEventsByIds(context: RepositoryExecutionContext, familyId: FamilyId, eventIds: readonly string[]): RepositoryResult<readonly EventCatalogRow[]>;
}
