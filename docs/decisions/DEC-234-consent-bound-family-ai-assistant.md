# DEC-234 — Onaya bağlı aile AI asistanı

## Durum

`33-W` yol haritasında `PLANNED`, yerel uygulama zincirinde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Bu karar registry, roadmap, work plan veya aktif governance ledger üzerinde kapanış mutasyonu yapmaz. `countsAsRequirementPass=false`; kalıcı governance receipt ve bütün manuel kanıtlar `NOT_RUN` kalır.

## Karar

Aile asistanı yalnız oturumdaki hesap, aile ve kişi sahibiyle bağlanmış merkezi Life PEP receipt'i altında çalışır. Kaynak seçimi içerik yerine kaynak türü ve kimliği taşıyan, politika süzgecinden geçmiş yerel okuma modellerinden yapılır. Her kaynak için amaç bazlı standart AI onayı yeniden doğrulanır; finans ve sağlık kaynaklarında ayrıca süreli `sensitive_processing` onayı gerekir. İzin geri çekilmiş öneriler merkez görünümünden çıkarılır.

Öneriler belirlenimlidir ve yalnız insan incelemesine sunulur. `confirm` kararı önerinin incelendiğini kaydeder; ödeme, rezervasyon, sağlık kararı, acil durum eylemi veya başka kalıcı alt sistem işlemi yürütmez. `dismiss`, kaynak izni daha sonra geri çekilmiş olsa bile kullanıcıya öneriyi kapatma olanağı verir. Mutation receipt daima `durableActionPerformed=not_performed` taşır.

Kalıcı öneri satırı genel başlık, genel açıklama, güven temeli ve içeriksiz kaynak bağlarını tutar. Ham OCR metni, finans/sağlık ayrıntısı, kaynak başlığı, sorgu metni, dosya yolu veya renderer yetkisi tutulmaz. Audit ve outbox içeriksizdir; idempotent istemci operasyonu, optimistic revision, immutable mutation ledger ve receipt/fence eşliği zorunludur.

## Dürüstlük sınırı

Yerel yetkili arama ve kural tabanlı öneri üretimi uygulanmıştır. Herhangi bir AI sağlayıcısı yapılandırılmamış; ağ, bulut, model çıkarımı, konuşma sentezi ve çeviri çalıştırılmamıştır. OCR sınıflandırması otomatik kabul edilmez. Gerçek aile UAT'ı, gerçek sağlayıcı/model UAT'ı, konuşma/çeviri UAT'ı, OCR sınıflandırma UAT'ı, finans/sağlık güvenlik incelemesi ve privacy/legal inceleme `NOT_RUN` durumundadır. Bu nedenle B6-01 ve EXT-043–EXT-050 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 101 `consent_bound_family_ai_assistant` SHA-256 değeri `3758e4c795b59e09b7701dbf6dd3b89c6717506be8e4ee9cc13b8ba20cdf3715` ile doğrulanır. Beş hedef dosyada 20 test; PPK-021 için 474 dosya / 730 exact yüzey ve `70db1305706956168b12fff86ad42cd9140227b0bfa0b5bc5e90c976c54ef971`; PPK-022 için 474 dosya / 345 exact yüzey ve `1b8625264023eb79d3f36a3c25ca19480569bea6aa1f4589841b1b4d14d5ec3e` ratchetleri yerel teknik kanıttır. Bu kanıtlar kabul, sertifikasyon veya harici servis kullanılabilirliği iddiası değildir.
