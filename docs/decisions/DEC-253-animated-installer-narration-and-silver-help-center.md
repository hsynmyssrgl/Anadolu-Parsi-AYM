# DEC-253 — Animasyonlu kurulum, yenilenmiş anlatım ve Silver sesli Yardım Merkezi

- Tarih: 17.08.2026
- Durum: ACTIVE
- Kanal gerçeği: Bronze kaynak geliştirmesi; Silver gerçek erişilebilirlik ve kullanıcı kabul doğrulaması

## Karar

Windows yardımcı kurulum sihirbazı, Anadolu Parsı görsel kimliğine uygun hafif hareketler ve açık Türkçe metinler kullanacaktır. Karşılama ile kuruluma hazır ekranları; hedef klasörü, kurulumun ne yapacağını, kurulum sırasında aile verisi oluşturulmayacağını ve sonraki ilk açılış adımını açıkça gösterecektir. Hareket yalnız yerel NSIS zamanlayıcısı ve ilerleme kontrolleriyle yapılır; ağ, haricî süreç veya yeni yetki yüzeyi açmaz.

İlk açılış anlatımı üç kısa adıma ayrılır. Kullanıcı anlatımı durdurabilir, baştan oynatabilir, yavaşlatabilir, sesi kapatabilir veya metni sessiz okuyabilir. Görsel hareket azaltma tercihi ve işletim sistemi `prefers-reduced-motion` ayarı animasyonları kapatır.

Uygulamada ayrı bir rota oluşturmayan, F1 ve üst çubuktaki Yardım düğmesiyle açılan Sesli Yardım Merkezi bulunacaktır. Yardım; başlangıç, açık ekran, gizlilik, erişilebilirlik ve sorun giderme konularını Türkçe metin ve yerel işletim sistemi konuşma senteziyle sunar. Metin her zaman görünürdür; ses kullanılamazsa işlev fail-closed olarak yazılı açıklamada kalır.

## Sürüm sınırı

Bu kullanıcı özelliği Bronze kaynakta tamamlanır. Silver yeni özellik eklemez; gerçek Windows kurulum ekranı, Türkçe ses kalitesi, Narrator, klavye, büyütme, yüksek kontrast, hareket azaltma ve kullanıcı kabul testlerini yürütür. Bu dış ve manuel kanıtlar PASS olmadan Silver kabulü veya tam erişilebilirlik iddiası kurulmaz.

## Etkilenen alanlar

- `apps/desktop/build/installer.nsh`
- `apps/desktop/scripts/verify-installer.mjs`
- `apps/desktop/src/renderer/accessibility.ts`
- `apps/desktop/src/renderer/NarratedHelpCenter.tsx`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/tests/installer-narration-experience.test.ts`
- `apps/desktop/tests/narrated-help-center.test.ts`
- `config/remaining-scope-package-roadmap.json`
- `docs/current/03_AKTIF_UX_ERISILEBILIRLIK_SOZLESMESI.md`
- `docs/04_RELEASE_PLAN.md`

## Açık kabul kanıtları

- Gerçek Windows NSIS ekran akışı ve animasyon UAT
- Gerçek kurulu uygulama ilk açılışı
- Türkçe ses kalitesi ve anlaşılabilirlik UAT
- Narrator, klavye, yüksek kontrast, büyütme ve hareket azaltma UAT
- İşitme ve görme erişilebilirliği kullanıcı incelemesi

Bu karar kaynak geliştirmesini yetkilendirir; çalıştırılmayan gerçek platform veya insan testini PASS saymaz.
