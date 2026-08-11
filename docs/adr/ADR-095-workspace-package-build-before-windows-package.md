# ADR-095 — Windows package lifecycle öncesi workspace build prerequisite

## Bağlam

Monorepo içindeki `@ppt/*` workspace paketleri `main` ve `types` alanlarında `dist/index.js` ve `dist/index.d.ts` çıktılarına bağlıdır. Temiz `npm ci` bu çıktıları üretmez. Desktop `package:win` doğrudan çalıştırıldığında Electron TypeScript derlemesi workspace modüllerini çözemeyebilir.

## Karar

Build221 Windows güvenlik runner sırası:
1. root `npm ci`,
2. isolated `windows-packager` bootstrap,
3. `npm run build:packages`,
4. workspace dist fail-closed guard,
5. desktop `package:win`.

Guard, build zincirindeki 13 workspace paketi için hem JavaScript hem declaration çıktısının varlığını doğrular. Eksik tek çıktı bile installer yaşam döngüsünü durdurur.

## Sonuç

Bu karar yalnız build sırasını düzeltir; gerçek Windows EFS/DPAPI veya packaged Electron PASS iddiası oluşturmaz. OPEN-021 ve OPEN-022 gerçek Build221 evidence dönene kadar `IN_PROGRESS` kalır.
