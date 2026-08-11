# Build215 Architecture Validation Report

- Application Version: `01.08.2026.215`
- Package Version: `1.8.2026-215`
- Stage: **Bronze RC2 Active Development**
- Scope: OPEN-021/OPEN-022 Windows security evidence harness

## Mimari sonuç

Yeni probe üretim davranışından environment gate ile ayrılmıştır. Test modu gerçek main-process bağımlılıklarını kullanır: `VolatileSqliteSession`, gerçek Electron `DeviceSecretProtector` ve `ProtectedSideArtifactStore`. Bu nedenle Windows'taki PASS, mock bir ayrı test implementasyonundan değil ürünün aynı güvenlik sınıflarından üretilir.

## Fail-closed özellikler

- Non-Windows probe çalıştırılamaz.
- `windows-dpapi` sağlayıcısı yoksa probe FAIL olur.
- EFS directory veya snapshot `Encrypted` attribute taşımıyorsa FAIL olur.
- Staging SQLite kalıntısı varsa FAIL olur.
- Protected Side Artifact plaintext probe marker bırakırsa FAIL olur.
- Development veya packaged launch probe eksik/FAIL ise birleşik evidence FAIL olur.
- Diagnostic sandbox istisnası resmî PASS sayılmaz.

## Kaynak kanıtı

`artifacts/validation/build215-windows-security-evidence-contract.json` — **26/26 PASS**.

## Sınır

Bu ortam real Windows değildir; platform execution kanıtları **NOT_RUN**.
