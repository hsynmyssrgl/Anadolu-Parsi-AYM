# Build225 Durumu

- Application Version: `02.08.2026.225`
- Package Version: `2.8.2026-225`
- Stage: **Bronze RC2 Active Development**
- Channel: Bronze RC2 Active Development
- Governed status: `COMPLETED`; gerçek Windows kapanış probları bağımsız olarak `NOT_RUN / NOT_READY`

## Uygulanan kanıtlanmış düzeltmeler

- OPEN-021 PowerShell `$args[0]` null yol aktarımı kaldırıldı; sabit encoded script ve child-process environment değeri kullanıldı.
- `cipher.exe` exit 0 tek başına yeterli değildir; directory, snapshot ve staging ağacının gerçek NTFS `Encrypted` niteliği fail-closed doğrulanır.
- Snapshot boş dosya olarak oluşturulup VACUUM'dan önce açıkça EFS-protected yapılır; VACUUM sonrasında yeniden doğrulanır.
- OPEN-022 Windows backend-name equality kaldırıldı; gerçek safeStorage protect/unprotect ve tüm artifact kanıtları zorunlu kaldı.
- Fatal `app.whenReady` hatası erken diagnostic evidence üretir ve `app.exit(1)` ile non-zero kapanır.
- PR-172 Constitution V6 içinde yalnız `platform_actual >= 90` HARD_STOP olacak biçimde kalıcılaştırıldı.

## Doğrulama

- OPEN-021 contract: **PASS (17/17)**
- OPEN-021 runtime/tamper: **PASS (3/3)**
- OPEN-022 contract: **PASS (14/14)**
- OPEN-022 runtime/tamper: **PASS (3/3)**
- Fatal startup contract: **PASS (10/10)**
- Fatal startup runtime/tamper: **PASS (3/3)**
- PR-172 contract: **PASS (19/19)**
- Windows retry harness contract: **PASS (19/19)**
- Unified result runtime/tamper: **PASS (7/7)**
- Build224 license regression: **PASS (13/13)**
- Build223 preload CJS regression: **PASS (13/13)**
- Desktop-main controlled TypeScript: **PASS**
- Real Windows development OPEN-021: **NOT_RUN**
- Real Windows installed OPEN-021: **NOT_RUN**
- Real Windows development OPEN-022: **NOT_RUN**
- Real Windows installed OPEN-022: **NOT_RUN**

## Readiness

- OPEN-021: **NOT_READY**
- OPEN-022: **NOT_READY**

Kaynak testleri gerçek Windows kanıtının yerine geçmez.
