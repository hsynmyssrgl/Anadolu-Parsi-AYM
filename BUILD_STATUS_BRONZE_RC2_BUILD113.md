# Panthera pardus tulliana Aile — Bronze RC2 Build 113

- Application Version: `25.07.2026.113`
- Package Version: `25.7.2026-113`
- Stage: **Bronze RC2 Active Development**
- Promotion: Bronze RC2 Final / Code Freeze / Silver / Gold yapılmadı.

## Build 113 odağı

Kaynak teslim ZIP'inin dış araç, dosya sistemi zamanı, dosya izinleri veya işletim sistemi sıralamasına bağlı olmadan aynı kaynak ağacından byte düzeyinde aynı biçimde yeniden üretilebilmesi sağlandı.

## Mimari değişiklikler

- Bağımlılıksız ZIP32/STORE yazıcısı `scripts/lib/deterministic-zip.mjs` içinde oluşturuldu.
- Dosyalar UTF-8 yol adı, sabit `1980-01-01 00:00:00` ZIP zamanı ve sabit `100644` Unix modu ile paketlenir.
- Kaynak yolları kesin sıralı ve tekrarsız olmak zorundadır; traversal ve mutlak yollar reddedilir.
- `manifest.json` ile `SHA256SUMS.txt` teslim ZIP'ine açık biçimde dahil edilir.
- Arşiv merkezi dizini, yerel başlıkları, CRC-32, SHA-256, dosya boyutları, sıralama ve içerik kümesi çapraz doğrulanır.
- Aynı kaynak ağacından iki bağımsız üretimin byte düzeyinde aynı olduğu source-preflight içinde zorunlu doğrulanır.
- Linux CI ve Windows RC2 kanıt paketlerine arşiv yeniden üretilebilirlik raporu eklendi.

## Aşama durumu

Bu artırım aktif mimari geliştirmedir. Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir.
