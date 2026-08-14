import { createHash, X509Certificate, type JsonWebKey } from 'node:crypto';
import { lookup as systemLookup } from 'node:dns/promises';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { NetworkEgressPin, NetworkEgressPurpose } from '@ppt/platform-policy';
import { NetworkEgressPolicy } from '@ppt/platform-policy';
import { validateOidcProviderConfiguration, type OidcProviderConfiguration } from '@ppt/security';
import type {
  OidcAuthorizationCodeExchangeClient,
  OidcAuthorizationCodeExchangeInput,
  OidcAuthorizationCodeExchangeResponse,
  TrustedOidcJwksResolver,
  TrustedOidcJwksResolverInput,
  TrustedOidcProviderRegistration
} from './oidc-federated-identity-adapter.js';
import {
  oidcClientConfigurationSha256,
  type OidcClientAuthenticationMode
} from './oidc-provider-configuration-fingerprint.js';

const DEFAULT_TIMEOUT_MS = 8_000;
const MINIMUM_TIMEOUT_MS = 1_000;
const MAXIMUM_TIMEOUT_MS = 15_000;
const MAX_TOKEN_REQUEST_BYTES = 32 * 1_024;
const MAX_TOKEN_RESPONSE_BYTES = 64 * 1_024;
const MAX_JWKS_RESPONSE_BYTES = 256 * 1_024;
const SHA256 = /^[0-9a-f]{64}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

const RESERVED_NETWORKS = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) RESERVED_NETWORKS.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001::', 32],
  ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]
] as const) RESERVED_NETWORKS.addSubnet(network, prefix, 'ipv6');

export interface TrustedOidcNetworkRegistration {
  readonly configurationId: string;
  readonly configuration: OidcProviderConfiguration;
  readonly clientAuthenticationMode: Extract<OidcClientAuthenticationMode, 'public_pkce'>;
  readonly tokenEndpointPins: readonly NetworkEgressPin[];
  readonly jwksEndpointPins: readonly NetworkEgressPin[];
}

export interface OidcPinnedHttpsRequest {
  readonly endpointId: string;
  readonly sourceUrl: string;
  readonly method: 'GET' | 'POST';
  readonly purpose: Extract<NetworkEgressPurpose, 'oidc.token.exchange' | 'oidc.jwks.fetch'>;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Buffer;
  readonly maximumResponseBytes: number;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface OidcPinnedHttpsResponse {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: Buffer;
  readonly tlsAuthorized: boolean;
  readonly tlsProtocol: string | null;
  readonly resolvedRemoteAddress: string;
  readonly connectedRemoteAddress: string;
  readonly peerSpkiSha256: string;
}

export interface OidcPinnedHttpsTransport {
  execute(input: OidcPinnedHttpsRequest): Promise<OidcPinnedHttpsResponse>;
}

export interface OidcDnsAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export type OidcDnsLookup = (hostname: string) => Promise<readonly OidcDnsAddress[]>;
export interface OidcHttpsIncomingMessage {
  readonly socket: {
    readonly authorized?: boolean;
    readonly remoteAddress?: string;
    getProtocol(): string | null;
    getPeerCertificate(detailed: boolean): { readonly raw?: Buffer };
  };
  readonly statusCode?: number;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly complete: boolean;
  on(event: 'data', listener: (chunk: Buffer) => void): this;
  on(event: 'end' | 'aborted' | 'close', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  destroy(error?: Error): void;
}
export interface OidcHttpsClientRequest {
  on(event: 'timeout', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  destroy(error?: Error): void;
  end(body?: Buffer): void;
}
export type OidcHttpsRequestFactory = (
  options: RequestOptions,
  onResponse: (response: OidcHttpsIncomingMessage) => void
) => OidcHttpsClientRequest;

export class SecureOidcNetworkError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SecureOidcNetworkError';
  }
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean => {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
};
const validIdentifier = (value: unknown, maximum = 160): value is string => typeof value === 'string'
  && value === value.trim() && value.length >= 2 && value.length <= maximum
  && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
const canonicalHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length < 8 || value.length > 2_048 || value !== value.trim()) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.protocol === 'https:' && Boolean(url.hostname) && isIP(url.hostname) === 0
    && !url.username && !url.password && !url.hash && (!url.port || url.port === '443')
    && url.hostname !== 'localhost' && !url.hostname.endsWith('.local') && url.toString() === value;
};
const validPins = (value: unknown): value is readonly [NetworkEgressPin, NetworkEgressPin] => Array.isArray(value)
  && value.length === 2 && isPlainRecord(value[0]) && isPlainRecord(value[1])
  && exactKeys(value[0], ['sha256', 'kind']) && exactKeys(value[1], ['sha256', 'kind'])
  && value[0].kind === 'primary' && value[1].kind === 'secondary'
  && typeof value[0].sha256 === 'string' && SHA256.test(value[0].sha256)
  && typeof value[1].sha256 === 'string' && SHA256.test(value[1].sha256)
  && value[0].sha256 !== value[1].sha256;
const clonePins = (pins: readonly [NetworkEgressPin, NetworkEgressPin]): readonly [NetworkEgressPin, NetworkEgressPin] =>
  Object.freeze([Object.freeze({ ...pins[0] }), Object.freeze({ ...pins[1] })]);
const cloneConfiguration = (configuration: OidcProviderConfiguration): OidcProviderConfiguration => Object.freeze({
  ...configuration,
  scopes: Object.freeze([...configuration.scopes])
});

const normalizedRegistration = (value: unknown): TrustedOidcNetworkRegistration | null => {
  if (!isPlainRecord(value) || !exactKeys(value, [
    'configurationId', 'configuration', 'clientAuthenticationMode', 'tokenEndpointPins', 'jwksEndpointPins'
  ]) || !validIdentifier(value.configurationId, 128) || !isPlainRecord(value.configuration)
    || !validPins(value.tokenEndpointPins) || !validPins(value.jwksEndpointPins)) return null;
  try { validateOidcProviderConfiguration(value.configuration as unknown as OidcProviderConfiguration); }
  catch { return null; }
  const configuration = value.configuration as unknown as OidcProviderConfiguration;
  if (!canonicalHttpsUrl(configuration.tokenEndpoint) || !canonicalHttpsUrl(configuration.jwksUri)
    || value.clientAuthenticationMode !== 'public_pkce' || configuration.providerId === 'apple') return null;
  return Object.freeze({
    configurationId: value.configurationId,
    configuration: cloneConfiguration(configuration),
    clientAuthenticationMode: value.clientAuthenticationMode,
    tokenEndpointPins: clonePins(value.tokenEndpointPins),
    jwksEndpointPins: clonePins(value.jwksEndpointPins)
  });
};

/** Only fully pinned token + JWKS registrations become visible to the federated identity center. */
export const networkReadyOidcProviderRegistrations = (
  registrations: readonly unknown[]
): readonly TrustedOidcProviderRegistration[] => {
  if (!Array.isArray(registrations) || registrations.length > 16) return Object.freeze([]);
  const normalized = registrations.map(normalizedRegistration).filter((item): item is TrustedOidcNetworkRegistration => item !== null);
  const counts = new Map<string, number>();
  for (const item of normalized) {
    const key = `${item.configuration.providerId}\u0000${item.configurationId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.freeze(normalized.filter((item) => counts.get(`${item.configuration.providerId}\u0000${item.configurationId}`) === 1)
    .map((item) => Object.freeze({
      configurationId: item.configurationId,
      configuration: cloneConfiguration(item.configuration),
      clientAuthenticationMode: item.clientAuthenticationMode,
      clientConfigurationSha256: oidcClientConfigurationSha256(item)
    })));
};

const normalizeIpAddress = (value: string): string => {
  const withoutZone = value.split('%')[0] ?? value;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(withoutZone);
  return mapped?.[1] ?? withoutZone;
};

export const isPrivateOrReservedOidcAddress = (value: string): boolean => {
  const normalized = normalizeIpAddress(value);
  const family = isIP(normalized);
  if (family === 4) return RESERVED_NETWORKS.check(normalized, 'ipv4');
  if (family === 6) return RESERVED_NETWORKS.check(normalized, 'ipv6');
  return true;
};

export const isSameOidcAddress = (expected: string, observed: string): boolean => {
  const normalizedExpected = normalizeIpAddress(expected);
  const normalizedObserved = normalizeIpAddress(observed);
  const family = isIP(normalizedExpected);
  if (family === 0 || isIP(normalizedObserved) !== family) return false;
  const exact = new BlockList();
  exact.addAddress(normalizedExpected, family === 4 ? 'ipv4' : 'ipv6');
  return exact.check(normalizedObserved, family === 4 ? 'ipv4' : 'ipv6');
};

const peerSpkiSha256 = (certificateDer: Buffer): string => {
  const certificate = new X509Certificate(certificateDer);
  return createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
};

const defaultLookup: OidcDnsLookup = async (hostname) => {
  const values = await systemLookup(hostname, { all: true, verbatim: true });
  return values.map(({ address, family }) => Object.freeze({ address, family: family as 4 | 6 }));
};

export class NodeHttpsOidcTransport implements OidcPinnedHttpsTransport {
  public constructor(
    private readonly lookup: OidcDnsLookup = defaultLookup,
    private readonly requestFactory: OidcHttpsRequestFactory = httpsRequest as unknown as OidcHttpsRequestFactory
  ) {}

  public async execute(input: OidcPinnedHttpsRequest): Promise<OidcPinnedHttpsResponse> {
    if (!canonicalHttpsUrl(input.sourceUrl) || input.signal.aborted) throw new SecureOidcNetworkError('OIDC HTTPS istegi gecersiz veya iptal edildi.');
    const url = new URL(input.sourceUrl);
    const addresses = await this.lookup(url.hostname);
    if (addresses.length < 1 || addresses.length > 32
      || addresses.some(({ address, family }) => isIP(address) !== family || isPrivateOrReservedOidcAddress(address))) {
      throw new SecureOidcNetworkError('OIDC DNS sonucu ozel, yerel veya ayrilmis adres iceriyor.');
    }
    if (input.signal.aborted) throw new SecureOidcNetworkError('OIDC HTTPS istegi iptal edildi.');
    const selected = addresses[0]!;
    return new Promise<OidcPinnedHttpsResponse>((resolve, reject) => {
      let settled = false;
      const chunks: Buffer[] = [];
      const zeroizeChunks = (): void => { for (const chunk of chunks) chunk.fill(0); chunks.length = 0; };
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        zeroizeChunks();
        reject(error);
      };
      const request = this.requestFactory({
        protocol: 'https:',
        hostname: selected.address,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: input.method,
        servername: url.hostname,
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        rejectUnauthorized: true,
        agent: false,
        timeout: input.timeoutMs,
        signal: input.signal,
        headers: { ...input.headers, host: url.host, connection: 'close' }
      }, (response) => {
        response.on('aborted', () => fail(new SecureOidcNetworkError('OIDC HTTPS yaniti yarida kesildi.')));
        response.on('error', (error: Error) => fail(error));
        response.on('close', () => {
          if (!response.complete) fail(new SecureOidcNetworkError('OIDC HTTPS yaniti tamamlanmadan kapandi.'));
        });
        const socket = response.socket;
        if (socket.authorized !== true || !socket.remoteAddress || isPrivateOrReservedOidcAddress(socket.remoteAddress)
          || !isSameOidcAddress(selected.address, socket.remoteAddress)
          || socket.getProtocol() !== 'TLSv1.3') {
          const error = new SecureOidcNetworkError('OIDC baglantisinin TLS veya uzak adres kaniti gecersiz.');
          fail(error);
          response.destroy(error);
          return;
        }
        const certificateDer = socket.getPeerCertificate(true).raw;
        if (!certificateDer) {
          const error = new SecureOidcNetworkError('OIDC TLS es sertifikasi alinamadi.');
          fail(error);
          response.destroy(error);
          return;
        }
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          if (settled) { chunk.fill(0); return; }
          size += chunk.byteLength;
          if (size > input.maximumResponseBytes) {
            chunk.fill(0);
            const error = new SecureOidcNetworkError('OIDC HTTPS yaniti boyut sinirini asti.');
            fail(error);
            response.destroy(error);
            return;
          }
          chunks.push(Buffer.from(chunk));
          chunk.fill(0);
        });
        response.on('end', () => {
          if (settled) return;
          try {
            const spkiSha256 = peerSpkiSha256(certificateDer);
            const body = Buffer.concat(chunks);
            zeroizeChunks();
            settled = true;
            resolve(Object.freeze({
              statusCode: response.statusCode ?? 0,
              headers: Object.freeze({ ...response.headers }),
              body,
              tlsAuthorized: true,
              tlsProtocol: socket.getProtocol(),
              resolvedRemoteAddress: selected.address,
              connectedRemoteAddress: socket.remoteAddress!,
              peerSpkiSha256: spkiSha256
            }));
          } catch (error) {
            fail(error instanceof Error ? error : new SecureOidcNetworkError('OIDC TLS sertifikasi dogrulanamadi.'));
          }
        });
      });
      request.on('timeout', () => request.destroy(new SecureOidcNetworkError('OIDC HTTPS istegi zaman asimina ugradi.')));
      request.on('error', (error: Error) => fail(error));
      if (input.body) request.end(input.body);
      else request.end();
    });
  }
}

const endpointId = (profile: TrustedOidcNetworkRegistration, kind: 'token' | 'jwks'): string => {
  const digest = createHash('sha256').update(`${profile.configuration.providerId}\u0000${profile.configurationId}\u0000${kind}`, 'utf8').digest('hex');
  return `oidc-${profile.configuration.providerId}-${kind}-${digest.slice(0, 32)}`;
};
const contentType = (headers: OidcPinnedHttpsResponse['headers']): string => {
  const value = headers['content-type'];
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').toLowerCase();
};
const contentEncoding = (headers: OidcPinnedHttpsResponse['headers']): string => {
  const value = headers['content-encoding'];
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').toLowerCase();
};
const utf8Json = (body: Buffer): unknown => {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  if (!text.trim()) throw new SecureOidcNetworkError('OIDC JSON yaniti bos.');
  try { return JSON.parse(text) as unknown; }
  catch { throw new SecureOidcNetworkError('OIDC HTTPS yaniti JSON degil.'); }
};
const validToken = (value: unknown): value is string => typeof value === 'string'
  && value.length >= 8 && value.length <= 32_768 && !/[\u0000-\u0020\u007f]/u.test(value);
const validCode = (value: unknown): value is string => typeof value === 'string'
  && value.length >= 8 && value.length <= 4_096 && !/[\u0000-\u0020\u007f]/u.test(value);
const validCodeVerifier = (value: unknown): value is string => typeof value === 'string'
  && value.length >= 43 && value.length <= 128 && BASE64URL.test(value);

export interface SecureOidcNetworkAdapterOptions {
  readonly registrations: readonly unknown[];
  readonly policy?: Pick<NetworkEgressPolicy, 'authorize'>;
  readonly transport?: OidcPinnedHttpsTransport;
  readonly clock?: () => string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export class SecureOidcNetworkAdapter implements OidcAuthorizationCodeExchangeClient, TrustedOidcJwksResolver {
  readonly #profiles = new Map<string, TrustedOidcNetworkRegistration>();
  readonly #policy: Pick<NetworkEgressPolicy, 'authorize'>;
  readonly #transport: OidcPinnedHttpsTransport;
  readonly #clock: () => string;
  readonly #timeoutMs: number;
  readonly #signal: AbortSignal | undefined;

  public constructor(options: SecureOidcNetworkAdapterOptions) {
    if (!Array.isArray(options.registrations) || options.registrations.length > 16) {
      throw new SecureOidcNetworkError('OIDC network registration kotasi gecersiz.');
    }
    for (const candidate of options.registrations) {
      const profile = normalizedRegistration(candidate);
      if (!profile) throw new SecureOidcNetworkError('OIDC token/JWKS endpoint veya SPKI pin profili eksik.');
      const key = `${profile.configuration.providerId}\u0000${profile.configurationId}`;
      if (this.#profiles.has(key)) throw new SecureOidcNetworkError('OIDC network registration duplicate.');
      this.#profiles.set(key, profile);
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MINIMUM_TIMEOUT_MS || timeoutMs > MAXIMUM_TIMEOUT_MS) {
      throw new SecureOidcNetworkError('OIDC HTTPS timeout siniri gecersiz.');
    }
    this.#policy = options.policy ?? new NetworkEgressPolicy();
    this.#transport = options.transport ?? new NodeHttpsOidcTransport();
    this.#clock = options.clock ?? (() => new Date().toISOString());
    this.#timeoutMs = timeoutMs;
    this.#signal = options.signal;
  }

  public networkReadyProviderRegistrations(): readonly TrustedOidcProviderRegistration[] {
    return networkReadyOidcProviderRegistrations([...this.#profiles.values()]);
  }

  public async exchange(input: OidcAuthorizationCodeExchangeInput): Promise<OidcAuthorizationCodeExchangeResponse> {
    const profile = this.#resolve(input.provider, input.configurationId);
    if (input.tokenEndpoint !== profile.configuration.tokenEndpoint || input.clientId !== profile.configuration.clientId
      || input.redirectUri !== profile.configuration.redirectUri || !validCode(input.authorizationCode)
      || !validCodeVerifier(input.codeVerifier)) throw new SecureOidcNetworkError('OIDC token exchange trusted configuration ile eslesmedi.');
    const body = Buffer.from(new URLSearchParams([
      ['grant_type', 'authorization_code'],
      ['code', input.authorizationCode],
      ['code_verifier', input.codeVerifier],
      ['redirect_uri', input.redirectUri],
      ['client_id', input.clientId]
    ]).toString(), 'utf8');
    if (body.byteLength > MAX_TOKEN_REQUEST_BYTES) { body.fill(0); throw new SecureOidcNetworkError('OIDC token istegi boyut sinirini asti.'); }
    let response: OidcPinnedHttpsResponse | undefined;
    try {
      response = await this.#execute(profile, 'token', 'POST', 'oidc.token.exchange', profile.tokenEndpointPins, {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(body.byteLength),
        'user-agent': 'Pardus-Aile/OIDC'
      }, MAX_TOKEN_RESPONSE_BYTES, body);
      const value = utf8Json(response.body);
      if (!isPlainRecord(value) || !exactKeys(value, ['access_token', 'id_token', 'token_type', 'expires_in'], ['refresh_token', 'scope'])
        || !validToken(value.access_token) || !validToken(value.id_token)
        || (value.refresh_token !== undefined && !validToken(value.refresh_token)) || value.token_type !== 'Bearer'
        || !Number.isSafeInteger(value.expires_in) || Number(value.expires_in) < 1 || Number(value.expires_in) > 86_400) {
        throw new SecureOidcNetworkError('OIDC token yaniti exact ve bounded degil.');
      }
      const scopes = value.scope === undefined ? [...profile.configuration.scopes]
        : typeof value.scope === 'string' && value.scope.length <= 1_024 ? value.scope.split(' ').filter(Boolean) : [];
      if (scopes.length < 1 || scopes.length > 12 || new Set(scopes).size !== scopes.length || !scopes.includes('openid')
        || scopes.some((scope) => !profile.configuration.scopes.includes(scope))) {
        throw new SecureOidcNetworkError('OIDC token scope yaniti trusted configuration disinda.');
      }
      return Object.freeze({
        accessToken: value.access_token,
        idToken: value.id_token,
        ...(value.refresh_token === undefined ? {} : { refreshToken: value.refresh_token }),
        tokenType: 'Bearer',
        scopes: Object.freeze(scopes),
        expiresInSeconds: Number(value.expires_in)
      });
    } finally {
      body.fill(0);
      response?.body.fill(0);
    }
  }

  public async resolveSigningKey(input: TrustedOidcJwksResolverInput): Promise<(JsonWebKey & { readonly kid: string }) | null> {
    const profile = this.#resolve(input.provider, input.configurationId);
    if (input.issuer !== profile.configuration.issuer || input.jwksUri !== profile.configuration.jwksUri
      || !validIdentifier(input.keyId, 256) || !['RS256', 'ES256'].includes(input.algorithm)) {
      throw new SecureOidcNetworkError('OIDC JWKS istegi trusted configuration ile eslesmedi.');
    }
    let response: OidcPinnedHttpsResponse | undefined;
    try {
      response = await this.#execute(profile, 'jwks', 'GET', 'oidc.jwks.fetch', profile.jwksEndpointPins, {
        accept: 'application/json',
        'user-agent': 'Pardus-Aile/OIDC'
      }, MAX_JWKS_RESPONSE_BYTES);
      const value = utf8Json(response.body);
      if (!isPlainRecord(value) || !exactKeys(value, ['keys']) || !Array.isArray(value.keys)
        || value.keys.length < 1 || value.keys.length > 32) throw new SecureOidcNetworkError('OIDC JWKS yaniti exact degil.');
      const matches = value.keys.filter((item) => isPlainRecord(item) && item.kid === input.keyId);
      if (matches.length === 0) return null;
      if (matches.length !== 1) throw new SecureOidcNetworkError('OIDC JWKS kid duplicate.');
      return this.#publicJwk(matches[0]!, input.algorithm);
    } finally { response?.body.fill(0); }
  }

  #resolve(provider: OidcAuthorizationCodeExchangeInput['provider'], configurationId: string): TrustedOidcNetworkRegistration {
    const profile = this.#profiles.get(`${provider}\u0000${configurationId}`);
    if (!profile) throw new SecureOidcNetworkError('OIDC provider network profili bulunamadi.');
    return profile;
  }

  async #execute(
    profile: TrustedOidcNetworkRegistration,
    kind: 'token' | 'jwks',
    method: 'GET' | 'POST',
    purpose: Extract<NetworkEgressPurpose, 'oidc.token.exchange' | 'oidc.jwks.fetch'>,
    pins: readonly NetworkEgressPin[],
    headers: Readonly<Record<string, string>>,
    maximumResponseBytes: number,
    body?: Buffer
  ): Promise<OidcPinnedHttpsResponse> {
    const sourceUrl = kind === 'token' ? profile.configuration.tokenEndpoint : profile.configuration.jwksUri;
    const id = endpointId(profile, kind);
    const observedAt = this.#clock();
    const request = { schemaVersion: 1 as const, endpointId: id, sourceUrl, method, purpose,
      applicationId: 'windows-desktop' as const, tlsMode: 'tls' as const, clientIdentityId: null };
    const authority = { schemaVersion: 1 as const, endpointId: id, sourceUrl, endpointStatus: 'active' as const,
      allowedMethod: method, allowedPurpose: purpose, allowedApplicationId: 'windows-desktop' as const,
      minimumTlsVersion: 'TLSv1.3' as const, tlsMode: 'tls' as const, clientIdentityId: null,
      expectedPins: pins, observedAt };
    const decision = this.#policy.authorize(request, authority);
    if (!decision.allowed || decision.redirectAllowed !== false || decision.directNetworkPrimitiveAllowed !== false) {
      throw new SecureOidcNetworkError(`OIDC network egress policy reddi: ${decision.reason}`);
    }
    const response = await this.#withDeadline((signal) => this.#transport.execute(Object.freeze({
      endpointId: id, sourceUrl, method, purpose, headers: Object.freeze({ ...headers }), ...(body ? { body } : {}),
      maximumResponseBytes, timeoutMs: this.#timeoutMs, signal
    })));
    if (!response.tlsAuthorized || response.tlsProtocol !== 'TLSv1.3'
      || isPrivateOrReservedOidcAddress(response.resolvedRemoteAddress)
      || isPrivateOrReservedOidcAddress(response.connectedRemoteAddress)
      || !isSameOidcAddress(response.resolvedRemoteAddress, response.connectedRemoteAddress)
      || !pins.some(({ sha256 }) => sha256 === response.peerSpkiSha256)) {
      response.body.fill(0);
      throw new SecureOidcNetworkError('OIDC TLS1.3, public remote veya SPKI pin kaniti gecersiz.');
    }
    if (response.body.byteLength < 1 || response.body.byteLength > maximumResponseBytes) {
      response.body.fill(0);
      throw new SecureOidcNetworkError('OIDC HTTPS yaniti boyut sinirini asti.');
    }
    if (response.statusCode >= 300 && response.statusCode < 400) {
      response.body.fill(0);
      throw new SecureOidcNetworkError('OIDC HTTPS redirect reddedildi.');
    }
    if (response.statusCode !== 200 || contentType(response.headers).split(';', 1)[0]?.trim() !== 'application/json'
      || !['', 'identity'].includes(contentEncoding(response.headers))) {
      response.body.fill(0);
      throw new SecureOidcNetworkError('OIDC HTTPS status veya icerik turu reddedildi.');
    }
    return response;
  }

  async #withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.#signal?.aborted) throw new SecureOidcNetworkError('OIDC network islemi iptal edildi.');
    const controller = new AbortController();
    const abort = () => controller.abort(this.#signal?.reason ?? new SecureOidcNetworkError('OIDC network islemi iptal edildi.'));
    this.#signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new SecureOidcNetworkError('OIDC network islemi zaman asimina ugradi.')), this.#timeoutMs);
    const aborted = new Promise<never>((_resolve, reject) => controller.signal.addEventListener('abort', () => {
      reject(controller.signal.reason instanceof Error ? controller.signal.reason : new SecureOidcNetworkError('OIDC network islemi iptal edildi.'));
    }, { once: true }));
    try { return await Promise.race([operation(controller.signal), aborted]); }
    finally { clearTimeout(timer); this.#signal?.removeEventListener('abort', abort); }
  }

  #publicJwk(value: Record<string, unknown>, algorithm: 'RS256' | 'ES256'): JsonWebKey & { readonly kid: string } {
    const common = ['kty', 'kid', 'use', 'alg', 'key_ops'];
    const allowed = algorithm === 'RS256' ? [...common, 'n', 'e'] : [...common, 'crv', 'x', 'y'];
    if (!exactKeys(value, ['kty', 'kid'], allowed.filter((key) => !['kty', 'kid'].includes(key)))
      || value.kid === undefined || value.alg !== undefined && value.alg !== algorithm
      || value.use !== undefined && value.use !== 'sig'
      || value.key_ops !== undefined && (!Array.isArray(value.key_ops) || value.key_ops.length !== 1 || value.key_ops[0] !== 'verify')
      || ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k', 'x5c', 'x5u', 'jku'].some((key) => value[key] !== undefined)) {
      throw new SecureOidcNetworkError('OIDC JWKS yalniz exact public verify anahtari tasimalidir.');
    }
    if (algorithm === 'RS256') {
      if (value.kty !== 'RSA' || typeof value.n !== 'string' || value.n.length < 342 || value.n.length > 684
        || !BASE64URL.test(value.n) || typeof value.e !== 'string' || !BASE64URL.test(value.e)) {
        throw new SecureOidcNetworkError('OIDC RSA JWK gecersiz.');
      }
    } else if (value.kty !== 'EC' || value.crv !== 'P-256' || typeof value.x !== 'string' || value.x.length !== 43
      || typeof value.y !== 'string' || value.y.length !== 43 || !BASE64URL.test(value.x) || !BASE64URL.test(value.y)) {
      throw new SecureOidcNetworkError('OIDC EC JWK gecersiz.');
    }
    return Object.freeze({ ...value }) as JsonWebKey & { readonly kid: string };
  }
}
