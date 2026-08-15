# 33-W — Onaya bağlı aile AI asistanı tehdit modeli

## Korunan varlıklar

- Aile, kişi ve kaynak sahipliği ile merkezi PEP receipt/fence bağları.
- Amaç bazlı standart AI onayı ve finans/sağlık için hassas veri onayı.
- Ham OCR, finans, sağlık, arşiv ve diğer kaynak içerikleri.
- Öneri mutation ledger'ı, optimistic revision ve idempotency kimliği.
- Renderer'a taşınan içerik-minimize merkez ve receipt görünümleri.

## Tehditler ve kontroller

1. **İzinsiz kaynak birleştirme:** Kaynaklar yalnız yetkili yerel okuma modellerinden alınır; her kaynak için amaç eşleşmeli aktif onay, finans/sağlıkta ek hassas onay zorunludur.
2. **İzin iptalinden sonra görünürlük:** Merkez her okumada onayı yeniden doğrular ve iptal edilmiş kaynaklara bağlı önerileri gizler; `confirm` tekrar reddedilir.
3. **Ham içerik sızıntısı:** Kalıcı satır, audit, outbox ve IPC yalnız genel öneri metni ile içeriksiz kaynak kimliği taşır; sorgu, kaynak başlığı, OCR metni, finans/sağlık içeriği ve yol tutulmaz.
4. **Otonom eylem yanılsaması:** İnsan onayı yalnız inceleme durumunu kaydeder. Ödeme, rezervasyon, sağlık, acil durum veya başka downstream kalıcı işlem yoktur.
5. **Replay ve yarış:** `clientOperationId`, request fingerprint, optimistic revision, immutable mutation ledger ve aynı receipt/fence altında current-row eşliği fail-closed uygulanır.
6. **Renderer yetki yükseltmesi:** Renderer hesap, aile, sahip, receipt, state fingerprint veya kalıcı eylem parametresi seçemez; exact IPC anahtarları, sınırlar ve safe-result doğrulaması zorunludur.
7. **Sağlayıcı/ağ iddiası:** Provider yapılandırılmış değildir; ağ, bulut ve model inference çalıştırılmaz. Konuşma ve çeviri seçenekleri yalnız uygulanmamış yerel truth olarak gösterilir.
8. **OCR/finans/sağlık yanlış kararı:** OCR önerileri otomatik kabul edilmez; medikal, finansal veya acil durum kararı üretilmez ve gerçek güvenlik incelemeleri yapılmadan kabul iddiası kurulmaz.

## Açık kanıtlar

Gerçek aile, gerçek sağlayıcı/model, konuşma/çeviri, OCR sınıflandırma, finans/sağlık güvenlik ve privacy/legal UAT'ları `NOT_RUN` durumundadır. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `33-W` yalnız yerel kısmi uygulama kanıtıdır ve `countsAsRequirementPass=false` kalır.
