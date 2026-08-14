import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  issueTemporaryVerifiableCredential,
  verifyTemporaryVerifiableCredential
} from '../src/temporary-verifiable-credential.js';

const pair = () => generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const base = () => ({
  credentialId: 'temporary-credential-1',
  kind: 'school_pickup' as const,
  purpose: 'school_pickup_authorization' as const,
  ownerRefSha256: hash('family-account-owner'),
  audienceRefSha256: hash('authorized-person'),
  disclosureSha256: hash('canonical-disclosure'),
  issuedAt: '2026-08-14T06:00:00.000Z',
  notBefore: '2026-08-14T06:00:00.000Z',
  expiresAt: '2026-08-14T18:00:00.000Z',
  nonce: randomBytes(16).toString('base64url'),
  revocationSequence: 0,
  disclosedClaims: { authorized_person: 'Ayse Y.', valid_until: '18:00' },
  allowedClaimCodes: ['authorized_person', 'valid_until']
});

describe('temporary verifiable credential', () => {
  it('issues and verifies a bounded minimum-disclosure offline credential', () => {
    const keys = pair();
    const issued = issueTemporaryVerifiableCredential(base(), keys.privateKey);
    expect(issued).toMatchObject({ networkDelivery: 'not_performed', disclosedClaimCodes: ['authorized_person', 'valid_until'] });
    expect(verifyTemporaryVerifiableCredential({
      compact: issued.compact,
      expectedAudienceRefSha256: hash('authorized-person'),
      observedAt: '2026-08-14T12:00:00.000Z'
    })).toMatchObject({
      verified: true,
      kind: 'school_pickup',
      revocationFreshness: 'locally_observed_only',
      networkDelivery: 'not_performed',
      audienceMatched: true,
      issuerIdentityCertified: false
    });
  });

  it('rejects over-disclosure, long validity and non-Ed25519 issuers', () => {
    const keys = pair();
    expect(() => issueTemporaryVerifiableCredential({ ...base(), disclosedClaims: { ...base().disclosedClaims, health: 'secret' } }, keys.privateKey))
      .toThrow(/minimum aciklama/u);
    expect(() => issueTemporaryVerifiableCredential({ ...base(), expiresAt: '2026-10-14T18:00:00.000Z' }, keys.privateKey))
      .toThrow(/zaman araligi/u);
    expect(() => issueTemporaryVerifiableCredential({ ...base(), purpose: 'event_invitation_access' }, keys.privateKey))
      .toThrow(/metadata/u);
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
    expect(() => issueTemporaryVerifiableCredential(base(), ec.privateKey)).toThrow(/Ed25519/u);
  });

  it('rejects tamper, foreign issuer, expiry and locally observed revocation', () => {
    const keys = pair();
    const issued = issueTemporaryVerifiableCredential(base(), keys.privateKey);
    const parts = issued.compact.split('.');
    const signature = Buffer.from(parts[2]!, 'base64url');
    signature[signature.length - 1] = (signature[signature.length - 1] ?? 0) ^ 1;
    expect(() => verifyTemporaryVerifiableCredential({
      compact: `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`,
      expectedAudienceRefSha256: hash('authorized-person'),
      observedAt: '2026-08-14T12:00:00.000Z'
    })).toThrow(/imzasi/u);
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
    const foreign = pair();
    payload.issuerPublicKeySpkiBase64Url = Buffer.from(foreign.publicKey).toString('base64url');
    expect(() => verifyTemporaryVerifiableCredential({ compact: `pptvc1.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`,
      expectedAudienceRefSha256: hash('authorized-person'), observedAt: '2026-08-14T12:00:00.000Z' })).toThrow();
    expect(verifyTemporaryVerifiableCredential({ compact: issued.compact, expectedAudienceRefSha256: hash('authorized-person'), observedAt: '2026-08-15T12:00:00.000Z' }))
      .toMatchObject({ verified: true, expired: true });
    expect(verifyTemporaryVerifiableCredential({ compact: issued.compact, expectedAudienceRefSha256: hash('wrong-audience'), observedAt: '2026-08-14T12:00:00.000Z' }))
      .toMatchObject({ verified: true, audienceMatched: false });
    expect(() => verifyTemporaryVerifiableCredential({
      compact: issued.compact,
      expectedAudienceRefSha256: hash('authorized-person'),
      observedAt: '2026-08-14T12:00:00.000Z',
      locallyRevokedCredentialIds: new Set(['temporary-credential-1'])
    })).toThrow(/iptal/u);
  });
});
