# 32-K PPK-015 ağ çıkış politikası üst kapanışı

Durum: `COMPLETE / PASS`

## Kapanan sınırlar

- Tüm üretim uygulama ve paket kaynaklarında doğrudan dış ağ primitive erişimi sıfır istisnalıdır; tek yetkili dış egress adaptörü güvenli iptal-listesi fetcher'ıdır.
- Merkezi use-case, repository kökenli etkin allowlist profilini `windows-desktop`, amaç, `GET`, endpoint ID, kanonik URL, TLS/mTLS modu, istemci kimlik ID'si ve SPKI pinleriyle exact bağlar.
- HTTPS 443, TLS 1.3, işletim sistemi güven zinciri, SPKI pinning, public-only DNS ve gerçek uzak adres denetimi zorunludur.
- Tüm redirect'ler, özel/yerel/ayrılmış adresler, bağlam uyuşmazlığı, bozuk pin seti, yanlış uygulama/amaç/yöntem ve bozuk yanıt fail-closed reddedilir.
- Mevcut migration 23 allowlist ve en fazla 14 günlük primary/secondary SPKI rotasyon şeması yeniden kullanılır; migration 77 veya kalıcı mTLS özel anahtar alanı eklenmez.
- Tipli IPC/preload sözleşmesi yalnız güvenlik duruşunu gösterir; policy-sensitive no-cache, UI ve menü görünürlüğü bağlıdır.

## Çalıştırılmış doğrulamalar

- PPK-015 hedefli politika/use-case testleri: 17/17 PASS.
- PPK-012, PPK-013 ve PPK-014 hedefli regresyonları: 49/49 PASS.
- Üretim kaynak egress taraması: 18 alan / 330 dosya / 0 bulgu; 6/6 kötü niyetli öz-sınama PASS.
- TypeScript: 0 diagnostic.
- Resmî PPK-015 sözleşmesi: 51/51 PASS; runtime demeti: 7/7 PASS.
- Tam Vitest: tek worker ile 64 dosya / 459 test PASS.
- Üretim build: 18 workspace paketi, Core Service, Electron main/preload ve renderer PASS.
- Platform Policy runtime: 8/8; Core Service sınırı: 8/8 PASS.
- Lockfile: 533 doğrulama / 18 workspace PASS.
- Supply: 435 doğrulama / 135 kanonik dış tarball PASS.
- Workspace: 497 doğrulama / 18 workspace; üretim grafiği döngüsüz PASS.
- Karar defteri: 273 kontrol / 50 karar PASS.
- Bronze audit: `PASS_WITH_OPEN_SCOPE`; resmî %25, strict %8, implementation-chain %8,2571.

## Gerçeklik sınırı

- Gerçek internete doğrulama isteği gönderilmemiş ve gerçek veri taşınmamıştır.
- Desktop kasası ve etkin SQLite oturumu korunmuş; SQLite sahipliği aktarılmamıştır.
- Core Service family-data oturumu bağlanmamış, cutover otoritesi eklenmemiş ve DEC-171 kaldırılmamıştır.
- mTLS sertifikası/özel anahtarı IPC, endpoint repository'si veya durum görünümü üzerinden açığa çıkarılmaz.
- PPK-012 hassas önbellek/no-cache, PPK-013 doğrudan veri erişim ve PPK-014 sürümlü Core API çitleri gevşetilmemiştir.

Bu kapanış yalnız PPK-015 gereksinimini tamamlar; diğer Bronze kapsamı açık kalır.
