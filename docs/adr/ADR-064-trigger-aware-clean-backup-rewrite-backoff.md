# ADR-064 — Tetikleyiciye Duyarlı Temiz Yedek Geri Çekilmesi

**Aktif sürüm:** 01.08.2026.219  

## Durum

Kabul edildi — Build 191.

## Bağlam

Politika manuel hata için 60, otomatik hata için 360 dakika tanımlamasına rağmen hedefsiz `attention` yolu ve kesinti kurtarması her zaman otomatik gecikmeyi kullanıyordu. Bu durum manuel düzeltme sonrası yeniden denemeyi gereksiz biçimde altı saat engelleyebiliyordu.

## Karar

Terminal gecikme, çalışma defterindeki `trigger` ve kalıcı politikadaki ilgili süreyle hesaplanır. `deferred` yalnız yüksek yük ertelemesini kullanır. Repository ve SQLite tetikleyicileri aynı sözleşmeyi fail-closed uygular.

## Sonuçlar

- Manuel dikkat/hata/kısmi/kesinti sonuçları 60 dakika sonra yeniden denenebilir.
- Otomatik sonuçlar 360 dakikalık geri çekilmeyi korur.
- Politika ve çalışma defteri arasında tetikleyici/gecikme sapması kalıcılaşamaz.
