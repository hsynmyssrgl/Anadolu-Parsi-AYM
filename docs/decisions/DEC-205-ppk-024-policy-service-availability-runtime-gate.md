# DEC-205 — PPK-024 canlı Policy Service availability runtime kapısı

## Durum

ACTIVE / COMPLETE — 2026-08-12; uygulama ve final doğrulama zinciri tamamlandı.

## Bağlam

PPK-003 güvenilir politika bağımlılıklarının sınırlı sürede sonuçlanmaması halinde varsayılan reddi, PPK-007 imzalı ve sürümlü policy paketini, PPK-009 kararın Core Service tarafından yeniden değerlendirilmesini ve PPK-012 hassas offline cache kilidini tamamladı. Bunların hiçbiri tek başına Policy Service yaşam döngüsü, güncel paket imzası, başlangıçta sabitlenen sürüm/hash bağı ve gözlem tazeliğini her hassas işlemden önce tek bir çalışma modu kararında birleştirmiyordu.

## Karar

1. Tek kanonik model `PolicyServiceAvailabilityPolicy` ve üç moddur: `read-write`, `read-only`, `deny`.
2. Her değerlendirme authenticated yerel Core Service health çağrısından yeni gözlem alır. Core Service aynı çağrıda belleğindeki policy paketini kernel HMAC doğrulayıcısıyla yeniden doğrular; yalnız biçim/hash kontrolü imza doğrulaması sayılmaz.
3. Desktop başlangıç bağlantısında korumalı connection authority içindeki policy sürümünü ve authenticated başlangıç paketinin paket sürümü ile SHA-256 değerini süreç ömrü için sabitler. Sessiz runtime rotasyonu kabul edilmez; yeni güvenilir handshake gerekir.
4. `undefined`, malformed, imzası geçersiz, policy sürümü/paket sürümü/paket hash'i farklı, service not-ready, çelişkili lifecycle, gelecek zamanlı veya stale gözlem `deny` olur. Deny hassas okuma ve mutation callback'ini authority çözümünden önce kapatır.
5. Gözlem yaşı `30.000 ms` iken kabul edilir, `30.001 ms` ve üzeri stale sayılır. Gelecek saat sapması `5.000 ms` iken kabul edilir, `5.001 ms` ve üzeri reddedilir.
6. `read-only` yalnız fresh, imzası doğrulanmış ve tutarlı non-writable `ready`/güvenli `degraded` durumudur. Hassas okuma imzalı normal politika akışından geçebilir. Normal mutation Core Service'e yalnız imzalı `CLUSTER_NOT_WRITABLE` ret makbuzu üretmesine yetecek kadar ilerler; iş callback'i açılmaz. Receipt üretmeyen bootstrap mutation doğrudan reddedilir.
7. `read-write` yalnız fresh, imzası doğrulanmış, tutarlı `ready`, writable ve non-safe-mode durumudur. Availability kararı tek başına yetki değildir; PEP, policy kararı, receipt doğrulaması, cluster fence ve repository kapsamı ayrıca zorunludur.
8. Ortak Desktop API kapısı status dışındaki normal ve bootstrap kanalları kapsar. `read-only` veya `deny` görüldüğünde paylaşılan IPC sonuç cache'i temizlenir ve hassas offline cache kilitlenir. PPK-012 lease'i invalid/stale online policy'yi yetkili hale getiremez.
9. Tek istisna `system:getPolicyServiceAvailabilityBoundary` exact kanalıdır. Bu kanal sıfır argümanlı ve no-cache'dir; yalnız content-free mode/reason/freshness duruşu verir. Policy paket hash'i, imza, kaynak yolu, token, kullanıcı verisi veya kalıcı yol renderer'a verilmez.
10. PEP provider bileşimi canlı availability observer olmadan üretim Core Service otoritesi olarak kurulamaz. Böylece outer Desktop kapısının atlandığı doğrudan PEP kullanımı da fail-closed kalır.
11. Availability observer zorunluluğu yalnız explicit `decisionAuthority === 'windows-core-service'` sağlayıcısına uygulanır. Yerel kernel ve tarihsel non-Core test/provider bileşimleri kendi mevcut policy zincirini korur; bu ayrım Core Service provider'ında observer eksikliğini gevşetmez.

## Tarihsel kanıt sınırı

Başlangıç health snapshot'ı, eski allow receipt, offline lease veya UI göstergesi güncel çalışma yetkisi vermez. Karar anındaki canlı gözlem ve bütün mevcut PEP kontrolleri yeniden geçilmelidir.

## Şema ve veri kararı

PPK-024 geçici bir çalışma duruşu sınırıdır. Yeni repository persistence veya migration eklenmez; latest migration `77` kalır. Gerçek kullanıcı verisi taşınmaz, backfill/cutover yapılmaz, Desktop vault ve SQLite yazma sahipliği değişmez, DEC-171 kaldırılmaz ve yeni Build verilmez.

## Ardıl sınır

PPK-025 SBOM, imzalı paket, dependency provenance, lisans ve zafiyet kapılarıdır. DEC-205 supply-chain kapanışını tamamlamaz.

## Kanıt

- `scripts/verify-policy-service-availability-boundary.mjs`
- `packages/platform-policy/src/policy-service-availability-policy.ts`
- `packages/platform-policy/src/policy-enforcement-point.ts`
- `apps/core-service/src/core-service-runtime.ts`
- `apps/desktop/src/main/policy-service-availability-application-adapter.ts`
- `packages/platform-policy/policy-service-availability-policy.test.ts`
- `apps/core-service/tests/ppk024-policy-service-availability-runtime.test.ts`
- `apps/desktop/tests/ppk024-policy-service-availability.test.ts`
- `apps/desktop/tests/ppk024-policy-service-availability-integration.test.ts`
- `artifacts/validation/32-T-ppk-024-policy-service-availability-contract.json`
- `artifacts/validation/32-T-ppk-024-policy-service-availability-runtime.json`

Final doğrulama: contract `71/71`, runtime kanıt demeti `28/28`, hedefli test `4 dosya / 71 test`, odak regresyon `6/90`, PPK-012–PPK-024 güvenlik regresyonu `23/351`, tam Vitest `84 dosya / 759 test`, production workspace build `18/18`, TypeScript diagnostics `0` ve latest migration `77` PASS.

Bu teslim yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmaz.
