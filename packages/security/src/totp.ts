import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface TotpSetupMaterial {
  readonly secret: string;
  readonly recoveryCodes: readonly string[];
  readonly recoveryCodeHashes: readonly string[];
}

export interface RecoveryCodeConsumption {
  readonly valid: boolean;
  readonly remainingHashes: readonly string[];
}

export const encodeBase32 = (buffer: Uint8Array): string => {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)] ?? '';
  }
  return output;
};

export const decodeBase32 = (value: string): Buffer => {
  const clean = value.toUpperCase().replace(/=|\s/gu, '');
  let bits = '';
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('TOTP anahtarı geçersiz.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
};

export const generateTotpCode = (secret: string, timestampMs = Date.now()): string => {
  const counter = Math.floor(timestampMs / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = (((digest[offset] ?? 0) & 0x7f) << 24)
    | (((digest[offset + 1] ?? 0) & 0xff) << 16)
    | (((digest[offset + 2] ?? 0) & 0xff) << 8)
    | ((digest[offset + 3] ?? 0) & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
};

export const verifyTotpCode = (
  secret: string,
  code: string,
  timestampMs = Date.now(),
  window = 1
): boolean => {
  const clean = code.trim();
  if (!/^\d{6}$/u.test(clean)) return false;
  for (let step = -window; step <= window; step += 1) {
    const expected = generateTotpCode(secret, timestampMs + step * 30_000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true;
  }
  return false;
};

export const normalizeRecoveryCode = (code: string): string =>
  code.trim().toUpperCase().replace(/[^A-Z0-9]/gu, '');

export const hashRecoveryCode = (code: string): string =>
  createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');

export const generateRecoveryCodes = (count = 8): readonly string[] => {
  if (!Number.isInteger(count) || count < 1 || count > 32) {
    throw new Error('Kurtarma kodu sayısı 1 ile 32 arasında olmalıdır.');
  }
  return Object.freeze(Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  }));
};

export const createTotpSetupMaterial = (): TotpSetupMaterial => {
  const recoveryCodes = generateRecoveryCodes(8);
  return {
    secret: encodeBase32(randomBytes(20)),
    recoveryCodes,
    recoveryCodeHashes: Object.freeze(recoveryCodes.map(hashRecoveryCode))
  };
};

export const consumeRecoveryCode = (
  storedHashes: readonly string[],
  candidate: string
): RecoveryCodeConsumption => {
  const candidateHash = hashRecoveryCode(candidate);
  const index = storedHashes.findIndex((hash) => {
    const left = Buffer.from(hash);
    const right = Buffer.from(candidateHash);
    return left.length === right.length && timingSafeEqual(left, right);
  });
  if (index < 0) return { valid: false, remainingHashes: storedHashes };
  return {
    valid: true,
    remainingHashes: Object.freeze(storedHashes.filter((_, itemIndex) => itemIndex !== index))
  };
};

export const createOtpAuthUri = (input: {
  readonly issuer: string;
  readonly accountName: string;
  readonly secret: string;
}): string => {
  const label = `${input.issuer}:${input.accountName}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(input.secret)}&issuer=${encodeURIComponent(input.issuer)}&algorithm=SHA1&digits=6&period=30`;
};
