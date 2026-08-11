# Bronze RC2 Build 168 Durumu

- Application Version: `29.07.2026.168`
- Package Version: `29.7.2026-168`
- Stage: **Bronze RC2 Active Development**

Build 168, adaptif IPC bütçe bakım işlemlerini etkin oturumlu `family_admin` rolüne ve güvenilir cihaz bağlamına bağlar. Yetki bilgisi renderer'a salt okunur görünüm olarak taşınır; uygun olmayan durumda işlemler fail-closed kapatılır.

## Doğrulama

- Build 168 sözleşme/runtime/sözdizimi: **PASS — 32/32, 12/12, 8/8**
- Build 167 devamlılığı: **PASS — 50/50, 29/29**
- Controlled TypeScript: **PASS**
- Source preflight: **PASS — 121/121**
- Source integrity: **PASS — final manifest-bound verification**
- Deterministic source archive: **PASS — byte-identical deterministic ZIP**
- Detached delivery attestation: **PASS — 67 evidence / 8 gate claims**
- Geniş RC2 kapıları: **NOT_RUN — bağlı bağımlılık yanıtı yok**
