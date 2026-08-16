import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
describe('34-K universal UX consolidation renderer surface',()=>{it('shows command, persona, keyboard ordering and fail-honest provider truth',()=>{
  const source=readFileSync('apps/desktop/src/renderer/UniversalUxConsolidationPanel.tsx','utf8');
  for(const marker of ['Komut paleti ve arama','Kişisel görünüm modu','Ana ekran kart sırası','yukarı','aşağı','gerçek Windows installer yaşam döngüsü ve 7 günlük soak kanıtı yoktur',
    'QR/barkod, kamera kırpma, sesle form, Windows mini paneli ve Apple widget sağlayıcıları yapılandırılmamıştır','Politika zayıflatma otomatik etkinleşmez',
    'yalnız sabit gezinme komutlarının yerel önizlemesidir','yetkilendirilmiş evrensel veri araması değildir',
    'Üretim arama yetki sağlayıcısı yapılandırılmamıştır'])expect(source).toContain(marker);
  expect(source).toContain('son doğrulanmış senkronizasyon: yok');});});
