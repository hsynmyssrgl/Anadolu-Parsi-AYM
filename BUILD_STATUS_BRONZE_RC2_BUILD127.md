# Bronze RC2 Build 127 Durum Kaydı

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.127`
- Package Version: `27.7.2026-127`
- Stage: **Bronze RC2 Active Development**
- Next: **Build 128 Active Development**

## Tamamlanan geliştirme

- Tüm sohbetlerde ve tarihsel belgelerde oluşan bağlayıcı kararlar birleştirildi.
- 41 maddelik Ana Karar Kaydı oluşturuldu.
- Belge önceliği ve çelişki çözüm sırası tanımlandı.
- Güncel 16 modüllü ürün kapsamı belgelendi.
- Mimari, güvenlik, veri sahipliği, yedekleme ve platform kararları güncellendi.
- Build 123–126 UI/UX ve Apple tipografi kararları aktif standarda işlendi.
- PASS/FAIL/NOT_RUN ve otomatik promotion yasağı tek sürüm yönetişim belgesinde toplandı.
- ADR seti 12 karara çıkarıldı.
- Eski dar kapsam belgeleri güncel aktif kararlarla uyumlu hâle getirildi.
- Bağımlılıksız Build 127 belge yönetişimi sözleşmesi eklendi.

## Gerçek doğrulama durumu

- Build 127 belge yönetişimi sözleşmesi: **PASS — 136 assertion**.
- Aktif teslim belgeleri sözleşmesi: **PASS — 121 assertion**.
- Kaynak bütünlüğü: **PASS — 1032 kaynak / 1033 SHA-256 girdisi**.
- Deterministik arşiv yeniden üretimi: **PASS — 1034 giriş / byte-identical**.
- Kaynak ZIP içerik ve deterministik metadata doğrulaması: **PASS — 1034 giriş**.

Temiz `npm ci`, tam TypeScript, test, production build, UI etkileşimi ve Windows
installer bu artırımda yeniden çalıştırılmayacaktır ve NOT_RUN kalacaktır.

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
