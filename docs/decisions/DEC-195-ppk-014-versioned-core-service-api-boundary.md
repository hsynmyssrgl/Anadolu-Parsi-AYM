# DEC-195 — PPK-014 sürümlü Core Service API güvenlik sınırı

## Durum

32-J kapsamında kabul edildi. PPK-014 üst gereksinimi, sözleşme ve runtime kanıt demetleri tamamlandığında `COMPLETE` durumuna geçirilir.

## Karar

Core Service dışındaki üretim uygulamaları Core Service iç modüllerini, dispatcher'ı veya yerel socket primitive'ini doğrudan kullanamaz. Tek yetkili Desktop yolu `apps/desktop/src/main/core-service-application-adapter.ts` içindeki `@ppt/core-service-client` adaptörüdür. `VERSIONED_CORE_SERVICE_API_DIRECT_IMPORT_EXCEPTIONS` boş ve değişmezdir; bütün Core dışı uygulama kaynakları typecheck ve üretim build öncesi kötü niyetli öz-sınamalı statik kapıdan geçer.

Yerel API isteği yalnız korumalı başlangıç authority kaydından alınan belirteçle kimlik doğrulandıktan sonra yürütülür. Sunucu exact zarf alanlarını, protokol sürümünü, API sürümünü, istemci uygulama kimliğini, imzalı politika paketindeki istemci uygulama sürümünü, kanonik yöntem allowlist'ini, istek yaşını, ileri saat sapmasını ve tekrar kimliğini callback açılmadan doğrular. Uyuşmazlık, bozuk/fazladan alan, expiry, gelecek zaman, replay ve bounded tekrar defteri kapasitesi fail-closed reddedilir.

İstemci yanıt zarfını protokol/API sürümü, `windows-core-service` sunucu kimliği, istek kimliği, exact anahtar kümesi ve kanonik hata kodu kaydıyla doğrular. Desktop başlangıç handshake'i ayrıca güvenli API durum sözleşmesini exact doğrular; zayıf veya fazladan alanlı durumu `API_BOUNDARY_MISMATCH` ile reddeder.

Tipli `client-api-boundary.status` sözleşmesi ve Sistem menüsü; fail-closed durumunu, `v1` sürümünü, izinli `windows-desktop` kimliğini, freshness/replay korumasını ve sıfır doğrudan import istisnasını gösterir. Bu durum sözleşmesi kalıcı yol, gizli malzeme veya cutover otoritesi taşımaz.

PPK-014 yeni kalıcı domain durumu üretmez. Domain sınırı sürümlü istek/yanıt ve güvenli durum sözleşmeleridir; use-case katmanı politika kararından sonra işlemi açar. Repository ve schema zinciri “yeni kalıcılık gerekmiyor” kararıyla kapanır; migration 77 eklenmez, mevcut migration 76 zinciri korunur.

## Gerçeklik sınırı

Desktop kasası ve etkin SQLite oturumu mevcut yetkili sağlayıcı alanında kalır. SQLite sahipliği değiştirilmez, gerçek kullanıcı verisi taşınmaz, Core Service family-data oturumu bağlanmaz ve DEC-171 cutover yasağı kaldırılmaz. PPK-012 hassas önbellek/policy-sensitive IPC no-cache kuralları ile PPK-013 repository, SQL, SQLite ve kasa doğrudan erişim yasağı gevşetilmez.

## Sonuç

Bu karar yalnız PPK-014 sürümlü istemci API sınırını kapatır. Yeni uygulama kimliği, yeni API ana sürümü, süreçler arası kalıcı replay defteri veya Windows Service kurulumu ayrı kapsam, karar ve kanıt gerektirir.
