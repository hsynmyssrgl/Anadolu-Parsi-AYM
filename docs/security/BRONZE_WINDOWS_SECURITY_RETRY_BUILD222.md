# Build222 — Bronze Windows Güvenlik Yeniden Testi

**Aktif sürüm:** 02.08.2026.224

## Neden yeniden test

Build221 gerçek Windows koşusunda exact-source integrity, root npm ci, isolated Windows packager bootstrap, workspace package build ve dist guard PASS oldu. Installer Electron TypeScript derlemesi `preload.ts` satır 146'da TS7017 ile durduğu için OPEN-021/OPEN-022 probları çalışmadı.

## Build222 düzeltmesi

Doğrudan `globalThis.addEventListener` erişimi kaldırıldı. `beforeunload` için dar, opsiyonel typed renderer lifecycle target kullanılır. Runtime cancellation semantiği değişmez.

## Çalıştırma

Build222 kaynak ZIP'i gerçek Windows bilgisayarda tamamen çıkarılır ve kökteki:

`BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD222.cmd`

çalıştırılır.

Runner exact source integrity → root npm ci → isolated windows-packager bootstrap → workspace package build → dist guard → installer build → OPEN-021/022 development probe → install → installed/package probe → uninstall → bağımsız readiness → evidence ZIP/SHA sırasını uygular.

## Sonuç kodları

- `0`: OPEN-021 ve OPEN-022 birlikte `READY_TO_CLOSE`
- `21`: yalnız OPEN-021 `READY_TO_CLOSE`
- `22`: yalnız OPEN-022 `READY_TO_CLOSE`
- diğer: kapanışa hazır değil

Kanıt dosyaları `artifacts/validation/Bronze_Guvenlik_Windows_Kanitlari_Build222_*.zip` ve aynı adın `.sha256` dosyasıdır. Runner Ana Build Defteri'ni değiştirmez; `npm ci` OPEN-002'yi otomatik kapatmaz.
