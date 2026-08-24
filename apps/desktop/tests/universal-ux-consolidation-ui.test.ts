import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
describe('34-K universal UX consolidation renderer surface',()=>{it('shows authorized search, persona, keyboard ordering and fail-honest provider truth',()=>{
  const source=readFileSync('apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx','utf8');
  for(const marker of ['Yetki filtreli evrensel arama','Kişisel görünüm modu','Ana ekran kart sırası','yukarı','aşağı','Kurulum deneyimi uzun süreli kullanım doğrulaması tamamlanana kadar geliştirme aşamasındadır',
    'QR ve barkod okuma, kamera kırpma, sesle form doldurma, mini panel ve Apple araçları henüz kullanıma hazır değildir','Güvenlik düzeyi kendiliğinden düşürülmez',
    'searchUnifiedAuthorizedRecords({query:normalized,limit:25})','kısmi sonuç gösterilmez','Aramanız kaydedilmez'])expect(source).toContain(marker);
  expect(source).not.toContain('Üretim arama yetki sağlayıcısı yapılandırılmamıştır');
  expect(source).not.toContain('const commands=');
  expect(source).toContain('son doğrulanmış eşitleme: yok');});});
