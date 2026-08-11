import { KeyObject, verify as verifySignature } from 'node:crypto';
import { CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES } from './family-data-cutover-guard.js';
import type {
  CoreServiceCutoverReadinessEvidenceClaim,
  CoreServiceCutoverReadinessEvidenceVerifier
} from './family-data-cutover-readiness-ledger.js';

const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CANONICAL_ED25519_SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{86}$/u;
const CLAIM_KEYS = Object.freeze([
  'epoch',
  'gateId',
  'status',
  'evidenceDigest',
  'verificationBinding'
] as const);

export type SignedCutoverReadinessEvidencePayload = Omit<
  CoreServiceCutoverReadinessEvidenceClaim,
  'verificationBinding'
>;

export type SignedCutoverReadinessEvidenceVerifierConfigurationErrorCode =
  | 'KEY_ID_INVALID'
  | 'PUBLIC_KEY_REQUIRED'
  | 'ALGORITHM_UNSUPPORTED';

export class SignedCutoverReadinessEvidenceVerifierConfigurationError extends Error {
  public readonly code: SignedCutoverReadinessEvidenceVerifierConfigurationErrorCode;

  public constructor(code: SignedCutoverReadinessEvidenceVerifierConfigurationErrorCode, message: string) {
    super(message);
    this.name = 'SignedCutoverReadinessEvidenceVerifierConfigurationError';
    this.code = code;
  }
}

const hasExactClaimKeys = (candidate: object): boolean => {
  const actual = Object.keys(candidate).sort();
  const expected = [...CLAIM_KEYS].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export const canonicalizeSignedCutoverReadinessEvidence = (
  keyId: string,
  payload: SignedCutoverReadinessEvidencePayload
): Buffer => Buffer.from(JSON.stringify([
  'PPT-CUTOVER-READINESS-EVIDENCE-V1',
  'ed25519',
  keyId,
  payload.epoch,
  payload.gateId,
  payload.status,
  payload.evidenceDigest
]), 'utf8');

export class SignedCutoverReadinessEvidenceVerifier implements CoreServiceCutoverReadinessEvidenceVerifier {
  readonly #publicKey: KeyObject;
  public readonly algorithm = 'ed25519' as const;
  public readonly keyId: string;

  public constructor(input: { readonly keyId: string; readonly publicKey: KeyObject }) {
    if (!input || !KEY_ID_PATTERN.test(input.keyId)) {
      throw new SignedCutoverReadinessEvidenceVerifierConfigurationError(
        'KEY_ID_INVALID',
        'Cutover-readiness verifier key identifier is invalid'
      );
    }
    if (!(input.publicKey instanceof KeyObject) || input.publicKey.type !== 'public') {
      throw new SignedCutoverReadinessEvidenceVerifierConfigurationError(
        'PUBLIC_KEY_REQUIRED',
        'Cutover-readiness verifier requires a public KeyObject'
      );
    }
    if (input.publicKey.asymmetricKeyType !== 'ed25519') {
      throw new SignedCutoverReadinessEvidenceVerifierConfigurationError(
        'ALGORITHM_UNSUPPORTED',
        'Cutover-readiness verifier requires an Ed25519 public key'
      );
    }
    this.keyId = input.keyId;
    this.#publicKey = input.publicKey;
  }

  public verify(claim: CoreServiceCutoverReadinessEvidenceClaim): boolean {
    const candidate: unknown = claim;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || !hasExactClaimKeys(candidate)) {
      return false;
    }
    const value = candidate as Record<string, unknown>;
    if (!Number.isSafeInteger(value.epoch) || (value.epoch as number) < 1) return false;
    if (
      typeof value.gateId !== 'string'
      || !CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.includes(
        value.gateId as (typeof CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES)[number]
      )
    ) return false;
    if (value.status !== 'pass' || typeof value.evidenceDigest !== 'string' || !SHA256_PATTERN.test(value.evidenceDigest)) {
      return false;
    }
    if (
      typeof value.verificationBinding !== 'string'
      || !CANONICAL_ED25519_SIGNATURE_PATTERN.test(value.verificationBinding)
    ) return false;

    try {
      const signature = Buffer.from(value.verificationBinding, 'base64url');
      if (signature.byteLength !== 64 || signature.toString('base64url') !== value.verificationBinding) return false;
      return verifySignature(
        null,
        canonicalizeSignedCutoverReadinessEvidence(this.keyId, {
          epoch: value.epoch as number,
          gateId: value.gateId as SignedCutoverReadinessEvidencePayload['gateId'],
          status: 'pass',
          evidenceDigest: value.evidenceDigest
        }),
        this.#publicKey,
        signature
      );
    } catch {
      return false;
    }
  }
}
