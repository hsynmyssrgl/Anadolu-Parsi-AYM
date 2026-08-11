# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 209

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.209`
- Package Version: `1.8.2026-209`
- Stage: **Bronze RC2 Active Development**
- Build: **209**
- Rule Set: `PROJECT-RULES-2026-08-01-V4`
- Rule SHA-256: `6259d2c757caf865aedfe99a7bcea0a1a333551415b0912a856ac571876274f9`

## Kapsam

Build 209 güvenli ilk kullanım, yerel güçlü parola, zorunlu TOTP/kurtarma kurulumu, Apple/Google/Microsoft dış kimlik sağlayıcı mimarisi ve giriş öncesi kilitli kullanıcı veri kasasını uygular. Kalıcı ana kullanıcı verisi AES-256-GCM kasada tutulur; veri anahtarı scrypt parola türetimi ve Windows safeStorage/DPAPI cihaz korumasıyla bağlanır. Logout, oturum süresi dolumu ve kapanışta geçici veritabanı mühürlenir ve silinir. Arşiv belgeleri haricî uygulamaya açık dosya olarak verilmez; uygulama içi güvenli önizleme kullanılır.

## Doğrulama

- Build209 secure onboarding/vault contract: **PASS — 43 kontrol / 170 kural**
- User-data vault runtime: **PASS — 7/7**
- Package source TypeScript: **PASS — TypeScript 5.8.3 kontrollü kaynak kontrolü**
- Desktop main source TypeScript: **PASS — kontrollü external type shell**
- Renderer/preload syntax: **PASS — 3 dosya**
- Project provenance: **PASS — 8/8**
- Source preflight gate: **PASS**
- Source integrity: **PASS**
- Deterministik kaynak arşivi: **PASS — ZIP doğrulaması ve byte-identical yeniden üretim doğrulandı**
- Clean install gate: **FAIL — bağımlılık erişim ortamı kararlı değil; önceki paket denemesinde 404, yeniden denemede dış servis erişimi kesildi**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**
- Apple/Google/Microsoft canlı OIDC: **PENDING/NOT_RUN — sağlayıcı kayıtları, Client ID/redirect URI ve gerçek Windows testi gerekir**

## Açık güvenlik sınırları

- `OPEN-021`: aktif oturumdaki SQLite için sayfa/in-use şifreleme veya eşdeğer çözüm Bronze Final öncesi kapanacaktır.
- `OPEN-022`: hassas log/cache/diagnostic/export/crash/evidence yan artifactları şifreleme veya doğrulanmış sanitizasyonla Bronze Final öncesi kapanacaktır.
- Aynı Windows kullanıcısı yetkisindeki malware/yöneticiye karşı mutlak erişim engeli iddia edilmez.
