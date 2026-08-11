# ADR-085 — Onaylı UI baseline hash sabitlemesi

## Bağlam
Aktif teslim otomasyonu görseli yalnız dosya yoluyla taşıdığı için eski koyu dashboard görseli Build208–211 boyunca `Aktif_Baseline` adıyla yeniden paketlenebildi.

## Karar
Aktif UI baseline tek dosya yolu + SHA-256 + boyut + açık-tema paleti + görsel yön metadata'sıyla tanımlanır. `UI_VISUAL_REFERENCE_MANIFESTO_ACTIVE.png` SHA-256 `f2f2a083fb74a50fc31459c8236eff9be74e01f9b359c5889fdb740395850357` olmak zorundadır. Hash driftinde preflight başarısız olur.

## Sonuç
- Tarihsel Build208–211 kanıtları geriye dönük değiştirilmez.
- Yanlış koyu görsel aktif yüzeyden çıkarılır.
- Silver görsel karşılaştırması onaylı açık-tema kaynağa dayanır.
- Görseldeki örnek içerik veri sözleşmesi değildir; production temiz-data yasağı aynen sürer.
