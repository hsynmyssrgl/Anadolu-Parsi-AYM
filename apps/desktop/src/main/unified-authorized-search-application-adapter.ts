import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type IsoDateTime,
  type Result
} from '@ppt/core';
import type {
  ArchiveItemView,
  FamilySnapshotPatchView,
  FinanceRecordView,
  HealthRecordView,
  LifeRecordView,
  UnifiedAuthorizedSearchModule
} from '@ppt/domain';
import type {
  UnifiedAuthorizedSearchApplicationContext,
  UnifiedAuthorizedSearchCandidate,
  UnifiedAuthorizedSearchSourcePort
} from '@ppt/application';

export interface RepositoryBackedUnifiedAuthorizedSearchDependencies {
  readonly loadFamilyAndEvents: () => Promise<FamilySnapshotPatchView>;
  readonly listArchive: () => Promise<readonly ArchiveItemView[]>;
  readonly listFinance: () => Promise<readonly FinanceRecordView[]>;
  readonly listHealth: () => Promise<readonly HealthRecordView[]>;
  readonly listLife: () => Promise<readonly LifeRecordView[]>;
  readonly now: () => IsoDateTime;
}

const occurredAt = (value: string | undefined): IsoDateTime | undefined =>
  value !== undefined && Number.isFinite(Date.parse(value)) ? asIsoDateTime(value) : undefined;
const occurredAtField = (value: string | undefined): { readonly occurredAt: IsoDateTime } | Record<never, never> => {
  const parsed = occurredAt(value);
  return parsed === undefined ? {} : { occurredAt: parsed };
};

const familyCandidates = async (
  dependencies: RepositoryBackedUnifiedAuthorizedSearchDependencies,
  modules: ReadonlySet<UnifiedAuthorizedSearchModule>
): Promise<readonly UnifiedAuthorizedSearchCandidate[]> => {
  if (!modules.has('family') && !modules.has('event')) return [];
  const snapshot = await dependencies.loadFamilyAndEvents();
  return [
    ...(modules.has('family') ? (snapshot.people ?? []).map((person): UnifiedAuthorizedSearchCandidate => ({
      module: 'family',
      resourceType: 'person',
      resourceId: person.id,
      title: person.displayName,
      searchableText: [person.displayName, person.relationshipType, person.branch]
    })) : []),
    ...(modules.has('event') ? (snapshot.events ?? []).map((event): UnifiedAuthorizedSearchCandidate => ({
      module: 'event',
      resourceType: 'event',
      resourceId: event.id,
      title: event.title,
      searchableText: [event.title, event.kind, event.description ?? '', event.locationLabel ?? ''],
      ...occurredAtField(event.startAt)
    })) : [])
  ];
};

export class RepositoryBackedUnifiedAuthorizedSearchSourcePort implements UnifiedAuthorizedSearchSourcePort {
  public constructor(private readonly dependencies: RepositoryBackedUnifiedAuthorizedSearchDependencies) {}

  public now(): IsoDateTime {
    return this.dependencies.now();
  }

  public async loadAuthorizedCandidates(
    context: UnifiedAuthorizedSearchApplicationContext,
    selectedModules: readonly UnifiedAuthorizedSearchModule[]
  ): Promise<Result<readonly UnifiedAuthorizedSearchCandidate[], AppError>> {
    const modules = new Set(selectedModules);
    try {
      const [familyAndEvents, archive, finance, health, life] = await Promise.all([
        familyCandidates(this.dependencies, modules),
        modules.has('archive') ? this.dependencies.listArchive() : Promise.resolve([]),
        modules.has('finance') ? this.dependencies.listFinance() : Promise.resolve([]),
        modules.has('health') ? this.dependencies.listHealth() : Promise.resolve([]),
        modules.has('life') ? this.dependencies.listLife() : Promise.resolve([])
      ]);
      return ok(Object.freeze([
        ...familyAndEvents,
        ...archive.map((item): UnifiedAuthorizedSearchCandidate => ({
          module: 'archive',
          resourceType: 'archive_item',
          resourceId: item.id,
          title: item.title,
          searchableText: [item.title, item.originalName, item.mimeType],
          ...occurredAtField(item.createdAt)
        })),
        ...finance.map((item): UnifiedAuthorizedSearchCandidate => ({
          module: 'finance',
          resourceType: 'finance_record',
          resourceId: item.id,
          title: item.title,
          searchableText: [item.title, item.kind, item.currency],
          ...occurredAtField(item.occurredAt)
        })),
        ...health.map((item): UnifiedAuthorizedSearchCandidate => ({
          module: 'health',
          resourceType: 'health_record',
          resourceId: item.id,
          title: item.title,
          searchableText: [item.title, item.kind, item.provider ?? ''],
          ...occurredAtField(item.occurredAt)
        })),
        ...life.map((item): UnifiedAuthorizedSearchCandidate => ({
          module: 'life',
          resourceType: 'life_record',
          resourceId: item.id,
          title: item.title,
          searchableText: [item.title, item.category, item.status, item.provider ?? ''],
          ...occurredAtField(item.dueAt ?? item.startsAt ?? item.createdAt)
        }))
      ]));
    } catch {
      return err(createAppError({
        code: ERROR_CODES.AUTHORIZATION_DENIED,
        message: 'Birleşik aramanın yetkili kaynaklarından biri yüklenemedi; kısmi sonuç üretilmedi.',
        category: 'authorization',
        correlationId: context.correlationId
      }));
    }
  }
}
