# Sürüm Notları — Bronze RC2 Build 149

- Uygulama sürümü: `29.07.2026.149`
- Paket sürümü: `29.7.2026-149`
- Aşama: **Bronze RC2 Active Development**

## Değişiklikler

- Electron masaüstü workspace'inden kullanılmayan doğrudan `esbuild 0.25.12`
  bağımlılığı kaldırıldı.
- Esbuild 0.25.12 kurulum onayı ve lockfile platform kayıtları temizlendi.
- Lockfile bütünlüğü ve resmî tedarik kökeni kontrolleri korundu.
- Kaynak preflight zinciri Build 143–149 kontrolleriyle güncellendi.
- Build 144–148 özellik sözleşmeleri ileri build devamlılık doğrulamasına hazırlandı.
- Build 149 temiz doğrulama ve dürüst kapı raporlama sözleşmesi eklendi.

## Doğrulama sonucu

Temiz `npm ci` üç gerçek denemede tamamlanamadı. Dahili paket aynası iki ayrı
pakette 404 verdi; resmî npm kaynağı denemesinde npm CLI iç hatayla sonlandı.
Bu nedenle tam root TypeScript, test, production build ve smoke kapıları bağımlılık
eksikliğiyle FAIL oldu. Hiçbiri PASS sayılmadı.
