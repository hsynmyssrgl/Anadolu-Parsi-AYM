# Build226 Architecture Validation Report

## Outcome

Build226, fresh-profile cihaz kimliği initialization-order kök nedenini güvenlik sınırlarını gevşetmeden düzeltir. Hedefli contract/runtime/tamper ve devralınan regresyonlar PASS'tir.

| Area | Result |
|---|---|
| Fresh-profile startup ordering | PASS — 25/25 |
| First/second launch and tamper runtime | PASS — 8/8 |
| Device identity protection regression | PASS — 10/10 |
| Maintenance persistence regression | PASS — 11/11 |
| Build225 OPEN-021 / OPEN-022 | PASS — 17/17 + 3/3; 14/14 + 3/3 |
| Fatal startup / PR-172 | PASS — 10/10 + 3/3; 19/19 |
| Build226 Windows harness / result tamper | PASS — 19/19; 7/7 |
| Build224 license / Build223 preload | PASS — 13/13; 13/13 |
| Controlled source TypeScript | PASS |

## Security boundary

`FileDeviceIdentityProvider`, zorunlu OS secret protector ile schema v2 korumalı kimlik üretir/doğrular. Bakım durumu cihaz-bağlı kalır. Koruma/provider/ciphertext/identity hataları fail-closed ve fatal non-zero başlangıç yoluna gider. Gerçek Windows runtime henüz `NOT_RUN` olduğu için OPEN-021/022 kapanış iddiası yapılmaz.

