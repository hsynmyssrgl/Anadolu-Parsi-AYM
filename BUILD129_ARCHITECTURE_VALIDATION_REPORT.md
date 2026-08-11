# Build 129 Architecture and Security Validation Report

## Kimlik

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.129`
- Package Version: `27.7.2026-129`
- Stage: **Bronze RC2 Active Development**

## Mimari etki

Auth application adapter, TOTP sırrının açık veya korumalı depolama biçimini
application use-case'lerinden ayırır. Repository portuna atomik legacy migration
komutu eklendi. Electron composition root, cihaz kimliği ve MFA sırları için aynı
OS destekli `safeStorage` koruma adaptörünü sağlar.

## Güvenlik davranışı

- Yeni TOTP sırrı koruma uygunsa sürüm 1 zarf olarak yazılır.
- Paketli/Windows ortamında zorunlu koruma yoksa kurulum ve giriş reddedilir.
- Legacy açık aktif/bekleyen sırlar transaction içinde korunur.
- Migration eski değeri SQL predicate olarak doğrular ve yalnız tek satır değişimini kabul eder.
- Application katmanına yalnız bellekte çözülmüş Base32 sır verilir.
- Kurtarma kodları hash biçiminde kalır; açık kurtarma kodu saklanmaz.

## Hedefli doğrulama

- Build 129 security contract: **PASS — 58 assertion**.
- MFA secret envelope runtime: **PASS — 11 assertion**.
- Legacy SQLite migration: **PASS — 11 assertion**.
- MFA/trusted-device integration: **PASS — 16 kontrol**.
- Controlled package-source type-check: **PASS — TypeScript 5.8.3**.
- Controlled Electron-main source type-check: **PASS**.
- Lockfile / dependency / workspace contracts: **PASS**.

Bu doğrulamalar gerçek Windows DPAPI çalışma zamanı kabul kanıtı değildir.
