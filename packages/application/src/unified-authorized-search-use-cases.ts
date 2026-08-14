import {
  ERROR_CODES,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  UNIFIED_AUTHORIZED_SEARCH_MAX_CANDIDATES,
  UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS,
  UNIFIED_AUTHORIZED_SEARCH_MODULES,
  canonicalUnifiedAuthorizedSearchTokens,
  unifiedAuthorizedSearchResourceTypeForModule,
  type FamilyRole,
  type UnifiedAuthorizedSearchInput,
  type UnifiedAuthorizedSearchModule,
  type UnifiedAuthorizedSearchResourceType,
  type UnifiedAuthorizedSearchView
} from '@ppt/domain';

export interface UnifiedAuthorizedSearchApplicationContext {
  readonly familyId: FamilyId;
  readonly actor: {
    readonly userId: UserId;
    readonly role: FamilyRole;
    readonly personId?: PersonId;
  };
  readonly correlationId: CorrelationId;
}

/**
 * Adapter-only searchable material. Every candidate must already have passed the
 * source module's current central read policy. `searchableText` never crosses IPC.
 */
export interface UnifiedAuthorizedSearchCandidate {
  readonly module: UnifiedAuthorizedSearchModule;
  readonly resourceType: UnifiedAuthorizedSearchResourceType;
  readonly resourceId: string;
  readonly title: string;
  readonly searchableText: readonly string[];
  readonly occurredAt?: IsoDateTime;
}

export interface UnifiedAuthorizedSearchSourcePort {
  loadAuthorizedCandidates(
    context: UnifiedAuthorizedSearchApplicationContext,
    modules: readonly UnifiedAuthorizedSearchModule[]
  ): Promise<Result<readonly UnifiedAuthorizedSearchCandidate[], AppError>>;
  now(): IsoDateTime;
}

const invalid = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category: 'validation',
  correlationId
});

const canonicalModules = (
  modules: UnifiedAuthorizedSearchInput['modules']
): readonly UnifiedAuthorizedSearchModule[] | null => {
  if (modules === undefined) return UNIFIED_AUTHORIZED_SEARCH_MODULES;
  if (!Array.isArray(modules) || modules.length === 0 || modules.length > UNIFIED_AUTHORIZED_SEARCH_MODULES.length) {
    return null;
  }
  const allowed = new Set<unknown>(UNIFIED_AUTHORIZED_SEARCH_MODULES);
  if (modules.some((module) => !allowed.has(module))) return null;
  const unique = [...new Set(modules)];
  return unique.length === modules.length ? Object.freeze(unique) : null;
};

const safeCandidate = (candidate: UnifiedAuthorizedSearchCandidate): boolean => {
  if (candidate.resourceType !== unifiedAuthorizedSearchResourceTypeForModule(candidate.module)) return false;
  if (candidate.resourceId !== candidate.resourceId.trim() || candidate.resourceId.length < 1 || candidate.resourceId.length > 160) return false;
  if (candidate.title !== candidate.title.trim() || candidate.title.length < 1 || candidate.title.length > 240) return false;
  if (!Array.isArray(candidate.searchableText) || candidate.searchableText.length < 1 || candidate.searchableText.length > 12) return false;
  if (candidate.searchableText.some((value) => typeof value !== 'string' || value.length > 1_000)) return false;
  return candidate.occurredAt === undefined || Number.isFinite(Date.parse(candidate.occurredAt));
};

const normalize = (value: string): string => value.normalize('NFKC').toLocaleLowerCase('tr-TR');

export class SearchUnifiedAuthorizedRecordsUseCase {
  public constructor(private readonly source: UnifiedAuthorizedSearchSourcePort) {}

  public async execute(
    context: UnifiedAuthorizedSearchApplicationContext,
    input: UnifiedAuthorizedSearchInput
  ): Promise<Result<UnifiedAuthorizedSearchView, AppError>> {
    const tokens = canonicalUnifiedAuthorizedSearchTokens(input.query);
    if (!tokens) return err(invalid(context.correlationId, 'Birleşik arama sorgusu geçersizdir.'));
    const modules = canonicalModules(input.modules);
    if (!modules) return err(invalid(context.correlationId, 'Birleşik arama modül seçimi geçersizdir.'));
    const limit = input.limit ?? UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS) {
      return err(invalid(context.correlationId, 'Birleşik arama sonuç sınırı geçersizdir.'));
    }

    let loaded: Result<readonly UnifiedAuthorizedSearchCandidate[], AppError>;
    try {
      loaded = await this.source.loadAuthorizedCandidates(context, modules);
    } catch {
      return err(createAppError({
        code: ERROR_CODES.CORE_UNEXPECTED,
        message: 'Birleşik arama yetkili kaynakları tamamen yüklenemedi.',
        category: 'unexpected',
        correlationId: context.correlationId
      }));
    }
    if (!loaded.ok) return loaded;
    if (loaded.value.length > UNIFIED_AUTHORIZED_SEARCH_MAX_CANDIDATES) {
      return err(invalid(context.correlationId, 'Birleşik arama aday sınırı aşıldı; kısmi sonuç üretilmedi.'));
    }
    if (loaded.value.some((candidate) => !modules.includes(candidate.module) || !safeCandidate(candidate))) {
      return err(invalid(context.correlationId, 'Birleşik arama kaynağı güvenli sözleşmeyle uyuşmuyor.'));
    }

    const ranked = loaded.value.flatMap((candidate) => {
      const title = normalize(candidate.title);
      const fields = candidate.searchableText.map(normalize);
      const combined = fields.join('\n');
      if (!tokens.every((token) => combined.includes(token))) return [];
      const titleMatches = tokens.filter((token) => title.includes(token)).length;
      const exactTitle = title === tokens.join(' ');
      return [{ candidate, score: (exactTitle ? 1_000 : 0) + titleMatches * 100 }];
    }).sort((left, right) => (
      right.score - left.score
      || (right.candidate.occurredAt ?? '').localeCompare(left.candidate.occurredAt ?? '')
      || left.candidate.title.localeCompare(right.candidate.title, 'tr-TR')
      || left.candidate.resourceId.localeCompare(right.candidate.resourceId)
    ));

    const items = ranked.slice(0, limit).map(({ candidate }) => ({
      module: candidate.module,
      resourceType: candidate.resourceType,
      resourceId: candidate.resourceId,
      title: candidate.title,
      ...(candidate.occurredAt ? { occurredAt: candidate.occurredAt } : {})
    }));
    return ok(Object.freeze({
      schemaVersion: 1 as const,
      items: Object.freeze(items),
      searchedModules: Object.freeze([...modules]),
      truncated: ranked.length > limit,
      policyFiltered: true as const,
      complete: true as const,
      queryEchoed: false as const,
      generatedAt: this.source.now()
    }));
  }
}
