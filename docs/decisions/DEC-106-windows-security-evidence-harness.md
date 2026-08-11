# DEC-106 — OPEN-021/022 kapanışı gerçek Windows kanıt zinciri gerektirir

**Build:** 215  
**Tarih:** 01.08.2026  
**Durum:** KABUL EDİLDİ

## Karar

OPEN-021 ve OPEN-022 yalnız kaynak sözleşmesi veya mock runtime ile kapatılamaz. Resmî kapanış kanıtı gerçek Windows üzerinde, güvenli sandbox korunarak hem development Electron hem de kurulmuş paketli uygulama için aşağıdaki kontrolleri birlikte sağlamalıdır:

1. `VolatileSqliteSession` gerçek Windows EFS staging ile `requireWindowsEfs=true` çalışmalıdır.
2. Staging dizini ve bounded SQLite snapshot dosyası Windows `Encrypted` dosya özniteliğini taşımalıdır.
3. Aktif SQLite verisi süreç belleğinde kalmalı ve probe sonunda staging `.sqlite/.db` dosyası bırakılmamalıdır.
4. Electron `safeStorage` sağlayıcısı Windows DPAPI olmalı; startup sentinel ve yan-artifact veri anahtarı gerçek cihaz korumasıyla süreçler arasında açılabilmelidir.
5. Protected Side Artifact gerçek Windows DPAPI sarımıyla ciphertext üretmeli, plaintext probe işaretini diskte bırakmamalı ve decrypt round-trip sağlamalıdır.
6. Aynı kontroller kurulmuş paketli Electron uygulamasında da PASS olmadan OPEN-021/022 platform kanıtı tamamlanmış sayılmaz.

## Fail-closed sınırı

Linux/non-Windows veya mock protector sonuçları resmî Windows PASS yerine geçmez. Diagnostic `--no-sandbox` çalıştırması yalnız diagnostic sonuçtur; resmî kapıyı değiştirmez.

## Kanıt

- `apps/desktop/src/main/windows-security-evidence-probe.ts`
- `scripts/windows-real-launch-test.mjs`
- `scripts/run-bronze-final-windows-validation.ps1`
- `scripts/verify-build215-windows-security-evidence-result.mjs`
- `artifacts/validation/build215-windows-security-evidence-contract.json`
- `docs/adr/ADR-089-real-windows-efs-dpapi-packaged-evidence.md`
