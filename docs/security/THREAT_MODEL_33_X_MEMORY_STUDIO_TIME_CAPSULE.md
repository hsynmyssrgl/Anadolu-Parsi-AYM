# 33-X — Hafıza stüdyosu ve zaman kapsülü tehdit modeli

## Korunan varlıklar

- Aile, kişi ve kaynak sahipliği ile merkezi PEP receipt/fence bağları.
- Korunan arşiv medyası ve yerel OCR/kişi kaynak referansları.
- Zaman kapsülü onayları, açılma tarihi ve durum geçişleri.
- Mutation ledger, optimistic revision ve idempotency kimliği.
- Renderer'a taşınan içerik-minimize merkez ve receipt görünümleri.

## Tehditler ve kontroller

1. **Yabancı kaynak bağlama:** Arşiv, hafıza kaydı, OCR işi ve kişi referansları exact aile/sahip kapsamında doğrulanır; eksik veya yabancı kaynak fail-closed reddedilir.
2. **Otomatik yüz tanıma yanılsaması:** `face_group` yalnız açık manuel onayla ve seçilmiş arşiv/kişi referanslarıyla kurulabilir. Yüz tanıma çalıştırılmaz.
3. **Üretilmemiş medya iddiası:** Transkripsiyon, duplicate detection, belgesel/kitap render ve yazdırma truth alanları daima false kalır; kayıt türü tek başına çıktı üretildiğini göstermez.
4. **Erken veya tek hesaplı açılış:** Mühürleme iki ayrı hesap onayı, açılış en az yedi günlük bekleme ve geri alma en çok yirmi dört saat sınırı altında çalışır.
5. **Onay replay ve yarış:** `clientOperationId`, request fingerprint, optimistic revision, immutable mutation ledger ve aynı receipt/fence current-row eşliği zorunludur.
6. **Ham medya sızıntısı:** Veritabanı, audit, outbox ve IPC yalnız metadata/reference taşır; medya byte'ları, dosya yolu, receipt hash ve state fingerprint renderer'a çıkmaz.
7. **Onay kimliği sızıntısı:** İç ledger hesap ve kişi bağını korur; renderer yalnız `approvalCount` ile mevcut hesabın kendi onay boolean'ını alır. Başka onaylayanların kimliği IPC safe-result kapısında reddedilir.
8. **Saat geri sarma ve stale kaynak:** Current row zamanı geriye gidemez; rollback release zamanından önce veya 24 saatten sonra reddedilir. Seal/release güncel aynı-sahip kaynaklarını tekrar doğrular.
9. **Kalıcı kapasite DoS'u:** Sahip başına 500 kayıt ve 200 kapsül üst sınırı repository ile DB triggerında atomik uygulanır; taşan mutation da transaction rollback'iyle kalmaz. Terminal retention/kapasite geri kazanımı tasarlanmadığı için bu sınır açık ürün riski olarak kalır.
10. **Renderer yetki yükseltmesi:** Renderer hesap, aile, sahip veya politika receipt'i seçemez; altı exact kanal, recursive input sınırları, canonical komut şeması ve safe-result doğrulaması uygulanır. Hatalı create sonrasında aynı operation kimliği ve form girdisi korunur.
11. **Dış teslimat yanılsaması:** Ağ ve bulut kullanılmaz. Capsule release yalnız yerel metadata durumudur; alıcıya gönderim, paylaşım veya teslimat yapılmaz.

## Açık kanıtlar

Gerçek aile hafıza, medya transkripsiyonu, yüz gruplama, duplicate detection, belgesel/kitap/yazdırma, çok hesaplı ortak onay keşfi, terminal retention/kapasite geri kazanımı, zaman kapsülü release/recovery ve privacy/legal UAT'ları `NOT_RUN` durumundadır. Geçmiş kaynak yetkisini her read'de yeniden değerlendirme yoktur. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `33-X` yalnız yerel kısmi uygulama kanıtıdır ve `countsAsRequirementPass=false` kalır.
