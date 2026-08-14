import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createOidcAuthorizationCeremony,
  validateOidcAuthorizationCallback,
  verifyOidcIdToken,
  type OidcProviderConfiguration
} from '../src/oidc-pkce.js';

const configuration: OidcProviderConfiguration = {
  providerId: 'google',
  issuer: 'https://accounts.example.test',
  authorizationEndpoint: 'https://accounts.example.test/authorize',
  tokenEndpoint: 'https://accounts.example.test/token',
  jwksUri: 'https://accounts.example.test/jwks',
  clientId: 'client-33-p',
  redirectUri: 'pardus-app://oidc/callback',
  scopes: ['openid', 'profile']
};

const jwtFixture = (nonce: string, expiresAt = 1_776_400_000) => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'key-1', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: configuration.issuer,
    aud: configuration.clientId,
    sub: 'provider-subject-1',
    nonce,
    iat: 1_776_300_000,
    exp: expiresAt
  })).toString('base64url');
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`, 'ascii'), pair.privateKey).toString('base64url');
  return { token: `${header}.${claims}.${signature}`, jwk: { ...jwk, kid: 'key-1' } };
};

describe('OIDC Authorization Code + PKCE boundary', () => {
  it('creates an exact S256/state/nonce authorization ceremony', () => {
    const ceremony = createOidcAuthorizationCeremony(configuration, '2026-04-16T06:00:00.000Z');
    const url = new URL(ceremony.authorizationUrl);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: configuration.clientId,
      redirect_uri: configuration.redirectUri,
      code_challenge_method: 'S256'
    });
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(ceremony.codeVerifier).digest('base64url'));
    expect(ceremony.codeVerifier).not.toBe(url.searchParams.get('code_challenge'));
  });

  it('validates exact redirect and state and rejects replay/unknown fields', () => {
    const ceremony = createOidcAuthorizationCeremony(configuration, '2026-04-16T06:00:00.000Z');
    const state = new URL(ceremony.authorizationUrl).searchParams.get('state')!;
    expect(validateOidcAuthorizationCallback(`${configuration.redirectUri}?code=authorization-code-1&state=${state}`, configuration.redirectUri, ceremony.stateSha256))
      .toMatchObject({ stateSha256: ceremony.stateSha256 });
    expect(() => validateOidcAuthorizationCallback(`${configuration.redirectUri}?code=authorization-code-1&state=forged`, configuration.redirectUri, ceremony.stateSha256))
      .toThrow(/code\/state/u);
    expect(() => validateOidcAuthorizationCallback(`${configuration.redirectUri}?code=authorization-code-1&state=${state}&token=secret`, configuration.redirectUri, ceremony.stateSha256))
      .toThrow(/bilinmeyen/u);
    expect(() => validateOidcAuthorizationCallback(`${configuration.redirectUri}?code=authorization-code-1&state=${state}&state=${state}`, configuration.redirectUri, ceremony.stateSha256))
      .toThrow(/yinelenen/u);
    expect(() => validateOidcAuthorizationCallback(`${configuration.redirectUri}?code=authorization-code-1&error=denied&state=${state}`, configuration.redirectUri, ceremony.stateSha256))
      .toThrow(/exact success/u);
  });

  it('verifies signature, issuer, audience, nonce and time without exposing subject', () => {
    const nonce = 'nonce-33-p';
    const token = jwtFixture(nonce);
    expect(verifyOidcIdToken({
      idToken: token.token,
      publicJwk: token.jwk,
      expectedIssuer: configuration.issuer,
      expectedClientId: configuration.clientId,
      expectedNonceSha256: createHash('sha256').update(nonce).digest('hex'),
      observedAt: '2026-04-16T06:00:00.000Z'
    })).toMatchObject({ signatureAlgorithm: 'RS256', networkDelivery: 'not_performed_by_verifier' });
  });

  it('rejects nonce mismatch, tamper and expired tokens', () => {
    const nonce = 'nonce-33-p';
    const token = jwtFixture(nonce);
    const common = {
      idToken: token.token,
      publicJwk: token.jwk,
      expectedIssuer: configuration.issuer,
      expectedClientId: configuration.clientId,
      observedAt: '2026-04-16T06:00:00.000Z'
    };
    expect(() => verifyOidcIdToken({ ...common, expectedNonceSha256: createHash('sha256').update('forged').digest('hex') })).toThrow(/claims/u);
    const [header, claims, encodedSignature] = token.token.split('.');
    const tamperedSignature = Buffer.from(encodedSignature!, 'base64url');
    tamperedSignature[0] = tamperedSignature[0]! ^ 0x01;
    const tamperedToken = `${header}.${claims}.${tamperedSignature.toString('base64url')}`;
    tamperedSignature.fill(0);
    expect(() => verifyOidcIdToken({ ...common, idToken: tamperedToken, expectedNonceSha256: createHash('sha256').update(nonce).digest('hex') })).toThrow(/imzasi/u);
    const expired = jwtFixture(nonce, 1_000);
    expect(() => verifyOidcIdToken({ ...common, idToken: expired.token, publicJwk: expired.jwk, expectedNonceSha256: createHash('sha256').update(nonce).digest('hex') }))
      .toThrow(/zaman/u);
  });

  it('rejects weak RSA exponents and private JWK material before signature evaluation', () => {
    const nonce = 'nonce-33-p';
    const token = jwtFixture(nonce);
    const common = {
      idToken: token.token,
      expectedIssuer: configuration.issuer,
      expectedClientId: configuration.clientId,
      expectedNonceSha256: createHash('sha256').update(nonce).digest('hex'),
      observedAt: '2026-04-16T06:00:00.000Z'
    };
    expect(() => verifyOidcIdToken({ ...common, publicJwk: { ...token.jwk, e: 'AQ' } })).toThrow(/modulus veya exponent/u);
    expect(() => verifyOidcIdToken({ ...common, publicJwk: { ...token.jwk, d: 'AQ' } })).toThrow(/public signature/u);
  });
});
