# DEC-234 — Onaya bağlı aile AI asistanı

## Durum

`33-W` yol haritasında `PLANNED`, yerel uygulama zincirinde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Bu karar registry, roadmap, work plan veya aktif governance ledger üzerinde kapanış mutasyonu yapmaz. `countsAsRequirementPass=false`; kalıcı governance receipt ve bütün manuel kanıtlar `NOT_RUN` kalır.

## Karar

Aile asistanı yalnız oturumdaki hesap, aile ve kişi sahibiyle bağlanmış merkezi Life PEP receipt'i altında çalışır. Kaynak seçimi içerik yerine kaynak türü ve kimliği taşıyan, politika süzgecinden geçmiş yerel okuma modellerinden yapılır. Her kaynak için amaç bazlı standart AI onayı yeniden doğrulanır; finans ve sağlık kaynaklarında ayrıca süreli `sensitive_processing` onayı gerekir. İzin geri çekilmiş öneriler merkez görünümünden çıkarılır.

Açık bir kaynak iptali, aynı kaynak türündeki `*` izninden önceliklidir. Öneri türleri yalnız kanonik modül kümelerinin alt kümelerini kullanabilir ve her modül tam kaynak türüyle eşlenir. `authorized_search` boş sorguyla çalışmaz; diğer öneri türleri serbest metin istemi kabul etmez. İzni geri çekilmiş veya süresi dolmuş bekleyen öneriler, kaynak kimliği ve içeriği gösterilmeden yalnız reddetme için içeriksiz tutamaç olarak sunulur.

Öneriler belirlenimlidir ve yalnız insan incelemesine sunulur. `confirm` kararı önerinin incelendiğini kaydeder; ödeme, rezervasyon, sağlık kararı, acil durum eylemi veya başka kalıcı alt sistem işlemi yürütmez. `dismiss`, kaynak izni daha sonra geri çekilmiş olsa bile kullanıcıya öneriyi kapatma olanağı verir. Mutation receipt daima `durableActionPerformed=not_performed` taşır.

Kalıcı öneri satırı genel başlık, genel açıklama, güven temeli ve içeriksiz kaynak bağlarını tutar. Ham OCR metni, finans/sağlık ayrıntısı, kaynak başlığı, sorgu metni, dosya yolu veya renderer yetkisi tutulmaz. Audit ve outbox içeriksizdir; idempotent istemci operasyonu, optimistic revision, immutable mutation ledger ve receipt/fence eşliği zorunludur.

Güven puanı bir doğruluk veya uzman kararı değil, yalnız yerel kaynak kapsam göstergesidir. Sahip başına yazma ve okuma kapasitesi 500 öneride fail-closed sınırlıdır; bu sınır merkez okumalarını taşma ile kilitlemez. Terminal kayıtların saklama ve güvenli kapasite geri kazanım politikası henüz kararlaştırılmadığından bu risk açık kalır.

## Dürüstlük sınırı

Yerel yetkili arama ve kural tabanlı öneri üretimi uygulanmıştır. Herhangi bir AI sağlayıcısı yapılandırılmamış; ağ, bulut, model çıkarımı, konuşma sentezi ve çeviri çalıştırılmamıştır. OCR sınıflandırması otomatik kabul edilmez. Gerçek aile UAT'ı, gerçek sağlayıcı/model UAT'ı, konuşma/çeviri UAT'ı, OCR sınıflandırma UAT'ı, finans/sağlık güvenlik incelemesi ve privacy/legal inceleme `NOT_RUN` durumundadır. Bu nedenle B6-01 ve EXT-043–EXT-050 tamamlanmış sayılmaz.

Öneri üretiminde kaynak PEP okumaları tazedir; ancak kalıcı, içeriksiz bir önerinin sonraki merkez okumasında kaynak nesnesinin ayrıca yeniden PEP doğrulaması henüz yapılmaz. İzin ve hassas veri onayı her okumada yeniden doğrulanır; nesne izni değişikliği için bu artık risk kabul kapanışına kadar açık tutulur.

## Yerel kanıt

Migration 101 `consent_bound_family_ai_assistant` SHA-256 değeri `ef3790fad5f64de7bbd089d09a835dcb302092d64ccef6abb85e2105fbab2b5b` ile doğrulanır. Beş hedef dosyada 26 test; PPK-021 için 555 dosya / 873 exact yüzey ve `843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc`; PPK-022 için 555 dosya / 392 exact yüzey ve `cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c` ratchetleri yerel teknik kanıttır. Bu kanıtlar kabul, sertifikasyon veya harici servis kullanılabilirliği iddiası değildir.
