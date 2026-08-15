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
7. **Renderer yetki yükseltmesi:** Renderer hesap, aile, sahip veya politika receipt'i seçemez; altı exact kanal, recursive input sınırları ve safe-result doğrulaması uygulanır.
8. **Dış teslimat yanılsaması:** Ağ ve bulut kullanılmaz. Capsule release yalnız yerel metadata durumudur; alıcıya gönderim, paylaşım veya teslimat yapılmaz.

## Açık kanıtlar

Gerçek aile hafıza, medya transkripsiyonu, yüz gruplama, duplicate detection, belgesel/kitap/yazdırma, zaman kapsülü release/recovery ve privacy/legal UAT'ları `NOT_RUN` durumundadır. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `33-X` yalnız yerel kısmi uygulama kanıtıdır ve `countsAsRequirementPass=false` kalır.
