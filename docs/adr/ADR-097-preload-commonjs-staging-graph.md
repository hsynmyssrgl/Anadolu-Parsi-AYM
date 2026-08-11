# ADR-097 — Preload CommonJS staging graph

## Karar
Electron preload CommonJS çıktısı tek dosyalık geçici kopyadan derlenmez. `preload.ts` ile onun runtime yerel IPC bağımlılıkları kontrollü `.cts` staging grafiğine alınır. Relative IPC specifier'ları `.cjs` çıktılara yönlendirilir. `.cts` generic arrow ayrıştırma belirsizliği staging transform ile güvenli trailing-comma biçimine normalize edilir.

## Neden
Build222 gerçek Windows installer derlemesi, tek başına staged `preload.cts` nedeniyle üç `TS2307` ve iki `TS7060` hatasıyla durdu. CJS graph staging hem compile-time resolution hem runtime `require('./*.cjs')` uyumunu açık hale getirir.

## Sınırlar
- Main-process ESM çıktıları değiştirilmez.
- Preload runtime cancellation/IPC semantiği değiştirilmez.
- Windows EFS/DPAPI sonucu bu ADR ile PASS sayılmaz.
- OPEN-021/022 kapanışı exact-source real Windows evidence gerektirir.
