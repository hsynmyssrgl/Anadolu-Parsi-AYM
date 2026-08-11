# Build 111 Delivery Validation Report

## Teslim kapsamı

Build 110 doğrulanmış kaynak paketi temel alınarak kaynak/sürüm sözleşmelerinin dış npm erişiminden ayrıldığı source-preflight fazı, faz tabanlı RC2 raporlaması ve başarısız bağımlılık kurulum kalıntısı temizliği eklenmiştir.

## Kaynak doğrulamaları

- Kök ve 14 workspace package sürümleri: **senkron**
- Internal `@ppt/*` dependency sürümleri: **senkron**
- Lockfile integrity: **PASS — 1.150 assertion / 14 workspace**
- Dependency supply: **PASS — 1.349 assertion / 436 canonical tarball**
- Workspace dependency contracts: **PASS — 356 assertion / çevrimsiz production graph**
- Sürüm sırası: **PASS — 25.07.2026.111**
- Aktif sürüm ve metadata sözleşmesi: **PASS — 176 assertion / 14 workspace**
- Source preflight: **PASS — 5/5 kontrol**
- Build 111 mimari doğrulaması: **PASS — 98 assertion**
- Package-source controlled type-check: **PASS — TypeScript 5.8.3**
- Electron-main controlled source type-check: **PASS**
- Aktif Bronze database kaynak kapısı: **PASS — 11 migration, 42 tablo, 132 IPC kanalı**
- Repository source-only verification: **PASS**
- Node `.mjs` syntax: **PASS — 97 dosya**
- JSON parse: **PASS — 289 dosya**
- GitHub Actions YAML parse: **PASS — 2 dosya**

- Kaynak manifesti: **PASS — 913 dosya hash/boyut kaydı**

## Temiz bağımlılık erişim kanıtı

`artifacts/validation/build111-clean-validation.json` ve `artifacts/validation/npm-ci-dependency-access.json` raporlarında:

- Durum: **FAIL**
- Sınıflandırma: `EXTERNAL_DEPENDENCY_SERVICE_UNAVAILABLE`
- Deneme: **3/3**
- Her denemede gerçek sinyal: `EAI_AGAIN`
- Her denemede asılı süreç koruması: `ATTEMPT_TIMEOUT`
- Resmî registry kısıtı: **etkin**
- Alternatif registry: **kullanılmadı**
- Kısmi kurulum kalıntısı temizliği: **PASS**
- Kaldırılan kalıntılar: `node_modules`, `apps/desktop/node_modules`

## Tam RC2 kapı zinciri

`artifacts/validation/build111-rc2-validation-report.json` raporunda:

- `source-preflight`: **PASS**
- `clean-npm-ci`: **FAIL**
- `tsc-no-emit`: **NOT_RUN — blockedBy: clean-npm-ci**
- `electron-production-build`: **NOT_RUN — blockedBy: clean-npm-ci**
- `smoke-tests`: **NOT_RUN — blockedBy: clean-npm-ci**
- `windows-real-launch`: **NOT_RUN — blockedBy: clean-npm-ci**
- `windows-installer`: **NOT_RUN — blockedBy: clean-npm-ci**

Çalıştırılmayan kapılar PASS olarak gösterilmemiştir.

## Teslim statüsü

Bronze RC2 Build 111 kaynak teslimidir. Üretim, Final, Code Freeze, Silver veya Gold teslimi değildir.
