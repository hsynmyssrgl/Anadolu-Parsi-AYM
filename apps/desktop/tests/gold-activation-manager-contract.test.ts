import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('ayrı Gold aktivasyon yöneticisi', () => {
  it('özel anahtarı depo dışında tutar ve kodu stdout yerine dosyaya yazar', async () => {
    const source = await readFile('tools/gold-aktivasyon-yoneticisi/yonetici.mjs', 'utf8');
    expect(source).toContain("if (!outsideRepository(privatePath))");
    expect(source).toContain("flag: 'wx'");
    expect(source).toContain('createGoldActivationCode');
    expect(source).toContain('Gold aktivasyon kodu dosyaya yazıldı');
    expect(source).not.toContain('console.log(code)');
    expect(source).not.toMatch(/privateKeyPem\s*[:,]\s*JSON/u);
  });

  it('uygulamadan cihaz bağını alır ve aktivasyonu main-only komutla kurar', async () => {
    const tool = await readFile('tools/gold-aktivasyon-yoneticisi/yonetici.mjs', 'utf8');
    const main = await readFile('apps/desktop/src/main/main.ts', 'utf8');
    expect(tool).toContain('--write-license-device-binding=');
    expect(tool).toContain('--install-gold-activation=');
    expect(main).toContain('--write-license-device-binding=');
    expect(main).toContain("flag: 'wx'");
    expect(main).toContain('--install-gold-activation=');
  });

  it('Bronze ve Silver kanalında Gold kodunun reddedilmesini güvenlik katmanına bırakır', async () => {
    const security = await readFile('packages/security/src/product-license.ts', 'utf8');
    expect(security).toContain("input.channel !== 'Gold'");
    expect(security).toContain("'CHANNEL_ACTIVATION_MISMATCH'");
  });

  it('Gold renk paletli ayrı görsel uygulamayı ve Windows korumalı anahtar kasasını kurar', async () => {
    const main = await readFile('tools/gold-aktivasyon-yoneticisi/uygulama.mjs', 'utf8');
    const preload = await readFile('tools/gold-aktivasyon-yoneticisi/on-yukleyici.cjs', 'utf8');
    const html = await readFile('tools/gold-aktivasyon-yoneticisi/arayuz/index.html', 'utf8');
    const css = await readFile('tools/gold-aktivasyon-yoneticisi/arayuz/stiller.css', 'utf8');
    expect(main).toContain('safeStorage.encryptString(privateKeyPem)');
    expect(main).toContain('safeStorage.decryptString');
    expect(main).toContain('createGoldActivationCode');
    expect(main).toContain('verifyGoldActivationCode');
    expect(main).toContain("status: 'PROVISIONED', publicKeyPem: vault.publicKeyPem");
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(preload).toContain('ipcRenderer.invoke(channel, input)');
    expect(preload).not.toContain('privateKeyPem');
    expect(html).toContain('ParsYuva Gold Aktivasyon Merkezi');
    expect(html).toContain('ParsYuva</strong><span>Aile Yaşam Merkezi');
    expect(css).toContain('--gold-500: #c8933d');
  });

  it('seri kodunu renderer veya loga vermeden doğrulanmış dosyaya yazar', async () => {
    const main = await readFile('tools/gold-aktivasyon-yoneticisi/uygulama.mjs', 'utf8');
    const renderer = await readFile('tools/gold-aktivasyon-yoneticisi/arayuz/uygulama.js', 'utf8');
    expect(main).toContain('defaultPath: `ParsYuva-Gold-${input.licenseId}.parsyuva-gold`');
    expect(main).toContain('verifyGoldActivationCode(readback');
    expect(main).toContain('lastActivation = Object.freeze({ code');
    expect(renderer).not.toContain('activationCode');
    expect(renderer).not.toContain('privateKey');
    expect(renderer).toContain('result.fileName');
  });

  it('görsel üreticinin kurduğu kodu ana uygulamanın main-only Gold girişine bağlar', async () => {
    const tool = await readFile('tools/gold-aktivasyon-yoneticisi/uygulama.mjs', 'utf8');
    const main = await readFile('apps/desktop/src/main/main.ts', 'utf8');
    expect(tool).toContain('`--install-gold-activation=${temporary}`');
    expect(tool).toContain('`--write-license-device-binding=${outputPath}`');
    expect(main).toContain('productLicenseManager.activateGold');
    expect(main).toContain('Gold aktivasyonu doğrulandı.');
    expect(main).toContain('app.quit()');
  });
});
