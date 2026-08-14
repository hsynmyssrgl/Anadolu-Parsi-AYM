import type { IsoDateTime } from '@ppt/core';

export const UNIFIED_AUTHORIZED_SEARCH_MODULES = Object.freeze([
  'family',
  'event',
  'archive',
  'finance',
  'health',
  'life'
] as const);

export type UnifiedAuthorizedSearchModule = (typeof UNIFIED_AUTHORIZED_SEARCH_MODULES)[number];

export type UnifiedAuthorizedSearchResourceType =
  | 'person'
  | 'event'
  | 'archive_item'
  | 'finance_record'
  | 'health_record'
  | 'life_record';

export const UNIFIED_AUTHORIZED_SEARCH_MAX_QUERY_CHARACTERS = 80 as const;
export const UNIFIED_AUTHORIZED_SEARCH_MAX_QUERY_TOKENS = 8 as const;
export const UNIFIED_AUTHORIZED_SEARCH_MAX_RESULTS = 25 as const;
export const UNIFIED_AUTHORIZED_SEARCH_MAX_CANDIDATES = 5_000 as const;

export interface UnifiedAuthorizedSearchInput {
  readonly query: string;
  readonly limit?: number;
  readonly modules?: readonly UnifiedAuthorizedSearchModule[];
}

export interface UnifiedAuthorizedSearchItemView {
  readonly module: UnifiedAuthorizedSearchModule;
  readonly resourceType: UnifiedAuthorizedSearchResourceType;
  readonly resourceId: string;
  readonly title: string;
  readonly occurredAt?: IsoDateTime;
}

export interface UnifiedAuthorizedSearchView {
  readonly schemaVersion: 1;
  readonly items: readonly UnifiedAuthorizedSearchItemView[];
  readonly searchedModules: readonly UnifiedAuthorizedSearchModule[];
  readonly truncated: boolean;
  readonly policyFiltered: true;
  readonly complete: true;
  readonly queryEchoed: false;
  readonly generatedAt: IsoDateTime;
}

const SEARCH_CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}\p{Cs}]/u;

export const canonicalUnifiedAuthorizedSearchTokens = (
  value: unknown
): readonly string[] | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (normalized.length < 2 || normalized.length > UNIFIED_AUTHORIZED_SEARCH_MAX_QUERY_CHARACTERS) {
    return null;
  }
  if (SEARCH_CONTROL_OR_FORMAT.test(normalized)) return null;
  const tokens = normalized
    .toLocaleLowerCase('tr-TR')
    .split(' ')
    .filter(Boolean);
  if (tokens.length === 0 || tokens.length > UNIFIED_AUTHORIZED_SEARCH_MAX_QUERY_TOKENS) return null;
  if (tokens.some((token) => token.length > 40)) return null;
  return Object.freeze([...new Set(tokens)]);
};

export const unifiedAuthorizedSearchResourceTypeForModule = (
  module: UnifiedAuthorizedSearchModule
): UnifiedAuthorizedSearchResourceType => ({
  family: 'person',
  event: 'event',
  archive: 'archive_item',
  finance: 'finance_record',
  health: 'health_record',
  life: 'life_record'
} satisfies Record<UnifiedAuthorizedSearchModule, UnifiedAuthorizedSearchResourceType>)[module];
