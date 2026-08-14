import { createHash, timingSafeEqual } from 'node:crypto';

export type OidcDeepLinkProvider = 'apple' | 'google' | 'microsoft';

export interface OidcExpectedDeepLinkBinding {
  readonly flowId: string;
  readonly provider: OidcDeepLinkProvider;
  readonly accountId: string;
  readonly stateSha256: string;
  readonly redirectUri: string;
  readonly expiresAt: string;
}

export interface OidcCapturedDeepLink {
  readonly flowId: string;
  readonly provider: OidcDeepLinkProvider;
  readonly accountId: string;
  readonly callbackUrl: string;
  readonly capturedAt: string;
}

interface PendingDeepLink extends OidcExpectedDeepLinkBinding {
  readonly callbackUrl?: string;
  readonly capturedAt?: string;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/u;
const ALLOWED_CALLBACK_KEYS = new Set(['code', 'state', 'iss', 'session_state', 'error', 'error_description']);
const MAX_CALLBACK_BYTES = 8_192;
const MAX_PENDING_FLOWS = 16;
const MAX_FLOW_TTL_MS = 10 * 60 * 1_000;

export class OidcDeepLinkRegistryError extends Error {
  public constructor(message: string, public readonly code: 'OIDC_DEEP_LINK_INVALID' | 'OIDC_CALLBACK_NOT_CAPTURED' = 'OIDC_DEEP_LINK_INVALID') {
    super(message);
    this.name = 'OidcDeepLinkRegistryError';
  }
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const exactSha256 = (left: string, right: string): boolean => {
  if (!SHA256.test(left) || !SHA256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
};
const canonicalRedirectBase = (value: string): string => {
  let url: URL;
  try { url = new URL(value); } catch { throw new OidcDeepLinkRegistryError('OIDC redirect URI gecersiz.'); }
  const path = url.pathname === '' ? '/' : url.pathname;
  if (url.protocol !== 'pardus-app:' || url.hostname !== 'oidc' || url.username || url.password || url.port || url.hash
    || url.search || !['/', '/callback'].includes(path)) {
    throw new OidcDeepLinkRegistryError('OIDC deep-link redirect URI exact pardus-app://oidc veya /callback olmali.');
  }
  return `pardus-app://oidc${path}`;
};
const parseCallback = (value: string, expectedRedirectUri: string): { readonly stateSha256: string; readonly callbackUrl: string } => {
  if (typeof value !== 'string' || value !== value.trim() || Buffer.byteLength(value, 'utf8') > MAX_CALLBACK_BYTES) {
    throw new OidcDeepLinkRegistryError('OIDC callback boyutu veya bicimi gecersiz.');
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new OidcDeepLinkRegistryError('OIDC callback URL gecersiz.'); }
  const callbackBase = `${url.protocol}//${url.host}${url.pathname === '' ? '/' : url.pathname}`;
  if (callbackBase !== canonicalRedirectBase(expectedRedirectUri)
    || url.username || url.password || url.port || url.hash) {
    throw new OidcDeepLinkRegistryError('OIDC callback redirect binding ile eslesmedi.');
  }
  const seen = new Set<string>();
  for (const [key] of url.searchParams) {
    if (!ALLOWED_CALLBACK_KEYS.has(key) || seen.has(key)) {
      throw new OidcDeepLinkRegistryError('OIDC callback bilinmeyen veya yinelenen parametre iceriyor.');
    }
    seen.add(key);
  }
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!state || state.length < 16 || state.length > 256 || /[\u0000-\u0020\u007f]/u.test(state)
    || (code === null) === (error === null)
    || (code !== null && (code.length < 8 || code.length > 4_096 || /[\u0000-\u0020\u007f]/u.test(code)))
    || (error !== null && (error.length < 1 || error.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(error)))) {
    throw new OidcDeepLinkRegistryError('OIDC callback code, error veya state bicimi gecersiz.');
  }
  return Object.freeze({ stateSha256: sha256(state), callbackUrl: url.toString() });
};

/**
 * Main-process-only, bounded, one-time OIDC deep-link registry. Callback code
 * and state never cross the preload/renderer boundary.
 */
export class MainOnlyOidcDeepLinkCallbackRegistry {
  readonly #pending = new Map<string, PendingDeepLink>();

  public constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  public register(binding: OidcExpectedDeepLinkBinding): void {
    const now = this.#now();
    this.#purge(now);
    const expiresAt = Date.parse(binding.expiresAt);
    if (!IDENTIFIER.test(binding.flowId) || !IDENTIFIER.test(binding.accountId)
      || !['apple', 'google', 'microsoft'].includes(binding.provider) || !SHA256.test(binding.stateSha256)
      || !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt - now > MAX_FLOW_TTL_MS) {
      throw new OidcDeepLinkRegistryError('OIDC expected deep-link binding gecersiz.');
    }
    const redirectUri = canonicalRedirectBase(binding.redirectUri);
    const duplicateState = [...this.#pending.values()].some((entry) => exactSha256(entry.stateSha256, binding.stateSha256)
      && entry.flowId !== binding.flowId);
    const existing = this.#pending.get(binding.flowId);
    if (duplicateState || (existing && (existing.provider !== binding.provider || existing.accountId !== binding.accountId
      || !exactSha256(existing.stateSha256, binding.stateSha256) || existing.redirectUri !== redirectUri))) {
      throw new OidcDeepLinkRegistryError('OIDC flow veya state baska bir binding ile kayitli.');
    }
    if (!existing && this.#pending.size >= MAX_PENDING_FLOWS) {
      throw new OidcDeepLinkRegistryError('OIDC pending deep-link kotasi asildi.');
    }
    this.#pending.set(binding.flowId, Object.freeze({ ...binding, redirectUri, ...(existing?.callbackUrl
      ? { callbackUrl: existing.callbackUrl, capturedAt: existing.capturedAt } : {}) }));
  }

  public captureFromArguments(argumentsList: readonly string[]): boolean {
    const now = this.#now();
    this.#purge(now);
    if (!Array.isArray(argumentsList) || argumentsList.length > 64) {
      throw new OidcDeepLinkRegistryError('OIDC process argument listesi gecersiz.');
    }
    const candidates = argumentsList.filter((value) => typeof value === 'string' && value.toLowerCase().startsWith('pardus-app://'));
    if (candidates.length === 0) return false;
    if (candidates.length !== 1) throw new OidcDeepLinkRegistryError('Bir process tesliminde yalniz bir OIDC callback kabul edilir.');
    let match: PendingDeepLink | undefined;
    let parsed: ReturnType<typeof parseCallback> | undefined;
    for (const entry of this.#pending.values()) {
      try {
        const candidate = parseCallback(candidates[0]!, entry.redirectUri);
        if (exactSha256(candidate.stateSha256, entry.stateSha256)) {
          if (match) throw new OidcDeepLinkRegistryError('OIDC callback birden fazla flow ile eslesti.');
          match = entry;
          parsed = candidate;
        }
      } catch (error) {
        if (error instanceof OidcDeepLinkRegistryError && error.message.includes('birden fazla flow')) throw error;
      }
    }
    if (!match || !parsed) throw new OidcDeepLinkRegistryError('OIDC callback aktif ve exact state-bound bir flow ile eslesmedi.');
    if (match.callbackUrl) throw new OidcDeepLinkRegistryError('OIDC callback daha once yakalandi.');
    this.#pending.set(match.flowId, Object.freeze({ ...match, callbackUrl: parsed.callbackUrl, capturedAt: new Date(now).toISOString() }));
    return true;
  }

  public take(input: { readonly flowId: string; readonly provider: OidcDeepLinkProvider; readonly accountId: string }): OidcCapturedDeepLink {
    const now = this.#now();
    this.#purge(now);
    const entry = this.#pending.get(input.flowId);
    if (!entry || entry.provider !== input.provider || entry.accountId !== input.accountId || !entry.callbackUrl || !entry.capturedAt) {
      throw new OidcDeepLinkRegistryError('[OIDC_CALLBACK_NOT_CAPTURED] OIDC callback henuz yakalanmadi veya flow binding eslesmedi.', 'OIDC_CALLBACK_NOT_CAPTURED');
    }
    this.#pending.delete(input.flowId);
    return Object.freeze({ flowId: entry.flowId, provider: entry.provider, accountId: entry.accountId,
      callbackUrl: entry.callbackUrl, capturedAt: entry.capturedAt });
  }

  public discard(flowId: string): void { this.#pending.delete(flowId); }

  public clear(): void { this.#pending.clear(); }

  public get size(): number { this.#purge(this.#now()); return this.#pending.size; }

  #now(): number {
    const value = Date.parse(this.clock());
    if (!Number.isFinite(value)) throw new OidcDeepLinkRegistryError('OIDC deep-link clock gecersiz.');
    return value;
  }

  #purge(now: number): void {
    for (const [flowId, entry] of this.#pending) if (Date.parse(entry.expiresAt) <= now) this.#pending.delete(flowId);
  }
}
