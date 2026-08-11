# Bronze RC2 Build 190 Sürüm Notları

## Yeni

- `DEC-080` ve `ADR-063`: monotonik temiz-yedek terminal kronolojisi.
- `deferred`, `attention` ve `failed` zamanları duvar saati yerine monotonik geçen süreye bağlandı.
- Retry ve erteleme zamanları doğrulanmış terminal tamamlanma zamanından hesaplanıyor.
- Ana Electron süreç `performance.now()` saatini açıkça enjekte ediyor.

## Güvenlik ve bütünlük

- İleri/geri sistem saati sıçraması terminal zamanını veya geri çekilmeyi bozamaz.
- Geçersiz/geriye giden monotonik saat sonuçlandırmayı fail-closed reddeder.
- Başarı ve kısmi sonuçlarda bağlı propagation tamamlanma zamanı yetkili kalır.

## Doğrulama sınırı

Bronze kaynak kanıtları çalıştırılır. Temiz kurulum, tam test, production build, smoke ve gerçek Windows/installer kapıları Silver için NOT_RUN kalır.
