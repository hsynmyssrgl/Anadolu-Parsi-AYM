# ADR-096 — Preload global lifecycle typing

## Karar

Electron preload katmanında renderer yaşam döngüsü için gereken `beforeunload` dinleyicisi, DOM kütüphanesini Electron main TypeScript sözleşmesine eklemek yerine dar bir structural type adapter üzerinden erişilir.

## Gerekçe

`tsconfig.electron.json` main/preload kaynaklarını Node types ve `tsconfig.base.json` içindeki `lib=["ES2024"]` ile derler. Bu sınırda doğrudan `globalThis.addEventListener` erişimi TS7017 üretir. Tüm DOM tiplerini main derlemesine eklemek istenmeyen type-surface genişlemesi yaratır.

## Uygulama

`preload.ts` içindeki `rendererLifecycleTarget`, yalnız `beforeunload`, `() => void` listener ve `{ once?: boolean }` seçeneğini tanımlar. Çağrı opsiyoneldir ve mevcut `cancelCurrentEpoch('renderer-unloaded')` davranışını korur.

## Kanıt

Build222 kaynak contract ve ES2024-only TypeScript A/B compile runtime bağlayıcıdır. Gerçek Windows installer/EFS/DPAPI kanıtı ayrıca gereklidir.
