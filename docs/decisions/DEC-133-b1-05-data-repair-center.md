# DEC-133 — B1-05 Güvenli Veri Onarma Merkezi

## Durum

Kabul edildi ve 30-I kapsamında uygulanıyor.

## Karar

Yinelenen kişi profilleri, kopuk kişi bağları ve aile/hane kapsamı uyuşmazlıkları yönetici tarafından önce taranır ve değişiklik yapılmadan önizlenir. Her önizleme, sorunun o andaki veri sürümünü temsil eden deterministik bir `revisionToken`, önerilen çözüm, değişiklik öncesi snapshot ve beklenen değişiklik sonrası snapshot üretir.

Uygulama yalnız önizlemenin sürüm belirteci güncel kaldığında aynı transaction içinde yapılır. Veri önizlemeden sonra değişmişse işlem fail-closed durur ve yeniden tarama ister. Uygulanan her onarma audit kaydı ve outbox olayı üretir.

## Onarma politikası

- Yinelenen kişi, kaynak profili etkin hedef profile mantıksal olarak birleştirir; fiziksel kişi kaydı silinmez.
- Eksik uçlu bağ kontrollü biçimde kaldırılır. Geri alma, iki kişi ucu yeniden mevcut değilse fail-closed durur.
- Aynı ailedeki iki kişiye ait fakat yanlış aile kimliği taşıyan bağ ortak aile kimliğine hizalanır.
- Farklı ailelerdeki kişileri bağlayan ilişki kaldırılır ve snapshot ile geri alınabilir tutulur.
- Hane veya aile dalı kapsamı bozuk etkin üyelik silinmez; tarihsel kimliği korunarak sona erdirilir.
- Geri alma yalnız uygulama sonrası kayıt beklenen snapshot ile hâlâ uyuşuyorsa çalışır.
- Her sorun için aynı anda yalnız bir bekleyen veya uygulanmış onarma kaydı olabilir.

## Yetkilendirme ve kanıt

Tarama, önizleme, uygulama, geçmiş ve geri alma işlemleri merkezi yetkilendirmeden geçen etkin `family_admin` hesabıyla sınırlıdır. Önizleme, uygulama ve geri alma ayrı audit/outbox kanıtları üretir. Başarısız veya stale denemeler transaction içinde veri değiştiremez.

## Teslim sınırı

30-I domain, şema, migration, repository, application use-case, merkezi yetkilendirme adaptörü, audit/outbox ve hedefli runtime doğrulama temelini kapsar. Masaüstü IPC, yönetici ekranı ve menü bağlantısı sonraki governed teslimde tamamlanacaktır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
