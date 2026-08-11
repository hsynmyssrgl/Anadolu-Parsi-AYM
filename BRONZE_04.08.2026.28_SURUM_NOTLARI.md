# Bronze 04.08.2026.28 - Sürüm Notları

## Tamamlanan kaynak çalışmaları

- 172 tarihsel ve 28 yeni kural 200 maddelik kanonik sicilde birleştirildi; çakışan 14 eski kural açıkça superseded olarak işaretlendi.
- Kullanıcı karar defteri, teslim rapor sözleşmesi, sohbet kapasite politikası, kalıcı kayıt politikası ve eksiksiz belge envanteri eklendi.
- GOVERNED_PREFLIGHT/GOVERNED_POSTFLIGHT, kullanıcı kural onayı, kaynak parmak izi ve tamper runtime kapıları kodlandı.
- Build/test/package lifecycle komutları güncel governed preflight olmadan fail-closed duracak şekilde bağlandı.
- Platform Policy Kernel ve Core Service arasında imzalı karar receipt zinciri kuruldu.
- Kimlik doğrulamalı, sürümlü ve boyut/timeout sınırlı yerel Core Service yönetim protokolü kodlandı.
- Desktop tarafında yalnız enjekte edilen bağlantı/secret otoritesiyle çalışan yerel Core Service istemci adaptörü eklendi.
- Bütün dosya ve belgeler için JSON/CSV/Markdown envanterleri ve doğrulama kapısı üretildi.
- Bronze 04.08.2026.28 Master Proje Dokümantasyonu DOCX/PDF oluşturuldu, sekiz sayfanın tamamı görsel olarak incelendi ve DOCX erişilebilirlik denetimi 0 bulguyla kapandı.

## Dürüst sınırlar

Clean npm ci OPEN-002 nedeniyle BLOCKED; tam TypeScript, bütün unit/integration testleri, Electron production build ve gerçek Windows installer/UAT NOT_RUN durumundadır. Silver ve Gold kapalıdır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
