import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const panel = readFileSync('apps/desktop/src/renderer/SmartHomeEnergyPanel.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('33-Y smart home and energy renderer surface', () => {
  it('extends the existing life center exactly once without a new route', () => {
    expect(app).toContain("import { SmartHomeEnergyPanel } from './SmartHomeEnergyPanel';");
    expect(app.match(/<SmartHomeEnergyPanel\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'smart-home-energy'");
    expect(app).toContain("activeLifeModule==='smart-home'");
  });

  it('uses only the four safe bridge methods and preserves retry identity', () => {
    for (const method of ['getSmartHomeEnergyCenter', 'grantSmartHomeCameraConsent', 'revokeSmartHomeCameraConsent',
      'setSmartHomeProcessing']) expect(panel).toContain(`.${method}(`);
    for (const forbidden of ['registerSmartHomeDevice', 'recordSmartHomeObservation', 'updateSmartHomeDeviceStatus'])
      expect(panel).not.toContain(`.${forbidden}(`);
    expect(panel).toContain('operationIds.current.get(key)');
    expect(panel).toContain('pendingGrant.current');
    expect(panel).toContain('command.signature!==signature');
    expect(panel).toContain('fixedClientOperationId??operation(key)');
    expect(panel).toContain('Aynı işlem kimliğiyle yeniden deneyebilirsiniz');
    expect(panel).toContain('İşlem kaydedildi; görünüm yenilenemedi');
  });

  it('enforces visible time-bounded consent and states every no-claim boundary', () => {
    for (const marker of ['min={5}', 'max={60}', 'Number.isInteger(minutes)', "purpose==='doorbell_answer'", 'Gizli gözetim yasaktır',
      'Ham kamera/ses saklanmaz', 'varsayılan kapalı', 'Akıllı ev eşleme', 'canlı hizmet bağlantısı',
      'cihaz kontrolü', 'bulut ve haricî teslimat bu sürümde kullanılmaz']) expect(panel).toContain(marker);
    for(const technical of ['Local and fail-closed','cihaz metadatası','fail‑closed','retention kurtarması','{device.providerId}','{device.adapterId}'])expect(panel).not.toContain(technical);
    expect(panel).not.toMatch(/Matter cihazlarını eşler|kamerayı uzaktan açar|buluta yükler|sağlayıcı kullanılabilirliği garanti/iu);
  });

  it('keeps the inventory, observations and consent panel accessible and responsive', () => {
    for (const labelledBy of ['smart-home-energy-title', 'smart-home-devices-title', 'smart-home-observations-title',
      'smart-home-consent-title']) expect(panel).toContain(`aria-labelledby="${labelledBy}"`);
    for (const selector of ['.smart-home-energy{', '.smart-home-truth{', '.smart-home-grid{', '.smart-home-row{',
      '.smart-home-consent form{', '@media(max-width:900px)']) expect(styles).toContain(selector);
    for(const marker of ['storageCapacity.devices.remaining','storageCapacity.observations.remaining',
      'storageCapacity.cameraConsents.remaining','storageCapacity.mutations.remaining','effectiveStatus'])expect(panel).toContain(marker);
  });
});
