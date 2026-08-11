# Bronze RC2 Build 192 Sürüm Notları

## Yeni

- `DEC-082` ve `ADR-065`: otomatik politikadan bağımsız manuel temiz-yedek kullanılabilirliği.
- “Otomatik politika etkin” kapalıyken aile yöneticisi “Şimdi çalıştır” komutunu kullanabilir.
- Otomatik çevrim kapalı politikada sahiplenme veya çalışma defteri oluşturamaz.

## Güvenlik ve bütünlük

- Manuel çalışma mevcut geri çekilme süresini, tek `running` sahipliğini ve saklama kesimini atlayamaz.
- Politika manuel çalışma sonunda da `enabled=false` değerini korur.
- Migrasyon 36, devre dışı politika altında otomatik `running` durumunu doğrudan SQLite yazımında reddeder.

## Doğrulama sınırı

Bronze kaynak kanıtları çalıştırılır. Temiz kurulum, tam test, production build, smoke ve gerçek Windows/installer kapıları Silver için NOT_RUN kalır.
