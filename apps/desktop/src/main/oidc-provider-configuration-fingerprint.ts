import { createHash } from 'node:crypto';
import type { NetworkEgressPin } from '@ppt/platform-policy';
import { validateOidcProviderConfiguration, type OidcProviderConfiguration } from '@ppt/security';

const SHA256 = /^[0-9a-f]{64}$/u;

export type OidcClientAuthenticationMode = 'public_pkce' | 'private_key_jwt';

export interface OidcClientConfigurationFingerprintInput {
  readonly configuration: OidcProviderConfiguration;
  readonly clientAuthenticationMode: OidcClientAuthenticationMode;
  readonly tokenEndpointPins: readonly NetworkEgressPin[];
  readonly jwksEndpointPins: readonly NetworkEgressPin[];
}

const canonicalPins = (value: readonly NetworkEgressPin[], label: string): readonly [string, string] => {
  if (!Array.isArray(value) || value.length !== 2
    || value[0]?.kind !== 'primary' || value[1]?.kind !== 'secondary'
    || !SHA256.test(value[0].sha256) || !SHA256.test(value[1].sha256)
    || value[0].sha256 === value[1].sha256) {
    throw new Error(`OIDC ${label} primary/secondary SPKI pin seti gecersizdir.`);
  }
  return Object.freeze([value[0].sha256, value[1].sha256]);
};

/**
 * Single canonical authority for the persisted OIDC client configuration binding.
 * Pin rotation intentionally changes the hash and invalidates links bound to the old profile.
 */
export const canonicalOidcClientConfiguration = (input: OidcClientConfigurationFingerprintInput): string => {
  validateOidcProviderConfiguration(input.configuration);
  if (input.clientAuthenticationMode !== 'public_pkce' && input.clientAuthenticationMode !== 'private_key_jwt') {
    throw new Error('OIDC client authentication mode gecersizdir.');
  }
  return JSON.stringify([
    'oidc-client-configuration-v2',
    input.configuration.providerId,
    input.configuration.issuer,
    input.configuration.authorizationEndpoint,
    input.configuration.tokenEndpoint,
    input.configuration.jwksUri,
    input.configuration.clientId,
    input.configuration.redirectUri,
    [...input.configuration.scopes],
    input.clientAuthenticationMode,
    canonicalPins(input.tokenEndpointPins, 'token endpoint'),
    canonicalPins(input.jwksEndpointPins, 'JWKS endpoint')
  ]);
};

export const oidcClientConfigurationSha256 = (input: OidcClientConfigurationFingerprintInput): string =>
  createHash('sha256').update(canonicalOidcClientConfiguration(input), 'utf8').digest('hex');
