# Release Notes — Bronze RC2 Build 216

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.216`
- Package Version: `1.8.2026-216`
- Stage: **Bronze RC2 Active Development**
- Build: **216**

## Ana değişiklikler

- Windows güvenlik probundaki Build215 sabiti kaldırıldı; build numarası aktif application version'dan türetiliyor.
- Windows launch doğrulaması güvenlik probu build'ini aktif uygulama sürümünden dinamik doğruluyor.
- Bronze Final Windows runner kanıt dosyaları için byte boyutu + SHA-256 manifesti üretiyor.
- Kanıt manifesti çalıştırıldığı exact kaynak `manifest.json` ve `SHA256SUMS.txt` hashlerine bağlanıyor.
- Windows kanıt ZIP'i için ayrı `.sha256` dosyası oluşturuluyor.
- Yeni platform-bağımsız intake verifier dokuz zorunlu kanıt dosyasını, exact source binding'i, resmî sandbox durumunu, installer lifecycle'ı, development/packaged EFS-DPAPI kanıtlarını ve dependency audit sonuçlarını fail-closed doğruluyor.
- Intake PASS yalnız OPEN-021/022 için `READY_TO_CLOSE` üretir; ledger otomatik değiştirilmez.
- Sentetik runtime testi geçerli paketi kabul edip sonradan değiştirilmiş kanıtı SHA uyuşmazlığıyla reddediyor.

## Doğrulama

- Build216 Windows evidence intake contract: **33/33 PASS**
- Build216 intake valid/tamper runtime: **6/6 PASS**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**
- Gerçek Windows EFS/DPAPI/paketli Electron/installer ve gerçek evidence intake: **NOT_RUN**

DEC-107 ve ADR-090 bağlayıcıdır. OPEN-021/OPEN-022 gerçek Windows PASS kanıtı gelene kadar kapanmaz.
