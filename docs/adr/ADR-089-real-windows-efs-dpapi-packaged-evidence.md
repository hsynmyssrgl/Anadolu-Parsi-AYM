# ADR-089 — Gerçek Windows EFS/DPAPI ve paketli Electron kanıt mimarisi

## Bağlam

Build213 ve Build214 kaynak/runtime kanıtları sırasıyla bellek-içi SQLite + EFS fail-closed tasarımını ve Protected Side Artifact + `safeStorage`/DPAPI arayüzünü doğruladı. Ancak mevcut Bronze Final Windows runner Build122 döneminde kalmıştı ve OPEN-021/022 için güncel platform kanıtı üretemiyordu.

## Karar

Windows launch probe yalnız `PPT_WINDOWS_SECURITY_PROBE=1` test ortamında ek güvenlik kanıtı üretir. Normal production kullanımında test probu çalışmaz.

Probe gerçek application main process içinde:

- `VolatileSqliteSession` örneğini `requireWindowsEfs=true` ile açar,
- snapshot operasyonu sırasında staging dizini ve SQLite dosyasının Windows `Encrypted` attribute değerini PowerShell üzerinden bağımsız doğrular,
- SQLite snapshot round-trip ve staging cleanup kontrolünü yapar,
- gerçek `ElectronSafeStorageDeviceSecretProtector` sağlayıcısının `windows-dpapi` olduğunu zorunlu kılar,
- aynı gerçek protector ile kullanılan `ProtectedSideArtifactStore` anahtar zarfının yalnız `protectedDataKey` taşıdığını doğrular,
- şifreli `.pptdiag` probunda plaintext işaret olmadığını ve decrypt round-trip'i doğrular.

`windows-real-launch-test.mjs` bu kanıtı hem development Electron hem paketli/kurulmuş uygulamanın iki ardışık çalıştırmasında zorunlu kılar. `verify-build215-windows-security-evidence-result.mjs` iki launch evidence dosyasını tek fail-closed sonuç kanıtına bağlar.

## Sonuçlar

- Gerçek Windows platform kanıtı tek bir eski build numarasına sabit değildir; runner aktif sürüm/build bilgisini `APP_META` üzerinden çözer.
- EFS ve DPAPI kontrolleri paketli uygulama bağlamında doğrulanabilir.
- Non-Windows geliştirme ortamı harness kaynağını doğrulayabilir fakat Windows PASS üretemez.
- Aynı kullanıcı malware/admin/process-memory saldırısına karşı mutlak izolasyon iddiası yapılmaz.
