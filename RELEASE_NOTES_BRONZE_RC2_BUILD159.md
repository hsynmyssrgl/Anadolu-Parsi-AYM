# Bronze RC2 Build 159 Sürüm Notları

- Application Version: `29.07.2026.159`
- Package Version: `29.7.2026-159`
- Stage: **Bronze RC2 Active Development**

## Değişiklikler

- Bütün preload IPC çağrıları tek doğrulanmış `invoke` sarmalayıcısına geçirildi.
- Her çağrı renderer oturum kimliği, istek kimliği, oturum çağı, sıra numarası,
  kanal ve revizyon özeti taşıyor.
- Ana süreç eski oturum çağını ve yinelenen istek kimliğini reddediyor.
- Uygulama handler'ları taşıma metadata'sından ayrılmış özgün argümanları alıyor.
- Başarılı yanıtlar correlation kimliği ve aynı istek bağlamıyla zarflanıyor.
- Preload eşleşmeyen veya eski oturum çağındaki yanıtı renderer'a teslim etmiyor.
- Kimlik doğrulama geçişleri yeni taşıma oturum çağı başlatıyor.
- Mutasyon revizyonları taşıma özetine yalnız monoton biçimde ekleniyor.

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
