# Bronze RC2 Build 113 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.113`
- Package Version: `25.7.2026-113`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- Deterministik ZIP32/STORE kaynak paketleyici.
- Kaynak ZIP merkezi dizin ve yerel başlık doğrulayıcısı.
- CRC-32 ve SHA-256 içerik çapraz kontrolü.
- Sabit arşiv zamanı, izin modu ve UTF-8 yol sözleşmesi.
- İki bağımsız üretimin byte düzeyinde karşılaştırıldığı yeniden üretilebilirlik kapısı.
- `source:archive`, `verify:source-archive` ve `verify:source-archive:reproducibility` komutları.

## Güvenlik ve bütünlük

- Mutlak, traversal, tekrarlı ve sırasız yollar reddedilir.
- Arşivde manifest dışı veya eksik dosya reddedilir.
- Değiştirilmiş arşiv içeriği CRC-32 ve SHA-256 kontrollerinde durdurulur.
- Zlib sürüm farklarına bağlı çıktı değişimini önlemek için sıkıştırmasız STORE yöntemi kullanılır.

## Doğrulama kuralı

Tam `npm ci`, root `tsc --noEmit`, production build, smoke, Windows açılış ve installer sonuçları yalnızca gerçekten çalıştırılırsa PASS olarak raporlanır.
