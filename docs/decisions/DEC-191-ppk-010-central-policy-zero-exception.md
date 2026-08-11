# DEC-191 — PPK-010 merkezi politika ve sıfır doğrudan-rol istisnası

## Durum

32-F kapsamında kabul edildi ve tamamlandı. PPK-010 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Üretim kodunda bir rol adı doğrudan karşılaştırılarak erişim izni veya reddi üretilemez. Yetkilendirme kararları `CentralAuthorizationService` ya da imzalı Core Service politika kararını zorunlu tutan evrensel Desktop PEP üzerinden alınır. `DIRECT_ROLE_AUTHORIZATION_EXCEPTIONS` kayıt defteri boş ve değişmezdir; yeni bir istisna eklemek PPK-010 sözleşmesini bozar.

Rol değerinin tanınması ve iki kimlik kaydındaki rol alanının tutarlı olduğunun sınanması, erişim kararı değildir. Bu işlemler merkezi rol sözlüğünü kullanan `isAuthorizationRole` ve `authorizationRoleMatches` yardımcılarına taşınmıştır. Yardımcıların sonucu tek başına korumalı bir işlemi açamaz.

Veri onarımı, kişi yaşam döngüsü ve hane üyeliği yönetim adaptörleri yönetim iznini merkezi servisten ister. Dashboard ve timeline adaptörleri rol sözlüğünü merkezi kaynaktan okur. Sağlık ve yaşam repository koleksiyon görünürlüğü de aile rolü için merkezi `read` kararı üretir; nesne sahibi, açık izin, açık ret, mahremiyet ve aktif yaşam döngüsü SQL sınırları korunur.

Üretim TypeScript kaynakları statik sıfır-istisna taramasına alınmıştır. Platform güvenlik modülündeki merkezi politika tanımı ile Core Service küme rolü ayrımı dışında doğrudan rol eşitliği, rol listesiyle allow/deny veya yerel rol kümesi bulunması testi düşürür. Repository paket bildirimi yeni merkezi güvenlik bağımlılığını açıkça taşır.

PPK-009 ile eklenen göç 74 yeniden kullanılır: kararın Core Service otoritesinden geldiği request, decision, receipt, işlem bağlamı ve kalıcı kayıt boyunca doğrulanır. PPK-010 yeni tablo gerektirmez; mevcut şema/göç kanıtı merkezi politika otoritesinin kalıcı bağını sağlar.

## Gerçeklik sınırı

Bu karar gerçek aile verisini taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Merkezi rol sözlüğü ile Core karar otoritesi farklı katmanlardır; ikisi de korumalı işlemi fail-closed tutar.

## Kapanış kanıtı

- Hedefli PPK-010 testi: 10/10 PASS.
- Kapanış sözleşmesi: 32/32 PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Veritabanı göç zinciri: 74/74 PASS.
- Tam Vitest: 59 dosya, 380 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-010 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
