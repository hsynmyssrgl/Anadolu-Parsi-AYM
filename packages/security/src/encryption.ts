import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedEnvelope {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
}

export const createDataKey = (): Buffer => randomBytes(32);

export function encryptBytes(plain: Uint8Array, key: Uint8Array): EncryptedEnvelope {
  if (key.byteLength !== 32) throw new Error('AES-256 anahtarı 32 bayt olmalıdır.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

export function decryptBytes(envelope: EncryptedEnvelope, key: Uint8Array): Buffer {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]);
}
