# Bronze RC2 Build 126 Durum Kaydı

- Application Version: `27.07.2026.126`
- Package Version: `27.7.2026-126`
- Stage: **Bronze RC2 Active Development**
- Next: **Build 127 Active Development**

## Tamamlanan geliştirme

- Apple sistem yazı ailesi tek bir merkezi font yığını olarak tanımlandı.
- Büyük başlık, başlık 1–3, gövde, alt başlık, dipnot ve açıklama tokenları eklendi.
- Sayfa başlıkları, panel başlıkları, normal metinler, formlar, düğmeler, menüler ve ikincil metinler semantik ölçeğe bağlandı.
- Önceki 7–12 px dağınık metinlerin görünür etkisi okunabilir 11–17 px ölçeğiyle değiştirildi.
- Form kontrolleri ve temel etkileşim hedefleri en az 44 px yüksekliğe taşındı.
- Genel etiketlerde zorunlu büyük harf dönüşümü kaldırıldı.
- Apple font dosyaları uygulamaya gömülmedi; sistem ve güvenli fallback yazı ailesi kullanıldı.

## Gerçek doğrulama durumu

- Build 126 tipografi sözleşmesi: **PASS — 28 assertion**.
- Kaynak bütünlüğü: **PASS**.
- Deterministik kaynak ZIP yeniden üretilebilirliği: **PASS**.
- Temiz `npm ci`: **NOT_RUN**.
- Tam root `tsc --noEmit`: **NOT_RUN**.
- Testler: **NOT_RUN**.
- Electron production build: **NOT_RUN**.
- UI etkileşim doğrulaması: **NOT_RUN**.
- Windows açılış ve installer: **NOT_RUN**.

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
