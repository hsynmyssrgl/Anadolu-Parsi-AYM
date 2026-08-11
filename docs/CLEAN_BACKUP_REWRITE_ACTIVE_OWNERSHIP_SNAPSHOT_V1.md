# Aktif Temiz-Yedek Sahiplik Anlık Görüntüsü V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Claim tamamlandıktan sonra tüketilmiş rezervasyon, aktif politika ve `running` çalışma defteri terminal geçişe kadar aynı sahiplik ve iş yükü anlık görüntüsünü taşır.

## Değiştirilemez alanlar

- Politika: tetikleyici, son deneme, devam eden çalışma kimliği, başlangıç ve güncelleme zamanı.
- Defter: kimlik, tetikleyici, saklama kesimi, bekleyen kayıt, etkin hedef, ara sonuç alanları, başlangıç ve güncelleme zamanı.

## Terminal geçiş

`success`, `partial`, `failed`, `attention`, `deferred` veya `interrupted` geçişi ancak tüketilmiş rezervasyon, politika ve defter hâlâ birebir eşleşiyorsa repository tarafından kabul edilir.

## SQLite

Migrasyon 39 iki fail-closed tetikleyici kurar. Geçerli terminal geçişi `running` durumundan çıktığı için engellenmez.
