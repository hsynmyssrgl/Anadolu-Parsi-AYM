import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { canonicalTemporaryCredentialDisclosureJson } from '@ppt/domain';
import type { DeviceSecretProtector } from '@ppt/security';
import { MAX_OWNED_TEMPORARY_CREDENTIAL_ENVELOPES, ProtectedTemporaryCredentialEnvelopeAdapter } from '../src/main/temporary-credential-envelope-adapter.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-33-p-temp-credential-'));
  directories.push(directory);
  const pair = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const protector: DeviceSecretProtector = {
    protectionId: 'test-device-protector',
    required: true,
    isAvailable: () => true,
    protect: (secret) => Buffer.from(`protected:${secret}`, 'utf8').toString('base64'),
    unprotect: (protectedValue) => {
      const value = Buffer.from(protectedValue, 'base64').toString('utf8');
      if (!value.startsWith('protected:')) throw new Error('protected fixture gecersiz');
      return value.slice('protected:'.length);
    }
  };
  const clock: Clock = { now: () => asIsoDateTime('2026-08-14T12:00:00.000Z') };
  const deviceIdentity = {
    snapshot: () => ({ deviceId: 'device-33-p', publicKeyPem: pair.publicKey, fingerprint: hash(pair.publicKey), createdAt: asIsoDateTime('2026-08-14T06:00:00.000Z') }),
    signDetached: (payload: Uint8Array) => sign(null, Buffer.from(payload), pair.privateKey)
  };
  return { directory, protector, clock, deviceIdentity, adapter: new ProtectedTemporaryCredentialEnvelopeAdapter({ directory, protector, clock, deviceIdentity }) };
};

const issuance = () => {
  const canonicalDisclosureJson = canonicalTemporaryCredentialDisclosureJson({
    id: 'credential-33-p-school-1',
    kind: 'school_pickup',
    purpose: 'school_pickup_authorization',
    audienceRefSha256: hash('authorized-person-33-p'),
    claims: [
      { key: 'authorized_person_display_name', value: 'Ayse Y.' },
      { key: 'subject_display_name', value: 'Deniz P.' }
    ],
    notBefore: asIsoDateTime('2026-08-14T10:00:00.000Z'),
    expiresAt: asIsoDateTime('2026-08-14T18:00:00.000Z')
  });
  return {
    credentialId: 'credential-33-p-school-1',
    canonicalDisclosureJson,
    disclosureSha256: hash(canonicalDisclosureJson),
    ownerRefSha256: hash('family-account-owner'),
    issuedAt: asIsoDateTime('2026-08-14T08:00:00.000Z')
  };
};

describe('ProtectedTemporaryCredentialEnvelopeAdapter', () => {
  it('signs, encrypts, readback-verifies and verifies the bounded QR offline', () => {
    const { adapter, directory } = fixture();
    const issued = adapter.issueAndStore(issuance());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.value).toMatchObject({ signatureAlgorithm: 'Ed25519', containsOnlyCanonicalDisclosure: true });
    const stored = readFileSync(join(directory, `${hash('credential-33-p-school-1')}.json`), 'utf8');
    expect(stored).not.toContain('Ayse Y.');
    expect(stored).not.toContain(issued.value.qrPayload);
    expect(adapter.listOwnedEnvelopeReferences(hash('family-account-owner'))).toEqual([{
      encryptedEnvelopeReference: issued.value.encryptedEnvelopeReference,
      createdAt: '2026-08-14T08:00:00.000Z'
    }]);
    expect(adapter.listOwnedEnvelopeReferences(hash('foreign-owner'))).toEqual([]);
    const verified = adapter.verifyOffline(issued.value.qrPayload, hash('authorized-person-33-p'));
    expect(verified).toMatchObject({ ok: true, value: { credentialId: 'credential-33-p-school-1', kind: 'school_pickup', signatureValid: true,
      disclosureValid: true, audienceMatched: true, issuerIdentityCertified: false, networkUsed: false,
      disclosedClaimKeys: ['authorized_person_display_name', 'subject_display_name'] } });
    const externalVerifier = fixture().adapter;
    expect(externalVerifier.verifyOffline(issued.value.qrPayload, hash('authorized-person-33-p')))
      .toMatchObject({ ok: true, value: { signatureValid: true, issuerIdentityCertified: false } });
    expect(externalVerifier.verifyOffline(issued.value.qrPayload, hash('wrong-audience')))
      .toMatchObject({ ok: true, value: { signatureValid: true, audienceMatched: false } });
  });

  it('fails closed on legacy or owner-tampered metadata and bounds crash orphans absolutely', () => {
    const value = fixture();
    const issued = value.adapter.issueAndStore(issuance());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const path = join(value.directory, `${hash('credential-33-p-school-1')}.json`);
    const stored = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    stored.ownerRefSha256 = hash('foreign-owner');
    writeFileSync(path, `${JSON.stringify(stored)}\n`, 'utf8');
    expect(() => value.adapter.listOwnedEnvelopeReferences(hash('foreign-owner'))).toThrow(/owner|binding/u);
    stored.ownerRefSha256 = hash('family-account-owner');
    stored.createdAt = '2026-08-01T00:00:00.000Z';
    writeFileSync(path, `${JSON.stringify(stored)}\n`, 'utf8');
    expect(() => value.adapter.listOwnedEnvelopeReferences(hash('family-account-owner'))).toThrow(/owner|binding/u);
    delete stored.ownerRefSha256;
    writeFileSync(path, `${JSON.stringify(stored)}\n`, 'utf8');
    expect(() => value.adapter.listOwnedEnvelopeReferences(hash('family-account-owner'))).toThrow(/envelope gecersiz/u);

    const capped = fixture();
    for (let index = 0; index < MAX_OWNED_TEMPORARY_CREDENTIAL_ENVELOPES; index += 1) {
      writeFileSync(join(capped.directory, `${index.toString(16).padStart(64, '0')}.json`), '{}\n', 'utf8');
    }
    expect(capped.adapter.issueAndStore(issuance())).toMatchObject({ ok: false });
    expect(() => capped.adapter.listOwnedEnvelopeReferences(hash('family-account-owner'))).toThrow(/envelope/u);
  });

  it('rejects disclosure drift, QR tamper and reference traversal', () => {
    const { adapter } = fixture();
    expect(adapter.issueAndStore({ ...issuance(), disclosureSha256: hash('forged') }).ok).toBe(false);
    const issued = adapter.issueAndStore(issuance());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const pieces=issued.value.qrPayload.split('.');
    const tamperedSignature=`${pieces[2]![0]==='A'?'B':'A'}${pieces[2]!.slice(1)}`;
    expect(adapter.verifyOffline(`${pieces[0]}.${pieces[1]}.${tamperedSignature}`, hash('authorized-person-33-p')).ok).toBe(false);
    expect(() => adapter.discardEncryptedEnvelope('temporary-credential-envelope:..\\forged')).toThrow(/referansi/u);
    expect(() => adapter.discardEncryptedEnvelope(issued.value.encryptedEnvelopeReference, hash('foreign-owner'))).toThrow(/foreign owner/u);
    adapter.discardEncryptedEnvelope(issued.value.encryptedEnvelopeReference, hash('family-account-owner'));
    expect(() => adapter.discardEncryptedEnvelope(issued.value.encryptedEnvelopeReference)).not.toThrow();
  });

  it('rejects hard-linked envelope files and a symlinked owned directory', () => {
    const value = fixture();
    const issued = value.adapter.issueAndStore(issuance());
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const envelopePath = join(value.directory, `${hash('credential-33-p-school-1')}.json`);
    const foreignLink = join(value.directory, 'foreign-hardlink.json');
    linkSync(envelopePath, foreignLink);
    expect(() => value.adapter.discardEncryptedEnvelope(issued.value.encryptedEnvelopeReference)).toThrow(/sahipli/u);
    rmSync(foreignLink);
    value.adapter.discardEncryptedEnvelope(issued.value.encryptedEnvelopeReference);

    const root = mkdtempSync(join(tmpdir(), 'ppt-33-p-temp-credential-symlink-'));
    directories.push(root);
    const realDirectory = join(root, 'real');
    const linkedDirectory = join(root, 'linked');
    mkdirSync(realDirectory);
    symlinkSync(realDirectory, linkedDirectory, 'junction');
    expect(() => new ProtectedTemporaryCredentialEnvelopeAdapter({
      directory: linkedDirectory,
      protector: value.protector,
      clock: value.clock,
      deviceIdentity: value.deviceIdentity
    })).toThrow(/dizini guvenli degil/u);
  });
});
