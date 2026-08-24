import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const panel = readFileSync('apps/desktop/src/renderer/SignedPluginPlatformPanel.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('33-Z signed plugin platform renderer surface', () => {
  it('extends the existing system management surface exactly once without a new route', () => {
    expect(app).toContain("import { SignedPluginPlatformPanel } from './SignedPluginPlatformPanel';");
    expect(app.match(/<SignedPluginPlatformPanel\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'signed-plugin-platform'");
    expect(app.indexOf('<SignedPluginPlatformPanel/>')).toBeGreaterThan(app.indexOf('function SystemManagementScreen'));
  });

  it('uses only safe bridge methods and preserves retry identity', () => {
    for (const method of [
      'getSignedPluginPlatformCenter', 'setSignedPluginDesiredState', 'emergencyDisableSignedPlugin', 'rollbackSignedPlugin'
    ]) expect(panel).toContain(`.${method}(`);
    for (const forbidden of ['registerSignedPluginManifest', 'installSignedPlugin', 'setPluginSigningKey', 'readSignedPluginPackage']) {
      expect(panel).not.toContain(`.${forbidden}(`);
    }
    expect(panel).toContain('operations.current.get(key)');
    expect(panel).toContain('Aynı işlem kimliğiyle yeniden deneyebilirsiniz');
    expect(panel).toContain('Değişiklik kaydedildi; güncel merkez yeniden yüklenemedi');
    expect(panel.indexOf('operations.current.delete(key)')).toBeGreaterThan(panel.indexOf('await run(operationId(key))'));
    expect(panel).toContain('signedPluginProviderLabel(kind,language)');
  });

  it('states every non-execution and external-provider no-claim boundary', () => {
    for (const marker of [
      'Bu ekran eklenti kodu çalıştırmaz', 'Canlı sürüm imza güveni', 'çalışma alanı yalıtımı',
      'banka, okul, sağlık, akıllı ev, dosya, harita, metin tanıma, yapay zekâ veya tarayıcı bağlantıları doğrulanmamıştır',
      "<strong>0</strong> {text('çalıştırılmış eklenti','executed plugins')}", 'Eski kayıtlar otomatik silinmez', 'En düşük uygulama sürümü'
    ]) expect(panel).toContain(marker);
    for(const technical of ['Production imza güveni','sandbox/ağ izolasyonu','SBOM','provenance hash','retention kurtarma','capabilityCodes.join','exact egress hostu'])expect(panel).not.toContain(technical);
    expect(panel).not.toMatch(/eklenti kodunu çalıştırır|production için uygundur|sağlayıcı bağlantısı hazırdır/iu);
  });

  it('keeps the registry and emergency actions accessible and responsive', () => {
    expect(panel).toContain('aria-labelledby="signed-plugin-platform-title"');
    for (const label of ['Etkin olmasını iste', 'Acil kapat', 'Önceki sürüme dön']) expect(panel).toContain(label);
    expect(panel).toContain("item.desiredState==='emergency_disabled'||!item.rollbackAvailable");
    expect(panel).toContain('Yerel güvenilen imza anahtarıyla doğrulanmış eklenti adayı yok');
    for (const selector of [
      '.signed-plugin-platform{', '.signed-plugin-truth{', '.signed-plugin-summary{', '.signed-plugin-card{',
      '.signed-plugin-actions{', '@media(max-width:900px)'
    ]) expect(styles).toContain(selector);
  });
});
