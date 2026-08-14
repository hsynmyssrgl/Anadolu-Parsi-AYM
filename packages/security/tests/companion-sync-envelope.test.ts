import { createHash, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptCompanionSyncEnvelopeForTest, encryptCompanionSyncEnvelope } from '../src/companion-sync-envelope.js';

const keys = () => generateKeyPairSync('x25519', {
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});
const metadata = () => ({
  protocolVersion: 1 as const,
  sourceVersion: 7,
  schemaVersion: 93,
  securityEpoch: 4,
  trustedDeviceId: 'trusted-device-mobile-33-p',
  ownerBindingSha256: createHash('sha256').update('family-account-owner').digest('hex'),
  generatedAt: '2026-08-14T07:00:00.000Z',
  expiresAt: '2026-08-15T07:00:00.000Z',
  sourceAuthority: 'windows_single_writer' as const,
  readOnly: true as const,
  remoteWritesAccepted: false as const,
  conflictResolution: 'reject_remote_and_refresh' as const,
  networkDelivery: 'not_performed' as const
});

describe('companion read-only sync envelope', () => {
  it('encrypts a versioned snapshot to the enrolled X25519 recipient', () => {
    const pair = keys();
    const encrypted = encryptCompanionSyncEnvelope({
      metadata: metadata(),
      snapshot: { records: [{ id: 'record-1', title: 'Yerel veri' }], sourceVersion: 7 },
      recipientPublicKeySpkiBase64Url: pair.publicKey.toString('base64url')
    });
    expect(encrypted).toMatchObject({ envelopeBytes: expect.any(Number), metadata: { readOnly: true, remoteWritesAccepted: false,
      conflictResolution: 'reject_remote_and_refresh', networkDelivery: 'not_performed' } });
    expect(decryptCompanionSyncEnvelopeForTest({
      envelopeBase64Url: encrypted.envelopeBase64Url,
      recipientPrivateKeyPkcs8Base64Url: pair.privateKey.toString('base64url')
    })).toMatchObject({ snapshot: { sourceVersion: 7, records: [{ id: 'record-1' }] } });
  });

  it('rejects foreign recipient, tamper and remote-write metadata', () => {
    const pair = keys(); const foreign = keys();
    const encrypted = encryptCompanionSyncEnvelope({ metadata: metadata(), snapshot: { records: [] },
      recipientPublicKeySpkiBase64Url: pair.publicKey.toString('base64url') });
    expect(() => decryptCompanionSyncEnvelopeForTest({ envelopeBase64Url: encrypted.envelopeBase64Url,
      recipientPrivateKeyPkcs8Base64Url: foreign.privateKey.toString('base64url') })).toThrow();
    const bytes = Buffer.from(encrypted.envelopeBase64Url, 'base64url'); bytes[bytes.length - 2] ^= 1;
    expect(() => decryptCompanionSyncEnvelopeForTest({ envelopeBase64Url: bytes.toString('base64url'),
      recipientPrivateKeyPkcs8Base64Url: pair.privateKey.toString('base64url') })).toThrow();
    expect(() => encryptCompanionSyncEnvelope({ metadata: { ...metadata(), remoteWritesAccepted: true } as never,
      snapshot: {}, recipientPublicKeySpkiBase64Url: pair.publicKey.toString('base64url') })).toThrow(/metadata/u);
  });
});
