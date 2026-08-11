# DEC-110 — OPEN-021 ve OPEN-022 tek Build219 Windows güvenlik kapanışında birleştirilir

**Aktif sürüm:** 01.08.2026.219

Build219 ile OPEN-021 ve OPEN-022 için daha önce ayrı hazırlanmış gerçek Windows kapanışları tek güncel kaynak snapshotından yürütülen birleşik bir kanıt akışına alınır.

## Karar

- Tek `npm ci` prerequisite çalıştırılır; bu çalışma OPEN-002'yi otomatik kapatmaz.
- Windows installer yalnız bir kez üretilir, bir kez kurulur ve bir kez kaldırılır.
- Aynı development ve kurulu/paketli yaşam döngüsünde OPEN-021 EFS ve OPEN-022 safeStorage/DPAPI + Protected Side Artifact probu ayrı ayrı yürütülür.
- OPEN-021 ve OPEN-022 readiness sonuçları birbirinden bağımsız hesaplanır. Birinin FAIL olması diğerinin geçerli PASS kanıtını geçersiz kılmaz.
- Sonuç yalnız `READY_TO_CLOSE` üretir; Ana Build Defteri otomatik değiştirilmez.
- Kanıt paketi exact Build219 `manifest.json` ve `SHA256SUMS.txt` hashlerine bağlanır ve tek ZIP + `.sha256` olarak üretilir.
- Gerçek Windows kanıtı olmadan hiçbir OPEN kaydı `COMPLETED` yapılamaz.

Bağlayıcı mimari: `ADR-093-unified-bronze-windows-security-lifecycle.md`.
Teknik prosedür: `docs/security/BRONZE_WINDOWS_SECURITY_CLOSURE_BUILD219.md`.
