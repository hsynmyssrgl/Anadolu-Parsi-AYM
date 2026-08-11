# Panthera pardus tulliana Aile — Bronze RC2 Build 97

## Sürüm
- Uygulama: `24.07.2026.97`
- Paket: `24.7.2026-97`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Parola hash/doğrulama, TOTP ve kurtarma kodu işlemleri, cihaz imzası doğrulaması ve bellek içi oturum portu `FamilyDataStore` içindeki inline güvenlik uygulamalarından çıkarıldı. Masaüstü ana süreçte `NodePasswordService`, `NodeSecondFactorService`, `NodeDeviceProofVerifier` ve `InMemoryAuthSessionPort` eklendi; mevcut application katmanı güvenlik sözleşmeleri doğrudan bu adaptörler tarafından uygulanıyor.

Davranış korunmuştur: parola kayıtları aynı JSON-serileştirilmiş güvenlik biçimini kullanır, TOTP doğrulaması işlem zamanına göre yapılır, kurtarma kodu tüketildiğinde kalan hash listesi güncellenir, cihaz kanıtı mevcut imza doğrulayıcısıyla denetlenir ve oturum boşta kalma süresi yapılandırması değişmeden uygulanır. Login kilitleme sınırı ve tüm auth use-case bağlantıları korunmuştur.

## Doğrulama kapsamı
Hedef adaptör sınırı, DataStore içindeki doğrudan güvenlik primitive kullanımlarının kaldırılması, auth use-case bağlantılarının ve güvenlik yapılandırmasının korunması, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
