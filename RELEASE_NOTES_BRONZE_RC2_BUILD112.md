# Bronze RC2 Build 112 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.112`
- Package Version: `25.7.2026-112`
- Kanal: Bronze RC2 Active Development

## Eklenenler

- Kaynak manifesti ve SHA-256 teslim bütünlüğü doğrulayıcısı
- Manifest/SHA-256 için ortak güvenli dosya-toplama kütüphanesi
- Dosya yolu, byte, hash, sıralama, tekrar ve kaynak-ağacı eşitliği kontrolleri
- Makine tarafından okunabilir `source-integrity.json` kanıtı
- Temiz npm yöneticisi için SIGINT/SIGTERM aktarımı ve `RUNNER_INTERRUPTED` sınıflandırması

## Değiştirilenler

- `manifest.json` şeması 3'e yükseltildi ve `fileCount` alanı eklendi.
- `npm run manifest` artık `manifest.json` ile `SHA256SUMS.txt` dosyalarını birlikte üretir.
- Kaynak bütünlüğü, source-preflight zincirinin ilk zorunlu kontrolüdür.
- Değişken doğrulama kanıtları `artifacts/validation` alanına ayrıldı.
- Kesintiye uğrayan npm süreci yeniden denenmez; alt süreç ağacı kapatılır ve kısmi kurulum kalıntıları temizlenir.

## Doğrulama özeti

- Source-preflight: **PASS — 6/6**
- Build 112 mimari doğrulaması: **PASS — 103 assertion**
- Temiz npm erişimi: **FAIL — dış hizmet EAI_AGAIN / ATTEMPT_TIMEOUT**
- Sonraki zorunlu kapılar: **NOT_RUN — blockedBy: clean-npm-ci**

## Değişmeyen güvenlik durumu

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir. Tam temiz kurulum, root type-check, production build, smoke, Windows gerçek açılış ve installer kapıları gerçekten geçmeden PASS olarak raporlanmaz.
