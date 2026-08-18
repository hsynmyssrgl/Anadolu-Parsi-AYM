import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export type ProductLicenseChannel = 'Bronze' | 'Silver' | 'Gold';
export type ProductLicenseDecision = 'trial' | 'perpetual' | 'blocked';
export type ProductLicenseReason =
  | 'TRIAL_ACTIVE'
  | 'GOLD_ACTIVATION_VALID'
  | 'TRIAL_EXPIRED'
  | 'CLOCK_ROLLBACK_DETECTED'
  | 'ACTIVATION_INVALID'
  | 'CHANNEL_ACTIVATION_MISMATCH'
  | 'LEDGER_INVALID';

export interface GoldActivationPayload {
  readonly schemaVersion: 1;
  readonly productId: 'tr.anadoluparsi.aileyasammerkezi';
  readonly licenseId: string;
  readonly channel: 'Gold';
  readonly deviceBindingSha256: string;
  readonly issuedAt: string;
  readonly perpetual: true;
}

export interface ProductLicenseLedger {
  readonly schemaVersion: 1;
  readonly installationId: string;
  readonly deviceBindingSha256: string;
  readonly installedAt: string;
  readonly trialEndsAt: string;
  readonly lastObservedAt: string;
  readonly activationCode?: string;
}

export interface ProductLicenseStatusView {
  readonly channel: ProductLicenseChannel;
  readonly decision: ProductLicenseDecision;
  readonly reason: ProductLicenseReason;
  readonly allowed: boolean;
  readonly trialEndsAt: string;
  readonly daysRemaining: number;
  readonly perpetual: boolean;
  readonly clockRollbackDetected: boolean;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const LICENSE_ID = /^[A-Za-z0-9_-]{8,64}$/u;
const INSTALLATION_ID = /^[A-Za-z0-9_-]{16,96}$/u;
const DAY_MS = 86_400_000;
const CLOCK_SKEW_MS = 5 * 60_000;
const PRODUCT_ID = 'tr.anadoluparsi.aileyasammerkezi' as const;
const ACTIVATION_KEYS = ['channel', 'deviceBindingSha256', 'issuedAt', 'licenseId', 'perpetual', 'productId', 'schemaVersion'] as const;
const LEDGER_KEYS = ['activationCode', 'deviceBindingSha256', 'installationId', 'installedAt', 'lastObservedAt', 'schemaVersion', 'trialEndsAt'] as const;

const canonicalJson = (value: Record<string, unknown>): string => JSON.stringify(
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))
);
const base64Url = (value: Uint8Array): string => Buffer.from(value).toString('base64url');
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).sort().join('\u0000') === [...allowed].filter((key) => value[key] !== undefined).sort().join('\u0000');
const validIso = (value: unknown): value is string =>
  typeof value === 'string' && new Date(value).toISOString() === value;

export const validateProductLicenseLedger = (value: unknown): value is ProductLicenseLedger => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ledger = value as Record<string, unknown>;
  if (!exactKeys(ledger, LEDGER_KEYS)) return false;
  if (ledger.schemaVersion !== 1 || typeof ledger.installationId !== 'string' || !INSTALLATION_ID.test(ledger.installationId)
    || typeof ledger.deviceBindingSha256 !== 'string' || !SHA256.test(ledger.deviceBindingSha256)
    || !validIso(ledger.installedAt) || !validIso(ledger.trialEndsAt) || !validIso(ledger.lastObservedAt)
    || Date.parse(ledger.trialEndsAt) - Date.parse(ledger.installedAt) !== 30 * DAY_MS
    || Date.parse(ledger.lastObservedAt) < Date.parse(ledger.installedAt)
    || (ledger.activationCode !== undefined && (typeof ledger.activationCode !== 'string' || ledger.activationCode.length > 4096))) return false;
  return true;
};

const parseActivationPayload = (payloadBytes: Buffer): GoldActivationPayload => {
  if (payloadBytes.length < 64 || payloadBytes.length > 2048) throw new Error('Gold aktivasyon yükü sınır dışında.');
  const value = JSON.parse(payloadBytes.toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Gold aktivasyon yükü geçersiz.');
  const payload = value as Record<string, unknown>;
  if (!exactKeys(payload, ACTIVATION_KEYS) || payload.schemaVersion !== 1 || payload.productId !== PRODUCT_ID
    || payload.channel !== 'Gold' || payload.perpetual !== true || typeof payload.licenseId !== 'string'
    || !LICENSE_ID.test(payload.licenseId) || typeof payload.deviceBindingSha256 !== 'string'
    || !SHA256.test(payload.deviceBindingSha256) || !validIso(payload.issuedAt)) throw new Error('Gold aktivasyon alanları geçersiz.');
  if (canonicalJson(payload) !== payloadBytes.toString('utf8')) throw new Error('Gold aktivasyon yükü canonical değil.');
  return payload as unknown as GoldActivationPayload;
};

export const createGoldActivationCode = (payload: GoldActivationPayload, privateKeyPem: string): string => {
  const payloadBytes = Buffer.from(canonicalJson(payload as unknown as Record<string, unknown>), 'utf8');
  parseActivationPayload(payloadBytes);
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Gold aktivasyon özel anahtarı Ed25519 olmalıdır.');
  return `${base64Url(payloadBytes)}.${base64Url(sign(null, payloadBytes, privateKey))}`;
};

export const verifyGoldActivationCode = (
  code: string,
  publicKeyPem: string,
  expectedDeviceBindingSha256: string,
  observedAt: string
): GoldActivationPayload => {
  if (!SHA256.test(expectedDeviceBindingSha256) || !validIso(observedAt) || typeof code !== 'string' || code.length > 4096) {
    throw new Error('Gold aktivasyon doğrulama girdisi geçersiz.');
  }
  const segments = code.split('.');
  if (segments.length !== 2 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/u.test(segment))) throw new Error('Gold aktivasyon kodu biçimi geçersiz.');
  const payloadBytes = Buffer.from(segments[0]!, 'base64url');
  const signature = Buffer.from(segments[1]!, 'base64url');
  if (signature.length !== 64) throw new Error('Gold aktivasyon imzası geçersiz.');
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== 'ed25519' || !verify(null, payloadBytes, publicKey, signature)) throw new Error('Gold aktivasyon imzası doğrulanamadı.');
  const payload = parseActivationPayload(payloadBytes);
  if (payload.deviceBindingSha256 !== expectedDeviceBindingSha256) throw new Error('Gold aktivasyon kodu bu cihaza ait değil.');
  if (Date.parse(payload.issuedAt) > Date.parse(observedAt) + CLOCK_SKEW_MS) throw new Error('Gold aktivasyon zamanı gelecekte.');
  return payload;
};

export const createProductLicenseLedger = (input: {
  readonly installationId: string;
  readonly deviceBindingSha256: string;
  readonly installedAt: string;
}): ProductLicenseLedger => {
  const ledger: ProductLicenseLedger = Object.freeze({
    schemaVersion: 1,
    installationId: input.installationId,
    deviceBindingSha256: input.deviceBindingSha256,
    installedAt: input.installedAt,
    trialEndsAt: new Date(Date.parse(input.installedAt) + 30 * DAY_MS).toISOString(),
    lastObservedAt: input.installedAt
  });
  if (!validateProductLicenseLedger(ledger)) throw new Error('Başlangıç lisans defteri geçersiz.');
  return ledger;
};

export const evaluateProductLicense = (input: {
  readonly channel: ProductLicenseChannel;
  readonly ledger: ProductLicenseLedger;
  readonly observedAt: string;
  readonly goldPublicKeyPem?: string;
}): ProductLicenseStatusView => {
  const base = (decision: ProductLicenseDecision, reason: ProductLicenseReason, allowed: boolean, perpetual = false, rollback = false): ProductLicenseStatusView => {
    const remaining = Math.max(0, Date.parse(input.ledger.trialEndsAt) - Date.parse(input.observedAt));
    return Object.freeze({
      channel: input.channel, decision, reason, allowed, trialEndsAt: input.ledger.trialEndsAt,
      daysRemaining: perpetual ? 0 : Math.ceil(remaining / DAY_MS), perpetual, clockRollbackDetected: rollback
    });
  };
  if (!validateProductLicenseLedger(input.ledger) || !validIso(input.observedAt)) return base('blocked', 'LEDGER_INVALID', false);
  if (input.ledger.deviceBindingSha256.length !== 64) return base('blocked', 'LEDGER_INVALID', false);
  if (Date.parse(input.observedAt) + CLOCK_SKEW_MS < Date.parse(input.ledger.lastObservedAt)) {
    return base('blocked', 'CLOCK_ROLLBACK_DETECTED', false, false, true);
  }
  if (input.ledger.activationCode !== undefined) {
    if (input.channel !== 'Gold') return base('blocked', 'CHANNEL_ACTIVATION_MISMATCH', false);
    try {
      if (!input.goldPublicKeyPem) throw new Error('Gold güven anahtarı yapılandırılmamış.');
      verifyGoldActivationCode(input.ledger.activationCode, input.goldPublicKeyPem, input.ledger.deviceBindingSha256, input.observedAt);
      return base('perpetual', 'GOLD_ACTIVATION_VALID', true, true);
    } catch {
      return base('blocked', 'ACTIVATION_INVALID', false);
    }
  }
  return Date.parse(input.observedAt) <= Date.parse(input.ledger.trialEndsAt)
    ? base('trial', 'TRIAL_ACTIVE', true)
    : base('blocked', 'TRIAL_EXPIRED', false);
};

export const advanceProductLicenseLedger = (
  ledger: ProductLicenseLedger,
  observedAt: string,
  activationCode = ledger.activationCode
): ProductLicenseLedger => {
  if (!validateProductLicenseLedger(ledger) || !validIso(observedAt)) throw new Error('Lisans defteri ilerletilemedi.');
  const next: ProductLicenseLedger = Object.freeze({
    ...ledger,
    lastObservedAt: new Date(Math.max(Date.parse(ledger.lastObservedAt), Date.parse(observedAt))).toISOString(),
    ...(activationCode ? { activationCode } : {})
  });
  if (!validateProductLicenseLedger(next)) throw new Error('İlerletilmiş lisans defteri geçersiz.');
  return next;
};
