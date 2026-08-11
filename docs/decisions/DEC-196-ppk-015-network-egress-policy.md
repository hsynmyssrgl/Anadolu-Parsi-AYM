# DEC-196 — PPK-015 allowlist ve TLS/mTLS ağ çıkış sınırı

## Durum

32-K kapsamında kabul edildi. PPK-015 üst gereksinimi, sözleşme ve runtime kanıt demetleri eksiksiz geçtiğinde `COMPLETE` durumundadır.

## Karar

Üretim uygulama ve paket kaynakları dış ağa yalnız `apps/desktop/src/main/secure-revocation-list-fetcher.ts` adaptörü üzerinden çıkabilir. `NETWORK_EGRESS_DIRECT_PRIMITIVE_EXCEPTIONS` boş ve değişmezdir. Core Service ile Desktop arasındaki iki `node:net` dosyası yalnız yerel named-pipe/socket taşımasıdır; dış egress yetkisi değildir. Tüm `apps/*/src` ve `packages/*/src` kaynakları typecheck ve production build öncesi statik kapıdan geçer.

Adaptör yalnız `GovernedRevocationListFetchUseCase` tarafından, bu use-case de yalnız `SecureRevocationSyncService` tarafından çağrılır. Politika isteğin exact alanlarını repository uygulama servisinden gelen etkin endpoint allowlist profiliyle bağlar: `windows-desktop`, iptal-listesi amacı, `GET`, endpoint ID, kanonik HTTPS URL, TLS/mTLS modu, mTLS kimlik ID'si ve geçerli SPKI pinleri. Her uyuşmazlık adaptör callback'i açılmadan fail-closed reddedilir.

Taşıma HTTPS 443, işletim sistemi sunucu güven zinciri, TLS 1.3, public-only DNS ve bağlanılan gerçek adres, SPKI SHA-256 pini, 1 MiB yanıt sınırı ve JSON içerik türü gerektirir. Redirect yoktur. İsteğe bağlı mTLS istemci sertifikası ve anahtarı yalnız çalışma zamanı portundan adaptöre gelir; endpoint tablosuna, IPC'ye veya durum görünümüne yazılmaz. Kimlik ID'si policy authority bağlamına exact bağlıdır.

Mevcut `external_backup_revocation_endpoints` tablosu migration 23'ten beri kanonik URL, etkinlik durumu, primary/secondary SPKI, geçiş başlangıcı ve eski pin bitişini taşır. Uygulama use-case'i çift-pin penceresini en fazla 14 günle sınırlar ve güçlü yönetici doğrulaması ister. Yeni kalıcı durum gerekmediği için migration 77 eklenmez; repository ve schema zinciri mevcut endpoint kaydı yeniden kullanılarak kapanır.

Tipli `system:getNetworkEgressBoundary` IPC/preload/domain sözleşmesi ile Sistem ve Bakım görünümü ve profil menüsündeki “Ağ çıkış güvenliği” girişi, fail-closed durumunu ve sıfır istisnayı gösterir. Kanal policy-sensitive no-cache listesine alınmıştır; kalıcı yol, anahtar, sertifika ya da cutover otoritesi taşımaz.

## Gerçeklik sınırı

Gerçek kullanıcı verisi taşınmaz, gerçek internete test isteği gönderilmez, Desktop kasa/SQLite sahipliği değişmez, Core Service family-data oturumu bağlanmaz ve DEC-171 cutover yasağı kaldırılmaz. PPK-012 hassas önbellek/no-cache, PPK-013 doğrudan repository/SQL/SQLite/kasa yasağı ve PPK-014 sürümlü API sınırı gevşetilmez.

## Sonuç

Bu karar yalnız PPK-015 ağ çıkış politikasını kapatır. Yeni egress amacı, yeni adaptör, farklı uygulama kimliği, daha düşük TLS sürümü, redirect yetkisi veya kalıcı mTLS kimlik deposu ayrı kapsam, açık karar ve yeni güvenlik kanıtı gerektirir.
