# Bronze RC2 Build 181 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.181`
- Package Version: `30.7.2026-181`
- Stage: **Bronze RC2 Active Development**
- Build: **181**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Eklenenler

- Bekleyen imzalı iptal listesi ve eşitleme durumu, işletim sistemi korumalı atomik dosyada saklanır.
- Bozuk veya koruma sağlayıcısı uyuşmayan durum karantinaya alınır.
- Kaynak profili, TLS pini veya etkinlik durumu değişirse bekleyen liste geri çekilir.
- Liste durumu `missing`, `fresh`, `expiring_soon` ve `expired` olarak sınıflanır.
- `nextUpdate` zamanına 24 saat kaldığında uyarı, süre dolduğunda kritik uyarı üretilir.
- Aynı uyarı yeniden başlatmada da tekilleştirilir.
- Güvenlik ekranı kaynak bazında liste sağlığı ve kalıcılık durumunu gösterir.
- Ağsız hedefli testler için enjekte edilebilir eşitleme adaptörü sağlanır.
