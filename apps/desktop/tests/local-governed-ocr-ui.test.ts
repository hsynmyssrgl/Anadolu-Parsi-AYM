import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('apps/desktop/src/renderer/LocalGovernedOcrPanel.tsx', 'utf8');
const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('33-Q local governed OCR renderer surface', () => {
  it('extends the existing archive screen without a new product route', () => {
    expect(app).toContain("import { LocalGovernedOcrPanel } from './LocalGovernedOcrPanel';");
    expect(app).toContain('<LocalGovernedOcrPanel selectedSource={selected ? {');
    expect(app.match(/<LocalGovernedOcrPanel\b/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'local-ocr'");
  });

  it('uses all renderer-safe bridge methods and never exposes source deletion', () => {
    for (const method of [
      'getLocalGovernedOcrCenter', 'getLocalGovernedOcrResult', 'searchLocalGovernedOcr', 'createLocalGovernedOcrJob',
      'runLocalGovernedOcrJob', 'cancelLocalGovernedOcrJob', 'correctLocalGovernedOcrResult',
      'rerunLocalGovernedOcrJob', 'deleteLocalGovernedOcrJob', 'setLocalGovernedOcrEnabled'
    ]) expect(panel).toContain(`.${method}(`);
    expect(panel).not.toContain('propagateSourceDeletion');
    expect(panel).not.toContain('sealedResultId');
    expect(panel).not.toContain('inputSha256');
    expect(panel).not.toContain('policyReceipt');
  });

  it('keeps mutation identity and original CAS revision stable across a failed retry', () => {
    expect(panel).toContain('pendingOperations.current.get(key)');
    expect(panel).toContain('existing?.expectedRevision === expectedRevision');
    expect(panel).toContain('pendingOperations.current.delete(key);');
    expect(panel).toContain('if (committed) await refresh(false);');
    expect(panel).toContain('Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.');
  });

  it('presents offline state without using it as local authorization and states claim limits', () => {
    expect(panel).toContain('Bu yalnız sunum bilgisidir; yerel OCR yetkisini tarayıcı ağ durumu belirlemez.');
    for (const truth of [
      "İşleme ağ ve bulut kullanmaz",
      "düşük ayrıcalıklı sandbox doğrulanmış değildir",
      "PDF rasterizer ve kötü amaçlı yazılım sağlayıcısı yoksa işlem fail-closed reddedilir",
      "kalıcı iş günlüğünden otomatik ve aynı işlem kimliğiyle sürdürülür",
      "Sıradaki veya çalışan iş iptal edilebilir",
      "!['queued', 'running'].includes(selectedJob.status)",
      "selectedJob.status === 'running' ? 'Çalışan işi iptal et'",
      "Sıradaki işi iptal et",
      "Türetilmiş sonucu silmek kaynak belgeyi silmez"
    ]) expect(panel).toContain(truth);
    expect(panel).toContain('Tam metin dizini sonuçla birlikte şifreli kasada tutulur');
    expect(panel).not.toContain('if (!networkOnline) return');
  });

  it('binds source eligibility, async states, explicit result reveal and accessible layout', () => {
    expect(panel).toContain("new Set(['image/png', 'image/jpeg'])");
    expect(panel).toContain('MAX_INPUT_BYTES = 16 * 1_024 * 1_024');
    expect(panel).toContain('AsyncStatePanel state="loading" title="Yerel OCR merkezi yükleniyor"');
    expect(panel).toContain('AsyncStatePanel state="error" title="Yerel OCR merkezi yüklenemedi"');
    expect(panel).toContain('Sonucu açıkça görüntüle');
    expect(panel).toContain('aria-label="OCR sonucu düzeltme metni"');
    expect(panel).toContain('id="local-ocr-search-query"');
    expect(panel).toContain('searchLocalGovernedOcr({ query: searchQuery, limit: 10 })');
    expect(panel).toContain('renderer sonucunda yankılanmaz');
    expect(styles).toContain('.local-ocr-center');
    expect(styles).toContain('.local-ocr-search-results');
    expect(styles).toContain('.local-ocr-result textarea');
  });
});
