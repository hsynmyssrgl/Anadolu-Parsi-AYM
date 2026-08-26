# ADR-067 — Temiz-Yedek Claim Rezervasyonu

**Aktif sürüm:** 31.07.2026.194

- Durum: Kabul edildi
- Kanal: Bronze RC2 Active Development
- Build: 194
- Karar: DEC-084

## Bağlam

Çalışan temiz-yedek defteri sahip kimliği politika ile eşleşse de politika sahiplenmesi ile defter satırının oluşturulması arasında tek kullanımlık, kalıcı ve değiştirilemez bir başlangıç kanıtı yoktu. Doğrudan SQLite yazımı; çalışma kimliği, tetikleyici, başlangıç zamanı, saklama kesimi veya sayaçları farklı bir sahiplik zinciri kurmayı deneyebilirdi.

## Karar

Migrasyon 38, `backup_clean_rewrite_claim_reservations` tablosunu ve rezervasyon yaşam döngüsü tetikleyicilerini ekler. Repository önce `open` rezervasyon oluşturur; politika ile `running` çalışma defterini aynı kimlik ve iş yükü anlık görüntüsüne bağladıktan sonra rezervasyonu yalnız bir kez `consumed` durumuna geçirir. Rezervasyon kimliği, tetikleyicisi, başlangıç zamanı, saklama kesimi, sayaçları ve oluşturulma zamanı değiştirilemez.

## Sonuçlar

- Rezervasyonsuz veya rezervasyonla uyuşmayan politika sahiplenmesi fail-closed reddedilir.
- `running` çalışma defteri yalnız eşleşen açık rezervasyonla oluşturulur.
- Rezervasyon, politika ve defter sahipliği kurulmadan tüketilemez.
- Tüketilmiş rezervasyon değiştirilemez veya silinemez.
- Kesinti kurtarma ve terminal tamamlama zincirleri aynı tüketilmiş sahiplik kanıtını kullanır.
