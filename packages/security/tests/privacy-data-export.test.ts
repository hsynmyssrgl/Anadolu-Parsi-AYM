import { describe, expect, it } from 'vitest';
import {
  PRIVACY_DATA_EXPORT_FORMAT,
  PRIVACY_DATA_EXPORT_MAX_CONTAINER_BYTES,
  PRIVACY_DATA_EXPORT_MAX_PLAINTEXT_BYTES,
  canonicalizePrivacyDataExport,
  decryptPrivacyDataExport,
  encryptPrivacyDataExport,
  normalizePrivacyDataExportPassphrase,
  parsePrivacyDataExport,
  verifyPrivacyDataExportReadback
} from '../src/index.js';

const passphrase = 'Gizlilik-Veri-Paketi-2026!';
const metadata = {
  accountId: 'account-33-o',
  familyId: 'family-33-o',
  ownerPersonId: 'person-33-o',
  requestId: 'request-33-o-0001',
  scopeSha256: 'a'.repeat(64),
  lineageSha256: 'b'.repeat(64),
  createdAt: '2026-08-14T00:00:00.000Z'
} as const;
const value = { records: [{ id: 'memory-1', state: 'restricted' }], scope: ['ai_memory', 'access_history'] };

describe('33-O privacy data export encryption', () => {
  it('creates random v1 wrapped-DEK containers and verifies canonical plaintext readback', () => {
    const first = encryptPrivacyDataExport({ value, passphrase, metadata });
    const second = encryptPrivacyDataExport({ value, passphrase, metadata });
    expect(first.equals(second)).toBe(false);
    const envelope = parsePrivacyDataExport(first);
    const secondEnvelope = parsePrivacyDataExport(second);
    expect(envelope).toMatchObject({
      format: PRIVACY_DATA_EXPORT_FORMAT,
      version: 1,
      metadata,
      keyDerivation: { algorithm: 'scrypt', n: 32768, r: 8, p: 1, keyLength: 32 },
      keyWrap: { algorithm: 'aes-256-gcm' },
      payload: { algorithm: 'aes-256-gcm' }
    });
    expect(envelope.keyDerivation.salt).not.toBe(secondEnvelope.keyDerivation.salt);
    expect(envelope.keyWrap.wrappedDek).not.toBe(secondEnvelope.keyWrap.wrappedDek);
    const decrypted = decryptPrivacyDataExport(first, passphrase);
    try {
      expect(decrypted.plaintext.toString('utf8')).toBe(canonicalizePrivacyDataExport(value));
      expect(decrypted.metadata).toEqual(metadata);
      expect(decrypted.plaintextSizeBytes).toBe(Buffer.byteLength(canonicalizePrivacyDataExport(value)));
    } finally { decrypted.plaintext.fill(0); }
    expect(verifyPrivacyDataExportReadback({
      serialized: first,
      passphrase,
      expectedMetadata: metadata,
      expectedPlaintextSha256: envelope.metadata.plaintextSha256
    })).toMatchObject({ verified: true, artifactSizeBytes: first.length, metadata });
  });

  it('authenticates every metadata and plaintext hash/size field as AAD', () => {
    const encrypted = encryptPrivacyDataExport({ value, passphrase, metadata });
    for (const [field, replacement] of [
      ['accountId', 'account-attacker'], ['familyId', 'family-attacker'], ['ownerPersonId', 'person-attacker'],
      ['requestId', 'request-attacker'], ['scopeSha256', 'c'.repeat(64)], ['lineageSha256', 'd'.repeat(64)],
      ['createdAt', '2026-08-14T00:00:01.000Z'], ['plaintextSha256', 'e'.repeat(64)], ['plaintextSizeBytes', 1]
    ] as const) {
      const altered = JSON.parse(encrypted.toString('utf8')) as { metadata: Record<string, unknown> };
      altered.metadata[field] = replacement;
      const serialized = Buffer.from(canonicalizePrivacyDataExport(altered), 'utf8');
      expect(() => decryptPrivacyDataExport(serialized, passphrase), field).toThrow();
    }
  });

  it('fails closed for wrong passwords, ciphertext tampering, noncanonical base64 and unknown keys', () => {
    const encrypted = encryptPrivacyDataExport({ value, passphrase, metadata });
    expect(() => decryptPrivacyDataExport(encrypted, 'Yanlis-Gizlilik-Parolasi-2026!')).toThrow();
    const altered = JSON.parse(encrypted.toString('utf8')) as { payload: { ciphertext: string }; delivery?: string };
    const ciphertext = Buffer.from(altered.payload.ciphertext, 'base64');
    ciphertext[0] = ciphertext[0]! ^ 1;
    altered.payload.ciphertext = ciphertext.toString('base64');
    ciphertext.fill(0);
    expect(() => decryptPrivacyDataExport(Buffer.from(canonicalizePrivacyDataExport(altered)), passphrase)).toThrow();
    altered.payload.ciphertext = `${altered.payload.ciphertext}====`;
    expect(() => parsePrivacyDataExport(Buffer.from(canonicalizePrivacyDataExport(altered)))).toThrow();
    altered.delivery = 'forbidden';
    expect(() => parsePrivacyDataExport(Buffer.from(canonicalizePrivacyDataExport(altered)))).toThrow(/sözleşmesi/u);
    expect(() => parsePrivacyDataExport(Buffer.from(` ${encrypted.toString('utf8')}`))).toThrow(/canonical/u);
  });

  it('enforces NFKC password policy, canonical JSON and fixed byte limits', () => {
    expect(normalizePrivacyDataExportPassphrase('Ｇizlilik-Veri-Paketi-2026!')).toBe(passphrase);
    for (const weak of ['123456789012', ' kısa-parola ', 'kısa', `Kontrol-${String.fromCharCode(1)}-Parola-2026`]) {
      expect(() => normalizePrivacyDataExportPassphrase(weak)).toThrow(/parolası/u);
    }
    expect(() => canonicalizePrivacyDataExport({ constructor: 'forbidden' })).toThrow(/anahtarı/u);
    expect(() => canonicalizePrivacyDataExport({ value: Number.NaN })).toThrow(/sonlu/u);
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(() => canonicalizePrivacyDataExport(cyclic)).toThrow(/döngüsel/u);
    expect(PRIVACY_DATA_EXPORT_MAX_PLAINTEXT_BYTES).toBe(32 * 1024 * 1024);
    expect(PRIVACY_DATA_EXPORT_MAX_CONTAINER_BYTES).toBe(50 * 1024 * 1024);
  });

  it('contains no path, delivery, recipient or network claim fields', () => {
    const envelope = parsePrivacyDataExport(encryptPrivacyDataExport({ value, passphrase, metadata }));
    const keys: string[] = [];
    const visit = (item: unknown): void => {
      if (!item || typeof item !== 'object') return;
      for (const [key, child] of Object.entries(item)) { keys.push(key); visit(child); }
    };
    visit(envelope);
    expect(keys).not.toEqual(expect.arrayContaining(['path', 'filePath', 'delivery', 'recipient', 'recipientId', 'network', 'networkDelivery']));
  });
});
