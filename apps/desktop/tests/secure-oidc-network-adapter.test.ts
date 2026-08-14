import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { OidcProviderConfiguration } from '@ppt/security';
import {
  NodeHttpsOidcTransport,
  SecureOidcNetworkAdapter,
  SecureOidcNetworkError,
  isPrivateOrReservedOidcAddress,
  isSameOidcAddress,
  networkReadyOidcProviderRegistrations,
  type OidcPinnedHttpsRequest,
  type OidcPinnedHttpsResponse,
  type OidcPinnedHttpsTransport,
  type TrustedOidcNetworkRegistration
} from '../src/main/secure-oidc-network-adapter.js';
import { oidcClientConfigurationSha256 } from '../src/main/oidc-provider-configuration-fingerprint.js';

const NOW = '2026-08-14T08:00:00.000Z';
const PRIMARY = 'a'.repeat(64);
const SECONDARY = 'b'.repeat(64);
const JWKS_PRIMARY = 'c'.repeat(64);
const JWKS_SECONDARY = 'd'.repeat(64);
const CONFIGURATION: OidcProviderConfiguration = Object.freeze({
  providerId: 'google',
  issuer: 'https://accounts.example.com',
  authorizationEndpoint: 'https://accounts.example.com/oauth/authorize',
  tokenEndpoint: 'https://accounts.example.com/oauth/token',
  jwksUri: 'https://accounts.example.com/.well-known/jwks.json',
  clientId: 'desktop-client-id',
  redirectUri: 'pardus-app://oidc',
  scopes: Object.freeze(['openid', 'profile', 'email'])
});
const pins = (primary = PRIMARY, secondary = SECONDARY) => Object.freeze([
  Object.freeze({ sha256: primary, kind: 'primary' as const }),
  Object.freeze({ sha256: secondary, kind: 'secondary' as const })
]);
const registration = (overrides: Partial<TrustedOidcNetworkRegistration> = {}): TrustedOidcNetworkRegistration => Object.freeze({
  configurationId: 'google-production',
  configuration: CONFIGURATION,
  clientAuthenticationMode: 'public_pkce',
  tokenEndpointPins: pins(),
  jwksEndpointPins: pins(JWKS_PRIMARY, JWKS_SECONDARY),
  ...overrides
});

const response = (body: unknown, overrides: Partial<OidcPinnedHttpsResponse> = {}): OidcPinnedHttpsResponse => Object.freeze({
  statusCode: 200,
  headers: Object.freeze({ 'content-type': 'application/json' }),
  body: Buffer.from(JSON.stringify(body), 'utf8'),
  tlsAuthorized: true,
  tlsProtocol: 'TLSv1.3',
  resolvedRemoteAddress: '93.184.216.34',
  connectedRemoteAddress: '93.184.216.34',
  peerSpkiSha256: PRIMARY,
  ...overrides
});

const exchangeInput = () => Object.freeze({
  provider: 'google' as const,
  configurationId: 'google-production',
  tokenEndpoint: CONFIGURATION.tokenEndpoint,
  clientId: CONFIGURATION.clientId,
  redirectUri: CONFIGURATION.redirectUri,
  authorizationCode: 'authorization-code-value',
  codeVerifier: 'A'.repeat(43),
  correlationId: 'correlation-oidc-network' as never
});

describe('PPK-015 secure OIDC network adapter', () => {
  it('publishes only unique fully pinned public-PKCE providers and hides unsupported Apple auth', () => {
    const complete = registration();
    const incomplete = { ...complete, configurationId: 'missing-jwks-pins', jwksEndpointPins: [] };
    const apple = { ...complete, configurationId: 'apple-production', configuration: { ...CONFIGURATION, providerId: 'apple' } };
    const duplicate = { ...complete };
    expect(networkReadyOidcProviderRegistrations([complete, incomplete, apple, duplicate])).toEqual([]);
    const visible = networkReadyOidcProviderRegistrations([complete]);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({
      configurationId: 'google-production',
      clientAuthenticationMode: 'public_pkce',
      clientConfigurationSha256: expect.stringMatching(/^[0-9a-f]{64}$/u)
    });
    expect(() => new SecureOidcNetworkAdapter({ registrations: [apple] })).toThrow(SecureOidcNetworkError);
  });

  it('binds the canonical client fingerprint to both endpoint pin rotation sets', () => {
    const current = registration();
    const rotated = registration({ tokenEndpointPins: pins('e'.repeat(64), SECONDARY) });
    expect(oidcClientConfigurationSha256(current)).not.toBe(oidcClientConfigurationSha256(rotated));
    expect(oidcClientConfigurationSha256(current)).toBe(
      networkReadyOidcProviderRegistrations([current])[0]?.clientConfigurationSha256
    );
  });

  it('authorizes before a bounded token POST and falls back to the requested scopes when scope is absent', async () => {
    let captured: { method: string; purpose: string; sourceUrl: string; body: string } | undefined;
    const transport: OidcPinnedHttpsTransport = { execute: vi.fn(async (input) => {
      captured = { method: input.method, purpose: input.purpose, sourceUrl: input.sourceUrl, body: input.body?.toString('utf8') ?? '' };
      return response({ access_token: 'access-token-value', id_token: 'identity-token-value', token_type: 'Bearer', expires_in: 3600 });
    }) };
    const authorize = vi.fn(() => Object.freeze({ allowed: true, reason: 'ALLOW_EGRESS' as const,
      redirectAllowed: false as const, directNetworkPrimitiveAllowed: false as const }));
    const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport, policy: { authorize }, clock: () => NOW });
    await expect(adapter.exchange(exchangeInput())).resolves.toMatchObject({ scopes: ['openid', 'profile', 'email'] });
    expect(authorize).toHaveBeenCalledOnce();
    expect(captured).toMatchObject({ method: 'POST', purpose: 'oidc.token.exchange', sourceUrl: CONFIGURATION.tokenEndpoint });
    expect(captured?.body).toContain('grant_type=authorization_code');
    expect(captured?.body).toContain('code_verifier=');
    expect(captured?.body).not.toMatch(/client_secret|private_key|assertion/iu);
  });

  it('accepts a configured scope subset but rejects an unknown or escalated scope', async () => {
    let returnedScope = 'openid profile';
    const transport: OidcPinnedHttpsTransport = { execute: async () => response({
      access_token: 'access-token-value', id_token: 'identity-token-value', token_type: 'Bearer', expires_in: 3600, scope: returnedScope
    }) };
    const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport, clock: () => NOW });
    await expect(adapter.exchange(exchangeInput())).resolves.toMatchObject({ scopes: ['openid', 'profile'] });
    returnedScope = 'openid admin';
    await expect(adapter.exchange(exchangeInput())).rejects.toThrow(/scope/iu);
  });

  it('fetches only one exact public JWK and rejects private key material', async () => {
    let body: unknown = { keys: [{ kty: 'EC', kid: 'key-1', use: 'sig', alg: 'ES256', key_ops: ['verify'],
      crv: 'P-256', x: 'A'.repeat(43), y: 'B'.repeat(43) }] };
    const transport: OidcPinnedHttpsTransport = { execute: vi.fn(async () => response(body, { peerSpkiSha256: JWKS_PRIMARY })) };
    const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport, clock: () => NOW });
    const input = Object.freeze({ provider: 'google' as const, configurationId: 'google-production', issuer: CONFIGURATION.issuer,
      jwksUri: CONFIGURATION.jwksUri, keyId: 'key-1', algorithm: 'ES256' as const, correlationId: 'correlation-jwks' as never });
    await expect(adapter.resolveSigningKey(input)).resolves.toMatchObject({ kid: 'key-1', kty: 'EC', crv: 'P-256' });
    expect(transport.execute).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'GET', purpose: 'oidc.jwks.fetch' }));
    body = { keys: [{ kty: 'EC', kid: 'key-1', crv: 'P-256', x: 'A'.repeat(43), y: 'B'.repeat(43), d: 'private' }] };
    await expect(adapter.resolveSigningKey(input)).rejects.toThrow(/public/iu);
  });

  it('never invokes transport after policy denial', async () => {
    const transport: OidcPinnedHttpsTransport = { execute: vi.fn(async () => response({})) };
    const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport,
      policy: { authorize: () => Object.freeze({ allowed: false, reason: 'PURPOSE_NOT_ALLOWED' as const,
        redirectAllowed: false as const, directNetworkPrimitiveAllowed: false as const }) }, clock: () => NOW });
    await expect(adapter.exchange(exchangeInput())).rejects.toThrow(/policy/iu);
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['private DNS', { connectedRemoteAddress: '93.184.216.34' }, ['10.0.0.2']],
    ['mixed DNS', { connectedRemoteAddress: '93.184.216.34' }, ['93.184.216.34', '127.0.0.1']]
  ])('rejects %s before opening HTTPS', async (_label, _response, addresses) => {
    const transport = new NodeHttpsOidcTransport(async () => addresses.map((address) => ({ address, family: 4 as const })));
    const controller = new AbortController();
    await expect(transport.execute(Object.freeze({
      endpointId: 'oidc-google-token', sourceUrl: CONFIGURATION.tokenEndpoint, method: 'POST', purpose: 'oidc.token.exchange',
      headers: Object.freeze({ accept: 'application/json' }), maximumResponseBytes: 1024, timeoutMs: 1000,
      signal: controller.signal
    }))).rejects.toThrow(/DNS/iu);
  });

  it('rejects DNS/connected mismatch, private address, TLS downgrade, wrong pin, redirect, spoofed type, encoding, and oversize', async () => {
    const cases: Partial<OidcPinnedHttpsResponse>[] = [
      { connectedRemoteAddress: '93.184.216.35' }, { connectedRemoteAddress: '127.0.0.1' },
      { tlsProtocol: 'TLSv1.2' }, { peerSpkiSha256: 'e'.repeat(64) }, { statusCode: 302 },
      { headers: { 'content-type': 'text/application/jsonp' } },
      { headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' } },
      { body: Buffer.alloc(65 * 1024, 1) }
    ];
    for (const override of cases) {
      const transport: OidcPinnedHttpsTransport = { execute: async () => response({
        access_token: 'access-token-value', id_token: 'identity-token-value', token_type: 'Bearer', expires_in: 3600
      }, override) };
      const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport, clock: () => NOW });
      await expect(adapter.exchange(exchangeInput())).rejects.toThrow(SecureOidcNetworkError);
    }
    for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fc00::1', 'not-an-ip']) {
      expect(isPrivateOrReservedOidcAddress(address)).toBe(true);
    }
    expect(isSameOidcAddress('93.184.216.34', '93.184.216.34')).toBe(true);
    expect(isSameOidcAddress('93.184.216.34', '93.184.216.35')).toBe(false);
  });

  it('zeroizes accumulated response chunks on a midstream abort', async () => {
    const source = Buffer.from('sensitive-midstream-token-bytes', 'utf8');
    const emitted = Buffer.from(source);
    const request = new EventEmitter() as EventEmitter & { end(): void; destroy(error: Error): void };
    const responseStream = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headers: Record<string, string>;
      complete: boolean;
      socket: unknown;
      destroy(error?: Error): void;
    };
    responseStream.statusCode = 200;
    responseStream.headers = { 'content-type': 'application/json' };
    responseStream.complete = false;
    responseStream.socket = {
      authorized: true,
      remoteAddress: '93.184.216.34',
      getProtocol: () => 'TLSv1.3',
      getPeerCertificate: () => ({ raw: Buffer.from('not-read-before-abort') })
    };
    responseStream.destroy = vi.fn();
    request.destroy = (error) => request.emit('error', error);
    request.end = () => queueMicrotask(() => {
      responseCallback?.(responseStream);
      responseStream.emit('data', emitted);
      responseStream.emit('aborted');
    });
    let responseCallback: ((value: typeof responseStream) => void) | undefined;
    const transport = new NodeHttpsOidcTransport(async () => [{ address: '93.184.216.34', family: 4 }],
      ((_options: unknown, callback: (value: typeof responseStream) => void) => {
        responseCallback = callback;
        return request;
      }) as never);
    await expect(transport.execute(Object.freeze({
      endpointId: 'oidc-google-token', sourceUrl: CONFIGURATION.tokenEndpoint, method: 'POST', purpose: 'oidc.token.exchange',
      headers: Object.freeze({ accept: 'application/json' }), maximumResponseBytes: 1024, timeoutMs: 1000,
      signal: new AbortController().signal
    }))).rejects.toThrow(/yarida/iu);
    expect(emitted.equals(Buffer.alloc(emitted.byteLength))).toBe(true);
    expect(source.toString('utf8')).toBe('sensitive-midstream-token-bytes');
  });

  it('fails closed on an already aborted operation without calling transport', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport: OidcPinnedHttpsTransport = { execute: vi.fn(async (_input: OidcPinnedHttpsRequest) => response({})) };
    const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport, signal: controller.signal });
    await expect(adapter.exchange(exchangeInput())).rejects.toThrow(/iptal/iu);
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it('aborts a non-responsive transport at the bounded deadline', async () => {
    vi.useFakeTimers();
    try {
      let observedSignal: AbortSignal | undefined;
      const transport: OidcPinnedHttpsTransport = { execute: vi.fn((input) => {
        observedSignal = input.signal;
        return new Promise<OidcPinnedHttpsResponse>(() => { /* deliberately non-responsive */ });
      }) };
      const adapter = new SecureOidcNetworkAdapter({ registrations: [registration()], transport, timeoutMs: 1000 });
      const assertion = expect(adapter.exchange(exchangeInput())).rejects.toThrow(/zaman asimi/iu);
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
      expect(observedSignal?.aborted).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
