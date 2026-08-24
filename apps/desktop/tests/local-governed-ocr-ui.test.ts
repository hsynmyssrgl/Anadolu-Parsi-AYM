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
    expect(panel).toContain('Aynı işlemi yeniden deneyebilirsiniz.');
  });

  it('presents offline state without using it as local authorization and states claim limits', () => {
    expect(panel).toContain('Bu yalnız bilgilendirmedir; yerel metin tanıma izni ağ durumuna göre değişmez.');
    for (const truth of [
      "Metin tanıma bu bilgisayarda yapılır",
      "işletim sistemi düzeyindeki ek yalıtım doğrulanmamıştır",
      "PDF hazırlama veya güvenlik taraması kullanılamıyorsa işlem güvenle durdurulur",
      "üretilen sonuçların temizliği de otomatik olarak sürdürülür",
      "Sıradaki veya çalışan iş iptal edilebilir",
      "!['queued', 'running'].includes(selectedJob.status)",
      "selectedJob.status === 'running' ? text('Çalışan işi iptal et','Cancel running job')",
      "Sıradaki işi iptal et",
      "Türetilmiş sonucu silmek kaynak belgeyi silmez"
    ]) expect(panel).toContain(truth);
    expect(panel).toContain('Tam metin dizini sonuçla birlikte şifreli alanda tutulur');
    expect(panel).not.toContain('if (!networkOnline) return');
  });

  it('binds source eligibility, async states, explicit result reveal and accessible layout', () => {
    expect(panel).toContain("new Set(['image/png', 'image/jpeg'])");
    expect(panel).toContain('MAX_INPUT_BYTES = 16 * 1_024 * 1_024');
    expect(panel).toContain("AsyncStatePanel state=\"loading\" title={text('Yerel metin tanıma merkezi yükleniyor','Loading the local text-recognition center')}");
    expect(panel).toContain("AsyncStatePanel state=\"error\" title={text('Yerel metin tanıma merkezi yüklenemedi','The local text-recognition center could not be loaded')}");
    expect(panel).toContain('Sonucu açıkça görüntüle');
    expect(panel).toContain("aria-label={text('Metin tanıma sonucu düzeltme alanı','Text-recognition result correction field')}");
    expect(panel).toContain('id="local-ocr-search-query"');
    expect(panel).toContain('searchLocalGovernedOcr({ query: searchQuery, limit: 10 })');
    expect(panel).toContain('sonuç ekranında tekrarlanmaz');
    for(const technical of ['child process','sandbox','renderer sonucunda','Yerel OCR merkezi','yerel OCR yetkisini'])expect(panel).not.toContain(technical);
    expect(styles).toContain('.local-ocr-center');
    expect(styles).toContain('.local-ocr-search-results');
    expect(styles).toContain('.local-ocr-result textarea');
  });
});
