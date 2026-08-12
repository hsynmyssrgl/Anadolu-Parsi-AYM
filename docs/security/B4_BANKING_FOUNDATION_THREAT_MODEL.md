# B4 Bankacılık Temeli Tehdit Modeli

## Korunan varlıklar

- Korumalı SQLite içindeki normalize IBAN
- Aile ve hesap sahibi bağlamı
- TCMB kurum kataloğunun kaynak ve kod bütünlüğü
- Finans policy receipt, audit ve outbox sınırları
- Kart ve internet bankacılığı sırlarının uygulamaya hiç kabul edilmemesi

## Tehditler ve kontroller

1. **Sahte kurum veya uzak logo içeriği:** katalog migration 78 içinde resmi kaynak
   metadata'sı ve 71 exact kodla tutulur; ağdan logo alınmaz, yerel harf simgesi kullanılır.
2. **Biçimsel olarak yanlış IBAN:** ülke, exact uzunluk, karakter kümesi, MOD 97-10,
   sağlayıcı kodu, rezerv alanı ve katalog eşleşmesi birlikte zorunludur.
3. **Yapısal doğrulamayı sahiplik kanıtı gibi sunma:** model ve UI gerçek hesap ile
   sahiplik doğrulamasını daima `not_performed` olarak ayrı gösterir.
4. **Tam IBAN sızıntısı:** renderer view yalnız maske/son dört hane taşır; audit ve
   outbox payload'ları IBAN içermez. Tam değer yalnız korumalı veritabanındadır.
5. **Yetkisiz veya receipt'siz yazma:** merkezi finance PEP, transaction bağlamı,
   exact receipt trigger'ı, replay çapraz kontrolleri ve immutable update/delete
   guard'ları yazmayı fail-closed sınırlar.
6. **Kart sırlarını unknown alanla sokma:** IPC exact key listesi canonical PAN,
   CVV/CVC, PIN ve parola alanlarını handler öncesinde reddeder; application aynı
   kontrolü doğrudan çağrı kaçışına karşı tekrarlar.
7. **Tam PAN'ı serbest metinde saklama:** alias, şube, finans başlığı/notu/simgesi
   ve değerleme sağlayıcısında 13–19 haneli Luhn-geçerli adaylar reddedilir.
8. **Eski finans kanalından bypass:** `finance:create` ve
   `finance:createValuation` exact IPC ve application sır denetimine dahildir.
9. **Aileler arası okuma:** finance PEP aile bağlamını doğrular; merkezi nesne
   yetkilendirmesi hesap sahibini ve gizliliği değerlendirmeden view döndürmez.
10. **Sahte kapanış:** boundary, contract ve runtime kanıtlarının üçü PASS olmadan
    accepted-scope zinciri tamamlanmış sayılmaz.

## Bilinçli sınırlar

Paket banka ağına bağlanmaz; gerçek hesap veya sahiplik doğrulaması yapmaz. Kredi
kartı ürün/limit/ekstre modeli ve kart otomasyonları B4-05/B4-06 kapsamında açık
kalır. Test IBAN'ları gerçek hesap kanıtı değildir.
