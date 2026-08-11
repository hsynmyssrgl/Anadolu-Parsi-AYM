# IPC Performance Telemetry V1

## Amaç

Build 159–162 ile kurulan taşıma, iptal, geri basınç ve okuma paylaşım katmanlarının
performansını kullanıcı verisi kaydetmeden ölçmek ve darboğazları görünür kılmak.

## Veri minimizasyonu

Telemetri yalnız kanal adı, sonuç sınıfı, süre, kuyruk bekleme süresi, etkin/kuyruk
sayaçları ve cache kullanım bayraklarını tutar. İstek kimliği, renderer oturum kimliği,
kullanıcı kimliği, argümanlar, kayıt içerikleri ve yanıt payload'ı telemetriye alınmaz.

## Sınırlar

- Son 60 dakikalık kayan pencere
- Kanal başına en fazla 256 örnek
- En fazla 64 kanal
- En fazla 24 aktif alarm
- Sistem Sağlığı ekranında en fazla 8 kanal gösterimi

## Alarmlar

Öncelik sınıfına göre p95 yanıt süresi ve p95 kuyruk beklemesi; yeterli örnek olduğunda
süre aşımı ve geri basınç ret oranı; ayrıca genel etkin/kuyruk baskısı değerlendirilir.
