# Build224 — Bronze Windows Güvenlik Yeniden Testi

**Aktif sürüm:** 02.08.2026.224

## Neden yeniden test

Build223 gerçek Windows koşusunda source integrity, dependency bootstrap, isolated Windows packager bootstrap, workspace build/dist guard, Electron main/preload build ve renderer build PASS oldu. Installer ön doğrulaması, `LICENSE_TR.rtf` ile `LICENSE_TR.txt` arasındaki türetilmiş içerik driftinde FAIL oldu; OPEN-021/OPEN-022 probları çalışmadı.

## Build224 düzeltmesi

- Build224 kaynak snapshotındaki `LICENSE_TR.rtf`, `LICENSE_TR.txt` üzerinden deterministik yeniden üretildi.
- Generation ve verification aynı `license-rtf-lib.mjs` renderer'ını kullanır.
- `verify:license-sync` Windows paketlemeden önce fail-closed çalışır.
- Windows closure runner lisans senkronizasyonunu ayrı `license-rtf-sync-prerequisite` adımı olarak kaydeder.
- Paketleme frozen source snapshotını sessizce değiştirmez.

## Çalıştırma

Build224 kaynak ZIP'i Windows bilgisayarda tamamen çıkarılır ve kökteki:

`BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD224.cmd`

çalıştırılır.

Runner sırası:

1. exact source integrity
2. root `npm ci`
3. isolated Windows packager bootstrap
4. workspace package build
5. workspace dist guard
6. NSIS license TXT/RTF sync prerequisite
7. installer build
8. OPEN-021 / OPEN-022 development probes
9. silent current-user install
10. installed/package probes
11. uninstall
12. independent readiness verification
13. exact-source-bound evidence ZIP + `.sha256`

## Sonuç kodları

- `0`: OPEN-021 + OPEN-022 `READY_TO_CLOSE`
- `21`: yalnız OPEN-021 `READY_TO_CLOSE`
- `22`: yalnız OPEN-022 `READY_TO_CLOSE`
- diğer: kapanışa hazır değil

Kanıt: `artifacts/validation/Bronze_Guvenlik_Windows_Kanitlari_Build224_*.zip` ve aynı adın `.sha256` dosyası.

Runner Ana Build Defteri'ni değiştirmez. `npm ci` OPEN-002'yi otomatik kapatmaz. OPEN-021/022 yalnız exact Build224 gerçek Windows evidence doğrulandıktan sonra yeni governed build içinde kapatılabilir.
