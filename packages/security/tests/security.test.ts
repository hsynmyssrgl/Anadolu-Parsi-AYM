import { describe, expect, it } from 'vitest';
import {
  createDataKey,
  decryptBytes,
  encryptBytes,
  hashPassword,
  verifyPassword
} from '../src/index.js';

describe('security primitives', () => {
  it('hashes and verifies a password', () => {
    const record = hashPassword('Guclu-Parola-2026!');
    expect(verifyPassword('Guclu-Parola-2026!', record)).toBe(true);
    expect(verifyPassword('Yanlis-Parola-2026!', record)).toBe(false);
  });

  it('encrypts and decrypts bytes', () => {
    const key = createDataKey();
    const envelope = encryptBytes(Buffer.from('aile hafızası', 'utf8'), key);
    expect(decryptBytes(envelope, key).toString('utf8')).toBe('aile hafızası');
  });

  it('fails closed when an authenticated envelope is tampered', () => {
    const key = createDataKey();
    const envelope = encryptBytes(Buffer.from('private archive payload', 'utf8'), key);
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 1;
    const tampered = { ...envelope, ciphertext: ciphertext.toString('base64') };
    ciphertext.fill(0);
    expect(() => decryptBytes(tampered, key)).toThrow();
    key.fill(0);
  });
});
