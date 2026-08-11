# DEC-170 — Headless cihaz-sır koruma sınırı

## Durum

ACTIVE — ana-yapı önceliğinin 31-I devam dilimi.

## Karar

Kullanıcı veri kasasının anahtar zarfı Windows CurrentUser DPAPI ile korunur. Mevcut DPAPI sağlayıcısının Desktop kaynak ağacında sahiplenilmesi, kasanın ileride headless Core Service tarafından açılmasını gereksiz biçimde Electron sürecine bağlar.

31-I, `DeviceSecretProtector` sözleşmesini ve Windows DPAPI uygulamasını `@ppt/security` paketinin sahipliğine taşır. Desktop eski modül yolunu bir uyumluluk shim’i olarak korur; tek gerçek uygulama paylaşılan güvenlik paketinde kalır. Paylaşılan uygulama Electron API’sine, kullanıcı veri yolu bilgisine veya kasa anahtarının Core Service istemci protokolünden aktarılmasına bağımlı olamaz.

Core Service tarafında yalnız koruma sağlayıcısı enjekte edildiğinde hazır duruma gelen, gizli malzeme içermeyen bir prerequisite sınırı kurulur. Üretim kasasını açma ve SQLite oturumunu devralma bu dilimde yapılmaz.

## Açık sınırlar

- `UserDataVault` uygulamasının paylaşılan/headless katmana taşınması tamamlanmamıştır.
- Core Service’in kasa kilidi açması ve veri anahtarını bellekte sahiplenmesi tamamlanmamıştır.
- Bellek-içi SQLite oturumunun Core Service tarafından açılması ve tek-yazar devri tamamlanmamıştır.
- Aile okuma/yazma API’leri, backup/sync sahipliği ve Windows servis kurulumu açık kalır.

Bu foundation DHA-001, PPK-013 ve PPK-014 gereksinimlerini tek başına COMPLETE saymaz ve yeni Build vermez.
