import { createHash, createPublicKey, verify } from 'node:crypto';
import type {
  CommunicationMlsCipherSuite,
  CommunicationMlsEpochReason,
  VerifiedCommunicationDeviceCredentialInput,
  VerifiedCommunicationMlsEpochInput
} from '@ppt/domain';

const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/u;
const BASE64URL = /^[A-Za-z0-9_-]{86}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const CIPHER_SUITE: CommunicationMlsCipherSuite = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
const EPOCH_REASONS = new Set<CommunicationMlsEpochReason>([
  'room_created', 'member_added', 'member_removed', 'device_revoked_recovery'
]);

export interface TrustedCommunicationMlsProviderKey {
  readonly providerId: string;
  readonly keyId: string;
  readonly publicKeyPem: string;
  readonly validFrom: string;
  readonly validUntil?: string;
}

export interface CommunicationMlsDeviceCredentialAttestationPayload {
  readonly trustedDeviceId: string;
  readonly deviceCredentialSha256: string;
  readonly keyPackageSha256: string;
  readonly sealedCredentialReference: string;
  readonly createdAt: string;
}

export interface CommunicationMlsEpochAttestationPayload {
  readonly roomId: string;
  readonly epoch: number;
  readonly cipherSuite: CommunicationMlsCipherSuite;
  readonly groupIdSha256: string;
  readonly commitSha256: string;
  readonly confirmedTranscriptHashSha256: string;
  readonly groupContextSha256: string;
  readonly membershipDigestSha256: string;
  readonly sealedStateReference: string;
  readonly createdAt: string;
  readonly reason: CommunicationMlsEpochReason;
}

export type CommunicationMlsProviderAttestation =
  | Readonly<{
      schemaVersion: 1;
      kind: 'device_credential';
      providerId: string;
      providerImplementation: string;
      providerKeyId: string;
      payload: CommunicationMlsDeviceCredentialAttestationPayload;
      signature: Readonly<{ algorithm: 'Ed25519'; valueBase64Url: string }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      kind: 'epoch';
      providerId: string;
      providerImplementation: string;
      providerKeyId: string;
      payload: CommunicationMlsEpochAttestationPayload;
      signature: Readonly<{ algorithm: 'Ed25519'; valueBase64Url: string }>;
    }>;

export interface VerifyCommunicationMlsProviderEvidenceOptions {
  readonly trustedKeys: readonly TrustedCommunicationMlsProviderKey[];
  readonly now?: () => Date;
  readonly maximumFutureSkewMs?: number;
}

const plainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
};

export const canonicalizeCommunicationMlsProviderEvidence = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('MLS evidence contains a non-integer number.');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeCommunicationMlsProviderEvidence).join(',')}]`;
  if (!plainRecord(value)) throw new Error('MLS evidence must contain only plain canonical JSON objects.');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeCommunicationMlsProviderEvidence(value[key])}`).join(',')}}`;
};

const parseIso = (value: unknown): number => {
  if (typeof value !== 'string' || !ISO.test(value) || new Date(value).toISOString() !== value) return Number.NaN;
  return Date.parse(value);
};
const safeReference = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 8 && value.length <= 512
  && value.trim() === value && !/[\u0000-\u001f\u007f\\]/u.test(value)
  && !/(?:PRIVATE KEY|BEGIN |file:|https?:|\.\.|[A-Za-z]:\/)/iu.test(value);
const validHash = (value: unknown): value is string => typeof value === 'string' && SHA256.test(value);
const validId = (value: unknown): value is string => typeof value === 'string' && SAFE_ID.test(value);

const validateEnvelope = (value: unknown): CommunicationMlsProviderAttestation => {
  if (!plainRecord(value)
    || !exactKeys(value, ['kind','payload','providerId','providerImplementation','providerKeyId','schemaVersion','signature'])
    || value.schemaVersion !== 1 || (value.kind !== 'device_credential' && value.kind !== 'epoch')
    || !validId(value.providerId) || !validId(value.providerImplementation) || !validId(value.providerKeyId)
    || !plainRecord(value.signature) || !exactKeys(value.signature, ['algorithm','valueBase64Url'])
    || value.signature.algorithm !== 'Ed25519' || typeof value.signature.valueBase64Url !== 'string'
    || !BASE64URL.test(value.signature.valueBase64Url) || !plainRecord(value.payload)) {
    throw new Error('MLS provider evidence envelope is not exact.');
  }
  const payload = value.payload;
  if (value.kind === 'device_credential') {
    if (!exactKeys(payload, ['createdAt','deviceCredentialSha256','keyPackageSha256','sealedCredentialReference','trustedDeviceId'])
      || !validId(payload.trustedDeviceId) || !validHash(payload.deviceCredentialSha256)
      || !validHash(payload.keyPackageSha256) || !safeReference(payload.sealedCredentialReference)
      || !Number.isFinite(parseIso(payload.createdAt))) throw new Error('MLS device credential evidence is invalid.');
  } else if (!exactKeys(payload, ['cipherSuite','commitSha256','confirmedTranscriptHashSha256','createdAt','epoch','groupContextSha256','groupIdSha256','membershipDigestSha256','reason','roomId','sealedStateReference'])
    || !validId(payload.roomId) || !Number.isSafeInteger(payload.epoch) || Number(payload.epoch) < 1
    || payload.cipherSuite !== CIPHER_SUITE || !validHash(payload.groupIdSha256) || !validHash(payload.commitSha256)
    || !validHash(payload.confirmedTranscriptHashSha256) || !validHash(payload.groupContextSha256)
    || !validHash(payload.membershipDigestSha256) || !safeReference(payload.sealedStateReference)
    || typeof payload.reason !== 'string' || !EPOCH_REASONS.has(payload.reason as CommunicationMlsEpochReason)
    || !Number.isFinite(parseIso(payload.createdAt))) throw new Error('MLS epoch evidence is invalid.');
  return value as unknown as CommunicationMlsProviderAttestation;
};

export const verifyCommunicationMlsProviderEvidence = (
  value: unknown,
  options: VerifyCommunicationMlsProviderEvidenceOptions
): VerifiedCommunicationDeviceCredentialInput | VerifiedCommunicationMlsEpochInput => {
  const evidence = validateEnvelope(value);
  const createdAt = evidence.payload.createdAt;
  const timestamp = parseIso(createdAt);
  const nowValue = (options.now ?? (() => new Date()))();
  const now = nowValue.getTime();
  const skew = options.maximumFutureSkewMs ?? 30_000;
  if (!Number.isFinite(now) || !Number.isSafeInteger(skew) || skew < 0 || skew > 300_000) {
    throw new Error('MLS provider verification clock or skew policy is invalid.');
  }
  if (timestamp > now + skew) throw new Error('MLS provider evidence is from the future.');
  const matchingKeys = options.trustedKeys.filter((key) => key.providerId === evidence.providerId && key.keyId === evidence.providerKeyId);
  if (matchingKeys.length !== 1) throw new Error('MLS provider trusted key identity is missing or ambiguous.');
  const trusted = matchingKeys[0]!;
  const validFrom = parseIso(trusted.validFrom);
  const validUntil = trusted.validUntil === undefined ? undefined : parseIso(trusted.validUntil);
  if (!validId(trusted.providerId) || !validId(trusted.keyId) || !Number.isFinite(validFrom)
    || (validUntil !== undefined && (!Number.isFinite(validUntil) || validUntil < validFrom))
    || validFrom > timestamp || (validUntil !== undefined && validUntil < timestamp)) {
    throw new Error('MLS provider evidence key is not trusted at the evidence time.');
  }
  if (typeof trusted.publicKeyPem !== 'string' || trusted.publicKeyPem.length < 80 || trusted.publicKeyPem.length > 8_192
    || !trusted.publicKeyPem.includes('BEGIN PUBLIC KEY') || /PRIVATE KEY/iu.test(trusted.publicKeyPem)) {
    throw new Error('MLS provider trust accepts bounded public keys only.');
  }
  const publicKey = createPublicKey(trusted.publicKeyPem);
  if (publicKey.type !== 'public' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('MLS provider trust key must be Ed25519.');
  }
  const signed = Object.freeze({
    schemaVersion: evidence.schemaVersion,
    kind: evidence.kind,
    providerId: evidence.providerId,
    providerImplementation: evidence.providerImplementation,
    providerKeyId: evidence.providerKeyId,
    payload: evidence.payload
  });
  const canonical = canonicalizeCommunicationMlsProviderEvidence(signed);
  const signature = Buffer.from(evidence.signature.valueBase64Url, 'base64url');
  if (signature.length !== 64 || !verify(null, Buffer.from(canonical, 'utf8'), publicKey, signature)) {
    throw new Error('MLS provider evidence signature is invalid.');
  }
  const providerAttestationSha256 = createHash('sha256')
    .update(canonicalizeCommunicationMlsProviderEvidence(evidence), 'utf8').digest('hex');
  if (evidence.kind === 'device_credential') return Object.freeze({
    trustedDeviceId: evidence.payload.trustedDeviceId,
    deviceCredentialSha256: evidence.payload.deviceCredentialSha256,
    keyPackageSha256: evidence.payload.keyPackageSha256,
    sealedCredentialReference: evidence.payload.sealedCredentialReference,
    providerId: evidence.providerId,
    providerImplementation: evidence.providerImplementation,
    providerAttestationSha256,
    providerEvidenceVerified: true,
    createdAt: evidence.payload.createdAt
  });
  return Object.freeze({
    roomId: evidence.payload.roomId,
    epoch: evidence.payload.epoch,
    cipherSuite: evidence.payload.cipherSuite,
    groupIdSha256: evidence.payload.groupIdSha256,
    commitSha256: evidence.payload.commitSha256,
    confirmedTranscriptHashSha256: evidence.payload.confirmedTranscriptHashSha256,
    groupContextSha256: evidence.payload.groupContextSha256,
    membershipDigestSha256: evidence.payload.membershipDigestSha256,
    sealedStateReference: evidence.payload.sealedStateReference,
    providerId: evidence.providerId,
    providerImplementation: evidence.providerImplementation,
    providerAttestationSha256,
    providerEvidenceVerified: true,
    createdAt: evidence.payload.createdAt,
    reason: evidence.payload.reason
  });
};
