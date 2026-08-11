# Bronze RC2 Build 100 — Release Notes

## Değişiklikler

- `package-lock.json` içindeki hatalı `esbuild` sürüm metadatası `0.25.12` olarak düzeltildi.
- `scripts/verify-lockfile-integrity.mjs` eklendi.
- `scripts/set-workspace-version.mjs` eklendi.
- Root `tsconfig.json` ve gerçek `tsc --noEmit` komut sözleşmesi eklendi.
- Aktif doğrulama komutu `verify:build100:architecture` olarak güncellendi.

## Doğrulama notu

Kaynak düzeyi doğrulamalar geçti. Temiz `npm ci`, dış paket hizmetinin HTTP 503 yanıtı nedeniyle tamamlanmadı. Bu nedenle derleme ve test doğrulamaları bu Build'de çalıştırılmadı.
