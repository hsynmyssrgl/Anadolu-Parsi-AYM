> Tarihsel kayıt: Bu belge Build 71 paket yönetişimi düzeltmesinden önceki MVP-70 adlandırmasını gösterir. Güncel yetkili özet için `RELEASE_NOTES_BRONZE_RC2_BUILD71.md` ve `BUILD_STATUS_BRONZE_RC2_BUILD71.md` dosyalarına bakın.

# Panthera pardus tulliana — Bronze MVP-70

**Sürüm:** 24.07.2026.70  
**Kanal:** Bronze / Geliştirme

## Kapsam

Arşiv saklama politikası yönetimi application/repository sınırına taşındı. Politika listeleme ve oluşturma, arşiv kaydına politika atama, saklama süresi uygunluk hesabı, güvenli imha planı ve imha sonrası metadata güncellemesi artık use-case ve repository üzerinden yürütülüyor. Fiziksel dosya üzerine rastgele veri yazma ve silme işlemi masaüstü dosya sistemi katmanında bırakıldı.

## Güvenlik ve bütünlük

- Politika oluşturma ve imha yalnızca etkin aile yöneticisine açık.
- Saklama süresi dolmadan imha engelleniyor.
- Daha önce imha edilmiş kayıt tekrar işlenemiyor.
- Politika atama ve imha işlemleri zincirli denetim kaydı oluşturuyor.
- Kullanıcının görebildiği arşiv kayıtları repository sonucu üzerinde yetkilendirme filtresinden geçiriliyor.

## Doğrulama

- MVP-70 hedef doğrulaması: 10/10
- Arşiv regresyon doğrulaması: 16/16
- DataStore TypeScript smoke derlemesi: başarılı
