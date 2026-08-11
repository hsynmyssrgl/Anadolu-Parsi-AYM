import type { DeviceSecretProtector } from './device-secret-protector.js';

interface ProtectedMfaSecretEnvelope {
  readonly schemaVersion: 1;
  readonly purpose: 'totp';
  readonly protectionId: string;
  readonly encoding: 'base64';
  readonly ciphertextBase64: string;
}

const TOTP_SECRET_PATTERN = /^[A-Z2-7]{16,128}$/u;

export const isValidTotpSecret = (value: string): boolean => TOTP_SECRET_PATTERN.test(value);

const parseEnvelope = (value: string): ProtectedMfaSecretEnvelope | undefined => {
  try {
    const parsed = JSON.parse(value) as Partial<ProtectedMfaSecretEnvelope>;
    if (
      parsed.schemaVersion !== 1
      || parsed.purpose !== 'totp'
      || parsed.encoding !== 'base64'
      || typeof parsed.protectionId !== 'string'
      || parsed.protectionId.length < 3
      || typeof parsed.ciphertextBase64 !== 'string'
      || parsed.ciphertextBase64.length < 4
    ) return undefined;
    return parsed as ProtectedMfaSecretEnvelope;
  } catch {
    return undefined;
  }
};

export const isProtectedMfaSecret = (value: string): boolean => parseEnvelope(value) !== undefined;

export const protectMfaSecret = (protector: DeviceSecretProtector, secret: string): string => {
  if (!isValidTotpSecret(secret)) throw new Error('TOTP sırrı biçimi geçersiz.');
  if (!protector.isAvailable()) throw new Error('İşletim sistemi MFA sırrı koruması kullanılamıyor.');
  const envelope: ProtectedMfaSecretEnvelope = {
    schemaVersion: 1,
    purpose: 'totp',
    protectionId: protector.protectionId,
    encoding: 'base64',
    ciphertextBase64: protector.protect(secret)
  };
  return JSON.stringify(envelope);
};

export const unprotectMfaSecret = (protector: DeviceSecretProtector, storedValue: string): string => {
  const envelope = parseEnvelope(storedValue);
  if (!envelope) throw new Error('Şifreli MFA sırrı zarfı geçersiz.');
  if (envelope.protectionId !== protector.protectionId) {
    throw new Error('Şifreli MFA sırrı farklı bir koruma sağlayıcısına ait.');
  }
  if (!protector.isAvailable()) throw new Error('İşletim sistemi MFA sırrı koruması kullanılamıyor.');
  const secret = protector.unprotect(envelope.ciphertextBase64);
  if (!isValidTotpSecret(secret)) throw new Error('Çözülen TOTP sırrı biçimi geçersiz.');
  return secret;
};
