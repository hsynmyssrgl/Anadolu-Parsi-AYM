# Build216 — Windows Evidence Intake ve Source Binding

**Aktif sürüm:** 02.08.2026.224
**Package:** 1.8.2026-216  
**Build:** 216  
**Hedef:** OPEN-021 + OPEN-022 gerçek Windows kanıtının güvenli taşınması ve fail-closed kabulü

## Windows tarafında üretilecekler

`BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd` başarılı çalıştırıldığında `artifacts/validation/` altında:

- Build216 Bronze Final Windows özet raporu,
- source preflight Windows raporu,
- RC2 validation raporu,
- Windows release/installer lifecycle raporu,
- OPEN-021/022 Windows security evidence sonucu,
- development launch probe,
- packaged launch probe,
- production ve build-toolchain dependency audit raporları,
- `build216-windows-evidence-manifest.json`,
- `Bronze_Final_Windows_Kanitlari_Build216_*.zip`,
- aynı ZIP için `.sha256`

üretilir.

## Intake kabul koşulları

Kanıt paketi başka ortama taşındıktan sonra ZIP açılır ve:

`node scripts/verify-build216-windows-evidence-intake.mjs --evidence-root <KANIT_KLASORU>`

çalıştırılır. PASS için:

1. Manifest build/sürüm/platform alanları eşleşmelidir.
2. Manifestteki `manifest.json` ve `SHA256SUMS.txt` hashleri bu exact Build216 kaynak snapshotıyla eşleşmelidir.
3. Dokuz zorunlu kanıt dosyasının tamamı bulunmalı, byte boyutu ve SHA-256 değerleri eşleşmelidir.
4. Windows özetindeki altı resmî adım PASS olmalıdır.
5. Release lifecycle resmî/diagnostic olmayan PASS olmalı ve installer SHA kanıtı bulunmalıdır.
6. Development ve packaged launch kanıtları ikişer süreç çalıştırmasıyla PASS olmalıdır.
7. EFS, safeStorage/DPAPI ve Protected Side Artifact Windows runtime alanları PASS olmalıdır.
8. Production ve build-toolchain audit raporları PASS olmalıdır.

## Fail-closed kapanış

Intake PASS olduğunda yalnız:

- OPEN-021 = `READY_TO_CLOSE`
- OPEN-022 = `READY_TO_CLOSE`

sonucu üretilir. Ledger otomatik değiştirilmez. Bu sohbette gerçek Windows kanıtı henüz bulunmadığından iki iş de **IN_PROGRESS** kalır.
