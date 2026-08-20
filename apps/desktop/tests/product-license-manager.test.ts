import { link, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createGoldActivationCode, type DeviceSecretProtector, type GoldActivationPayload } from '@ppt/security';
import { ProductLicenseManager } from '../src/main/product-license-manager.js';

class FixtureProtector implements DeviceSecretProtector {
  readonly protectionId = 'fixture-dpapi'; readonly required = true;
  isAvailable(): boolean { return true; }
  protect(secret: string): string { return Buffer.from(secret, 'utf8').toString('base64'); }
  unprotect(value: string): string { return Buffer.from(value, 'base64').toString('utf8'); }
}

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50
  })));
});
const paths = async () => {
  const root = await mkdtemp(join(tmpdir(), 'aym-license-')); roots.push(root);
  return { primaryPath: join(root, 'local', 'license.pptlicense'), anchorPath: join(root, 'anchor', 'license.pptlicense') };
};

describe('DPAPI korumalı çift lisans kaydı', () => {
  it('30 günlük kaydı iki ayrı yerde oluşturur ve yeniden kurulumda başlangıcı korur', async () => {
    const storage = await paths(); let now = new Date('2026-08-18T00:00:00.000Z');
    const options = { ...storage, protector: new FixtureProtector(), channel: 'Bronze' as const, deviceBindingSha256: 'a'.repeat(64), clock: () => now, installationId: () => 'installation_123456789' };
    const first = new ProductLicenseManager(options);
    expect(await first.initialize()).toMatchObject({ allowed: true, decision: 'trial', daysRemaining: 30 });
    now = new Date('2026-09-18T00:00:00.000Z');
    const reinstalled = new ProductLicenseManager(options);
    expect(await reinstalled.initialize()).toMatchObject({ allowed: false, reason: 'TRIAL_EXPIRED' });
    expect((await readFile(storage.primaryPath, 'utf8'))).not.toContain('installation_123456789');
    expect((await readFile(storage.anchorPath, 'utf8'))).not.toContain('installation_123456789');
  });

  it('tek kayıp kopyayı onarır, çelişen ve symlink kaydı reddeder', async () => {
    const storage = await paths();
    const options = { ...storage, protector: new FixtureProtector(), channel: 'Silver' as const, deviceBindingSha256: 'b'.repeat(64), clock: () => new Date('2026-08-18T00:00:00.000Z'), installationId: () => 'installation_123456789' };
    await new ProductLicenseManager(options).initialize();
    await rm(storage.primaryPath);
    expect(await new ProductLicenseManager(options).initialize()).toMatchObject({ allowed: true });
    await rm(storage.primaryPath);
    await link(storage.anchorPath, storage.primaryPath);
    await expect(new ProductLicenseManager(options).initialize()).rejects.toThrow(/güvenilir/u);
  });

  it('Gold kodunu doğrulayıp iki kayda yazar ve yıllar sonra açık tutar', async () => {
    const storage = await paths(); let now = new Date('2026-08-18T00:00:00.000Z');
    const keys = generateKeyPairSync('ed25519');
    const privateKey = keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicKey = keys.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const payload: GoldActivationPayload = { schemaVersion: 1, productId: 'tr.anadoluparsi.aileyasammerkezi', licenseId: 'gold_license_001', channel: 'Gold', deviceBindingSha256: 'c'.repeat(64), issuedAt: now.toISOString(), perpetual: true };
    const manager = new ProductLicenseManager({ ...storage, protector: new FixtureProtector(), channel: 'Gold', deviceBindingSha256: 'c'.repeat(64), goldPublicKeyPem: publicKey, clock: () => now, installationId: () => 'installation_123456789' });
    await manager.initialize();
    expect(await manager.activateGold(createGoldActivationCode(payload, privateKey))).toMatchObject({ decision: 'perpetual' });
    now = new Date('2036-08-18T00:00:00.000Z');
    expect(await manager.refresh()).toMatchObject({ allowed: true, perpetual: true });
  });
});
