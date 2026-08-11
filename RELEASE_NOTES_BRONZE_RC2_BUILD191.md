# Bronze RC2 Build 191 Sürüm Notları

## Yeni

- `DEC-081` ve `ADR-064`: tetikleyiciye duyarlı temiz-yedek geri çekilmesi.
- Manuel hedefsiz `attention` sonucu artık 60 dakikalık manuel gecikmeyi kullanır.
- Manuel kesinti kurtarması 60, otomatik kesinti kurtarması 360 dakika kullanır.
- Partial ve failed yollar ortak tetikleyiciye duyarlı gecikme yardımcısına bağlandı.

## Güvenlik ve bütünlük

- Politika ve çalışma defteri retry zamanı terminal zaman + doğru tetikleyici gecikmesi olmak zorundadır.
- Dört yeni SQLite tetikleyicisi doğrudan yanlış gecikme yazımını fail-closed reddeder.
- Deferred 30 dakika, success ise retry olmadan kalır.

## Doğrulama sınırı

Bronze kaynak kanıtları çalıştırılır. Temiz kurulum, tam test, production build, smoke ve gerçek Windows/installer kapıları Silver için NOT_RUN kalır.
