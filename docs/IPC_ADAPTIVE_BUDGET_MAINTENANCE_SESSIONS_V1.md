# Adaptif IPC Bütçe Bakım Oturumları V1

## Akış

1. Preload işlem türü ve kendi renderer oturum kimliğiyle bakım oturumu ister.
2. Ana süreç açık kullanıcı oturumunu doğrular ve işlem türüne özel onay gösterir.
3. Onay sonrası 90 saniyelik tek kullanımlık oturum üretilir.
4. Preload oturum kimliğini yalnız aynı işlem çağrısında kullanır.
5. Ana süreç sender, renderer oturumu, kimlik bağlamı, işlem türü ve süreyi doğrular.
6. Başarılı tüketimden sonra aynı kimlik tekrar kullanılamaz.

## Ret nedenleri

- Oturum bulunamadı
- Oturum süresi doldu
- Oturum daha önce kullanıldı
- Sender uyuşmadı
- Renderer oturumu uyuşmadı
- Kimlik doğrulama bağlamı değişti
- İşlem türü uyuşmadı

## Veri minimizasyonu

Registry kullanıcı adı, aile verisi, IPC argümanı veya payload tutmaz. Denetim kayıtları yalnız işlem türü, ret nedeni, sender ve kısaltılmış teknik parmak izi taşır.
