import { createHash, type JsonWebKey } from 'node:crypto';
import type {
  FederatedAuthorizationCeremonyPort,
  FederatedAuthorizationCodeVerifierPort,
  VerifiedFederatedIdentityLink
} from '@ppt/application';
import {
  asIsoDateTime,
  createAppError,
  err,
  ERROR_CODES,
  ok,
  type AppError,
  type CorrelationId,
  type Result,
  type UserId
} from '@ppt/core';
import type { FederatedAuthorizationCeremonyView, FederatedIdentityProvider } from '@ppt/domain';
import {
  createOidcAuthorizationCeremony,
  validateOidcAuthorizationCallback,
  validateOidcProviderConfiguration,
  verifyOidcIdToken,
  type OidcProviderConfiguration,
  type SupportedOidcProviderId
} from '@ppt/security';
import {
  OidcTokenVault,
  type OidcTokenSet,
  type OidcTokenVaultBinding
} from './oidc-token-vault.js';

const MAX_COMPLETION_TTL_MS = 5 * 60 * 1000;
const MAX_EXCHANGE_TTL_SECONDS = 24 * 60 * 60;
const MAX_JWT_HEADER_BYTES = 4 * 1024;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{1,255}$/u;
const TOKEN = /^[^\u0000-\u0020\u007f]{8,32768}$/u;

export interface TrustedOidcProviderRegistration {
  readonly configurationId: string;
  readonly configuration: OidcProviderConfiguration;
  readonly clientAuthenticationMode: 'public_pkce';
  readonly clientConfigurationSha256: string;
}

export interface TrustedOidcProviderConfigurationResolver {
  resolve(provider: SupportedOidcProviderId, configurationId: string): TrustedOidcProviderRegistration | null;
  listConfigured(): readonly TrustedOidcProviderRegistration[];
}

export interface OidcAuthorizationCodeExchangeInput {
  readonly provider: SupportedOidcProviderId;
  readonly configurationId: string;
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly authorizationCode: string;
  readonly codeVerifier: string;
  readonly correlationId: CorrelationId;
}

export interface OidcAuthorizationCodeExchangeResponse {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken?: string;
  readonly tokenType: 'Bearer';
  readonly scopes: readonly string[];
  readonly expiresInSeconds: number;
}

export interface OidcAuthorizationCodeExchangeClient {
  exchange(input: OidcAuthorizationCodeExchangeInput): Promise<OidcAuthorizationCodeExchangeResponse>;
}

export interface TrustedOidcJwksResolverInput {
  readonly provider: SupportedOidcProviderId;
  readonly configurationId: string;
  readonly issuer: string;
  readonly jwksUri: string;
  readonly keyId: string;
  readonly algorithm: 'RS256' | 'ES256';
  readonly correlationId: CorrelationId;
}

export interface TrustedOidcJwksResolver {
  resolveSigningKey(input: TrustedOidcJwksResolverInput): Promise<(JsonWebKey & { readonly kid: string }) | null>;
}

export interface OidcAuthorizationCallbackInput {
  readonly flowId: string;
  readonly linkId: string;
  readonly provider: FederatedIdentityProvider;
  readonly accountId: UserId;
  readonly callbackUrl: string;
  readonly correlationId: CorrelationId;
}

export interface VerifiedOidcAuthorizationCallbackReceipt {
  readonly flowId: string;
  readonly provider: FederatedIdentityProvider;
  readonly encryptedVaultEntryId: string;
  readonly completedAt: string;
  readonly liveAccountTested: true;
  readonly authorizationCodePkceVerified: true;
  readonly stateVerified: true;
  readonly nonceVerified: true;
  readonly tokenBytesExposed: false;
  readonly tokenStoredInEncryptedVault: true;
  readonly providerAvailabilityGuaranteed: false;
  readonly providerDeliveryGuaranteed: false;
  readonly networkAvailabilityGuaranteed: false;
  readonly networkDeliveryGuaranteed: false;
}

export interface VisibleConfiguredOidcProvider {
  readonly provider: FederatedIdentityProvider;
  readonly configurationId: string;
  readonly providerAvailabilityGuaranteed: false;
  readonly providerDeliveryGuaranteed: false;
  readonly networkAvailabilityGuaranteed: false;
  readonly networkDeliveryGuaranteed: false;
}

export interface OidcFederatedIdentityAdapterOptions {
  readonly providerConfigurations: TrustedOidcProviderConfigurationResolver;
  readonly codeExchangeClient: OidcAuthorizationCodeExchangeClient;
  readonly jwksResolver: TrustedOidcJwksResolver;
  readonly tokenVault: OidcTokenVault;
  readonly clock?: () => string;
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;

const validIdentifier = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && IDENTIFIER.test(value);

const cloneConfiguration = (configuration: OidcProviderConfiguration): OidcProviderConfiguration => Object.freeze({
  ...configuration,
  scopes: Object.freeze([...configuration.scopes])
});

const canonicalConfiguration = (configuration: OidcProviderConfiguration): string => JSON.stringify([
  configuration.providerId,
  configuration.issuer,
  configuration.authorizationEndpoint,
  configuration.tokenEndpoint,
  configuration.jwksUri,
  configuration.clientId,
  configuration.redirectUri,
  [...configuration.scopes]
]);

const failure = <T>(correlationId: CorrelationId): Result<T, AppError> => err(createAppError({
  code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  message: 'Federated kimlik dogrulamasi tamamlanamadi.',
  category: 'security',
  correlationId
}));

const normalizeScopes = (
  scopes: readonly string[],
  configuredScopes: readonly string[]
): readonly string[] => {
  const normalized = [...new Set(scopes)].sort();
  const configured = new Set(configuredScopes);
  if (normalized.length < 1 || normalized.length > 12 || !normalized.includes('openid')
    || normalized.some((scope) => !/^[A-Za-z0-9._:-]{1,64}$/u.test(scope) || !configured.has(scope))) {
    throw new Error('OIDC exchange scope kumesi trusted configuration ile eslesmedi.');
  }
  return Object.freeze(normalized);
};

const readJwtKeySelector = (idToken: string): { readonly keyId: string; readonly algorithm: 'RS256' | 'ES256' } => {
  if (!TOKEN.test(idToken)) throw new Error('OIDC ID token siniri gecersizdir.');
  const parts = idToken.split('.');
  const encoded = parts.length === 3 ? parts[0] : undefined;
  if (!encoded || encoded.includes('=') || !/^[A-Za-z0-9_-]+$/u.test(encoded)) throw new Error('OIDC JWT header canonical degildir.');
  const bytes = Buffer.from(encoded, 'base64url');
  try {
    if (bytes.length < 2 || bytes.length > MAX_JWT_HEADER_BYTES || bytes.toString('base64url') !== encoded) {
      throw new Error('OIDC JWT header boyutu gecersizdir.');
    }
    let value: unknown;
    try { value = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('OIDC JWT header JSON degildir.'); }
    if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error('OIDC JWT header nesnesi gecersizdir.');
    }
    const header = value as Record<string, unknown>;
    if ((header.alg !== 'RS256' && header.alg !== 'ES256') || typeof header.kid !== 'string'
      || header.kid.length < 1 || header.kid.length > 256 || /[\u0000-\u001f\u007f]/u.test(header.kid)) {
      throw new Error('OIDC JWT key selector gecersizdir.');
    }
    return Object.freeze({ keyId: header.kid, algorithm: header.alg });
  } finally { bytes.fill(0); }
};

const validateExchange = (
  value: OidcAuthorizationCodeExchangeResponse,
  configuredScopes: readonly string[]
): { readonly tokenType: 'Bearer'; readonly accessToken: string; readonly idToken: string; readonly refreshToken?: string; readonly scopes: readonly string[]; readonly expiresInSeconds: number } => {
  if (!value || typeof value !== 'object' || value.tokenType !== 'Bearer'
    || !TOKEN.test(value.accessToken) || !TOKEN.test(value.idToken)
    || (value.refreshToken !== undefined && !TOKEN.test(value.refreshToken))
    || !Array.isArray(value.scopes) || !Number.isSafeInteger(value.expiresInSeconds)
    || value.expiresInSeconds < 1 || value.expiresInSeconds > MAX_EXCHANGE_TTL_SECONDS) {
    throw new Error('OIDC token exchange cevabi gecersizdir.');
  }
  return Object.freeze({
    accessToken: value.accessToken,
    idToken: value.idToken,
    ...(value.refreshToken === undefined ? {} : { refreshToken: value.refreshToken }),
    tokenType: 'Bearer',
    scopes: normalizeScopes(value.scopes, configuredScopes),
    expiresInSeconds: value.expiresInSeconds
  });
};

export class StaticTrustedOidcProviderConfigurationResolver implements TrustedOidcProviderConfigurationResolver {
  readonly #entries: readonly TrustedOidcProviderRegistration[];

  public constructor(entries: readonly TrustedOidcProviderRegistration[]) {
    if (entries.length > 16) throw new Error('OIDC trusted configuration kotasi gecersizdir.');
    const keys = new Set<string>();
    this.#entries = Object.freeze(entries.map((entry) => {
      if (!validIdentifier(entry.configurationId) || entry.clientAuthenticationMode !== 'public_pkce'
        || !/^[0-9a-f]{64}$/u.test(entry.clientConfigurationSha256)) {
        throw new Error('OIDC trusted configuration kimligi veya network bindingi gecersizdir.');
      }
      validateOidcProviderConfiguration(entry.configuration);
      const key = `${entry.configuration.providerId}\u0000${entry.configurationId}`;
      if (keys.has(key)) throw new Error('OIDC trusted configuration duplicate kaydidir.');
      keys.add(key);
      return Object.freeze({ configurationId: entry.configurationId, configuration: cloneConfiguration(entry.configuration),
        clientAuthenticationMode: entry.clientAuthenticationMode, clientConfigurationSha256: entry.clientConfigurationSha256 });
    }));
  }

  public resolve(provider: SupportedOidcProviderId, configurationId: string): TrustedOidcProviderRegistration | null {
    const entry = this.#entries.find((candidate) => candidate.configuration.providerId === provider
      && candidate.configurationId === configurationId);
    return entry ?? null;
  }

  public listConfigured(): readonly TrustedOidcProviderRegistration[] {
    return this.#entries;
  }
}

export class OidcFederatedIdentityAdapter implements FederatedAuthorizationCeremonyPort, FederatedAuthorizationCodeVerifierPort {
  readonly #options: OidcFederatedIdentityAdapterOptions;
  readonly #clock: () => string;

  public constructor(options: OidcFederatedIdentityAdapterOptions) {
    this.#options = options;
    this.#clock = options.clock ?? (() => new Date().toISOString());
  }

  public listVisibleConfiguredProviders(): readonly VisibleConfiguredOidcProvider[] {
    const visible: VisibleConfiguredOidcProvider[] = [];
    try {
      for (const entry of this.#options.providerConfigurations.listConfigured()) {
        if (!validIdentifier(entry.configurationId)) continue;
        validateOidcProviderConfiguration(entry.configuration);
        const exact = this.#options.providerConfigurations.resolve(entry.configuration.providerId, entry.configurationId);
        if (!exact || exact.configurationId !== entry.configurationId
        || exact.clientAuthenticationMode !== 'public_pkce'
        || exact.clientConfigurationSha256 !== entry.clientConfigurationSha256
        || canonicalConfiguration(exact.configuration) !== canonicalConfiguration(entry.configuration)) continue;
        visible.push(Object.freeze({
          provider: entry.configuration.providerId,
          configurationId: entry.configurationId,
          providerAvailabilityGuaranteed: false,
          providerDeliveryGuaranteed: false,
          networkAvailabilityGuaranteed: false,
          networkDeliveryGuaranteed: false
        }));
      }
    } catch { return Object.freeze([]); }
    return Object.freeze(visible);
  }

  public createAndStore(input: Parameters<FederatedAuthorizationCeremonyPort['createAndStore']>[0]): Result<FederatedAuthorizationCeremonyView, AppError> {
    try {
      const observedAt = this.#clock();
      if (!validIdentifier(input.flowId) || !validIdentifier(String(input.accountId)) || !validIdentifier(input.configurationId)
        || !validIso(input.createdAt) || !validIso(observedAt)
        || Math.abs(Date.parse(input.createdAt) - Date.parse(observedAt)) > 60_000) return failure(input.correlationId);
      const registration = this.#options.providerConfigurations.resolve(input.provider, input.configurationId);
      if (!registration || registration.configurationId !== input.configurationId
        || registration.configuration.providerId !== input.provider) return failure(input.correlationId);
      validateOidcProviderConfiguration(registration.configuration);
      const ceremony = createOidcAuthorizationCeremony(registration.configuration, input.createdAt);
      if (ceremony.authorizationUrl.length > 2_048 || new URL(ceremony.authorizationUrl).protocol !== 'https:') {
        return failure(input.correlationId);
      }
      const binding: OidcTokenVaultBinding = Object.freeze({
        accountId: String(input.accountId),
        providerId: input.provider,
        linkId: input.flowId,
        flowId: input.flowId
      });
      this.#options.tokenVault.storeAuthorizationFlow(binding, Object.freeze({
        configurationId: registration.configurationId,
        configuration: cloneConfiguration(registration.configuration),
        stateSha256: ceremony.stateSha256,
        nonceSha256: ceremony.nonceSha256,
        codeVerifier: ceremony.codeVerifier,
        codeVerifierSha256: ceremony.codeVerifierSha256,
        createdAt: ceremony.createdAt,
        expiresAt: ceremony.expiresAt
      }), observedAt);
      return ok(Object.freeze({
        flowId: input.flowId,
        provider: input.provider,
        authorizationUrl: ceremony.authorizationUrl,
        expiresAt: asIsoDateTime(ceremony.expiresAt),
        responseType: 'code',
        pkceMethod: 'S256',
        stateBound: true,
        nonceBound: true,
        codeVerifierStoredInEncryptedVault: true,
        codeVerifierExposed: false,
        tokenBytesExposed: false,
        providerAvailabilityGuaranteed: false,
        providerDeliveryGuaranteed: false
      }));
    } catch { return failure(input.correlationId); }
  }

  public discardCeremony(flowId: string): void {
    try { this.#options.tokenVault.discardAuthorizationFlow(flowId, this.#clock()); } catch { /* fail-closed idempotent cleanup */ }
  }

  public async acceptAuthorizationCallback(input: OidcAuthorizationCallbackInput): Promise<Result<VerifiedOidcAuthorizationCallbackReceipt, AppError>> {
    let tokenEntryId: string | undefined;
    try {
      const observedAt = this.#clock();
      if (!validIso(observedAt) || !validIdentifier(input.flowId) || !validIdentifier(input.linkId)
        || !validIdentifier(String(input.accountId)) || typeof input.callbackUrl !== 'string'
        || input.callbackUrl.length < 8 || input.callbackUrl.length > 8192) return failure(input.correlationId);
      const stored = this.#options.tokenVault.takeAuthorizationFlow({
        flowId: input.flowId,
        accountId: String(input.accountId),
        observedAt
      });
      if (!stored || stored.binding.providerId !== input.provider || stored.binding.flowId !== input.flowId) {
        return failure(input.correlationId);
      }
      const registration = this.#options.providerConfigurations.resolve(stored.binding.providerId, stored.secret.configurationId);
      if (!registration || registration.configurationId !== stored.secret.configurationId
        || registration.configuration.providerId !== stored.binding.providerId
        || canonicalConfiguration(registration.configuration) !== canonicalConfiguration(stored.secret.configuration)) {
        return failure(input.correlationId);
      }
      const callback = validateOidcAuthorizationCallback(
        input.callbackUrl,
        registration.configuration.redirectUri,
        stored.secret.stateSha256
      );
      if (callback.issuer !== undefined && callback.issuer !== registration.configuration.issuer) return failure(input.correlationId);
      if (sha256(stored.secret.codeVerifier) !== stored.secret.codeVerifierSha256) return failure(input.correlationId);
      const exchanged = validateExchange(await this.#options.codeExchangeClient.exchange(Object.freeze({
        provider: stored.binding.providerId,
        configurationId: registration.configurationId,
        tokenEndpoint: registration.configuration.tokenEndpoint,
        clientId: registration.configuration.clientId,
        redirectUri: registration.configuration.redirectUri,
        authorizationCode: callback.code,
        codeVerifier: stored.secret.codeVerifier,
        correlationId: input.correlationId
      })), registration.configuration.scopes);
      const selector = readJwtKeySelector(exchanged.idToken);
      const publicJwk = await this.#options.jwksResolver.resolveSigningKey(Object.freeze({
        provider: stored.binding.providerId,
        configurationId: registration.configurationId,
        issuer: registration.configuration.issuer,
        jwksUri: registration.configuration.jwksUri,
        keyId: selector.keyId,
        algorithm: selector.algorithm,
        correlationId: input.correlationId
      }));
      if (!publicJwk || publicJwk.kid !== selector.keyId) return failure(input.correlationId);
      const identity = verifyOidcIdToken({
        idToken: exchanged.idToken,
        publicJwk,
        expectedIssuer: registration.configuration.issuer,
        expectedClientId: registration.configuration.clientId,
        expectedNonceSha256: stored.secret.nonceSha256,
        observedAt
      });
      const exchangeExpiresAt = new Date(Date.parse(observedAt) + exchanged.expiresInSeconds * 1000).toISOString();
      const expiresAt = new Date(Math.min(Date.parse(exchangeExpiresAt), Date.parse(identity.expiresAt))).toISOString();
      if (Date.parse(expiresAt) <= Date.parse(observedAt)) return failure(input.correlationId);
      const binding: OidcTokenVaultBinding = Object.freeze({
        accountId: String(input.accountId),
        providerId: stored.binding.providerId,
        linkId: input.linkId,
        flowId: input.flowId
      });
      const tokenSet: OidcTokenSet = Object.freeze({
        accessToken: exchanged.accessToken,
        idToken: exchanged.idToken,
        ...(exchanged.refreshToken === undefined ? {} : { refreshToken: exchanged.refreshToken }),
        tokenType: 'Bearer',
        scopes: exchanged.scopes,
        issuedAt: observedAt,
        expiresAt
      });
      tokenEntryId = this.#options.tokenVault.putToken(binding, tokenSet, observedAt);
      const completionExpiry = new Date(Math.min(Date.parse(expiresAt), Date.parse(observedAt) + MAX_COMPLETION_TTL_MS)).toISOString();
      this.#options.tokenVault.storeCompletedFlow(Object.freeze({
        binding,
        configurationId: registration.configurationId,
        authorizationEndpointSha256: sha256(registration.configuration.authorizationEndpoint),
        clientConfigurationSha256: registration.clientConfigurationSha256,
        providerSubjectSha256: identity.subjectSha256,
        grantedScopes: exchanged.scopes,
        encryptedVaultEntryId: tokenEntryId,
        completedAt: observedAt,
        expiresAt: completionExpiry
      }), observedAt);
      return ok(Object.freeze({
        flowId: input.flowId,
        provider: input.provider,
        encryptedVaultEntryId: tokenEntryId,
        completedAt: observedAt,
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
      }));
    } catch {
      if (tokenEntryId !== undefined) {
        try { this.#options.tokenVault.revokeToken(tokenEntryId, this.#clock()); } catch { /* fail-closed tombstone is best effort after failed completion */ }
      }
      return failure(input.correlationId);
    }
  }

  public consumeVerifiedFlow(input: Parameters<FederatedAuthorizationCodeVerifierPort['consumeVerifiedFlow']>[0]): Result<VerifiedFederatedIdentityLink, AppError> {
    try {
      const observedAt = this.#clock();
      if (!validIso(observedAt)) return failure(input.correlationId);
      const completed = this.#options.tokenVault.takeCompletedFlow({
        flowId: input.flowId,
        expectedLinkId: input.expectedLinkId,
        providerId: input.provider,
        accountId: String(input.accountId),
        observedAt
      });
      if (!completed) return failure(input.correlationId);
      return ok(Object.freeze({
        provider: completed.binding.providerId,
        configurationId: completed.configurationId,
        authorizationEndpointSha256: completed.authorizationEndpointSha256,
        clientConfigurationSha256: completed.clientConfigurationSha256,
        providerSubjectSha256: completed.providerSubjectSha256,
        grantedScopes: completed.grantedScopes,
        encryptedVaultEntryId: completed.encryptedVaultEntryId,
        liveAccountTested: true,
        authorizationCodePkceVerified: true,
        stateVerified: true,
        nonceVerified: true
      }));
    } catch { return failure(input.correlationId); }
  }

  public discardVaultEntry(encryptedVaultEntryId: string): void {
    try { this.#options.tokenVault.revokeToken(encryptedVaultEntryId, this.#clock()); } catch { /* fail-closed idempotent cleanup */ }
  }
}
