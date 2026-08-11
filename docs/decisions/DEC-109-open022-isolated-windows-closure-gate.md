# DEC-109 — OPEN-022 gerçek Windows kapanışı ayrı ve dar bir kapıdır

**Build:** 218  
**Sürüm:** 01.08.2026.218  
**Durum:** Kabul edildi

OPEN-022; OPEN-021 EFS kapanışı, full RC2/Silver doğrulama zinciri ve genel dependency audit kapsamından ayrılır. Resmî kapanış için exact Build218 kaynak bütünlüğü, gerçek Windows Electron `safeStorage` backend=`dpapi`, korumalı yan-artifact anahtar zarfının açık veri anahtarı içermemesi, `.pplog/.pptdiag/.pptreport` ciphertext + decrypt round-trip, startup security evidence'ın şifreli at-rest tutulması, browser-session/crash yollarının volatil runtime kökünde kalması ve development + kurulu/paketli Electron yaşam döngüsünde aynı koşulların PASS olması zorunludur.

`electron-safe-storage-v1` kalıcı key-envelope sağlayıcı kimliğidir; Windows DPAPI kullanımı ayrı olarak Electron `safeStorage.getSelectedStorageBackend() = dpapi` ve startup security `protectionProvider = windows-dpapi` kanıtlarıyla doğrulanır. Bu ayrım Build215 full-Windows probundaki provider-ID karışıklığını düzeltir.

`npm ci` yalnız Windows çalıştırmasının dependency bootstrap önkoşuludur; OPEN-002'yi otomatik kapatmaz. OPEN-021 bu kararla değiştirilmez.

Bağlayıcı uygulama: ADR-092, `docs/security/OPEN022_WINDOWS_CLOSURE_BUILD218.md`, `OPEN022_WINDOWS_KAPAT.cmd`.
