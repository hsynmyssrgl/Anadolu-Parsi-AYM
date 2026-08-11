# ADR-038 — Gizlilik Güvenli IPC Performans Telemetrisi

- Durum: Kabul edildi
- Tarih: 2026-07-29
- Build: 163

## Karar

IPC performansı yalnız toplu ve bounded teknik ölçümlerle izlenecek. Telemetri kayıtları
istek, oturum, kullanıcı, argüman veya payload kimliklerini içermeyecek. Kayan pencere,
ring buffer ve kanal sınırları bellek kullanımını sabitleyecek. Alarm eşikleri kanalın
interactive/standard/background önceliğine göre uygulanacak.

## Sonuç

Darboğazlar Sistem Sağlığı ekranında görülebilir; kişisel aile verileri veya hassas işlem
ayrıntıları performans telemetrisine taşınmaz.
