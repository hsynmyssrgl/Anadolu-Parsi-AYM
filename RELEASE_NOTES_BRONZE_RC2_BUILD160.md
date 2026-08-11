# Bronze RC2 Build 160 Sürüm Notları

- Application Version: `29.07.2026.160`
- Package Version: `29.7.2026-160`
- Stage: **Bronze RC2 Active Development**

## Değişiklikler

- IPC istekleri için merkezi `IpcRequestLifecycleRegistry` eklendi.
- Katalog, dashboard, sınırlı snapshot ve büyük veri okumaları `latest-wins`
  iptal politikasına alındı.
- Preload 30 saniyelik bounded okuma süresi ve 45 saniyelik güvenli ağ
  senkronizasyonu süresi uygular.
- Süre aşımı veya daha yeni aynı-kanal isteği ana süreçteki eski isteği iptal eder.
- Oturum değişimi ve renderer kapanışı güncel çağdaki aktif okuma işlerini temizler.
- Mutasyon kanalları varsayılan olarak otomatik iptal edilmez.
- Güvenli iptal listesi senkronizasyonu AbortSignal'i HTTPS isteğine kadar taşır.
- İptal ve süre aşımı ayrı audit olaylarıyla kaydedilir.

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
