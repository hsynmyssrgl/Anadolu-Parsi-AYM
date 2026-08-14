import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { asFamilyId, asIsoDateTime, asPersonId, asUserId, ok } from '@ppt/core';
import { decryptCompanionSyncEnvelopeForTest } from '@ppt/security';
import { X25519EncryptedCompanionSnapshotAdapter } from '../src/main/companion-sync-envelope-adapter.js';

const key = { familyId: asFamilyId('family-33-p'), accountId: asUserId('account-33-p'), ownerPersonId: asPersonId('person-33-p') };

describe('X25519EncryptedCompanionSnapshotAdapter', () => {
  it('binds the Windows version, device epoch and read-only payload to an encrypted envelope', () => {
    const recipient = generateKeyPairSync('x25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });
    const adapter = new X25519EncryptedCompanionSnapshotAdapter({
      encryptionKeys: { resolve: ({ securityEpoch }) => ok({ publicKeySpkiBase64Url: recipient.publicKey.toString('base64url'), algorithm: 'X25519', securityEpoch }) }
    });
    const result = adapter.create({ key, trustedDeviceId: 'trusted-mobile-device', sourceVersion: 9, schemaVersion: 1, securityEpoch: 4,
      generatedAt: asIsoDateTime('2026-08-14T07:00:00.000Z'), snapshot: { sourceVersion: 9, schemaVersion: 1,
        passkeys: [{ id: 'passkey-1', revision: 2, displayName: 'Laptop', relyingPartyId: 'local.pardus.test', transports: ['internal'], status: 'active', createdAt: asIsoDateTime('2026-08-14T06:00:00.000Z') }],
        federatedLinks: [], temporaryCredentials: [], sourceAuthority: 'windows_single_writer', remoteWritesAccepted: false } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(decryptCompanionSyncEnvelopeForTest({ envelopeBase64Url: result.value.encryptedEnvelopeBase64Url,
      recipientPrivateKeyPkcs8Base64Url: recipient.privateKey.toString('base64url') })).toMatchObject({
      metadata: { sourceVersion: 9, schemaVersion: 1, securityEpoch: 4, trustedDeviceId: 'trusted-mobile-device',
        sourceAuthority: 'windows_single_writer', readOnly: true, remoteWritesAccepted: false, networkDelivery: 'not_performed' },
      snapshot: { passkeys: [{ id: 'passkey-1', displayName: 'Laptop' }], sourceAuthority: 'windows_single_writer' }
    });
  });

  it('fails closed on source-version or recipient-epoch drift', () => {
    const recipient = generateKeyPairSync('x25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } });
    const base = { key, trustedDeviceId: 'trusted-mobile-device', sourceVersion: 9, schemaVersion: 1, securityEpoch: 4,
      generatedAt: asIsoDateTime('2026-08-14T07:00:00.000Z'), snapshot: { sourceVersion: 10, schemaVersion: 1 as const,
        passkeys: [], federatedLinks: [], temporaryCredentials: [], sourceAuthority: 'windows_single_writer' as const, remoteWritesAccepted: false as const } };
    const sourceDrift = new X25519EncryptedCompanionSnapshotAdapter({
      encryptionKeys: { resolve: ({ securityEpoch }) => ok({ publicKeySpkiBase64Url: recipient.publicKey.toString('base64url'), algorithm: 'X25519', securityEpoch }) }
    });
    expect(sourceDrift.create(base).ok).toBe(false);
    const epochDrift = new X25519EncryptedCompanionSnapshotAdapter({
      encryptionKeys: { resolve: () => ok({ publicKeySpkiBase64Url: recipient.publicKey.toString('base64url'), algorithm: 'X25519', securityEpoch: 3 }) }
    });
    expect(epochDrift.create({ ...base, snapshot: { ...base.snapshot, sourceVersion: 9 } }).ok).toBe(false);
  });
});
