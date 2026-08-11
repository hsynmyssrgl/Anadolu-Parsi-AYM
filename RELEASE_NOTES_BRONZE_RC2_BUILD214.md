# Release Notes — Bronze RC2 Build 214

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.214`
- Package Version: `1.8.2026-214`
- Stage: **Bronze RC2 Active Development**
- Build: **214**

## Ana değişiklik — OPEN-022

- Kalıcı structured loglar plaintext JSONL yerine AES-256-GCM korumalı `.pplog` kayıtlarına taşındı.
- Diagnostic ve maintenance exportları `.pptdiag` şifreli kapsayıcıya bağlandı.
- Sistem sağlık raporu bellekte üretilip `.pptreport` şifreli kapsayıcı olarak yazılıyor.
- Security receipt ve startup security evidence aynı Protected Side Artifact katmanına bağlandı.
- Yan-artifact veri anahtarı `DeviceSecretProtector` ile sarılıyor; Windows production hedefi Electron `safeStorage`/DPAPI.
- Browser `sessionData`, cache/temp ve crash çalışma alanları süreç-özel volatil OS temp köküne ayrıldı; başlangıç/normal kapanış temizliği eklendi.
- Kullanıcının bilinçli diagnostic exportu plaintext istisna oluşturmuyor.

## Doğrulama

- OPEN-022 contract: **25/25 PASS**
- Protected side-artifact runtime: **10/10 PASS**
- Integration runtime: **8/8 PASS**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**
- Documentation Closure: **PASS (101/101; 1929 indexed files)**
- Master DOCX/PDF: **11 sayfa render/preflight ve görsel QA PASS**
- Source preflight: **PASS (26/26)**
- Source integrity: **PASS (1920/1920 source files; 1921 SHA entries)**
- Active Version Sweep: **PASS (178/178; 90 aktif dosya)**.
- Gerçek Windows `safeStorage`/DPAPI: **NOT_RUN**
- Clean `npm ci`, tam root `tsc`, tam test zinciri, Electron production build, blocking smoke ve gerçek Windows installer: çalıştırılmadıkça **NOT_RUN**.

## Yönetişim

- DEC-104 / ADR-087: Protected Side Artifact güvenlik sınırı.
- DEC-105 / ADR-088: PR-171 küçük, bağımsız, doğrulanabilir çalışma adımları.
- Aktif Anayasa: `PROJECT-RULES-2026-08-01-V5`.
- V5 kaynak-kurtarma hash uyuşmazlığı gizlenmedi; kanonik yeniden üretim kanıtı `artifacts/validation/build214-v5-rule-hash-recovery.json` içindedir.

Build214, nihai preflight → integrity → deterministik archive → reproducibility → detached delivery attestation → Library teslimi tamamlanmadan COMPLETED değildir.
