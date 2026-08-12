# DEC-210 — B2-05/B6-03 hassas veri rızası ve dışa gönderim önizlemesi

- Tarih: 12.08.2026
- Durum: ACTIVE
- Gereksinimler: B2-05, B6-03
- Uygulama paketi: 32-Y

## Karar

Çocuk, sağlık, finans ve konum verileri dört ayrı hassasiyet profili olarak
yönetilir. Her profil, `sensitive_processing` ve `external_export` amaçlarında
birbirinden bağımsızdır. Kayıt bulunmaması açıkça `default_denied` sonucudur.
Onay yalnız kategori, amaç, süre ve açık rıza kutusu birlikte verildiğinde
oluşur; 15 dakikadan kısa veya 30 günden uzun, süresiz ya da örtük onay
reddedilir. İptal yeni bir `revoked` kararı olarak anında saklanır ve audit
zincirine yazılır.

Hassas veri yönetimi doğrudan rol karşılaştırması yapmaz. Application use-case'i
`SensitiveDataAuthorizationPort` ister; production adapter kararı mevcut
`CentralAuthorizationService` üzerinden `administer` eylemiyle alır. PPK-021
exact AST ratchet üç yeni use-case composition yüzeyiyle 531 girdiye ilerletilir
ve doğrudan rol bypass sayısı sıfır kalır.

Üç IPC kanalı genel kabul yoluna bırakılmaz. Liste çağrısı sıfır argümanlıdır;
onay ve önizleme payload'ları exact alan listesi, kapalı kategori/amaç kümesi,
benzersiz kategori seçimi, süre ve açık rıza bakımından handler öncesinde
doğrulanır. Standart AI amaçları ile hassas amaçların tipleri ayrıdır; eski
`ai:upsertConsent` ve `ai:previewAccess` kanalları hassas amaç veya
`sensitive_data_profile` kaynağını kabul etmez. Geçmişten ya da tahrif edilmiş
süresiz hassas grant kayıtları da etkin sayılmaz. Bilinmeyen alan ve örtük grant
fail-closed reddedilir.

## Dışa gönderim sınırı

Önizleme, kullanıcının seçtiği hedef açıklamasını, iş amacını ve kategorileri
zorunlu tutar. Her kategori için ayrı `external_export` onayının etkinliğini,
kayıt sayısını ve alan etiketlerini gösterir. Sağlık notu, finans tutarı, çocuk
kimliği, adres veya koordinat değeri önizlemeye girmez. Sonuç
`outboundTransferPerformed=false` taşır; 32-Y yeni ağ, upload, send, transfer,
dosya üretimi veya dışa aktarım handler'ı eklemez. Gerçek bir aktarım ileride
eklenirse bu önizleme tek başına yetki sayılmaz; açık kullanıcı eylemi ve işlem
anında yeniden politika kontrolü zorunludur.

## Veri ve migration sınırı

Mevcut `ai_consents` tablosunun hesap + amaç + kaynak türü + kaynak kimliği
benzersizliği, durum, başlangıç ve bitiş alanları kullanılır. Kaynak türü
`sensitive_data_profile`, kaynak kimliği dört kategoriden biridir. Yeni tablo,
payload kopyası, migration, backfill, veri taşıma, cutover veya sahiplik değişimi
yoktur; latest migration 77 kalır.

## Kapanış sınırı

B2-05 ve B6-03 birlikte tamamlanır. B2-02 fiziksel WebAuthn/FIDO2 kabulü,
PPK-025 production code-signing sertifikası, B9-01, Silver readiness ve Bronze
Final bu kararla tamamlanmaz.
