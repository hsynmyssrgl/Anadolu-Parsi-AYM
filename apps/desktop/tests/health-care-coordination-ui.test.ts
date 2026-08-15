import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('apps/desktop/src/renderer/HealthCareCoordinationPanel.tsx', 'utf8');
const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('33-S health care coordination renderer surface', () => {
  it('extends the existing health screen without creating a competing product route', () => {
    expect(app).toContain("import { HealthCareCoordinationPanel } from './HealthCareCoordinationPanel';");
    expect(app).toContain('<HealthCareCoordinationPanel people={snapshot.people}/>');
    expect(app.match(/<HealthCareCoordinationPanel\b/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'health-care-coordination'");
  });

  it('uses only the four renderer-safe governed bridge methods', () => {
    for (const method of [
      'getHealthCareCoordinationCenter',
      'recordHealthCareEntry',
      'upsertHealthCareAccessGrant',
      'revokeHealthCareAccessGrant'
    ]) expect(panel).toContain(`.${method}(`);
    for (const forbidden of [
      'policyReceipt', 'stateFingerprint', 'requestFingerprint', 'lastMutationId',
      'familyId', 'accountId:', 'rawBytes', 'filePath'
    ]) expect(panel).not.toContain(forbidden);
  });

  it('keeps idempotency identity and original revision stable after a failed mutation', () => {
    expect(panel).toContain('pending.current.get(key)');
    expect(panel).toContain('expectedRevision:center?.revision??0');
    expect(panel).toContain("pending.current.delete('entry')");
    expect(panel).toContain('pending.current.delete(`grant:${caregiverAccountId}`)');
    expect(panel).toContain('pending.current.delete(`revoke:${grantId}`)');
    expect(panel).toContain('Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.');
  });

  it('states local-only and external-evidence limits without implying medical verification', () => {
    expect(panel).toContain('Tıbbi doğrulama veya sağlık kayıt sistemi sorgusu yapılmaz.');
    expect(panel).toContain('Sensör, uzaktan yardım, acil servis araması ve dış yardım teslimi yapılandırılmadı');
    expect(panel).toContain('bu ekran yalnız yerel kayıt ve görünüm sağlar');
    expect(panel).toContain('Genel sağlık verisi otomatik açılmaz; yalnız seçtiğiniz kapsamlar paylaşılır.');
  });

  it('offers scoped caregiver access, measurements and accessible large-text presentation', () => {
    expect(panel).toContain("useState<readonly HealthCareAccessScope[]>(['appointments','measurements'])");
    expect(panel).toContain("caregiverCanRecord?['read','record']:['read']");
    expect(panel).toContain("new Set<HealthCareEntryKind>([");
    expect(panel).toContain("kind==='blood_pressure'");
    expect(panel).toContain('aria-pressed={largeText}');
    expect(panel).toContain('aria-live="polite"');
    expect(styles).toContain('.health-care-large-text');
    expect(styles).toContain('@media (forced-colors: active)');
  });
});
