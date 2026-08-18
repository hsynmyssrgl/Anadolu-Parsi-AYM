import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('ürün lisansı başlangıç entegrasyonu', () => {
  it('veri tabanı ve Core Service açılmadan önce çift DPAPI lisans kaydını denetler', async () => {
    const source = await readFile('apps/desktop/src/main/main.ts', 'utf8');
    const license = source.indexOf("startupStage = 'PRODUCT_LICENSE_INITIALIZATION'");
    const runtime = source.indexOf("startupStage = 'RUNTIME_BOOTSTRAP'");
    const core = source.indexOf("startupStage = 'CORE_SERVICE_CONNECTION'");
    expect(license).toBeGreaterThan(-1);
    expect(runtime).toBeGreaterThan(license);
    expect(core).toBeGreaterThan(runtime);
    expect(source).toContain("'PPT', 'AYM-Lisans'");
    expect(source).toContain("'Panthera-Pardus-Tulliana', 'AYM-Lisans'");
    expect(source).toContain('30 günlük kullanım süresi sona erdi.');
  });

  it('Gold aktivasyonunu yalnız mutlak, normal ve sınırlı dosyadan ana süreçte kurar', async () => {
    const source = await readFile('apps/desktop/src/main/main.ts', 'utf8');
    expect(source).toContain("--install-gold-activation=");
    expect(source).toContain("productReleaseChannel === 'Gold'");
    expect(source).toContain('metadata.isSymbolicLink()');
    expect(source).toContain('metadata.nlink !== 1');
    expect(source).toContain('productLicenseManager.activateGold');
    expect(source).not.toContain('Gold aktivasyon özel anahtarı');
  });

  it('açık kalan uygulamada süreyi yeniden denetler ve süre biterse güvenle kapanır', async () => {
    const source = await readFile('apps/desktop/src/main/main.ts', 'utf8');
    expect(source).toContain('scheduleLicenseRefresh');
    expect(source).toContain('productLicenseManager!.refresh()');
    expect(source).toContain('Kişisel verileriniz silinmedi.');
    expect(source).toContain('clearTimeout(productLicenseTimer)');
  });
});
