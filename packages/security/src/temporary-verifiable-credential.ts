import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const TEMPORARY_VERIFIABLE_CREDENTIAL_FORMAT = 'ppt-temporary-verifiable-credential' as const;
export const TEMPORARY_VERIFIABLE_CREDENTIAL_VERSION = 1 as const;
export const TEMPORARY_VERIFIABLE_CREDENTIAL_MAX_COMPACT_BYTES = 4096;
export const TEMPORARY_VERIFIABLE_CREDENTIAL_MAX_VALIDITY_MS = 31 * 24 * 60 * 60 * 1000;

export type TemporaryVerifiableCredentialKind =
  | 'school_pickup'
  | 'temporary_caregiver'
  | 'pet_caregiver'
  | 'emergency_contact_health'
  | 'event_invitation'
  | 'temporary_home_access';

export type TemporaryVerifiableCredentialPurpose =
  | 'school_pickup_authorization'
  | 'temporary_care_authorization'
  | 'pet_care_authorization'
  | 'emergency_contact_health_access'
  | 'event_invitation_access'
  | 'temporary_home_access';

const PURPOSE_BY_KIND: Readonly<Record<TemporaryVerifiableCredentialKind, TemporaryVerifiableCredentialPurpose>> = Object.freeze({
  school_pickup: 'school_pickup_authorization',
  temporary_caregiver: 'temporary_care_authorization',
  pet_caregiver: 'pet_care_authorization',
  emergency_contact_health: 'emergency_contact_health_access',
  event_invitation: 'event_invitation_access',
  temporary_home_access: 'temporary_home_access'
});

export interface TemporaryVerifiableCredentialPayload {
  readonly format: typeof TEMPORARY_VERIFIABLE_CREDENTIAL_FORMAT;
  readonly version: typeof TEMPORARY_VERIFIABLE_CREDENTIAL_VERSION;
  readonly credentialId: string;
  readonly kind: TemporaryVerifiableCredentialKind;
  readonly purpose: TemporaryVerifiableCredentialPurpose;
  readonly issuerKeyId: string;
  readonly issuerPublicKeySpkiBase64Url: string;
  readonly ownerRefSha256: string;
  readonly audienceRefSha256: string;
  readonly disclosureSha256: string;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly revocationSequence: number;
  readonly disclosedClaims: Readonly<Record<string, string>>;
}

export interface IssueTemporaryVerifiableCredentialInput {
  readonly credentialId: string;
  readonly kind: TemporaryVerifiableCredentialKind;
  readonly purpose: TemporaryVerifiableCredentialPurpose;
  readonly ownerRefSha256: string;
  readonly audienceRefSha256: string;
  readonly disclosureSha256: string;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly revocationSequence: number;
  readonly disclosedClaims: Readonly<Record<string, string>>;
  readonly allowedClaimCodes: readonly string[];
}

export interface IssuedTemporaryVerifiableCredential {
  readonly compact: string;
  readonly compactSha256: string;
  readonly compactSizeBytes: number;
  readonly issuerKeyId: string;
  readonly issuerPublicKeySha256: string;
  readonly signatureSha256: string;
  readonly disclosureSha256: string;
  readonly expiresAt: string;
  readonly disclosedClaimCodes: readonly string[];
  readonly networkDelivery: 'not_performed';
}

export interface VerifyTemporaryVerifiableCredentialInput {
  readonly compact: string;
  readonly expectedAudienceRefSha256: string;
  readonly observedAt: string;
  readonly locallyRevokedCredentialIds?: ReadonlySet<string>;
}

export interface VerifiedTemporaryVerifiableCredential {
  readonly verified: true;
  readonly credentialId: string;
  readonly kind: TemporaryVerifiableCredentialKind;
  readonly purpose: TemporaryVerifiableCredentialPurpose;
  readonly issuerKeyId: string;
  readonly issuerPublicKeySha256: string;
  readonly ownerRefSha256: string;
  readonly audienceRefSha256: string;
  readonly payloadSha256: string;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly disclosedClaims: Readonly<Record<string, string>>;
  readonly disclosedClaimCodes: readonly string[];
  readonly disclosureSha256: string;
  readonly signatureValid: true;
  readonly disclosureValid: true;
  readonly audienceMatched: boolean;
  readonly issuerIdentityCertified: false;
  readonly networkUsed: false;
  readonly notYetValid: boolean;
  readonly expired: boolean;
  readonly revocationFreshness: 'locally_observed_only';
  readonly networkDelivery: 'not_performed';
}

export interface TemporaryVerifiableCredentialSigner {
  readonly issuerPublicKeyPem: string;
  sign(payload: Uint8Array): Uint8Array;
}

const sha256Hex = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const validId = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim() && value.length >= 2 && value.length <= 160
  && !/[\u0000-\u001f\u007f\\/]/u.test(value);
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const validKind = (value: unknown): value is TemporaryVerifiableCredentialKind => [
  'school_pickup', 'temporary_caregiver', 'pet_caregiver', 'emergency_contact_health', 'event_invitation', 'temporary_home_access'
].includes(String(value));
const validPurpose = (value: unknown): value is TemporaryVerifiableCredentialPurpose => Object.values(PURPOSE_BY_KIND).includes(value as TemporaryVerifiableCredentialPurpose);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Dogrulanabilir kimlik JSON sayisi sonlu olmalidir.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!isPlainRecord(value)) throw new Error('Dogrulanabilir kimlik yalniz duz JSON degerleri icerebilir.');
  return `{${Object.keys(value).sort().map((key) => {
    if (/^(?:__proto__|prototype|constructor)$/u.test(key)) throw new Error('Dogrulanabilir kimlik JSON anahtari yasaktir.');
    return `${JSON.stringify(key)}:${canonicalJson(value[key])}`;
  }).join(',')}}`;
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

const issuerKeyId = (publicKey: ReturnType<typeof createPublicKey>): string =>
  sha256Hex(publicKey.export({ type: 'spki', format: 'der' }));

const validateClaims = (claims: unknown, allowedClaimCodes: readonly string[]): Readonly<Record<string, string>> => {
  if (!isPlainRecord(claims)) throw new Error('Aciklanan claim kumesi duz nesne olmalidir.');
  const allowed = [...new Set(allowedClaimCodes)].sort();
  if (allowed.length < 1 || allowed.length > 8 || allowed.some((code) => !/^[a-z][a-z0-9_]{1,47}$/u.test(code))) {
    throw new Error('Minimum aciklama claim politikasi gecersizdir.');
  }
  const actual = Object.keys(claims).sort();
  if (actual.length !== allowed.length || actual.some((code, index) => code !== allowed[index])) {
    throw new Error('Claim kumesi minimum aciklama politikasiyla birebir eslesmelidir.');
  }
  const result: Record<string, string> = {};
  for (const code of actual) {
    const value = claims[code];
    if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > 256
      || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`Claim degeri gecersiz: ${code}`);
    result[code] = value;
  }
  return Object.freeze(result);
};

const validateTimes = (issuedAt: string, notBefore: string, expiresAt: string): void => {
  if (!validIso(issuedAt) || !validIso(notBefore) || !validIso(expiresAt)) throw new Error('Kimlik zamanlari canonical ISO olmalidir.');
  const issued = Date.parse(issuedAt);
  const starts = Date.parse(notBefore);
  const expires = Date.parse(expiresAt);
  if (starts < issued || starts - issued > 24 * 60 * 60 * 1000 || expires <= starts
    || expires - starts > TEMPORARY_VERIFIABLE_CREDENTIAL_MAX_VALIDITY_MS) {
    throw new Error('Gecici kimlik zaman araligi gecersizdir.');
  }
};

const validatePayload = (payload: unknown): TemporaryVerifiableCredentialPayload => {
  if (!isPlainRecord(payload)) throw new Error('Dogrulanabilir kimlik payload nesne olmalidir.');
  const expected = [
    'format', 'version', 'credentialId', 'kind', 'purpose', 'issuerKeyId', 'issuerPublicKeySpkiBase64Url', 'ownerRefSha256', 'audienceRefSha256', 'disclosureSha256',
    'issuedAt', 'notBefore', 'expiresAt', 'nonce', 'revocationSequence', 'disclosedClaims'
  ].sort();
  const actual = Object.keys(payload).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error('Kimlik payload alanlari exact degildir.');
  if (payload.format !== TEMPORARY_VERIFIABLE_CREDENTIAL_FORMAT || payload.version !== TEMPORARY_VERIFIABLE_CREDENTIAL_VERSION
    || !validId(payload.credentialId) || !validKind(payload.kind) || !validPurpose(payload.purpose)
    || payload.purpose !== PURPOSE_BY_KIND[payload.kind] || !validSha256(payload.issuerKeyId)
    || typeof payload.issuerPublicKeySpkiBase64Url !== 'string'
    || !validSha256(payload.ownerRefSha256) || !validSha256(payload.audienceRefSha256) || !validSha256(payload.disclosureSha256)
    || typeof payload.nonce !== 'string' || !Number.isSafeInteger(payload.revocationSequence)
    || Number(payload.revocationSequence) < 0) throw new Error('Kimlik payload metadata gecersizdir.');
  const nonce = canonicalBase64url(payload.nonce, 'Kimlik nonce', 64);
  if (nonce.length < 16) { nonce.fill(0); throw new Error('Kimlik nonce en az 16 byte olmalidir.'); }
  nonce.fill(0);
  validateTimes(String(payload.issuedAt), String(payload.notBefore), String(payload.expiresAt));
  const claimCodes = isPlainRecord(payload.disclosedClaims) ? Object.keys(payload.disclosedClaims) : [];
  validateClaims(payload.disclosedClaims, claimCodes);
  return payload as unknown as TemporaryVerifiableCredentialPayload;
};

const issueWithSigner = (
  input: IssueTemporaryVerifiableCredentialInput,
  signer: TemporaryVerifiableCredentialSigner
): IssuedTemporaryVerifiableCredential => {
  if (!validId(input.credentialId) || !validKind(input.kind) || !validPurpose(input.purpose)
    || input.purpose !== PURPOSE_BY_KIND[input.kind] || !validSha256(input.ownerRefSha256)
    || !validSha256(input.audienceRefSha256) || !validSha256(input.disclosureSha256)
    || !Number.isSafeInteger(input.revocationSequence) || input.revocationSequence < 0) {
    throw new Error('Gecici kimlik metadata gecersizdir.');
  }
  validateTimes(input.issuedAt, input.notBefore, input.expiresAt);
  const nonce = canonicalBase64url(input.nonce, 'Kimlik nonce', 64);
  if (nonce.length < 16) { nonce.fill(0); throw new Error('Kimlik nonce en az 16 byte olmalidir.'); }
  nonce.fill(0);
  const claims = validateClaims(input.disclosedClaims, input.allowedClaimCodes);
  const publicKey = createPublicKey(signer.issuerPublicKeyPem);
  if (publicKey.type !== 'public' || publicKey.asymmetricKeyType !== 'ed25519') throw new Error('Kimlik issuer anahtari Ed25519 olmalidir.');
  const keyId = issuerKeyId(publicKey);
  const publicKeySpkiBase64Url = publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
  const payload: TemporaryVerifiableCredentialPayload = Object.freeze({
    format: TEMPORARY_VERIFIABLE_CREDENTIAL_FORMAT,
    version: TEMPORARY_VERIFIABLE_CREDENTIAL_VERSION,
    credentialId: input.credentialId,
    kind: input.kind,
    purpose: input.purpose,
    issuerKeyId: keyId,
    issuerPublicKeySpkiBase64Url: publicKeySpkiBase64Url,
    ownerRefSha256: input.ownerRefSha256,
    audienceRefSha256: input.audienceRefSha256,
    disclosureSha256: input.disclosureSha256,
    issuedAt: input.issuedAt,
    notBefore: input.notBefore,
    expiresAt: input.expiresAt,
    nonce: input.nonce,
    revocationSequence: input.revocationSequence,
    disclosedClaims: claims
  });
  const payloadBytes = Buffer.from(canonicalJson(payload), 'utf8');
  let signature: Buffer | undefined;
  try {
    signature = Buffer.from(signer.sign(payloadBytes));
    if (signature.length !== 64 || !verify(null, payloadBytes, publicKey, signature)) {
      throw new Error('Kimlik issuer imzalama portu gecersiz imza uretti.');
    }
    const signatureSha256 = sha256Hex(signature);
    const compact = `pptvc1.${payloadBytes.toString('base64url')}.${signature.toString('base64url')}`;
    const compactSizeBytes = Buffer.byteLength(compact, 'utf8');
    if (compactSizeBytes > TEMPORARY_VERIFIABLE_CREDENTIAL_MAX_COMPACT_BYTES) throw new Error('Kimlik QR payload sinirini asti.');
    return Object.freeze({
      compact,
      compactSha256: sha256Hex(compact),
      compactSizeBytes,
      issuerKeyId: keyId,
      issuerPublicKeySha256: keyId,
      signatureSha256,
      disclosureSha256: input.disclosureSha256,
      expiresAt: input.expiresAt,
      disclosedClaimCodes: Object.freeze(Object.keys(claims).sort()),
      networkDelivery: 'not_performed'
    });
  } finally {
    signature?.fill(0);
    payloadBytes.fill(0);
  }
};

export const issueTemporaryVerifiableCredentialWithSigner = (
  input: IssueTemporaryVerifiableCredentialInput,
  signer: TemporaryVerifiableCredentialSigner
): IssuedTemporaryVerifiableCredential => issueWithSigner(input, signer);

export const issueTemporaryVerifiableCredential = (
  input: IssueTemporaryVerifiableCredentialInput,
  issuerPrivateKeyPem: string
): IssuedTemporaryVerifiableCredential => {
  const privateKey = createPrivateKey(issuerPrivateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Kimlik issuer anahtari Ed25519 olmalidir.');
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
  return issueWithSigner(input, {
    issuerPublicKeyPem: publicKey,
    sign: (payload) => sign(null, Buffer.from(payload), privateKey)
  });
};

export const verifyTemporaryVerifiableCredential = (
  input: VerifyTemporaryVerifiableCredentialInput
): VerifiedTemporaryVerifiableCredential => {
  if (typeof input.compact !== 'string' || Buffer.byteLength(input.compact, 'utf8') > TEMPORARY_VERIFIABLE_CREDENTIAL_MAX_COMPACT_BYTES) {
    throw new Error('Kimlik compact payload gecersizdir.');
  }
  const parts = input.compact.split('.');
  if (parts.length !== 3 || parts[0] !== 'pptvc1') throw new Error('Kimlik compact formati gecersizdir.');
  const payloadBytes = canonicalBase64url(parts[1] ?? '', 'Kimlik payload', TEMPORARY_VERIFIABLE_CREDENTIAL_MAX_COMPACT_BYTES);
  const signature = canonicalBase64url(parts[2] ?? '', 'Kimlik signature', 256);
  try {
    const text = payloadBytes.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(payloadBytes)) throw new Error('Kimlik payload UTF-8 degildir.');
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error('Kimlik payload JSON degildir.'); }
    const payload = validatePayload(parsed);
    if (canonicalJson(payload) !== text) throw new Error('Kimlik payload canonical degildir.');
    const publicKeyBytes = canonicalBase64url(payload.issuerPublicKeySpkiBase64Url, 'Kimlik issuer public key', 128);
    const publicKey = createPublicKey({ key: publicKeyBytes, type: 'spki', format: 'der' });
    publicKeyBytes.fill(0);
    if (publicKey.asymmetricKeyType !== 'ed25519' || issuerKeyId(publicKey) !== payload.issuerKeyId
      || !verify(null, payloadBytes, publicKey, signature)) throw new Error('Kimlik issuer imzasi gecersizdir.');
    if (!validSha256(input.expectedAudienceRefSha256)) throw new Error('Beklenen audience hash gecersizdir.');
    if (!validIso(input.observedAt)) throw new Error('Kimlik dogrulama zamani canonical degildir.');
    const observed = Date.parse(input.observedAt);
    const notYetValid = observed < Date.parse(payload.notBefore);
    const expired = observed >= Date.parse(payload.expiresAt);
    if (input.locallyRevokedCredentialIds?.has(payload.credentialId)) throw new Error('Kimlik yerel revocation kaydinda iptal edilmis.');
    return Object.freeze({
      verified: true,
      credentialId: payload.credentialId,
      kind: payload.kind,
      purpose: payload.purpose,
      issuerKeyId: payload.issuerKeyId,
      issuerPublicKeySha256: payload.issuerKeyId,
      ownerRefSha256: payload.ownerRefSha256,
      audienceRefSha256: payload.audienceRefSha256,
      payloadSha256: sha256Hex(input.compact),
      issuedAt: payload.issuedAt,
      notBefore: payload.notBefore,
      expiresAt: payload.expiresAt,
      disclosedClaims: Object.freeze({ ...payload.disclosedClaims }),
      disclosedClaimCodes: Object.freeze(Object.keys(payload.disclosedClaims).sort()),
      disclosureSha256: payload.disclosureSha256,
      signatureValid: true,
      disclosureValid: true,
      audienceMatched: payload.audienceRefSha256 === input.expectedAudienceRefSha256,
      issuerIdentityCertified: false,
      networkUsed: false,
      notYetValid,
      expired,
      revocationFreshness: 'locally_observed_only',
      networkDelivery: 'not_performed'
    });
  } finally {
    payloadBytes.fill(0);
    signature.fill(0);
  }
};
