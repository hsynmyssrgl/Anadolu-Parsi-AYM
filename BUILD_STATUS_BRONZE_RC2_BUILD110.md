# Panthera pardus tulliana Aile — Bronze RC2 Build 110

- Application Version: `25.07.2026.110`
- Package Version: `25.7.2026-110`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 110 odağı

Temiz bağımlılık kurulum kapısının geçici dış servis hatalarını güvenli ve ölçülebilir biçimde yeniden denemesi; kaynak/lockfile hatalarıyla dış npm hizmeti kesintilerini birbirinden ayırması ve hiçbir koşulda güvenilmeyen alternatif registry’ye sessiz geçiş yapmaması sağlandı.

## Mimari değişiklikler

- `config/npm-ci-policy.json` ile resmî npm registry, yeniden deneme sayısı, gecikme ve retry edilebilir hata sinyalleri tek politikada toplandı.
- `scripts/run-clean-npm-ci.mjs`, temiz kaynak ağacını ve lockfile registry kökenlerini doğrulamadan kurulumu başlatmaz.
- Yalnızca HTTP 408/429/500/502/503/504 ile tanımlı geçici ağ hatalarında sınırlı yeniden deneme yapılır.
- Lockfile/politika, bütünlük ve yerel izin hataları tekrar edilmeden doğrudan sınıflandırılır.
- Npm çıktısındaki olası token ve URL kimlik bilgileri kanıt dosyasına yazılmadan önce maskelenir.
- Her deneme; süre, exit code, sinyal, sınıflandırma ve eşleşen hata göstergeleriyle JSON kanıtına kaydedilir.
- RC2 gate zincirinin ilk kapısı yeni temiz npm ci yöneticisine bağlandı.
- Windows GitHub Actions kanıt paketi bağımlılık erişim raporunu da koruyacak şekilde genişletildi.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.

## Gerçek doğrulama durumu

- Lockfile integrity: **PASS — 1.150 assertion**
- Dependency supply: **PASS — 1.349 assertion / 436 tarball**
- Workspace dependency contracts: **PASS — 356 assertion**
- Aktif sürüm sözleşmesi: **PASS — 176 assertion**
- Build 110 mimari doğrulaması: **PASS — 80 assertion**
- Package-source controlled type-check: **PASS — TypeScript 5.8.3**
- Electron-main controlled source type-check: **PASS**
- Aktif Bronze database kaynak kapısı: **PASS**
- Temiz `npm ci`: **FAIL — üç denemede EAI_AGAIN / dış bağımlılık hizmeti erişilemedi**
- Tam root `tsc --noEmit`, Electron production build, blocking smoke, Windows gerçek açılış ve installer: **NOT_RUN**
