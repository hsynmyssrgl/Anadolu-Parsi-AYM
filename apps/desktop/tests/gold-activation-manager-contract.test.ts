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
});
