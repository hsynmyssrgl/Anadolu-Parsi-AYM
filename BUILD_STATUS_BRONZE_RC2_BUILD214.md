# Build 214 — Bronze RC2 Active Development

- Current Application Version: `01.08.2026.214`
- Current Package Version: `1.8.2026-214`
- Current Build: **214**
- Current Stage: **Bronze RC2 Active Development**
- Channel flow: **Bronze development → Silver validation → Gold production**
- Scope: OPEN-022 — log, diagnostic/export, health report, security receipt, browser session/cache/temp ve crash gibi hassas yan-artifact yüzeylerinde plaintext kişisel/hassas veri bırakmayan Protected Side Artifact katmanı
- Project Rules: `PROJECT-RULES-2026-08-01-V5` / `2e342a2e0a982bb19c2e45fb25b67336f70eb71969ce1e0f4e298f3fe6cfe9d1`

## Durum

Build214 kurtarma ağacında Protected Side Artifact katmanı yeniden kuruldu. Kalıcı yan-artifact içerikleri AES-256-GCM kapsayıcıyla korunur; loglar `.pplog`, diagnostic/bakım exportları `.pptdiag`, sistem sağlık raporu `.pptreport` kullanır. Yan-artifact veri anahtarı `DeviceSecretProtector` üzerinden sarılır; Windows production hedefi Electron `safeStorage`/DPAPI'dir. Browser `sessionData`, cache/temp ve crash alanları süreç-özel volatil çalışma köküne yönlendirilir.

## OPEN-022

**IN_PROGRESS (Build kapanışı sürüyor).** Kaynak sözleşmesi, kontrollü TypeScript ve taşınabilir runtime/integration doğrulamaları PASS'tir. Gerçek Windows `safeStorage`/DPAPI, paketli Electron ve installer doğrulaması **NOT_RUN** durumundadır. Build214 nihai preflight, source integrity, deterministik archive/reproducibility ve teslim tasdiki tamamlanmadan COMPLETED ilan edilmez.

## Build214 doğrulanmış kanıtlar

- Active Version Sweep: **PASS (178/178, 90 aktif dosya)**
- OPEN-022 security contract: **PASS (25/25)**
- Protected side-artifact runtime: **PASS (10/10)**
- Side-artifact integration runtime: **PASS (8/8)**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**
- Documentation Closure: **PASS (101/101; Artifact Index güncel dosya sayısıyla yeniden doğrulanır)**
- Master DOCX/PDF render/preflight: **PASS (11 sayfa; görsel QA tamamlandı)**
- Source preflight: **PASS (26/26 checks)**
- Source integrity: **PASS (1920/1920 source files; 1921 SHA entries)**
- Windows safeStorage/DPAPI runtime: **NOT_RUN**
- Windows EFS runtime (OPEN-021): **NOT_RUN**

## Doğrulama sınırı

- Source preflight gate: **PASS**
- Source integrity: **PASS**
- Clean install gate: **NOT_RUN**
- Full root `tsc --noEmit`: **NOT_RUN**
- Unit and integration tests: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

OPEN-002 clean dependency installation erişilebilir ve kabul edilmiş dependency ortamında çözülmüş değildir. Lockfile bu nedenle bozuk varsayılıp değiştirilmez.

## Kural-kurtarma notu

Build214'ün kaybolmuş çalışma ağacındaki V5 byte dizisi Library'de bulunamadı. Handoff'ta verilen PR-171 semantiği doğrulanmış V4 üzerine eklenerek repository'nin kanonik hash algoritmasıyla V5 yeniden üretildi. Elde edilen kanonik SHA-256 `2e342a2e0a982bb19c2e45fb25b67336f70eb71969ce1e0f4e298f3fe6cfe9d1` değeridir. Handoff'ta bildirilen `8798cd8a8f3bdb23234aa4c7533a414fd2beab94eae9e43d990073ade5c843d2` ile eşleşmemesi `artifacts/validation/build214-v5-rule-hash-recovery.json` içinde açıkça kayıtlıdır; eşleşmeyen hash PASS olarak sunulmaz.

- Detached delivery attestation: `Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_RC2_Build214_Teslim_Kanit_Tasdiki_01.08.2026.214.json` — kaynak ZIP üretildikten sonra oluşturulur.
