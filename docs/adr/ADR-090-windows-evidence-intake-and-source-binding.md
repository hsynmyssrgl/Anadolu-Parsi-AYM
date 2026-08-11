# ADR-090 — Windows evidence intake ve exact-source binding mimarisi

## Bağlam

Build215 gerçek Windows EFS, Electron `safeStorage`/DPAPI, development + paketli Electron ve installer kanıtlarını üretecek harness'i hazırladı. Ancak Windows'ta oluşan ZIP'in daha sonra hangi exact kaynak snapshotından üretildiğini ve taşıma sırasında değiştirilip değiştirilmediğini bağımsız kabul katmanında doğrulayacak bağlayıcı bir mekanizma yoktu.

## Karar

Windows runner kanıt üretiminden sonra `build{N}-windows-evidence-manifest.json` üretir. Manifest:

- build/application/package sürümünü,
- host adının SHA-256 takma kimliğini,
- `manifest.json` ve `SHA256SUMS.txt` hashlerini,
- her zorunlu kanıt dosyasının byte boyutu ve SHA-256 değerini,
- dosyanın mevcut olup olmadığını

taşır.

Kanıt ZIP'i bu manifesti de içerir ve ZIP'in kendisi için ayrı `.sha256` dosyası oluşturulur.

`scripts/lib/windows-evidence-intake.mjs` platform-bağımsız doğrulama katmanıdır. Bu katman Windows operasyonlarını yeniden çalıştırmaz; taşınmış kanıtların bütünlüğünü ve içerik iddialarını doğrular. Exact source binding eşleşmezse, dosya boyutu/hash saparsa, diagnostic sandbox sonucu resmî kanıt gibi sunulursa, development veya packaged kanıt eksikse, EFS/DPAPI/Protected Side Artifact/installer/audit sonucu PASS değilse kabul FAIL olur.

## Güvenlik özellikleri

- Tek bir özet JSON'a güvenilmez; zorunlu kanıtların her biri hash ile bağlanır.
- Kaynak ağacı iki ayrı kök (`manifest.json`, `SHA256SUMS.txt`) üzerinden bağlanır.
- Host açık adı kalıcı kanıta yazılmaz; yalnız SHA-256 takma değeri tutulur.
- Intake işlemi Ana Build Defteri'ni değiştirmez; kanıt kabulü ile yönetişim mutasyonu ayrıdır.
- Sentetik runtime testi geçerli fixture'ı kabul edip sonradan değiştirilmiş dosyayı SHA uyuşmazlığıyla reddetmek zorundadır.

## Sonuçlar

Bu mimari Windows makinesi ile geliştirme/inceleme ortamı arasındaki kanıt taşımasını güvenilir hale getirir, ancak gerçek Windows çalıştırmasının yerine geçmez. Build216 non-Windows ortamında OPEN-021/022 statüsünü değiştirmez.
