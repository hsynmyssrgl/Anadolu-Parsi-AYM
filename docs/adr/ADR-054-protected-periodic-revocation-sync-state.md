# ADR-054 — Korumalı periyodik iptal listesi eşitleme durumu

**Aktif sürüm:** 01.08.2026.219  

**Durum:** Kabul edildi  
**Kanal:** Bronze RC2 Build 181  
**Politika:** `PPT-LIFECYCLE-STRICT-V1`

## Bağlam

Build 142–148, Ed25519 imzalı sağlayıcı iptal listelerini, HTTPS kaynak profillerini, TLS SPKI pinlerini, geri alma korumasını ve ana süreçte güçlü onay bekleyen liste akışını oluşturdu. Ancak eşitleme durumu ve bekleyen imzalı liste süreç belleğindeydi; uygulama yeniden başlatılırsa kaybolabiliyordu. Ayrıca doğrulanmış listenin yokluğu, 24 saat içinde sona erecek olması veya süresinin dolması kaynak bazında kullanıcıya gösterilmiyordu.

## Karar

- Eşitleme durumu ve bekleyen imzalı liste, Electron `safeStorage` / işletim sistemi sır koruması üzerinden şifreli biçimde saklanır.
- Dosya atomik yazılır, boyut ve kaynak sayısı sınırlıdır, çözülmüş payload SHA-256 ile doğrulanır.
- Bozuk, başka koruma sağlayıcısına ait veya şema dışı dosya karantinaya alınır; içeriği güvenilir kabul edilmez.
- Kaynak profili, TLS pini veya etkinlik durumu değişirse bekleyen liste geri çekilir.
- Doğrulanmış liste durumu `missing`, `fresh`, `expiring_soon` ve `expired` olarak sınıflanır. `nextUpdate` zamanına 24 saat kaldığında uyarı, süre dolduğunda kritik uyarı üretilir. Aynı durum ve bitiş zamanı için uyarı tekilleştirilir ve bu tekilleştirme yeniden başlatmada korunur.
- Gerçek ağ sağlayıcısı yerine enjekte edilebilir çevrimdışı test adaptörü bulunur; ağır haricî API gerektirmez.
- Periyodik çalışma mevcut Bronze zamanlayıcısına bağlıdır. Silver, gerçek Windows `safeStorage`, ağ, TLS, zamanlama, üretim dosya sistemi ve tam regresyon kampanyasını çalıştırır; yeni ürün özelliği eklemez.

## Sonuçlar

Bekleyen güvenlik güncellemesi yeniden başlatmada kaybolmaz, süresi yaklaşan veya dolan güven listeleri görünür olur ve kaynak profili değişiklikleri eski bekleyen payloadı otomatik geri çeker.

Not: Bu durum kalıcı olarak korunur ve 24 saat eşiği kullanıcı uyarısı üretir.
