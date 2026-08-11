# Release Notes — Build224

Build224, exact-source Build223 gerçek Windows testinde görülen NSIS lisans TXT/RTF driftini düzeltir.

- Build223 gerçek FAIL evidence exact-source olarak kabul edilip sanitize failure-intake kaydına alındı.
- Önceki bootstrap/workspace-build/preload typing/CommonJS staging düzeltmeleri korunur.
- `LICENSE_TR.txt` tek düzenlenebilir lisans kaynağı olarak sabitlendi.
- Generation, standalone sync verification ve installer verification aynı RTF renderer fonksiyonunu kullanır.
- Frozen Build224 kaynağındaki `LICENSE_TR.rtf` deterministik olarak yeniden üretildi.
- `package:win` ve `package:win:dir`, kaynak dosyayı sessizce değiştirmeden önce `verify:license-sync` ile fail-closed kontrol eder.
- Valid/tamper runtime TXT ve RTF tek-taraflı driftini yakalar; explicit regeneration sonrası PASS'ı doğrular.
- Yeni: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD224.cmd`.
- OPEN-021 ve OPEN-022 exact Build224 gerçek Windows evidence dönmeden kapanmaz.
