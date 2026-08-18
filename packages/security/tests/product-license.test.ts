import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  advanceProductLicenseLedger,
  createGoldActivationCode,
  createProductLicenseLedger,
  evaluateProductLicense,
  verifyGoldActivationCode,
  type GoldActivationPayload
} from '../src/product-license.js';

const installedAt = '2026-08-18T00:00:00.000Z';
const binding = 'a'.repeat(64);
const ledger = createProductLicenseLedger({ installationId: 'installation_123456789', deviceBindingSha256: binding, installedAt });
const keys = generateKeyPairSync('ed25519');
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const payload: GoldActivationPayload = Object.freeze({
  schemaVersion: 1, productId: 'tr.anadoluparsi.aileyasammerkezi', licenseId: 'gold_license_001',
  channel: 'Gold', deviceBindingSha256: binding, issuedAt: installedAt, perpetual: true
});

describe('30 günlük ürün lisansı ve Gold aktivasyonu', () => {
  it('Bronze, Silver ve aktivasyonsuz Gold için yalnız 30 günlük deneme verir', () => {
    for (const channel of ['Bronze', 'Silver', 'Gold'] as const) {
      expect(evaluateProductLicense({ channel, ledger, observedAt: '2026-09-16T23:59:59.000Z' })).toMatchObject({ allowed: true, decision: 'trial' });
      expect(evaluateProductLicense({ channel, ledger, observedAt: '2026-09-18T00:00:01.000Z' })).toMatchObject({ allowed: false, reason: 'TRIAL_EXPIRED' });
    }
  });

  it('cihaza bağlı Ed25519 Gold kodunu doğrular ve sınırsız kullanım verir', () => {
    const activationCode = createGoldActivationCode(payload, privateKey);
    expect(verifyGoldActivationCode(activationCode, publicKey, binding, '2026-08-18T00:01:00.000Z')).toEqual(payload);
    const activated = advanceProductLicenseLedger(ledger, installedAt, activationCode);
    expect(evaluateProductLicense({ channel: 'Gold', ledger: activated, observedAt: '2036-08-18T00:00:00.000Z', goldPublicKeyPem: publicKey }))
      .toMatchObject({ allowed: true, decision: 'perpetual', reason: 'GOLD_ACTIVATION_VALID' });
  });

  it('sahte imza, yabancı cihaz, Bronze aktivasyonu ve saat geri almayı reddeder', () => {
    const code = createGoldActivationCode(payload, privateKey);
    const forged = `${code.slice(0, -2)}${randomBytes(1).toString('hex')}`;
    expect(() => verifyGoldActivationCode(forged, publicKey, binding, installedAt)).toThrow();
    expect(() => verifyGoldActivationCode(code, publicKey, 'b'.repeat(64), installedAt)).toThrow(/cihaza/u);
    const activated = advanceProductLicenseLedger(ledger, installedAt, code);
    expect(evaluateProductLicense({ channel: 'Bronze', ledger: activated, observedAt: installedAt, goldPublicKeyPem: publicKey })).toMatchObject({ allowed: false, reason: 'CHANNEL_ACTIVATION_MISMATCH' });
    const observed = advanceProductLicenseLedger(ledger, '2026-08-20T00:00:00.000Z');
    expect(evaluateProductLicense({ channel: 'Bronze', ledger: observed, observedAt: installedAt })).toMatchObject({ allowed: false, reason: 'CLOCK_ROLLBACK_DETECTED' });
  });

  it('deneme süresini tam 30 gün ve son gözlemi monoton tutar', () => {
    expect(ledger.trialEndsAt).toBe('2026-09-17T00:00:00.000Z');
    expect(advanceProductLicenseLedger(ledger, '2026-08-17T23:59:00.000Z').lastObservedAt).toBe(installedAt);
  });
});
