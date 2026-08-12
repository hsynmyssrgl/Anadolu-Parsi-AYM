# 33-E B5 kategori yaşam, ev ve araç tehdit modeli

## Korunan varlıklar

- aile, sahip ve gizlilik kapsamı;
- ev/araç profil ayrıntıları ve faaliyet geçmişi;
- kira, prim, bakım, yakıt ve şarj minor-unit değerleri;
- arşiv ve finans kayıtlarına opaque bağlantılar;
- yenileme ve son tarih hatırlatmaları;
- exact policy receipt ve audit/outbox bütünlüğü.

## Başlıca tehditler ve kontroller

1. **Cross-family veya cross-owner confused deputy.** Alt satır, arşiv ve finance
   bağlantıları SQLite trigger'larında exact family/owner/privacy eşliğiyle ve
   application policy çözümünde kök profil üzerinden doğrulanır.
2. **Makbuz replay/forgery.** Kök `create`, alt satır `update` action/resource
   bağını kullanır. Hash/version/nonce/correlation, sensitivity ve purpose exact
   doğrulanır; legacy ve managed tablolar arası tekrar kullanımı reddedilir.
3. **Gizli belge veya credential sızıntısı.** Komut sözleşmesi recursive unknown ve
   secret/PAN/path/base64 reddi uygular. Renderer yalnız opaque `archiveItemId`
   görür; içerik, yol, ad, hash ve receipt dönmez.
4. **Finansal sessiz bozulma.** Tutar, miktar ve kilometre safe integer sınırında;
   currency ISO-3 uppercase; tarih canonical UTC ve sıralı doğrulanır.
5. **Kategori karıştırma.** Rent yalnız home; inspection/maintenance/fuel/charging
   yalnız vehicle; document/activity/detail enum matrisi hem application hem DB
   katmanında fail-closed uygulanır.
6. **Geçmişin değiştirilmesi.** Ledger update/delete reddeder. Yenileme, bakım ve
   hatırlatma değişimi yeni append-only activity satırıdır.
7. **Dış hizmet varmış gibi sunma.** Workspace truth alanları `manual` ve
   `not_performed` değerlerini taşır; ağ, doğrulama, sağlayıcı iletişimi ve ödeme
   kanalı eklenmez.
8. **Outbox/audit üzerinden veri sızıntısı.** Olay payload'ı yalnız item/root/type,
   kategori ve gizlilik metadata'sıdır; başlık, adres, plaka, sağlayıcı, tutar,
   arşiv veya finance kimliği taşımaz.

## Kalan riskler

- Manuel girilen bilgi dış kaynağa göre doğru kabul edilmez.
- Kullanıcının yazdığı serbest not yanlış veya aşırı hassas olabilir; uzunluk ve
  secret/PAN taraması riski azaltır fakat anlam doğruluğu sağlamaz.
- Arşiv belgesinin içeriği bu workspace'te açılmaz; erişim ayrıca archive policy
  akışına tabidir.
- Harici sicil, ödeme, teklif ve servis entegrasyonları bu paketin dışındadır.
