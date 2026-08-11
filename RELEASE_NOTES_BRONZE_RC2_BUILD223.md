# Release Notes — Build223

Build223, exact-source Build222 gerçek Windows testinde görülen preload CommonJS staging derleme hatalarını düzeltir.

- Build222 gerçek FAIL evidence exact-source olarak kabul edilip sanitize failure-intake kaydına alındı.
- Önceki bootstrap/workspace-build/dist-guard/TS7017 düzeltmeleri korunur.
- Preload'un üç yerel IPC bağımlılığı CommonJS TypeScript staging grafiğine dahil edilir.
- Relative `.js` IPC specifier'ları staged graph içinde `.cjs` olarak yeniden yazılır.
- `.cts` generic arrow uyumluluğu staging transform ile normalize edilir; iki preload generic invoker function declaration kullanır.
- Focused CJS graph runtime gerçek `tsc` ile dört `.cjs` çıktısını doğrular ve eksik-modül tamper senaryosunda fail-closed davranır.
- Yeni: `BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD223.cmd`.
- OPEN-021 ve OPEN-022 exact Build223 gerçek Windows evidence dönmeden kapanmaz.
