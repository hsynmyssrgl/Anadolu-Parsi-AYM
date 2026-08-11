# Bronze RC2 Active Development — Build 144

- **Ürün:** Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.144`
- Package Version: `28.7.2026-144`
- Stage: **Bronze RC2 Active Development**
- **Sonraki geliştirme noktası:** Build 145

## Tamamlanan ana geliştirme

İmzalı iptal listesi HTTPS kaynakları sağlayıcıya bağlı kalıcı profile taşındı.
Birincil ve geçiş TLS SPKI pinleri, sınırlı geçiş penceresi, güçlü doğrulamalı
profil değişikliği ve son alım sonucu kaydı eklendi.

## Gerçek hedefli kontroller

- Build 144 profil/pin sözleşmesi: **PASS — 43/43**
- Pin geçişi runtime senaryoları: **PASS — 26/26**
- Renderer/preload/global sözdizimi: **PASS — 3/3**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Kaynak envanteri: **PASS — 1.188 kaynak / 1.189 SHA girdisi**

## Çalıştırılmayan geniş kapılar

- Temiz `npm ci`: **NOT_RUN**
- Tam root `tsc --noEmit`: **NOT_RUN**
- Tüm birim ve entegrasyon testleri: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke: **NOT_RUN**
- Gerçek sağlayıcı TLS pin rotasyonu: **NOT_RUN**
- Windows açılışı ve installer: **NOT_RUN**
