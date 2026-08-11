# DEC-107 — Windows kanıt kabulü exact kaynak snapshotına bağlanır

**Build:** 216  
**Tarih:** 01.08.2026  
**Durum:** KABUL EDİLDİ

## Karar

OPEN-021 ve OPEN-022 için gerçek Windows üzerinde üretilen kanıt, yalnız dosya adlarına veya tek bir PASS özetine güvenilerek kabul edilemez. Resmî Windows runner aşağıdaki bağları birlikte üretmelidir:

1. Kanıt dosyalarının her biri için göreli ad, byte boyutu ve SHA-256.
2. Kanıt paketinin oluşturulduğu kaynak ağacındaki `manifest.json` SHA-256 değeri.
3. Aynı kaynak ağacındaki `SHA256SUMS.txt` SHA-256 değeri.
4. Windows makinesinin açık adını taşımayan, SHA-256 ile takma adlandırılmış host bağı.
5. Kanıt ZIP'i için ayrı SHA-256 dosyası.

Platform-bağımsız intake doğrulayıcısı tüm gerekli kanıt dosyalarını, boyut/hash bütünlüğünü, exact source binding değerlerini, resmî sandbox koşulunu, development + packaged launch kanıtlarını, Windows EFS/DPAPI sonuçlarını, installer yaşam döngüsünü ve dependency audit sonuçlarını fail-closed doğrular.

## Kapanış sınırı

`PASS` intake raporu yalnız `READY_TO_CLOSE` üretir; Ana Build Defteri'ni otomatik değiştirmez. OPEN-021 ve OPEN-022 ancak ayrı yönetişim adımında gerçek PASS intake raporu tüketilerek `COMPLETED` yapılabilir.

## Kanıt

- `scripts/run-bronze-final-windows-validation.ps1`
- `scripts/lib/windows-evidence-intake.mjs`
- `scripts/verify-build216-windows-evidence-intake.mjs`
- `scripts/verify-build216-windows-evidence-intake-contract.mjs`
- `scripts/verify-build216-windows-evidence-intake-runtime.mjs`
- `artifacts/validation/build216-windows-evidence-intake-contract.json`
- `artifacts/validation/build216-windows-evidence-intake-runtime.json`
- `docs/adr/ADR-090-windows-evidence-intake-and-source-binding.md`
