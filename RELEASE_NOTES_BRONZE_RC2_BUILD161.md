# Bronze RC2 Build 161 Sürüm Notları

- Application Version: `29.07.2026.161`
- Package Version: `29.7.2026-161`
- Stage: **Bronze RC2 Active Development**

## Değişiklikler

- Ağır ve iptal edilebilir IPC okumalarına admission/backpressure katmanı eklendi.
- Renderer başına en fazla dört etkileşimli/standart ağır okuma çalışır.
- Aynı ağır kanalda aynı anda en fazla bir iş çalışır.
- Dashboard, snapshot ve katalog çağrıları yüksek önceliklidir.
- Büyük veri sayfaları standart, güvenli ağ senkronizasyonu düşük önceliklidir.
- Kuyruklar renderer başına sınırlıdır ve bekleme süreleri bounded yapıdadır.
- Kuyruk doluluğu ile kuyruk süre aşımı tipli, yeniden denenebilir hatalardır.
- Kuyruktaki istekler tekil iptal, oturum değişimi ve pencere kapanışıyla temizlenir.
- Mutasyon kanalları admission kuyruğuna alınmadan mevcut davranışını korur.
- Başlama loglarına kuyrukta bekleme, öncelik ve kuyruk derinliği telemetrisi eklendi.

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
