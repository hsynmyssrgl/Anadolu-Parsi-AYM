# ADR-028 — Güvenilen iptal listesi uç noktası ve TLS SPKI pin döndürme

- **Durum:** Kabul edildi
- **Build:** 144
- **Tarih:** 28.07.2026

## Bağlam

Build 143, imzalı sağlayıcı iptal listelerini HTTPS üzerinden TLS doğrulaması ve
SPKI pinning ile alabiliyordu. Ancak kaynak URL ve pinin her istekte renderer
üzerinden verilmesi kalıcı güven ilişkisi, değişiklik denetimi ve güvenli sertifika
geçişi için yeterli değildi.

## Karar

Her iptal listesi kaynağı kök güven sağlayıcısına bağlı kalıcı bir profil olarak
saklanır. Profil değişikliği güçlü yeniden doğrulama ve kesin onay gerektirir.
Ağ katmanı yalnız ana süreçte çözümlenen, o anda geçerli birincil/geçiş pinlerini
kullanır.

Pin geçişinde:

- Birincil ve ikincil pin farklı olmalıdır.
- İkincil pin başlangıcı ile birincil pin bitişi arasındaki çift-pin pencere en
  fazla 14 gündür.
- Geçiş en fazla 90 gün ileriye planlanabilir.
- Devre dışı profil veya geçerli pini kalmamış profil bağlantı kuramaz.
- Son alım sonucu profile yazılır.

## Sonuçlar

Renderer serbest URL/pin veremez. TLS sertifika değişimi sınırlı bir çift-pin
penceresiyle planlanabilir. SPKI pin doğrulaması yalnız taşıma kanalını sınırlar;
belge yine Build 142 Ed25519 imza, sıra numarası ve zaman penceresi kurallarından
geçer.

## Ertelenen doğrulamalar

- Gerçek sağlayıcı sertifika geçişi ve pin rotasyonu
- Gerçek internet endpoint’iyle paketli Windows testi
- Otomatik periyodik senkronizasyon ve hata bildirim UAT’si
