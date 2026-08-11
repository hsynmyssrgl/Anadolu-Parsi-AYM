import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SignedCutoverReadinessEvidenceVerifier,
  SignedCutoverReadinessEvidenceVerifierConfigurationError,
  canonicalizeSignedCutoverReadinessEvidence,
  type SignedCutoverReadinessEvidencePayload
} from '../src/signed-cutover-readiness-evidence-verifier.js';

const BASE_PAYLOAD = Object.freeze({
  epoch: 1,
  gateId: 'KEY_LIFECYCLE_PROOF',
  status: 'pass',
  evidenceDigest: '1'.padStart(64, '0')
} as const satisfies SignedCutoverReadinessEvidencePayload);

const signClaim = (
  keyId: string,
  payload: SignedCutoverReadinessEvidencePayload,
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey']
) => ({
  ...payload,
  verificationBinding: sign(
    null,
    canonicalizeSignedCutoverReadinessEvidence(keyId, payload),
    privateKey
  ).toString('base64url')
});

describe('31-M signed cutover-readiness evidence verifier boundary', () => {
  it('accepts an exact Ed25519 signature bound to the configured key identifier', () => {
    const keyId = 'test-readiness-key-v1';
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const verifier = new SignedCutoverReadinessEvidenceVerifier({ keyId, publicKey });

    expect(verifier.algorithm).toBe('ed25519');
    expect(verifier.keyId).toBe(keyId);
    expect(verifier.verify(signClaim(keyId, BASE_PAYLOAD, privateKey))).toBe(true);
  });

  it('rejects mutations of every signed claim field and a different key identifier', () => {
    const keyId = 'test-readiness-key-v1';
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const claim = signClaim(keyId, BASE_PAYLOAD, privateKey);

    expect(new SignedCutoverReadinessEvidenceVerifier({ keyId, publicKey }).verify({ ...claim, epoch: 2 })).toBe(false);
    expect(new SignedCutoverReadinessEvidenceVerifier({ keyId, publicKey }).verify({
      ...claim,
      gateId: 'ROLLBACK_DRILL'
    })).toBe(false);
    expect(new SignedCutoverReadinessEvidenceVerifier({ keyId, publicKey }).verify({
      ...claim,
      evidenceDigest: '2'.repeat(64)
    })).toBe(false);
    expect(new SignedCutoverReadinessEvidenceVerifier({ keyId: 'other-readiness-key-v1', publicKey }).verify(claim)).toBe(false);
    expect(new SignedCutoverReadinessEvidenceVerifier({ keyId, publicKey }).verify({
      ...claim,
      status: 'fail' as 'pass'
    })).toBe(false);
  });

  it('rejects malformed, non-canonical, unknown-gate, and extra-field claims without throwing', () => {
    const keyId = 'test-readiness-key-v1';
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const verifier = new SignedCutoverReadinessEvidenceVerifier({ keyId, publicKey });
    const claim = signClaim(keyId, BASE_PAYLOAD, privateKey);

    const malformedClaims: unknown[] = [
      null,
      [],
      { ...claim, gateId: 'UNKNOWN_GATE' },
      { ...claim, verificationBinding: 'not-a-signature' },
      { ...claim, verificationBinding: `${claim.verificationBinding}=` },
      { ...claim, verificationBinding: `${claim.verificationBinding.slice(0, -1)}+` },
      { ...claim, unexpected: true }
    ];
    for (const malformed of malformedClaims) {
      expect(() => verifier.verify(malformed as typeof claim)).not.toThrow();
      expect(verifier.verify(malformed as typeof claim)).toBe(false);
    }
  });

  it('rejects private keys, non-Ed25519 public keys, PEM strings, and invalid key identifiers', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const { publicKey: rsaPublicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

    expect(() => new SignedCutoverReadinessEvidenceVerifier({ keyId: 'test-key-v1', publicKey: privateKey }))
      .toThrowError(SignedCutoverReadinessEvidenceVerifierConfigurationError);
    expect(() => new SignedCutoverReadinessEvidenceVerifier({ keyId: 'test-key-v1', publicKey: rsaPublicKey }))
      .toThrowError(SignedCutoverReadinessEvidenceVerifierConfigurationError);
    expect(() => new SignedCutoverReadinessEvidenceVerifier({
      keyId: 'test-key-v1',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }) as unknown as typeof publicKey
    })).toThrowError(SignedCutoverReadinessEvidenceVerifierConfigurationError);
    expect(() => new SignedCutoverReadinessEvidenceVerifier({ keyId: 'NO', publicKey }))
      .toThrowError(SignedCutoverReadinessEvidenceVerifierConfigurationError);
  });

  it('does not expose the configured public key or any signing capability', () => {
    const { publicKey } = generateKeyPairSync('ed25519');
    const verifier = new SignedCutoverReadinessEvidenceVerifier({ keyId: 'test-readiness-key-v1', publicKey });

    expect(Object.keys(verifier).sort()).toEqual(['algorithm', 'keyId']);
    expect('publicKey' in verifier).toBe(false);
    expect('privateKey' in verifier).toBe(false);
    expect('sign' in verifier).toBe(false);
  });
});
