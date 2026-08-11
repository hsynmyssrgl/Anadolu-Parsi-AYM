# Panthera pardus tulliana — Bronze MVP-51 Build Durumu

- Kullanıcı sürümü: `23.07.2026.51`
- Paket sürümü: `23.7.2026-51`
- Kanal: `Bronze`
- Milestone: `B060-M11 — MFA Recovery & Trusted Device Identity`
- Sonuç: **Başarılı kaynak teslimi**

## Tamamlanan temel işler

- TOTP üretme/doğrulama primitive’leri security paketine taşındı.
- İki aşamalı doğrulama kurulum ve etkinleştirme use-case’leri eklendi.
- Sekiz adet tek kullanımlık kurtarma kodu oluşturuluyor; yalnızca SHA-256 hash’leri saklanıyor.
- Kurtarma kodu tüketimi hesap güncellemesi ve audit kaydıyla aynı transaction içinde yürütülüyor.
- Ed25519 tabanlı cihaz kimliği ve imzalı cihaz kanıtı eklendi.
- Cihaz özel anahtarı SQLite verisinden ayrı secret dizininde tutuluyor.
- `trusted_devices` tablosu ve `SqliteTrustedDeviceRepository` eklendi.
- Güvenilir cihaz listeleme, güvenme ve iptal use-case’leri eklendi.
- Yeni cihazın eski cihaz güvenini otomatik devralması engellendi.
- MFA kapatıldığında tüm aktif cihaz güvenleri iptal ediliyor.
- Auth state, mevcut cihaz ve kalan kurtarma kodu sayısını taşıyor.

## Doğrulama

- TypeScript workspace: `12/12`
- Electron main/preload typecheck: başarılı
- Foundation: `14/14`
- Runtime: `6/6`
- Migration: `9/9`
- SQLite smoke: `14/14`
- Repository/outbox: `10/10`
- Transaction atomikliği: `9/9`
- Event dispatcher: `3/3`
- Family use-case: `14/14`
- Genealogy: `6/6`
- Timeline: `17/17`
- Dashboard/navigation: `14/14`
- Authentication/session: `16/16`
- MFA/güvenilir cihaz: `16/16`
- Toplam: `148/148`
- IPC eşleşmesi: `128/128`
- Migration: `6`
- Uygulama/güvenlik tablosu: `41`
- Altyapı tablosu: `4`

## Sınırlar

- Tam Electron/Vite/Vitest production build’i ve Windows installer bu Bronze ara geliştirme turunda yeniden çalıştırılmadı.
- Windows DPAPI/Hello tabanlı OS-backed secret store cihaz taşıma ve security sertleştirme milestone’una bırakıldı.
- Kapsamlı manuel UI, kurulum ve ekran görüntüsü doğrulamaları Silver aşamasında toplu yürütülecektir.
