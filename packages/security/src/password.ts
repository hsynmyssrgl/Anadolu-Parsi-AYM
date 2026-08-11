import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export interface PasswordRecord {
  algorithm: 'scrypt';
  salt: string;
  hash: string;
  keyLength: number;
}

export function hashPassword(password: string): PasswordRecord {
  if (password.length < 12) {
    throw new Error('Parola en az 12 karakter olmalıdır.');
  }
  const salt = randomBytes(16);
  const keyLength = 32;
  const derived = scryptSync(password.normalize('NFKC'), salt, keyLength, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return {
    algorithm: 'scrypt',
    salt: salt.toString('base64'),
    hash: derived.toString('base64'),
    keyLength
  };
}

export function verifyPassword(password: string, record: PasswordRecord): boolean {
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  const actual = scryptSync(password.normalize('NFKC'), salt, record.keyLength, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
