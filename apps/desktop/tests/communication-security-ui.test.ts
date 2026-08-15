import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const panel = readFileSync('apps/desktop/src/renderer/CommunicationSecurityPanel.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('34-A communication policy and MLS foundation renderer surface', () => {
  it('extends the existing system management surface exactly once without a new route', () => {
    expect(app).toContain("import { CommunicationSecurityPanel } from './CommunicationSecurityPanel';");
    expect(app.match(/<CommunicationSecurityPanel\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'communication-security'");
    expect(app.indexOf('<CommunicationSecurityPanel/>')).toBeGreaterThan(app.indexOf('function SystemManagementScreen'));
  });

  it('uses all nine renderer-safe bridge methods and preserves retry identity', () => {
    for (const method of [
      'getCommunicationSecurityCenter', 'registerCommunicationDeviceCredential',
      'revokeCommunicationDeviceCredential', 'createCommunicationRoom', 'addCommunicationRoomMember',
      'removeCommunicationRoomMember', 'rekeyCommunicationRoomAfterDeviceRevocation',
      'setCommunicationHistoryAccess', 'freezeCommunicationRoom'
    ]) expect(panel).toContain(`.${method}(`);
    expect(panel).toContain('operations.current.get(key)');
    expect(panel).toContain('operations.current.delete(key);');
    expect(panel).toContain('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.');
    for (const forbidden of ['messageBody', 'plaintext', 'ciphertext', 'keyPackageRef', 'sealedProviderStateRef', 'policyReceipt']) {
      expect(panel).not.toContain(forbidden);
    }
  });

  it('keeps provider-dependent cryptographic writes fail-closed and states every no-claim boundary', () => {
    expect(panel).toContain('const providerReady=false;');
    for (const marker of [
      'Bu ekran mesaj göndermez ve anahtar yönetmez.', 'Production RFC 9420 sağlayıcısı',
      'ileri gizlilik', 'saldırı sonrası güvenlik', 'relay içerik körlüğü',
      'mesaj imzası', 'gerçek ağ teslimi doğrulanmadı',
      'Yeni üyeler katılım öncesi geçmişi varsayılan göremez',
      'explicit snapshot kararı bu foundation içinde içerik paylaşmaz',
      '0</strong> gönderilmiş mesaj'
    ]) expect(panel).toContain(marker);
    expect(panel).toContain('disabled={Boolean(busy)||!providerReady}');
    expect(panel).not.toMatch(/RFC 9420 uyumludur|ileri gizlilik sağlanır|relay içeriği göremez|mesaj teslim edildi/iu);
  });

  it('covers all room types and exposes accessible, bounded local controls', () => {
    for (const roomType of ['direct', 'family', 'household', 'family_branch', 'event', 'care', 'private_topic']) {
      expect(panel).toContain(`${roomType}:`);
    }
    for (const marker of [
      'aria-labelledby="communication-security-title"', 'role="note"', 'aria-label="İletişim odası oluşturma"',
      'aria-label="Oda adı"', 'maxLength={160}', 'aria-label="Oda türü"',
      'aria-label="Oda sahibi cihaz kimliği"', 'aria-label="Üye kişi kimliği"',
      'aria-label="Üye cihaz kimliği"'
    ]) expect(panel).toContain(marker);
    for (const selector of [
      '.communication-security{', '.communication-security-truth{', '.communication-security-summary{',
      '.communication-security-devices{', '.communication-security-room{', '.communication-security-room-actions{'
    ]) expect(styles).toContain(selector);
    expect(styles).toContain('var(--shell-warning,#9b6b08)');
  });
});
