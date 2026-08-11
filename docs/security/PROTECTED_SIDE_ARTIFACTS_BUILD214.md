# Build214 — Protected Side Artifact güvenlik sözleşmesi

- Aktif sürüm: `01.08.2026.214`
- Package: `1.8.2026-214`
- Build: `214`
- Hedef: `OPEN-022`

## Korunan yüzeyler

| Yüzey | Kalıcı/çalışma biçimi |
|---|---|
| Structured log | AES-256-GCM record envelope, `.pplog` |
| Diagnostic / maintenance export | AES-256-GCM container, `.pptdiag` |
| Startup security evidence | AES-256-GCM container, `.pptdiag` |
| Security event receipts | AES-256-GCM container, `.pptdiag` |
| System health PDF payload | Bellekte PDF → AES-256-GCM container, `.pptreport` |
| Browser session/cache/temp | OS temp altında süreç-özel volatil root |
| Crash dump | OS temp altında süreç-özel volatil root |

## Anahtar yönetimi

Yan-artifact AES veri anahtarı 32 bayt rastgele üretilir. Diskte açık anahtar tutulmaz. `DeviceSecretProtector` ile sarılır; production Windows hedefinde bunun sağlayıcısı Electron `safeStorage`/DPAPI'dir.

## Doğrulama

- OPEN-022 contract: **25/25 PASS**
- Protected side-artifact runtime: **10/10 PASS**
- Integration runtime: **8/8 PASS**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**
- Gerçek Windows safeStorage/DPAPI: **NOT_RUN**
- Electron production build / installer: **NOT_RUN**

Bu belge gerçek Windows doğrulamasını ikame etmez.
