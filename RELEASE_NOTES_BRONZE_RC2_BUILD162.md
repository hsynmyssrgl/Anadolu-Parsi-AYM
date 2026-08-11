# Bronze RC2 Build 162 Sürüm Notları

- Application Version: `29.07.2026.162`
- Package Version: `29.7.2026-162`
- Stage: **Bronze RC2 Active Development**

## Değişiklikler

- Aynı kapsamlı eşzamanlı salt IPC okumaları preload'da tek yürütmede birleştirildi.
- Ana sürece sender-isolated, kısa TTL'li ve boyutu sınırlı sonuç cache'i eklendi.
- Paylaşım anahtarı oturum, epoch, kanal, revizyon ve kanonik argümanlara bağlandı.
- Her çağırana ayrı `structuredClone` sonucu döndürülüyor.
- Mutasyonlar cache'i temizliyor ve aktif paylaşılabilir okumaları iptal ediyor.
- Cache nesli eski okumanın mutasyon sonrası cache'i yeniden doldurmasını engelliyor.
- Ağ senkronizasyonu, mutasyonlar, hatalar ve sınırı aşan sonuçlar cache dışı bırakıldı.

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
