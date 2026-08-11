# Bronze RC2 Build 210 Durumu

- Application Version: `01.08.2026.210`
- Package Version: `1.8.2026-210`
- Stage: **Bronze RC2 Active Development**
- Build: **210**
- Migrasyon: **49**
- Karar: **DEC-100**
- ADR: **ADR-083**
- Proje Anayasası: **V4 / 170 istisnasız kural**
- Kapsam: Terminal temiz-yedek çalışma defterini UPDATE, DELETE ve INSERT OR REPLACE yeniden yazımına karşı değişmez kılmak; running→terminal ve gerçek no-op güncellemeleri korumak.

## Doğrulama durumu

- Build210 terminal-ledger sözleşmesi: **PASS — 21/21**
- Gerçek `node:sqlite` davranış regresyonu: **PASS — 19/19**
- Package source TypeScript kontrolü: **PASS**
- Desktop-main source TypeScript kontrolü: **PASS**
- Master DOCX görsel QA: **PASS — 11/11 sayfa**
- Master PDF görsel QA: **PASS — 11/11 sayfa**
- Source preflight: **PASS**
- Source integrity: **PASS — 1863/1863 kaynak dosyası, 1864 SHA kaydı**
- Deterministik source archive verification: **PASS**
- Source archive reproducibility: **PASS — byte-identical**
- Detached delivery attestation: **PASS**
- Clean install gate: **FAIL — EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE; üç resmî registry denemesi zaman aşımına uğradı**
- Tam root/workspace `tsc --noEmit`: **NOT_RUN**
- Tüm unit/integration test zinciri: **NOT_RUN**
- Electron production build: **NOT_RUN**
- Blocking smoke: **NOT_RUN**
- Gerçek Windows launch/installer: **NOT_RUN**

Clean dependency kurulumu veya platform kapıları çalıştırılmadan PASS kabul edilmez. Build210 yalnız Bronze kaynak geliştirme teslimidir.

## Build210 kapanış yönetişim düzeltmesi

V4 Anayasa Build209’da yürürlüğe girdiği için provenance doğrulayıcısındaki `effectiveBuild === currentBuild` varsayımı `effectiveBuild <= currentBuild` olarak düzeltildi. Kural seti, kural sayısı, SHA-256 ve Build209 yürürlük başlangıcı değiştirilmedi; yalnız sonraki buildlerde aynı yürürlükteki Anayasanın doğru biçimde kabul edilmesi sağlandı.
