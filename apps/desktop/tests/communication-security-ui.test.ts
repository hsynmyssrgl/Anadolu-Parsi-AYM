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
      'Bu ekran mesaj göndermez ve anahtar yönetmez.', 'Gerçek ağ üzerinden güvenli mesajlaşma',
      'geçmişi koruma', 'kayıp cihaz sonrası güvenliği yenileme', 'mesaj doğrulama henüz hazır değildir',
      'Yeni üyeler katılmadan önceki geçmişi varsayılan olarak göremez',
      'ayrı geçmiş paylaşımı seçilse bile bu ekran içerik aktarmaz',
      'Kapsamlı kaynak yetkilendirmesi henüz uygulanmadı',
      'otomatik saklama temizliği henüz yoktur',
      "<strong>0</strong> {text('gönderilmiş mesaj','sent messages')}"
    ]) expect(panel).toContain(marker);
    expect(panel).toContain('disabled={Boolean(busy)||!providerReady');
    for(const technicalCopy of ['MLS dönem temeli','politika receipt','güvenli metadata','Production RFC 9420','relay içerik körlüğü','explicit snapshot','Metadata kotaları','fail-closed','Production MLS'])expect(panel).not.toContain(technicalCopy);
    expect(panel).not.toMatch(/RFC 9420 uyumludur|ileri gizlilik sağlanır|relay içeriği göremez|mesaj teslim edildi/iu);
  });

  it('covers all room types and exposes accessible, bounded local controls', () => {
    for (const roomType of ['direct', 'family', 'household', 'family_branch', 'event', 'care', 'private_topic']) {
      expect(panel).toContain(`${roomType}:`);
    }
    for (const marker of [
      'aria-labelledby="communication-security-title"', 'role="note"', "aria-label={text('İletişim odası oluşturma','Create communication room')}",
      "aria-label={text('Oda adı','Room name')}", 'maxLength={160}', "aria-label={text('Oda türü','Room type')}",
      "aria-label={text('Oda sahibi cihaz kimliği','Room owner device credential')}", "aria-label={text('Üye kişi kimliği','Member person ID')}",
      "aria-label={text('Üye cihaz kimliği','Member device credential')}"
    ]) expect(panel).toContain(marker);
    for (const marker of [
      'center.storageCapacity.deviceCredentials', 'center.storageCapacity.rooms', 'center.storageCapacity.mutations',
      'room.storageCapacity.memberships', 'room.storageCapacity.epochs', 'replacementDeviceCredentialId'
    ]) expect(panel).toContain(marker);
    for (const selector of [
      '.communication-security{', '.communication-security-truth{', '.communication-security-summary{',
      '.communication-security-devices{', '.communication-security-room{', '.communication-security-room-actions{'
    ]) expect(styles).toContain(selector);
    expect(styles).toContain('var(--shell-warning,#9b6b08)');
  });
});
