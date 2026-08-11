
export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface Page<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const normalizePageRequest = (
  request: Partial<PageRequest>,
  options: { readonly defaultLimit?: number; readonly maximumLimit?: number } = {}
): PageRequest => {
  const defaultLimit = options.defaultLimit ?? 50;
  const maximumLimit = options.maximumLimit ?? 500;
  const limit = Number.isFinite(request.limit)
    ? Math.max(1, Math.min(Math.trunc(request.limit ?? defaultLimit), maximumLimit))
    : defaultLimit;
  const offset = Number.isFinite(request.offset)
    ? Math.max(0, Math.trunc(request.offset ?? 0))
    : 0;
  return { limit, offset };
};
