# Bronze RC2 Build 183 Sürüm Notları

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `30.07.2026.183`
- Package Version: `30.7.2026-183`
- Stage: **Bronze RC2 Active Development**
- Build: **183**
- Policy: `PPT-LIFECYCLE-STRICT-V1`

## Eklenenler

- Saklama süresi dolan imha tombstone kayıtları için otomatik temiz tam yedek yeniden yazımı.
- Veritabanında kalıcı politika, çalışma sahipliği, sonuç, hata ve sonraki deneme durumu.
- Migrasyon 29: `REVISION-183-AUTOMATIC-CLEAN-BACKUP-REWRITE`.
- Yeni ve doğrulanmış yedek başarılı olmadan eski yönetilen kopyaya dokunmayan güvenli akış.
- Eski yönetilen yedeğin manifestli ve geri alınabilir karantinaya alınması.
- Uygulama kesintisi ve yeniden başlatma sonrası 6 saatlik güvenli geri çekilme.
- Manuel başarısızlık sonrası 1 saat, otomatik başarısızlık sonrası 6 saat geri çekilme.
- Yüksek CPU/bellek kullanımında 30 dakikalık güvenli erteleme.
- Etkin hedef yokluğunda görünür `attention` durumu ve tanı kaydı.
- Güvenlik Merkezi'nde etkinlik, saklama süresi, durum, hedef, sonraki deneme ve son hata görünümü.
- Güçlü yeniden doğrulamalı politika güncellemesi ve açık manuel çalıştırma.

## Kaynak doğrulaması

- Build 183 sözleşme/davranış/syntax hedefi: **36/36 + 15/15 + 3/3 PASS**
- Kaynak preflight hedefi: **165/165 PASS — 21 küçük segment**
- Kaynak bütünlüğü hedefi: **1.594/1.594 PASS — 1.595 SHA-256 girdisi**
