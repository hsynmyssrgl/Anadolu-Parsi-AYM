import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalizeCommunicationMlsProviderEvidence,
  verifyCommunicationMlsProviderEvidence,
  type CommunicationMlsProviderAttestation
} from '../src/communication-mls-provider-evidence.js';

const pair = generateKeyPairSync('ed25519');
const now = '2026-08-15T10:00:00.000Z';
const trustedKeys = [{
  providerId: 'provider-local-test', keyId: 'provider-key-1',
  publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  validFrom: '2026-08-01T00:00:00.000Z', validUntil: '2026-09-01T00:00:00.000Z'
}] as const;
const sha = (value: string) => value.repeat(64).slice(0, 64);

const signed = (kind: 'device_credential' | 'epoch'): CommunicationMlsProviderAttestation => {
  const payload = kind === 'device_credential' ? {
    trustedDeviceId: 'trusted-device-1', deviceCredentialSha256: sha('a'), keyPackageSha256: sha('b'),
    sealedCredentialReference: 'provider-vault:device:credential-1', createdAt: now
  } : {
    roomId: 'comm-room-1', epoch: 1,
    cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,
    groupIdSha256: sha('c'), commitSha256: sha('d'), confirmedTranscriptHashSha256: sha('e'),
    groupContextSha256: sha('f'), membershipDigestSha256: sha('1'),
    sealedStateReference: 'provider-vault:room:epoch-1', createdAt: now, reason: 'room_created' as const
  };
  const body = { schemaVersion: 1 as const, kind, providerId: 'provider-local-test',
    providerImplementation: 'test-rfc9420-adapter', providerKeyId: 'provider-key-1', payload };
  const signature = sign(null, Buffer.from(canonicalizeCommunicationMlsProviderEvidence(body), 'utf8'), pair.privateKey).toString('base64url');
  return { ...body, signature: { algorithm: 'Ed25519', valueBase64Url: signature } } as CommunicationMlsProviderAttestation;
};

describe('communication MLS provider evidence', () => {
  it('verifies exact Ed25519-bound device credential metadata without exposing key material', () => {
    const result = verifyCommunicationMlsProviderEvidence(signed('device_credential'), {
      trustedKeys, now: () => new Date(now)
    });
    expect(result).toMatchObject({ trustedDeviceId: 'trusted-device-1', providerEvidenceVerified: true });
    expect(JSON.stringify(result)).not.toMatch(/private|keyPackageBytes|signature/i);
  });

  it('verifies an exact epoch, cipher suite, transcript and sealed-state binding', () => {
    const result = verifyCommunicationMlsProviderEvidence(signed('epoch'), {
      trustedKeys, now: () => new Date(now)
    });
    expect(result).toMatchObject({ roomId: 'comm-room-1', epoch: 1, reason: 'room_created', providerEvidenceVerified: true });
  });

  it('rejects tampering and untrusted provider keys', () => {
    const evidence = signed('epoch') as Extract<CommunicationMlsProviderAttestation, { kind: 'epoch' }>;
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence, payload: { ...evidence.payload, epoch: 2 } }, {
      trustedKeys, now: () => new Date(now)
    })).toThrow(/signature/i);
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, { trustedKeys: [], now: () => new Date(now) })).toThrow(/trusted/i);
  });

  it('rejects future evidence, private-key trust input and non-canonical opaque references', () => {
    const evidence = signed('device_credential') as Extract<CommunicationMlsProviderAttestation, { kind: 'device_credential' }>;
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys, now: () => new Date('2026-08-15T09:00:00.000Z')
    })).toThrow(/future/i);
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys: [{ ...trustedKeys[0], publicKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }],
      now: () => new Date(now)
    })).toThrow(/public keys only/i);
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence,
      payload: { ...evidence.payload, sealedCredentialReference: 'file:C:/secret' } }, {
      trustedKeys, now: () => new Date(now)
    })).toThrow(/credential evidence/i);
  });

  it('rejects malformed trust windows, ambiguous key identities and unbounded clock policy', () => {
    const evidence = signed('device_credential');
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys: [{ ...trustedKeys[0], validFrom: 'invalid-date' }], now: () => new Date(now)
    })).toThrow(/not trusted/i);
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys: [trustedKeys[0], { ...trustedKeys[0] }], now: () => new Date(now)
    })).toThrow(/ambiguous/i);
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys, now: () => new Date('invalid'), maximumFutureSkewMs: 30_000
    })).toThrow(/clock/i);
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys, now: () => new Date(now), maximumFutureSkewMs: 300_001
    })).toThrow(/skew/i);
  });
});
