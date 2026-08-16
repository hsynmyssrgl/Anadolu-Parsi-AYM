# 33-W — Onaya bağlı aile AI asistanı tehdit modeli

## Korunan varlıklar

- Aile, kişi ve kaynak sahipliği ile merkezi PEP receipt/fence bağları.
- Amaç bazlı standart AI onayı ve finans/sağlık için hassas veri onayı.
- Ham OCR, finans, sağlık, arşiv ve diğer kaynak içerikleri.
- Öneri mutation ledger'ı, optimistic revision ve idempotency kimliği.
- Renderer'a taşınan içerik-minimize merkez ve receipt görünümleri.

## Tehditler ve kontroller

1. **İzinsiz kaynak birleştirme:** Kaynaklar yalnız yetkili yerel okuma modellerinden alınır; her kaynak için amaç eşleşmeli aktif onay, finans/sağlıkta ek hassas onay zorunludur.
2. **İzin iptalinden sonra görünürlük:** Merkez her okumada onayı yeniden doğrular; exact veya wildcard etkin bir iptal daha geniş izni ezer. İptal edilmiş veya süresi dolmuş kaynaklara bağlı öneriler gizlenir, `confirm` reddedilir ve yalnız içeriksiz tutamaçla `dismiss` kullanılabilir.
3. **Ham içerik sızıntısı:** Kalıcı satır, audit, outbox ve IPC yalnız genel öneri metni ile içeriksiz kaynak kimliği taşır; sorgu, kaynak başlığı, OCR metni, finans/sağlık içeriği ve yol tutulmaz.
4. **Otonom eylem yanılsaması:** İnsan onayı yalnız inceleme durumunu kaydeder. Ödeme, rezervasyon, sağlık, acil durum veya başka downstream kalıcı işlem yoktur.
5. **Replay ve yarış:** `clientOperationId`, request fingerprint, optimistic revision, immutable mutation ledger ve aynı receipt/fence altında current-row eşliği fail-closed uygulanır.
6. **Renderer yetki yükseltmesi:** Renderer hesap, aile, sahip, receipt, state fingerprint veya kalıcı eylem parametresi seçemez; exact IPC anahtarları, sınırlar ve safe-result doğrulaması zorunludur.
7. **Sağlayıcı/ağ iddiası:** Provider yapılandırılmış değildir; ağ, bulut ve model inference çalıştırılmaz. Konuşma ve çeviri seçenekleri yalnız uygulanmamış yerel truth olarak gösterilir.
8. **OCR/finans/sağlık yanlış kararı:** OCR önerileri otomatik kabul edilmez; medikal, finansal veya acil durum kararı üretilmez ve gerçek güvenlik incelemeleri yapılmadan kabul iddiası kurulmaz.
9. **Türler arası kaynak karıştırma:** Her öneri türü kanonik modül kümesinin yalnız alt kümesini, her modül de tek kaynak türünü kullanır. Arama sorgusu yalnız `authorized_search` için zorunludur; diğer türler serbest metin istemi kabul etmez.
10. **Merkez taşması ve kalıcı disk büyümesi:** Sahip başına 500 current öneri hem repository hem migration tarafından fail-closed sınırlanır. Terminal kayıt saklama/kapasite geri kazanım politikası kararlaştırılmadığı için yaşam boyu kapasite tükenmesi artık riski açıktır; sessiz kırpma yapılmaz.
11. **Yanıltıcı güven puanı:** Puan yalnız kaynak kapsamını gösterir; doğruluk, güvenlik veya uzman tavsiyesi değildir ve UI bunu açıkça etiketler.

## Açık kanıtlar

Gerçek aile, gerçek sağlayıcı/model, konuşma/çeviri, OCR sınıflandırma, finans/sağlık güvenlik ve privacy/legal UAT'ları `NOT_RUN` durumundadır. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `33-W` yalnız yerel kısmi uygulama kanıtıdır ve `countsAsRequirementPass=false` kalır.

Kalıcı öneri yeniden görüntülenirken kaynak nesne izninin ayrı bir PEP turuyla yeniden doğrulanması, terminal kayıtların retention/kapasite geri kazanımı ve fiziksel/backup imhası uygulanmamıştır. İçerik saklanmaması bu artık riskleri ortadan kaldırmaz; kabul kanıtı sayılmaz.
