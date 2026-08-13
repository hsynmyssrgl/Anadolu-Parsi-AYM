import { describe, expect, it } from 'vitest';
import {
  decryptPortableEmergencyPack,
  encryptPortableEmergencyPack,
  normalizePortableEmergencyPackPassphrase,
  parsePortableEmergencyPack,
  sha256Hex,
  verifyPortableEmergencyPackReadback
} from '../src/index.js';

const metadata = {
  profileId: 'profile-1',
  configurationId: 'configuration-1',
  selectionSha256: 'a'.repeat(64)
};
const passphrase = 'Acil-Paket-Parolasi-2026!';

describe('33-J portable emergency pack encryption', () => {
  it('uses independent random salt/DEK wrapping and verifies decrypt/hash readback', () => {
    const plaintext = Buffer.from('%PDF governed emergency card and archive bytes', 'utf8');
    const first = encryptPortableEmergencyPack({ plaintext, passphrase, metadata });
    const second = encryptPortableEmergencyPack({ plaintext, passphrase, metadata });
    expect(first.equals(second)).toBe(false);
    const firstEnvelope = parsePortableEmergencyPack(first);
    const secondEnvelope = parsePortableEmergencyPack(second);
    expect(firstEnvelope).toMatchObject({
      format: 'ppt-emergency-portable-pack', version: 1,
      keyDerivation: { algorithm: 'scrypt', n: 32768, r: 8, p: 1, keyLength: 32 },
      keyWrap: { algorithm: 'aes-256-gcm' }, payload: { algorithm: 'aes-256-gcm' }
    });
    expect(firstEnvelope.keyDerivation.salt).not.toBe(secondEnvelope.keyDerivation.salt);
    expect(firstEnvelope.keyWrap.wrappedDek).not.toBe(secondEnvelope.keyWrap.wrappedDek);
    const decrypted = decryptPortableEmergencyPack(first, passphrase);
    try {
      expect(decrypted.plaintext.equals(plaintext)).toBe(true);
      expect(decrypted.plaintextSha256).toBe(sha256Hex(plaintext));
      expect(decrypted.metadata).toEqual(metadata);
    } finally {
      decrypted.plaintext.fill(0);
    }
    expect(verifyPortableEmergencyPackReadback({
      serialized: first,
      passphrase,
      expectedPlaintextSha256: sha256Hex(plaintext)
    })).toMatchObject({
      verified: true,
      artifactSha256: sha256Hex(first),
      artifactSizeBytes: first.length,
      plaintextSha256: sha256Hex(plaintext),
      metadata
    });
  });

  it('fails closed for weak passphrases, wrong credentials, tampering and unknown envelope keys', () => {
    expect(() => normalizePortableEmergencyPackPassphrase('123456789012')).toThrow(/parolasi/i);
    expect(() => normalizePortableEmergencyPackPassphrase(' short-password ')).toThrow(/parolasi/i);
    expect(normalizePortableEmergencyPackPassphrase('Ａcil-Paket-Parolasi-2026!'))
      .toBe('Acil-Paket-Parolasi-2026!');
    const plaintext = Buffer.from('sensitive emergency value', 'utf8');
    const encrypted = encryptPortableEmergencyPack({ plaintext, passphrase, metadata });
    expect(() => decryptPortableEmergencyPack(encrypted, 'Yanlis-Paket-Parolasi-2026!')).toThrow();

    const tampered = JSON.parse(encrypted.toString('utf8')) as {
      payload:{ ciphertext:string };
      extra?:string;
    };
    const bytes = Buffer.from(tampered.payload.ciphertext, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    tampered.payload.ciphertext = bytes.toString('base64');
    expect(() => decryptPortableEmergencyPack(Buffer.from(JSON.stringify(tampered)), passphrase)).toThrow();
    tampered.extra = 'not-allowed';
    expect(() => parsePortableEmergencyPack(Buffer.from(JSON.stringify(tampered)))).toThrow(/sozlesmesi/i);
    expect(() => parsePortableEmergencyPack(Buffer.from(` ${encrypted.toString('utf8')}`)))
      .toThrow(/sozlesmesi/i);
  });

  it('authenticates metadata as AAD and refuses a selection/profile substitution', () => {
    const encrypted = encryptPortableEmergencyPack({
      plaintext: Buffer.from('card', 'utf8'), passphrase, metadata
    });
    const parsed = JSON.parse(encrypted.toString('utf8')) as {
      metadata:{ profileId:string; selectionSha256:string };
    };
    parsed.metadata.profileId = 'profile-2';
    expect(() => decryptPortableEmergencyPack(Buffer.from(JSON.stringify(parsed)), passphrase)).toThrow();
    parsed.metadata.profileId = metadata.profileId;
    parsed.metadata.selectionSha256 = 'b'.repeat(64);
    expect(() => decryptPortableEmergencyPack(Buffer.from(JSON.stringify(parsed)), passphrase)).toThrow();
  });
});
