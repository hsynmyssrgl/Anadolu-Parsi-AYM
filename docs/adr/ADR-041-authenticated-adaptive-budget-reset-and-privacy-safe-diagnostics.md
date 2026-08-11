# ADR-041 — Yetkili Adaptif Bütçe Sıfırlama ve Gizlilik Güvenli Tanı Paketi

- Durum: Kabul edildi
- Tarih: 2026-07-29
- Aşama: Bronze RC2 Active Development

## Karar

Adaptif IPC bütçe durumu yalnız güvenilir renderer ve açık kullanıcı oturumu üzerinden, ikinci bir ana-süreç onayıyla `baseline` moda sıfırlanabilir. Sıfırlama cache ve toplu telemetriyi temizler, nesli ilerletir ve hash-zincirli günlüğe `manual-clear` olayı ekler.

Tanı dışa aktarımı ham günlük veya uygulama verisi yerine yalnız doğrulanmış teknik özet üretir. Paket atomik JSON ve ayrı SHA-256 checksum olarak yazılır. Karantina saklama yaş ve adet sınırıyla bounded tutulur.

## Gerekçe

- Operatör, yanlış veya aşırı kısıtlayıcı adaptif moda uygulamayı yeniden kurmadan müdahale edebilmelidir.
- Teknik destek kanıtı kullanıcı/aile verisini taşımamalıdır.
- Bozuk dosyaların sınırsız birikmesi disk tüketimine dönüşmemelidir.

## Güvenlik sonucu

İşlemler fail-closed, kullanıcı onaylı ve denetlenebilir kalır. Tanı paketi istek/payload içermediğinden veri minimizasyonu korunur.
