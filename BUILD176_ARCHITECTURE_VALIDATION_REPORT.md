# Build 176 Mimari Doğrulama Raporu

## Karar

Build 176, bakım kurtarması sonrası kimlik güven zincirini oturum ve cihaz katmanlarında tamamlar. Katman yönü korunur:

`Renderer → preload allowlist → Electron main IPC → DataStore application façade → application use-case → repository contracts → SQLite repositories`

Renderer doğrudan hesap, oturum, özel anahtar veya veritabanına erişmez. İmzalama ana süreçte OS korumalı cihaz anahtarı üzerinden yapılır.

## Güvenlik özellikleri

- Oturum başlangıcında hesap güvenlik dönemi snapshot'a bağlanır.
- Her korunan işlemde hesap/oturum dönemi fail-closed karşılaştırılır.
- Eski oturum otomatik temizlenir ve kullanıcıdan yeniden giriş istenir.
- Yeniden yetkilendirme eski cihaz kaydını canlandırmaz; güncel dönemde yeni güven kaydı oluşturur.
- Makbuz sabit kanonik payload, SHA-256 ve Ed25519 imzasıyla değişikliğe duyarlıdır.
- Ham hesap kimliği makbuzda yer almaz.
- Cihaz özel anahtarı main process dışına çıkmaz.
- Güvenilir cihaz SQL INSERT sözleşmesi 10 sütun/10 parametre olarak düzeltilmiştir.

## Kanıt

- Build 176 contract: **52/52 PASS**
- Build 176 runtime: **23/23 PASS**
- Build 176 syntax: **14/14 PASS**
- Build 175 continuity: **50/50 + 15/15 + 12/12 PASS**
- Build 174 continuity: **10/10 + 6/6 PASS**
- Build 173 continuity: **81/81 + 42/42 + 13/13 PASS**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**

## Sınırlama

Kontrollü TypeScript ve izole runtime kapıları gerçek source uyumunu denetler; temiz lockfile-pinned `npm ci`, full root testleri, production Electron runtime ve Windows installer uyumluluğunun yerine geçmez.
