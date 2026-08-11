# Release Notes — Bronze RC2 Build 215

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.215`
- Package Version: `1.8.2026-215`
- Stage: **Bronze RC2 Active Development**
- Build: **215**

## Ana değişiklik

- Build122'e sabitlenmiş Bronze Final Windows runner aktif APP_META build/version değerini dinamik kullanacak biçimde güncellendi.
- Yeni `windows-security-evidence-probe.ts`, yalnız resmî launch test modunda gerçek EFS ve real `safeStorage`/DPAPI kanıtı üretir.
- Windows EFS staging directory ve bounded SQLite snapshot `Encrypted` attribute ile bağımsız doğrulanır.
- Protected Side Artifact key envelope gerçek `windows-dpapi` sağlayıcısı ve ciphertext/plaintext ayrımıyla doğrulanır.
- Development Electron ile kurulmuş paketli Electron aynı güvenlik probunu iki ardışık process çalışmasında geçmek zorundadır.
- Ayrı result verifier iki launch probe'u OPEN-021/022 Windows security evidence sonucuna bağlar.

## Doğrulama

- Build215 Windows harness contract: **26/26 PASS**
- Package source TypeScript: **PASS**
- Desktop-main controlled TypeScript: **PASS**
- Gerçek Windows EFS/DPAPI/paketli Electron/installer: **NOT_RUN**

DEC-106 ve ADR-089 bağlayıcıdır. OPEN-021/OPEN-022 platform kanıtı gerçek Windows PASS alınana kadar kapanmaz.
