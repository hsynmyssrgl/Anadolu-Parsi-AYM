import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify, type JsonWebKey } from 'node:crypto';

export type SupportedOidcProviderId = 'apple' | 'google' | 'microsoft';

export interface OidcProviderConfiguration {
  readonly providerId: SupportedOidcProviderId;
  readonly issuer: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly jwksUri: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
}

export interface OidcAuthorizationCeremony {
  readonly authorizationUrl: string;
  readonly stateSha256: string;
  readonly nonceSha256: string;
  readonly codeVerifier: string;
  readonly codeVerifierSha256: string;
  readonly codeChallenge: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface OidcAuthorizationCallback {
  readonly code: string;
  readonly stateSha256: string;
  readonly issuer?: string;
}

export interface VerifyOidcIdTokenInput {
  readonly idToken: string;
  readonly publicJwk: JsonWebKey & { readonly kid?: string };
  readonly expectedIssuer: string;
  readonly expectedClientId: string;
  readonly expectedNonceSha256: string;
  readonly observedAt: string;
  readonly maximumClockSkewSeconds?: number;
}

export interface VerifiedOidcIdentity {
  readonly issuer: string;
  readonly subjectSha256: string;
  readonly tokenClaimsSha256: string;
  readonly expiresAt: string;
  readonly signatureAlgorithm: 'RS256' | 'ES256';
  readonly networkDelivery: 'not_performed_by_verifier';
}

const sha256 = (value: Uint8Array | string): Buffer => createHash('sha256').update(value).digest();
const sha256Hex = (value: Uint8Array | string): string => sha256(value).toString('hex');
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object'
  && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const exactHash = (value: string, expectedSha256: string): boolean => {
  const actual = sha256(Buffer.from(value, 'utf8'));
  const expected = Buffer.from(expectedSha256, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
};

const canonicalBase64url = (value: string, label: string, maximumBytes: number): Buffer => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('=') || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(`${label} canonical base64url olmalidir.`);
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.length > maximumBytes || decoded.toString('base64url') !== value) {
    decoded.fill(0);
    throw new Error(`${label} gecersizdir.`);
  }
  return decoded;
};

const validatePublicJwk = (jwk: JsonWebKey, algorithm: 'RS256' | 'ES256'): void => {
  const record = jwk as Record<string, unknown>;
  const keyOperations = record.key_ops;
  if (['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'].some((key) => record[key] !== undefined)
    || (jwk.use !== undefined && jwk.use !== 'sig')
    || (keyOperations !== undefined && (!Array.isArray(keyOperations)
      || keyOperations.length !== 1 || keyOperations[0] !== 'verify'))
    || (jwk.alg !== undefined && jwk.alg !== algorithm)) {
    throw new Error('OIDC JWK public signature anahtari degildir.');
  }
  if (algorithm === 'RS256') {
    if (jwk.kty !== 'RSA' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') throw new Error('OIDC RS256 JWK gecersizdir.');
    const modulus = canonicalBase64url(jwk.n, 'OIDC RSA modulus', 512);
    const exponent = canonicalBase64url(jwk.e, 'OIDC RSA exponent', 8);
    try {
      if (modulus.length < 256 || (modulus[0] ?? 0) < 0x80 || (modulus[modulus.length - 1] ?? 0) % 2 === 0
        || !exponent.equals(Buffer.from([0x01, 0x00, 0x01]))) {
        throw new Error('OIDC RS256 modulus veya exponent politikaya uygun degildir.');
      }
    } finally { modulus.fill(0); exponent.fill(0); }
    return;
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('OIDC ES256 JWK gecersizdir.');
  }
  const x = canonicalBase64url(jwk.x, 'OIDC ES256 x', 32);
  const y = canonicalBase64url(jwk.y, 'OIDC ES256 y', 32);
  try { if (x.length !== 32 || y.length !== 32) throw new Error('OIDC ES256 koordinatlari gecersizdir.'); }
  finally { x.fill(0); y.fill(0); }
};

const validateHttpsUrl = (value: string, label: string): URL => {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error(`${label} URL degildir.`); }
  if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
    throw new Error(`${label} HTTPS ve kimlik-bilgisi icermeyen URL olmalidir.`);
  }
  return parsed;
};

const validateRedirectUri = (value: string): URL => {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('OIDC redirect URI gecersizdir.'); }
  const loopback = parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]' || parsed.hostname === 'localhost');
  const privateScheme = parsed.protocol === 'pardus-app:' && parsed.hostname === 'oidc';
  if ((!loopback && !privateScheme) || parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') {
    throw new Error('OIDC redirect URI yalniz loopback veya pardus-app://oidc olabilir.');
  }
  return parsed;
};

export const validateOidcProviderConfiguration = (configuration: OidcProviderConfiguration): void => {
  if (!['apple', 'google', 'microsoft'].includes(configuration.providerId)) throw new Error('OIDC provider desteklenmiyor.');
  const issuer = validateHttpsUrl(configuration.issuer, 'OIDC issuer');
  validateHttpsUrl(configuration.authorizationEndpoint, 'OIDC authorization endpoint');
  validateHttpsUrl(configuration.tokenEndpoint, 'OIDC token endpoint');
  validateHttpsUrl(configuration.jwksUri, 'OIDC JWKS URI');
  validateRedirectUri(configuration.redirectUri);
  if (issuer.search !== '' || issuer.pathname.endsWith('/') && issuer.pathname !== '/') throw new Error('OIDC issuer canonical degildir.');
  if (typeof configuration.clientId !== 'string' || configuration.clientId !== configuration.clientId.trim()
    || configuration.clientId.length < 3 || configuration.clientId.length > 512 || /[\u0000-\u001f\u007f]/u.test(configuration.clientId)) {
    throw new Error('OIDC clientId gecersizdir.');
  }
  const scopes = [...new Set(configuration.scopes)];
  if (scopes.length < 1 || scopes.length > 12 || !scopes.includes('openid')
    || scopes.some((scope) => !/^[A-Za-z0-9._:-]{1,64}$/u.test(scope))) throw new Error('OIDC scope kumesi gecersizdir.');
};

export const createOidcAuthorizationCeremony = (
  configuration: OidcProviderConfiguration,
  createdAt: string,
  ttlSeconds = 300
): OidcAuthorizationCeremony => {
  validateOidcProviderConfiguration(configuration);
  if (!validIso(createdAt) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 600) {
    throw new Error('OIDC ceremony zamani veya suresi gecersizdir.');
  }
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const codeVerifier = randomBytes(64).toString('base64url');
  const codeChallenge = sha256(Buffer.from(codeVerifier, 'ascii')).toString('base64url');
  const url = new URL(configuration.authorizationEndpoint);
  url.search = '';
  for (const [key, value] of [
    ['response_type', 'code'],
    ['client_id', configuration.clientId],
    ['redirect_uri', configuration.redirectUri],
    ['scope', [...new Set(configuration.scopes)].join(' ')],
    ['state', state],
    ['nonce', nonce],
    ['code_challenge', codeChallenge],
    ['code_challenge_method', 'S256']
  ] as const) url.searchParams.set(key, value);
  return Object.freeze({
    authorizationUrl: url.toString(),
    stateSha256: sha256Hex(state),
    nonceSha256: sha256Hex(nonce),
    codeVerifier,
    codeVerifierSha256: sha256Hex(codeVerifier),
    codeChallenge,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + ttlSeconds * 1000).toISOString()
  });
};

export const validateOidcAuthorizationCallback = (
  callbackUrl: string,
  expectedRedirectUri: string,
  expectedStateSha256: string
): OidcAuthorizationCallback => {
  if (!validSha256(expectedStateSha256)) throw new Error('OIDC state hash gecersizdir.');
  const expected = validateRedirectUri(expectedRedirectUri);
  let callback: URL;
  try { callback = new URL(callbackUrl); } catch { throw new Error('OIDC callback URL gecersizdir.'); }
  if (`${callback.protocol}//${callback.host}${callback.pathname}` !== `${expected.protocol}//${expected.host}${expected.pathname}`
    || callback.username !== '' || callback.password !== '' || callback.hash !== '') throw new Error('OIDC callback redirect URI eslesmedi.');
  const allowed = new Set(['code', 'state', 'iss', 'session_state', 'error', 'error_description']);
  const seen = new Set<string>();
  for (const key of callback.searchParams.keys()) {
    if (!allowed.has(key) || seen.has(key)) throw new Error('OIDC callback bilinmeyen veya yinelenen parametre iceriyor.');
    seen.add(key);
  }
  const error = callback.searchParams.get('error');
  const code = callback.searchParams.get('code');
  if ((error === null) === (code === null)) throw new Error('OIDC callback exact success veya error sonucu tasimalidir.');
  if (error !== null) throw new Error(`OIDC provider callback reddedildi: ${error.slice(0, 64)}`);
  const state = callback.searchParams.get('state');
  if (code === null || state === null || code.length < 8 || code.length > 4096 || /[\u0000-\u0020\u007f]/u.test(code)
    || !exactHash(state, expectedStateSha256)) throw new Error('OIDC callback code/state gecersizdir.');
  const issuer = callback.searchParams.get('iss') ?? undefined;
  if (issuer !== undefined) validateHttpsUrl(issuer, 'OIDC callback issuer');
  return Object.freeze({ code, stateSha256: sha256Hex(state), ...(issuer === undefined ? {} : { issuer }) });
};

const audienceIncludes = (value: unknown, expected: string): boolean => typeof value === 'string'
  ? value === expected
  : Array.isArray(value) && value.length > 0 && value.length <= 8 && value.every((item) => typeof item === 'string') && value.includes(expected);

export const verifyOidcIdToken = (input: VerifyOidcIdTokenInput): VerifiedOidcIdentity => {
  if (typeof input.idToken !== 'string' || input.idToken.length > 32 * 1024 || !validSha256(input.expectedNonceSha256)
    || !validIso(input.observedAt) || typeof input.expectedClientId !== 'string' || input.expectedClientId.length < 3) {
    throw new Error('OIDC ID token dogrulama girdisi gecersizdir.');
  }
  validateHttpsUrl(input.expectedIssuer, 'OIDC expected issuer');
  const parts = input.idToken.split('.');
  if (parts.length !== 3) throw new Error('OIDC ID token compact JWT degildir.');
  const headerBytes = canonicalBase64url(parts[0] ?? '', 'OIDC JWT header', 4096);
  const payloadBytes = canonicalBase64url(parts[1] ?? '', 'OIDC JWT payload', 24 * 1024);
  const signature = canonicalBase64url(parts[2] ?? '', 'OIDC JWT signature', 4096);
  try {
    let headerValue: unknown;
    let claimsValue: unknown;
    try {
      headerValue = JSON.parse(headerBytes.toString('utf8'));
      claimsValue = JSON.parse(payloadBytes.toString('utf8'));
    } catch { throw new Error('OIDC JWT JSON gecersizdir.'); }
    if (!isPlainRecord(headerValue) || !isPlainRecord(claimsValue)) throw new Error('OIDC JWT nesneleri gecersizdir.');
    const alg = headerValue.alg;
    if ((alg !== 'RS256' && alg !== 'ES256') || (headerValue.typ !== undefined && headerValue.typ !== 'JWT')
      || typeof headerValue.kid !== 'string' || headerValue.kid.length < 1 || headerValue.kid.length > 256
      || typeof input.publicJwk.kid !== 'string' || headerValue.kid !== input.publicJwk.kid) throw new Error('OIDC JWT header gecersizdir.');
    validatePublicJwk(input.publicJwk, alg);
    const key = createPublicKey({ key: input.publicJwk, format: 'jwk' });
    if ((alg === 'RS256' && key.asymmetricKeyType !== 'rsa') || (alg === 'ES256' && key.asymmetricKeyType !== 'ec')) {
      throw new Error('OIDC JWT key algoritmasi eslesmedi.');
    }
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii');
    const verified = alg === 'ES256'
      ? verify('sha256', signingInput, { key, dsaEncoding: 'ieee-p1363' }, signature)
      : verify('sha256', signingInput, key, signature);
    if (!verified) throw new Error('OIDC ID token imzasi gecersizdir.');
    const issuer = claimsValue.iss;
    const subject = claimsValue.sub;
    const nonce = claimsValue.nonce;
    const expiration = claimsValue.exp;
    const issuedAt = claimsValue.iat;
    if (issuer !== input.expectedIssuer || typeof subject !== 'string' || subject.length < 1 || subject.length > 512
      || typeof nonce !== 'string' || !exactHash(nonce, input.expectedNonceSha256)
      || !audienceIncludes(claimsValue.aud, input.expectedClientId)
      || typeof expiration !== 'number' || !Number.isSafeInteger(expiration)
      || typeof issuedAt !== 'number' || !Number.isSafeInteger(issuedAt)) throw new Error('OIDC ID token claims eslesmedi.');
    if (Array.isArray(claimsValue.aud) && claimsValue.aud.length > 1 && claimsValue.azp !== input.expectedClientId) {
      throw new Error('OIDC ID token azp eslesmedi.');
    }
    const observedSeconds = Math.floor(Date.parse(input.observedAt) / 1000);
    const skew = input.maximumClockSkewSeconds ?? 120;
    if (!Number.isSafeInteger(skew) || skew < 0 || skew > 300 || expiration <= observedSeconds - skew || issuedAt > observedSeconds + skew) {
      throw new Error('OIDC ID token zaman penceresi gecersizdir.');
    }
    return Object.freeze({
      issuer,
      subjectSha256: sha256Hex(`${issuer}\u0000${subject}`),
      tokenClaimsSha256: sha256Hex(payloadBytes),
      expiresAt: new Date(expiration * 1000).toISOString(),
      signatureAlgorithm: alg,
      networkDelivery: 'not_performed_by_verifier'
    });
  } finally {
    headerBytes.fill(0);
    payloadBytes.fill(0);
    signature.fill(0);
  }
};
