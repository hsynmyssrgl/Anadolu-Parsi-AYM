# Build223 — Bronze Windows Güvenlik Yeniden Testi

**Aktif sürüm:** 02.08.2026.224

## Neden yeniden test
Build222 gerçek Windows koşusunda dependency/bootstrap/workspace kapıları PASS oldu; installer build geçici preload CJS derlemesinde üç `TS2307` ve iki `TS7060` hatasıyla durdu. OPEN-021/OPEN-022 probları çalışmadı.

## Build223 düzeltmesi
Preload + üç local IPC bağımlılığı kontrollü CommonJS staging grafiğinde derlenir. Staged `.js` IPC specifier'ları `.cjs` olur; `.cts` generic arrow sözdizimi normalize edilir. Focused runtime dört CJS çıktısını ve eksik dependency fail-closed davranışını doğrular.

## Çalıştırma
Build223 kaynak ZIP'i gerçek Windows bilgisayarda tamamen çıkarılır ve kökteki:

`BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD223.cmd`

çalıştırılır.

Runner exact source integrity → root npm ci → isolated windows-packager bootstrap → workspace package build → dist guard → installer build → OPEN-021/022 development probe → install → installed/package probe → uninstall → bağımsız readiness → evidence ZIP/SHA sırasını uygular.

## Sonuç kodları
- `0`: OPEN-021 ve OPEN-022 birlikte `READY_TO_CLOSE`
- `21`: yalnız OPEN-021 `READY_TO_CLOSE`
- `22`: yalnız OPEN-022 `READY_TO_CLOSE`
- diğer: kapanışa hazır değil

Kanıt dosyaları `artifacts/validation/Bronze_Guvenlik_Windows_Kanitlari_Build223_*.zip` ve aynı adın `.sha256` dosyasıdır. Runner Ana Build Defteri'ni değiştirmez; `npm ci` OPEN-002'yi otomatik kapatmaz.
