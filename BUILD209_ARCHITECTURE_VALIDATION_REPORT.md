# Build 209 Architecture Validation Report

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.209`
- Package Version: `1.8.2026-209`
- Stage: **Bronze RC2 Active Development**
- Build: **209**

## Mimari karar

Kalıcı kullanıcı veri yolu doğrudan SQLite değildir. Uygulama başlangıcında yalnız runtime/kimlik kabuğu çalışır; kullanıcı doğrulanmadan `FamilyDataStore` oluşturulamaz. Doğrulama başarılı olduğunda AES-256-GCM kasası parola + Windows cihaz korumasıyla açılır, rastgele geçici oturum dizininde SQLite materyalize edilir. Store kapanışı WAL checkpoint uygular; logout/timeout/quit sonrası veritabanı yeniden şifrelenir ve geçici dizin silinir.

Haricî Apple/Google/Microsoft kimliği yerel authorization modelinden ayrıdır. Canlı OIDC henüz doğrulanmadığından production-ready sayılmaz.

Arşiv materyalizasyonu dış uygulamaya verilmez; bytes uygulama içinde okunup geçici dosya hemen silinir ve sandboxed internal preview kullanılır.

## Kanıt

- Build209 contract: PASS 43 kontrol
- Vault runtime: PASS 7 kontrol
- Package source typecheck: PASS
- Desktop main source typecheck: PASS
- Renderer/preload transpile syntax: PASS
- Provenance: PASS 8 kontrol
- Clean npm install: FAIL — dependency mirror 404; mimari/kod hatası olarak sınıflandırılmadı ancak clean gate PASS değildir.
