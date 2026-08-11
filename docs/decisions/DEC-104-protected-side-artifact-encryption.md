# DEC-104 — Hassas yan-artifactlar varsayılan şifreli kapsayıcıdır

**Build:** 214  
**Tarih:** 01.08.2026  
**Durum:** KABUL EDİLDİ

## Karar

Log, diagnostic, maintenance export, health report, security receipt, crash/session/cache/temp ve benzeri yan-artifact yüzeylerinde kişisel veya hassas içeriğin plaintext kalıcı dosya olarak bırakılması yasaktır.

Kalıcı loglar satır-başına AES-256-GCM korumalı `.pplog` kaydı olarak tutulur. Tanılama/bakım dışa aktarımları `.pptdiag`, sistem sağlık raporları `.pptreport` uygulamaya özel şifreli kapsayıcı olarak yazılır. Yan-artifact veri anahtarı 32 bayt rastgele anahtardır ve Windows production'da Electron `safeStorage`/DPAPI cihaz koruması ile sarılır. Anahtar sarması kullanılamıyorsa protected side-artifact runtime fail-closed davranır.

Browser session/cache/temp ve crash çalışma alanları kalıcı kullanıcı-verisi alanından ayrılarak OS temp altında süreç-özel volatil alana yönlendirilir; başlangıçta ve normal kapanışta temizlenir.

## Uygulama

- `apps/desktop/src/main/protected-side-artifact-store.ts`
- `apps/desktop/src/main/protected-side-artifact-logger.ts`
- `apps/desktop/src/main/operational-artifact-file-application-adapter.ts`
- `apps/desktop/src/main/security-event-receipt-store.ts`
- `apps/desktop/src/main/startup-security-preflight.ts`
- `apps/desktop/src/main/runtime-bootstrap.ts`
- `apps/desktop/src/main/main.ts`

## Kanıt ve sınır

- `artifacts/validation/build214-open022-contract.json` — 25/25 PASS
- `artifacts/validation/build214-protected-side-artifact-runtime.json` — 10/10 PASS
- `artifacts/validation/build214-side-artifact-integration-runtime.json` — 8/8 PASS
- package/desktop-main kontrollü source TypeScript — PASS
- gerçek Windows `safeStorage`/DPAPI ve paketli Electron — **NOT_RUN**

OPEN-022 yalnız kaynak/runtime sözleşmesi açısından kapanışa hazırdır; gerçek Windows platform kanıtı Bronze Final/Silver doğrulama sınırında ayrıca tutulur ve çalıştırılmadan PASS sayılamaz.
