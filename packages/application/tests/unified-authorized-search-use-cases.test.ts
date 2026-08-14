import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  createAppError,
  err,
  ok
} from '@ppt/core';
import {
  SearchUnifiedAuthorizedRecordsUseCase,
  type UnifiedAuthorizedSearchApplicationContext,
  type UnifiedAuthorizedSearchCandidate,
  type UnifiedAuthorizedSearchSourcePort
} from '../src/unified-authorized-search-use-cases.js';

const NOW = asIsoDateTime('2026-08-15T00:00:00.000Z');
const context: UnifiedAuthorizedSearchApplicationContext = Object.freeze({
  familyId: asFamilyId('family-33-r'),
  actor: {
    userId: asUserId('account-33-r'),
    role: 'family_admin',
    personId: asPersonId('person-33-r')
  },
  correlationId: asCorrelationId('unified-search-33-r')
});

const candidates: readonly UnifiedAuthorizedSearchCandidate[] = Object.freeze([
  {
    module: 'family',
    resourceType: 'person',
    resourceId: 'person-ayse',
    title: 'Ayşe Yılmaz',
    searchableText: ['Ayşe Yılmaz', 'anne', 'ana kol']
  },
  {
    module: 'event',
    resourceType: 'event',
    resourceId: 'event-checkup',
    title: 'Ayşe kontrol randevusu',
    searchableText: ['Ayşe kontrol randevusu', 'Hastane', 'önemli gün'],
    occurredAt: asIsoDateTime('2026-08-14T10:00:00.000Z')
  },
  {
    module: 'archive',
    resourceType: 'archive_item',
    resourceId: 'archive-report',
    title: 'Kontrol raporu',
    searchableText: ['Kontrol raporu', 'ayse-kontrol.pdf', 'application/pdf'],
    occurredAt: asIsoDateTime('2026-08-13T10:00:00.000Z')
  },
  {
    module: 'finance',
    resourceType: 'finance_record',
    resourceId: 'finance-private',
    title: 'Yetkili sağlık ödemesi',
    searchableText: ['Yetkili sağlık ödemesi', 'expense', 'TRY'],
    occurredAt: asIsoDateTime('2026-08-12T10:00:00.000Z')
  }
]);

const source = (
  value: readonly UnifiedAuthorizedSearchCandidate[] = candidates
): UnifiedAuthorizedSearchSourcePort => ({
  loadAuthorizedCandidates: async (_context, modules) => ok(value.filter((candidate) => modules.includes(candidate.module))),
  now: () => NOW
});

describe('SearchUnifiedAuthorizedRecordsUseCase', () => {
  it('returns only selected already-authorized sources and never echoes searchable material', async () => {
    const result = await new SearchUnifiedAuthorizedRecordsUseCase(source()).execute(context, {
      query: 'Ayşe kontrol',
      modules: ['event', 'archive'],
      limit: 10
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      schemaVersion: 1,
      searchedModules: ['event', 'archive'],
      policyFiltered: true,
      complete: true,
      queryEchoed: false,
      generatedAt: NOW
    });
    expect(result.value.items.map((item) => item.resourceId)).toEqual(['event-checkup']);
    expect(JSON.stringify(result.value)).not.toContain('Hastane');
    expect(Object.hasOwn(result.value, 'query')).toBe(false);
  });

  it('normalizes NFKC and ranks exact title matches before newer partial matches', async () => {
    const result = await new SearchUnifiedAuthorizedRecordsUseCase(source([
      {
        module: 'life', resourceType: 'life_record', resourceId: 'partial', title: 'Yeni okul sözleşmesi',
        searchableText: ['Yeni okul sözleşmesi'], occurredAt: asIsoDateTime('2026-08-15T00:00:00.000Z')
      },
      {
        module: 'archive', resourceType: 'archive_item', resourceId: 'exact', title: 'Okul',
        searchableText: ['Okul'], occurredAt: asIsoDateTime('2020-01-01T00:00:00.000Z')
      }
    ])).execute(context, { query: 'Ｏｋｕｌ' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items.map((item) => item.resourceId)).toEqual(['exact', 'partial']);
  });

  it('fails closed without partial output when one governed source reports an error', async () => {
    const failure = createAppError({
      code: ERROR_CODES.AUTHORIZATION_DENIED,
      message: 'Kaynak yetkisi reddedildi.',
      category: 'authorization',
      correlationId: context.correlationId
    });
    const result = await new SearchUnifiedAuthorizedRecordsUseCase({
      loadAuthorizedCandidates: async () => err(failure),
      now: () => NOW
    }).execute(context, { query: 'rapor' });

    expect(result).toEqual(err(failure));
  });

  it('rejects invalid query, duplicate modules and excessive limits before source access', async () => {
    let calls = 0;
    const useCase = new SearchUnifiedAuthorizedRecordsUseCase({
      loadAuthorizedCandidates: async () => { calls += 1; return ok([]); },
      now: () => NOW
    });
    const invalidQuery = await useCase.execute(context, { query: '\u0000x' });
    const duplicateModules = await useCase.execute(context, { query: 'arama', modules: ['archive', 'archive'] });
    const invalidLimit = await useCase.execute(context, { query: 'arama', limit: 26 });

    expect(invalidQuery.ok).toBe(false);
    expect(duplicateModules.ok).toBe(false);
    expect(invalidLimit.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it('rejects module/resource mismatches instead of silently skipping malformed candidates', async () => {
    const result = await new SearchUnifiedAuthorizedRecordsUseCase(source([{
      module: 'health',
      resourceType: 'finance_record',
      resourceId: 'forged',
      title: 'Sahte kayıt',
      searchableText: ['Sahte kayıt']
    }])).execute(context, { query: 'sahte' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(ERROR_CODES.CORE_INVALID_ARGUMENT);
  });

  it('reports truncation only after filtering authorized candidates', async () => {
    const many = Array.from({ length: 30 }, (_, index): UnifiedAuthorizedSearchCandidate => ({
      module: 'archive',
      resourceType: 'archive_item',
      resourceId: `archive-${index.toString().padStart(2, '0')}`,
      title: `Rapor ${index}`,
      searchableText: [`Rapor ${index}`]
    }));
    const result = await new SearchUnifiedAuthorizedRecordsUseCase(source(many)).execute(context, {
      query: 'rapor',
      limit: 5
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(5);
      expect(result.value.truncated).toBe(true);
    }
  });
});
