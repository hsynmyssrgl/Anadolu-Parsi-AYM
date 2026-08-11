# ADR-101 — Protected Device Identity Before Device-Bound Maintenance Restore

## Status

Accepted for Build226.

## Context

Bakım yeniden doğrulama durum zarfı schema v2 ile cihaz kimliği özetine bağlıdır. Fresh profile'da durum dosyası da cihaz kimliği dosyası da mevcut olmayabilir. Build225 sırası, bakım guard restore/persist sırasında kimlik dosyasının önceden var olduğunu varsayarak gerçek Windows başlangıcını durdurdu.

## Architecture

Başlangıç sırası şöyledir:

1. Electron `app.whenReady()` ve startup security preflight.
2. Zorunlu OS secret protector kullanılabilirlik ve round-trip doğrulaması.
3. `FileDeviceIdentityProvider` ile schema v2 korumalı cihaz kimliği oluşturma/yükleme ve anahtar eşleşmesi doğrulaması.
4. Doğrulanmış `deviceId + fingerprint` değerinden cihaz-bağlama SHA-256 özeti türetme.
5. Bakım yeniden doğrulama durumunu restore etme; eksikse boş snapshot'ı korumalı ve cihaz-bağlı biçimde persist etme.
6. OPEN-021/OPEN-022 Windows probe ve normal pencere başlangıcı.

## Failure behavior

Koruma yokluğu, yanlış provider, bozuk kimlik, açılamayan ciphertext veya cihaz-bağlama uyuşmazlığı sessizce atlanmaz. Fatal startup kanıtı gerçek stage/stack ile yazılır ve süreç non-zero kapanır.

## Consequences

Fresh profile ilk açılışı üretim kimlik sağlayıcısıyla güvenli biçimde bootstrap edilir. İkinci açılış aynı kimlik ve durumla restore olur. Device binding ve safeStorage/DPAPI güvenlik sınırı korunur.

