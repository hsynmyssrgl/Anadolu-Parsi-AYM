# Bronze RC2 Build 205 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `01.08.2026.205`
- Package Version: `1.8.2026-205`
- Stage: **Bronze RC2 Active Development**
- Build: **205**

## Eklenenler

- 20 Temmuz 2026 tarihli Build 1’den Build 205’e kadar bütün geliştirmeler tek yetkili ana build defterinde birleştirildi.
- Yapılmış her build `COMPLETED`, devam eden build `IN_PROGRESS` ve kalan işler `OPEN/IN_PROGRESS/COMPLETED/CANCELLED` durumlarıyla izlenir.
- Bütün kalan işler tek, sıralı ve makine tarafından okunabilir listeye taşındı.
- Yeni sohbet ve geliştirme oturumlarının başlangıç kaynağı `docs/17_MASTER_BUILD_LEDGER.md` olarak belirlendi.
- Her build başında ana defteri açan, build sonunda yapılan işi ve durum bildirimini kaydeden güncelleme komutları eklendi.
- Ana build defteri güncel değilse, güncel build tamamlanmamışsa veya build sonrası durum bildirimi kaydedilmemişse teslimi engelleyen doğrulama kapısı eklendi.
- Sürüm yükseltme komutu ana build defterini otomatik olarak yeni build için `IN_PROGRESS` durumuna getirir.
- Geçmiş buildlerin değiştirilmesini engelleyen süreklilik politikası eklendi.

## Bağlayıcı kayıtlar

- `DEC-095`
- `ADR-078`
- `PPT-BUILD-LEDGER-CONTINUITY-V1`
- `config/master-build-ledger.json`
- `docs/17_MASTER_BUILD_LEDGER.md`
