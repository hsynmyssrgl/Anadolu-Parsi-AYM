# DEC-234 — Onaya bağlı aile AI asistanı

## Durum

`33-W` yol haritasında `PLANNED`, yerel uygulama zincirinde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Bu karar registry, roadmap, work plan veya aktif governance ledger üzerinde kapanış mutasyonu yapmaz. `countsAsRequirementPass=false`; kalıcı governance receipt ve bütün manuel kanıtlar `NOT_RUN` kalır.

## Karar

Aile asistanı yalnız oturumdaki hesap, aile ve kişi sahibiyle bağlanmış merkezi Life PEP receipt'i altında çalışır. Kaynak seçimi içerik yerine kaynak türü ve kimliği taşıyan, politika süzgecinden geçmiş yerel okuma modellerinden yapılır. Her kaynak için amaç bazlı standart AI onayı yeniden doğrulanır; finans ve sağlık kaynaklarında ayrıca süreli `sensitive_processing` onayı gerekir. İzin geri çekilmiş öneriler merkez görünümünden çıkarılır.

Açık bir kaynak iptali, aynı kaynak türündeki `*` izninden önceliklidir. Öneri türleri yalnız kanonik modül kümelerinin alt kümelerini kullanabilir ve her modül tam kaynak türüyle eşlenir. `authorized_search` boş sorguyla çalışmaz; diğer öneri türleri serbest metin istemi kabul etmez. İzni geri çekilmiş veya süresi dolmuş bekleyen öneriler, kaynak kimliği ve içeriği gösterilmeden yalnız reddetme için içeriksiz tutamaç olarak sunulur.

Öneriler belirlenimlidir ve yalnız insan incelemesine sunulur. `confirm` kararı önerinin incelendiğini kaydeder; ödeme, rezervasyon, sağlık kararı, acil durum eylemi veya başka kalıcı alt sistem işlemi yürütmez. `dismiss`, kaynak izni daha sonra geri çekilmiş olsa bile kullanıcıya öneriyi kapatma olanağı verir. Mutation receipt daima `durableActionPerformed=not_performed` taşır.

Kalıcı öneri satırı genel başlık, genel açıklama, güven temeli ve içeriksiz kaynak bağlarını tutar. Ham OCR metni, finans/sağlık ayrıntısı, kaynak başlığı, sorgu metni, dosya yolu veya renderer yetkisi tutulmaz. Audit ve outbox içeriksizdir; idempotent istemci operasyonu, optimistic revision, immutable mutation ledger ve receipt/fence eşliği zorunludur.

Gerçek model yanıtı için ayrı ve kalıcılıksız bir yerel yol uygulanır. Sağlayıcı yalnız opt-in etkinleştirmeyle, exact `http://127.0.0.1:11434` Ollama döngüsel uç noktasında çalışabilir; uzak host, yönlendirme, proxy, bulut anahtarı veya renderer tarafından seçilen uç nokta kabul edilmez. Durum sorgusu `/api/tags`, çıkarım `/api/chat` ile; bounded istek/yanıt, timeout, `stream=false`, JSON içerik türü ve yapılandırılmış `answer` alanı altında doğrulanır. Model yanıtı veritabanına, audit'e veya outbox'a yazılmaz ve downstream işlem yürütmez.

Model çağrısından önce yalnız PEP ve amaç bazlı AI onayından geçen kaynaklar içerik-minimize bir isteme dönüştürülür. Çıkarımdan sonra aynı kaynak kümesi ve içerik özeti yeniden yüklenip fingerprint eşliği doğrulanır; izin veya kaynak değişmişse üretilen geçici yanıt renderer'a verilmeden atılır. Finans ve sağlık için süreli hassas veri onayı zorunluluğu aynen korunur. Renderer sağlayıcı tokenı, URL, aile/hesap/sahip yetkisi, receipt, dosya yolu veya ham kaynak seçemez.

Güven puanı bir doğruluk veya uzman kararı değil, yalnız yerel kaynak kapsam göstergesidir. Sahip başına yazma ve okuma kapasitesi 500 öneride fail-closed sınırlıdır; bu sınır merkez okumalarını taşma ile kilitlemez. Terminal kayıtların saklama ve güvenli kapasite geri kazanım politikası henüz kararlaştırılmadığından bu risk açık kalır.

## Dürüstlük sınırı

Yerel yetkili arama, kural tabanlı öneri ve exact loopback Ollama adaptörü uygulanmıştır. Uygulama varsayılan olarak yalnız `127.0.0.1:11434` üzerindeki Ollama hizmetini otomatik keşfeder; `PPT_LOCAL_AI_ENABLED=0` yerel keşfi tamamen kapatan yönetici anahtarıdır. Bu bilgisayarda Ollama/model kurulu olmadığından canlı model çıkarımı çalıştırılmamış, bulut veya dış ağ kullanılmamıştır. Konuşma sentezi ve çeviri sağlayıcısı da çalıştırılmamıştır. OCR sınıflandırması otomatik kabul edilmez. Gerçek aile UAT'ı, gerçek yerel sağlayıcı/model UAT'ı, konuşma/çeviri UAT'ı, OCR sınıflandırma UAT'ı, finans/sağlık güvenlik incelemesi ve privacy/legal inceleme `NOT_RUN` durumundadır. Bu nedenle B6-01 ve EXT-043–EXT-050 tamamlanmış sayılmaz.

Öneri üretiminde kaynak PEP okumaları tazedir; ancak kalıcı, içeriksiz bir önerinin sonraki merkez okumasında kaynak nesnesinin ayrıca yeniden PEP doğrulaması henüz yapılmaz. İzin ve hassas veri onayı her okumada yeniden doğrulanır; nesne izni değişikliği için bu artık risk kabul kapanışına kadar açık tutulur.

## Yerel kanıt

Migration 101 `consent_bound_family_ai_assistant` SHA-256 değeri `ef3790fad5f64de7bbd089d09a835dcb302092d64ccef6abb85e2105fbab2b5b` ile doğrulanır. Altı hedef dosyada 34 test; PPK-021 için 568 dosya / 889 exact yüzey ve `3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd`; PPK-022 için 568 dosya / 428 exact yüzey ve `1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1` ratchetleri yerel teknik kanıttır. Bu kanıtlar kabul, sertifikasyon, yerel model kurulumu veya gerçek sağlayıcı kullanılabilirliği iddiası değildir.
