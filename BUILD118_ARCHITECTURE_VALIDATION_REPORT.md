# Build 118 Mimari Doğrulama Raporu

- Application Version: `25.07.2026.118`
- Package Version: `25.7.2026-118`
- Stage: **Bronze RC2 Active Development**

## Hedefli sonuçlar

- Electron IPC sender trust sözleşmesi: **PASS — 40 assertion**.
- Build 118 entegrasyon doğrulaması: **PASS — 17 assertion**.
- Kayıtlı ana renderer `webContents.id` eşleşmesi: **ZORUNLU**.
- `senderFrame === sender.mainFrame` ana-frame sınırı: **ZORUNLU**.
- Renderer belgesi: **tam kanonik URL eşleşmesi; hash değişimi hariç**.
- URL-prefix kandırması, farklı path/query, alt frame, farklı pencere kimliği ve geçersiz URL: **REJECTED**.
- Geliştirme renderer kaynağı: **yalnız loopback http(s)**.
- Dış bağlantılar: **yalnız kimlik bilgisiz HTTPS**.
- Güvenilmeyen IPC çağrıları: **iş handler’ına ulaşmadan security kategorisiyle reddedilir ve yapılandırılmış loga yazılır**.

Bu rapor full workspace compile, Electron production build veya Windows çalışma kanıtı değildir.
