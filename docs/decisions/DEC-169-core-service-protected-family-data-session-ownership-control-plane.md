# DEC-169 — Core Service korumalı aile-verisi oturumu sahiplik kontrol düzlemi

## Durum

ACTIVE — kullanıcının ana yapıya öncelik verilmesi ve devam edilmesi talimatının 31-H dilimi.

## Karar

Aktif aile verisi bugün Desktop tarafından açılan, şifreli kullanıcı kasasına bağlı geçici SQLite oturumundadır. Bu oturumun dosya yolunu veya bağlantısını doğrulanmış bir devir protokolü olmadan Core Service'e açmak veri gizliliğini, tek-yazar sahipliğini ve kapanış mühürlemesini bozabilir.

31-H önce Core Service içinde tip güvenli, makine-okunur ve monoton epoch kullanan aile-verisi oturum sahipliği kontrol düzlemini kurar. Core Service yalnız gerçek bir korumalı oturum portu bağlandığında `core-service` sahipliği ve `ready` yaşam döngüsü ilan edebilir. Bağlı oturum yokken gerçek durum `desktop-transition`, `detached` ve yazılamaz olarak kalır.

Desktop başlangıç el sıkışması aile-verisi durumunu ayrıca okur; architecture manifest ile sahiplik durumu çelişirse fail-closed durur. Kalıcı veritabanı yolu protokol üzerinden yayımlanmaz.

## Açık sınırlar

- Korumalı kasa anahtarı ve oturum yetkisinin süreçler arası devri tamamlanmamıştır.
- Core Service'in gerçek SQLite bağlantısını açması, migration çalıştırması ve tek-yazar olması tamamlanmamıştır.
- Aile graph okuma ve yazma API'leri bu dilimde COMPLETE değildir.
- Backup/sync sahipliği ve Windows servis kurulumu açık kalır.

Bu checkpoint DHA-001, PPK-003 ve PPK-014 için ana-yapı foundation'ıdır; hiçbir gereksinimi tek başına COMPLETE saymaz ve yeni Build vermez.
