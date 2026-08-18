import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
describe('34-K universal UX consolidation renderer surface',()=>{it('shows authorized search, persona, keyboard ordering and fail-honest provider truth',()=>{
  const source=readFileSync('apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx','utf8');
  for(const marker of ['Yetki filtreli evrensel arama','Kişisel görünüm modu','Ana ekran kart sırası','yukarı','aşağı','Gerçek Windows installer yaşam döngüsü ve 7 günlük soak kanıtı henüz yoktur',
    'QR/barkod, kamera kırpma, sesle form, Windows mini paneli ve Apple widget sağlayıcıları yapılandırılmamıştır','Politika zayıflatma otomatik etkinleşmez',
    'searchUnifiedAuthorizedRecords({query:normalized,limit:25})','kısmi sonuç gösterilmez','kalıcı arama geçmişine yazılmaz'])expect(source).toContain(marker);
  expect(source).not.toContain('Üretim arama yetki sağlayıcısı yapılandırılmamıştır');
  expect(source).not.toContain('const commands=');
  expect(source).toContain('son doğrulanmış senkronizasyon: yok');});});
