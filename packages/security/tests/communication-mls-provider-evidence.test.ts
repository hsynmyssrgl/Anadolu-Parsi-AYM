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
  providerImplementation: 'test-rfc9420-adapter',
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

const signedAdvancedEpoch = (): CommunicationMlsProviderAttestation => {
  const payload = {
    roomId: 'comm-room-1', epoch: 2,
    cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519' as const,
    groupIdSha256: sha('c'), commitSha256: sha('2'), confirmedTranscriptHashSha256: sha('3'),
    groupContextSha256: sha('4'), membershipDigestSha256: sha('5'),
    sealedStateReference: 'provider-vault:room:epoch-2', createdAt: now, reason: 'member_added' as const,
    previousEpoch: 1, previousCommitSha256: sha('d'), previousConfirmedTranscriptHashSha256: sha('e')
  };
  const body = { schemaVersion: 1 as const, kind: 'epoch' as const, providerId: 'provider-local-test',
    providerImplementation: 'test-rfc9420-adapter', providerKeyId: 'provider-key-1', payload };
  const signature = sign(null, Buffer.from(canonicalizeCommunicationMlsProviderEvidence(body), 'utf8'), pair.privateKey).toString('base64url');
  return { ...body, signature: { algorithm: 'Ed25519', valueBase64Url: signature } };
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
    expect(verifyCommunicationMlsProviderEvidence(signedAdvancedEpoch(), {
      trustedKeys, now: () => new Date(now)
    })).toMatchObject({
      roomId: 'comm-room-1', epoch: 2, reason: 'member_added', previousEpoch: 1,
      previousCommitSha256: sha('d'), previousConfirmedTranscriptHashSha256: sha('e')
    });
  });

  it('rejects tampering and untrusted provider keys', () => {
    const evidence = signed('epoch') as Extract<CommunicationMlsProviderAttestation, { kind: 'epoch' }>;
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence,
      payload: { ...evidence.payload, commitSha256: sha('9') } }, {
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

  it('rejects provider implementation drift and broken previous-epoch continuity', () => {
    const evidence = signedAdvancedEpoch() as Extract<CommunicationMlsProviderAttestation, { kind: 'epoch' }>;
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence,
      providerImplementation: 'substituted-provider' }, { trustedKeys, now: () => new Date(now) }))
      .toThrow(/identity/i);
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence,
      payload: { ...evidence.payload, previousEpoch: 2 } }, { trustedKeys, now: () => new Date(now) }))
      .toThrow(/epoch evidence/i);
    const missingPrevious = { ...evidence.payload } as Record<string, unknown>;
    delete missingPrevious.previousCommitSha256;
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence, payload: missingPrevious }, {
      trustedKeys, now: () => new Date(now)
    })).toThrow(/epoch evidence/i);
  });

  it('rejects accessors, symbols and sparse trusted-key registries before verification', () => {
    const evidence = signed('device_credential') as Extract<CommunicationMlsProviderAttestation, { kind: 'device_credential' }>;
    const accessorPayload = { ...evidence.payload } as Record<string, unknown>;
    Object.defineProperty(accessorPayload, 'createdAt', { enumerable: true, get: () => now });
    expect(() => verifyCommunicationMlsProviderEvidence({ ...evidence, payload: accessorPayload }, {
      trustedKeys, now: () => new Date(now)
    })).toThrow(/canonical|exact/i);
    const symbolEvidence = { ...evidence } as Record<PropertyKey, unknown>;
    symbolEvidence[Symbol('hidden')] = 'secret';
    expect(() => verifyCommunicationMlsProviderEvidence(symbolEvidence, {
      trustedKeys, now: () => new Date(now)
    })).toThrow(/canonical|exact/i);
    const sparse = [trustedKeys[0]] as Array<(typeof trustedKeys)[number] | undefined>;
    sparse.length = 2;
    expect(() => verifyCommunicationMlsProviderEvidence(evidence, {
      trustedKeys: sparse as typeof trustedKeys, now: () => new Date(now)
    })).toThrow(/registry/i);
  });
});
