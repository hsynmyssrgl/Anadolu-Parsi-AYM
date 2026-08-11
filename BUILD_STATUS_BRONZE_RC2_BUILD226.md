# Build226 Durumu

- Application Version: `02.08.2026.226`
- Package Version: `2.8.2026-226`
- Stage: **Bronze RC2 Active Development**
- Channel: Bronze RC2 Active Development
- Governed status: `COMPLETED`; kaynak kapanışı PASS, gerçek Windows probları henüz `NOT_RUN / NOT_READY`

## Kanıtlanmış dar düzeltme

Exact Build225 gerçek Windows fresh-profile kanıtında `VAULT_INITIALIZATION`, eksik `device-identity.json` dosyasını bakım restore/persist öncesinde ham okumaya çalışıyordu. Build226, startup security preflight sonrasında korumalı üretim cihaz kimliğini oluşturup/doğrulayıp cihaz-bağlama özetini hazırlar; bakım durumu bundan sonra restore/persist edilir.

## Doğrulama

- Fresh-profile startup contract: **PASS (25/25)**
- Fresh-profile runtime/tamper: **PASS (8/8)**
- Device identity protection regression: **PASS (10/10)**
- Maintenance persistence regression: **PASS (11/11)**
- Build225 OPEN-021 contract/runtime: **PASS (17/17 + 3/3)**
- Build225 OPEN-022 contract/runtime: **PASS (14/14 + 3/3)**
- Build225 fatal startup contract/runtime: **PASS (10/10 + 3/3)**
- PR-172 contract: **PASS (19/19)**
- Build226 Windows retry contract: **PASS (19/19)**
- Build226 unified result runtime/tamper: **PASS (7/7)**
- Build224 license regression: **PASS (13/13)**
- Build223 preload CJS regression: **PASS (13/13)**
- Package and desktop-main TypeScript: **PASS**
- Full source preflight: **PASS (63/63)**
- Source integrity: **PASS (2147/2147 source files; 2148 SHA256SUMS entries)**

## Real Windows boundary

- Development OPEN-021: **NOT_RUN**
- Installed OPEN-021: **NOT_RUN**
- Development OPEN-022: **NOT_RUN**
- Installed OPEN-022: **NOT_RUN**
- OPEN-021: **NOT_READY**
- OPEN-022: **NOT_READY**

Kaynak kontrolleri gerçek Windows kanıtının yerine geçmez.
