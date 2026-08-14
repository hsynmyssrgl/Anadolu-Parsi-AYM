import { createHash, generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { asCorrelationId, asIsoDateTime, asUserId } from '@ppt/core';
import type { DeviceSecretProtector, OidcProviderConfiguration } from '@ppt/security';
import {
  OidcFederatedIdentityAdapter,
  StaticTrustedOidcProviderConfigurationResolver,
  type OidcAuthorizationCodeExchangeClient,
  type OidcAuthorizationCodeExchangeInput,
  type OidcAuthorizationCodeExchangeResponse,
  type TrustedOidcJwksResolver,
  type TrustedOidcJwksResolverInput
} from '../src/main/oidc-federated-identity-adapter.js';
import { OidcTokenVault, type OidcVaultPersistence } from '../src/main/oidc-token-vault.js';

const NOW = '2026-08-14T06:00:00.000Z';
const ACCOUNT_ID = asUserId('account-1');
const CORRELATION_ID = asCorrelationId('correlation-1');
const CONFIGURATION: OidcProviderConfiguration = Object.freeze({
  providerId: 'google',
  issuer: 'https://accounts.example.test',
  authorizationEndpoint: 'https://accounts.example.test/oauth2/authorize',
  tokenEndpoint: 'https://accounts.example.test/oauth2/token',
  jwksUri: 'https://accounts.example.test/.well-known/jwks.json',
  clientId: 'desktop-client-id',
  redirectUri: 'pardus-app://oidc',
  scopes: Object.freeze(['openid', 'profile', 'email'])
});

class TestProtector implements DeviceSecretProtector {
  public readonly protectionId = 'test-protector-v1';
  public readonly required = true;
  public isAvailable(): boolean { return true; }
  public protect(value: string): string { return Buffer.from(`sealed:${value}`, 'utf8').toString('base64'); }
  public unprotect(value: string): string {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (!decoded.startsWith('sealed:')) throw new Error('bad');
    return decoded.slice(7);
  }
}

class MemoryPersistence implements OidcVaultPersistence {
  public serialized: string | null = null;
  public read(): string | null { return this.serialized; }
  public write(serializedEnvelope: string): void { this.serialized = serializedEnvelope; }
}

const sha256Base64Url = (value: string): string => createHash('sha256').update(value, 'ascii').digest('base64url');
const sha256Hex = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const signedIdToken = (input: {
  readonly privateKey: KeyObject;
  readonly nonce: string;
  readonly subject?: string;
  readonly issuer?: string;
  readonly audience?: string;
}): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'key-1' }), 'utf8').toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: input.issuer ?? CONFIGURATION.issuer,
    sub: input.subject ?? 'provider-user-1',
    aud: input.audience ?? CONFIGURATION.clientId,
    nonce: input.nonce,
    iat: Math.floor(Date.parse(NOW) / 1000),
    exp: Math.floor(Date.parse(NOW) / 1000) + 3600
  }), 'utf8').toString('base64url');
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`, 'ascii'), input.privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
};

const publicSigningJwk = (publicKey: KeyObject): JsonWebKey & { readonly kid: string } => Object.freeze({
  ...publicKey.export({ format: 'jwk' }),
  kid: 'key-1',
  alg: 'RS256',
  use: 'sig',
  key_ops: ['verify']
});

const createResolver = () => new StaticTrustedOidcProviderConfigurationResolver([{
  configurationId: 'google-production-v1',
  configuration: CONFIGURATION,
  clientAuthenticationMode: 'public_pkce',
  clientConfigurationSha256: 'c'.repeat(64)
}]);

describe('OIDC federated identity main-process adapter', () => {
  it('persists ceremony and token secrets only under device protection and emits live=true only after exchange and trusted JWT verification', async () => {
    const persistence = new MemoryPersistence();
    const protector = new TestProtector();
    const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
    let exchangeInput: OidcAuthorizationCodeExchangeInput | undefined;
    let jwksInput: TrustedOidcJwksResolverInput | undefined;
    let nonce = '';
    const exchangeClient: OidcAuthorizationCodeExchangeClient = {
      async exchange(input): Promise<OidcAuthorizationCodeExchangeResponse> {
        exchangeInput = input;
        return {
          accessToken: 'access-token-secret',
          idToken: signedIdToken({ privateKey: keyPair.privateKey, nonce }),
          refreshToken: 'refresh-token-secret',
          tokenType: 'Bearer',
          scopes: ['profile', 'openid'],
          expiresInSeconds: 3600
        };
      }
    };
    const jwksResolver: TrustedOidcJwksResolver = {
      async resolveSigningKey(input) { jwksInput = input; return publicSigningJwk(keyPair.publicKey); }
    };
    const firstVault = new OidcTokenVault(protector, persistence);
    const firstAdapter = new OidcFederatedIdentityAdapter({
      providerConfigurations: createResolver(), codeExchangeClient: exchangeClient, jwksResolver, tokenVault: firstVault, clock: () => NOW
    });

    const ceremony = firstAdapter.createAndStore({
      flowId: 'flow-1', provider: 'google', configurationId: 'google-production-v1',
      accountId: ACCOUNT_ID, createdAt: asIsoDateTime(NOW), correlationId: CORRELATION_ID
    });
    expect(ceremony.ok).toBe(true);
    if (!ceremony.ok) return;
    const authorizationUrl = new URL(ceremony.value.authorizationUrl);
    const state = authorizationUrl.searchParams.get('state') ?? '';
    nonce = authorizationUrl.searchParams.get('nonce') ?? '';
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(ceremony.value).toMatchObject({
      codeVerifierStoredInEncryptedVault: true,
      codeVerifierExposed: false,
      tokenBytesExposed: false,
      providerAvailabilityGuaranteed: false,
      providerDeliveryGuaranteed: false
    });
    expect(persistence.serialized).not.toContain(CONFIGURATION.clientId);
    expect(persistence.serialized).not.toContain(CONFIGURATION.tokenEndpoint);
    expect(persistence.serialized).not.toContain(state);
    expect(firstAdapter.listVisibleConfiguredProviders()).toEqual([{
      provider: 'google', configurationId: 'google-production-v1',
      providerAvailabilityGuaranteed: false, providerDeliveryGuaranteed: false,
      networkAvailabilityGuaranteed: false, networkDeliveryGuaranteed: false
    }]);

    const restartedVault = new OidcTokenVault(protector, persistence);
    const restartedAdapter = new OidcFederatedIdentityAdapter({
      providerConfigurations: createResolver(), codeExchangeClient: exchangeClient, jwksResolver, tokenVault: restartedVault, clock: () => NOW
    });
    const callback = await restartedAdapter.acceptAuthorizationCallback({
      flowId: 'flow-1', linkId: 'link-1', provider: 'google', accountId: ACCOUNT_ID,
      callbackUrl: `${CONFIGURATION.redirectUri}?code=authorization-code-1&state=${encodeURIComponent(state)}&iss=${encodeURIComponent(CONFIGURATION.issuer)}`,
      correlationId: CORRELATION_ID
    });
    expect(callback.ok).toBe(true);
    if (!callback.ok) return;
    expect(callback.value.encryptedVaultEntryId).toMatch(/^oidc-[0-9a-f]{48}$/u);
    expect(callback.value).toMatchObject({
      liveAccountTested: true,
      authorizationCodePkceVerified: true,
      stateVerified: true,
      nonceVerified: true,
      tokenBytesExposed: false,
      tokenStoredInEncryptedVault: true,
      providerAvailabilityGuaranteed: false,
      providerDeliveryGuaranteed: false,
      networkAvailabilityGuaranteed: false,
      networkDeliveryGuaranteed: false
    });
    expect(JSON.stringify(callback.value)).not.toContain('access-token-secret');
    expect(persistence.serialized).not.toContain('access-token-secret');
    expect(persistence.serialized).not.toContain('refresh-token-secret');
    expect(exchangeInput).toMatchObject({
      provider: 'google', configurationId: 'google-production-v1', tokenEndpoint: CONFIGURATION.tokenEndpoint,
      clientId: CONFIGURATION.clientId, redirectUri: CONFIGURATION.redirectUri,
      authorizationCode: 'authorization-code-1', correlationId: CORRELATION_ID
    });
    expect(sha256Base64Url(exchangeInput?.codeVerifier ?? '')).toBe(authorizationUrl.searchParams.get('code_challenge'));
    expect(jwksInput).toMatchObject({
      provider: 'google', configurationId: 'google-production-v1', issuer: CONFIGURATION.issuer,
      jwksUri: CONFIGURATION.jwksUri, keyId: 'key-1', algorithm: 'RS256'
    });

    const finalAdapter = new OidcFederatedIdentityAdapter({
      providerConfigurations: createResolver(), codeExchangeClient: exchangeClient, jwksResolver,
      tokenVault: new OidcTokenVault(protector, persistence), clock: () => NOW
    });
    expect(finalAdapter.consumeVerifiedFlow({
      flowId: 'flow-1', expectedLinkId: 'link-wrong', provider: 'google', accountId: ACCOUNT_ID, correlationId: CORRELATION_ID
    }).ok).toBe(false);
    const verified = finalAdapter.consumeVerifiedFlow({
      flowId: 'flow-1', expectedLinkId: 'link-1', provider: 'google', accountId: ACCOUNT_ID, correlationId: CORRELATION_ID
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value).toMatchObject({
      provider: 'google', configurationId: 'google-production-v1',
      authorizationEndpointSha256: sha256Hex(CONFIGURATION.authorizationEndpoint),
      clientConfigurationSha256: 'c'.repeat(64),
      grantedScopes: ['openid', 'profile'], encryptedVaultEntryId: callback.value.encryptedVaultEntryId,
      liveAccountTested: true, authorizationCodePkceVerified: true, stateVerified: true, nonceVerified: true
    });
    expect(finalAdapter.consumeVerifiedFlow({
      flowId: 'flow-1', expectedLinkId: 'link-1', provider: 'google', accountId: ACCOUNT_ID, correlationId: CORRELATION_ID
    }).ok).toBe(false);
    expect(restartedVault.getToken({
      accountId: String(ACCOUNT_ID), providerId: 'google', linkId: 'link-1', flowId: 'flow-1'
    }, callback.value.encryptedVaultEntryId, NOW)).toMatchObject({ accessToken: 'access-token-secret' });
    finalAdapter.discardVaultEntry(callback.value.encryptedVaultEntryId);
    expect(() => restartedVault.getToken({
      accountId: String(ACCOUNT_ID), providerId: 'google', linkId: 'link-1', flowId: 'flow-1'
    }, callback.value.encryptedVaultEntryId, NOW)).toThrow(/iptal/u);
  });

  it('hides unconfigured providers and fails closed before starting a flow', () => {
    const adapter = new OidcFederatedIdentityAdapter({
      providerConfigurations: new StaticTrustedOidcProviderConfigurationResolver([]),
      codeExchangeClient: { exchange: async () => { throw new Error('must not run'); } },
      jwksResolver: { resolveSigningKey: async () => { throw new Error('must not run'); } },
      tokenVault: new OidcTokenVault(new TestProtector(), new MemoryPersistence()),
      clock: () => NOW
    });
    expect(adapter.listVisibleConfiguredProviders()).toEqual([]);
    expect(adapter.createAndStore({
      flowId: 'flow-2', provider: 'google', configurationId: 'not-configured', accountId: ACCOUNT_ID,
      createdAt: asIsoDateTime(NOW), correlationId: CORRELATION_ID
    }).ok).toBe(false);
  });

  it('consumes forged-state callbacks once without exchange and rejects a foreign signing key without a live receipt', async () => {
    const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
    const foreignPair = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
    const persistence = new MemoryPersistence();
    let networkCalls = 0;
    let nonce = '';
    const adapter = new OidcFederatedIdentityAdapter({
      providerConfigurations: createResolver(),
      codeExchangeClient: {
        async exchange() {
          networkCalls += 1;
          return {
            accessToken: 'access-token-secret', idToken: signedIdToken({ privateKey: keyPair.privateKey, nonce }),
            tokenType: 'Bearer', scopes: ['openid'], expiresInSeconds: 3600
          };
        }
      },
      jwksResolver: { resolveSigningKey: async () => publicSigningJwk(foreignPair.publicKey) },
      tokenVault: new OidcTokenVault(new TestProtector(), persistence), clock: () => NOW
    });
    const first = adapter.createAndStore({
      flowId: 'flow-forged-state', provider: 'google', configurationId: 'google-production-v1', accountId: ACCOUNT_ID,
      createdAt: asIsoDateTime(NOW), correlationId: CORRELATION_ID
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstUrl = new URL(first.value.authorizationUrl);
    nonce = firstUrl.searchParams.get('nonce') ?? '';
    const forged = await adapter.acceptAuthorizationCallback({
      flowId: 'flow-forged-state', linkId: 'link-forged', provider: 'google', accountId: ACCOUNT_ID,
      callbackUrl: `${CONFIGURATION.redirectUri}?code=authorization-code-2&state=forged-state-value`, correlationId: CORRELATION_ID
    });
    expect(forged.ok).toBe(false);
    expect(networkCalls).toBe(0);
    const replay = await adapter.acceptAuthorizationCallback({
      flowId: 'flow-forged-state', linkId: 'link-forged', provider: 'google', accountId: ACCOUNT_ID,
      callbackUrl: `${CONFIGURATION.redirectUri}?code=authorization-code-2&state=${encodeURIComponent(firstUrl.searchParams.get('state') ?? '')}`,
      correlationId: CORRELATION_ID
    });
    expect(replay.ok).toBe(false);
    expect(networkCalls).toBe(0);

    const second = adapter.createAndStore({
      flowId: 'flow-foreign-key', provider: 'google', configurationId: 'google-production-v1', accountId: ACCOUNT_ID,
      createdAt: asIsoDateTime(NOW), correlationId: CORRELATION_ID
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const secondUrl = new URL(second.value.authorizationUrl);
    nonce = secondUrl.searchParams.get('nonce') ?? '';
    const foreignKey = await adapter.acceptAuthorizationCallback({
      flowId: 'flow-foreign-key', linkId: 'link-foreign', provider: 'google', accountId: ACCOUNT_ID,
      callbackUrl: `${CONFIGURATION.redirectUri}?code=authorization-code-3&state=${encodeURIComponent(secondUrl.searchParams.get('state') ?? '')}`,
      correlationId: CORRELATION_ID
    });
    expect(foreignKey.ok).toBe(false);
    expect(networkCalls).toBe(1);
    expect(adapter.consumeVerifiedFlow({
      flowId: 'flow-foreign-key', expectedLinkId: 'link-foreign', provider: 'google', accountId: ACCOUNT_ID, correlationId: CORRELATION_ID
    }).ok).toBe(false);
    expect(persistence.serialized).not.toContain('access-token-secret');
  });
});
