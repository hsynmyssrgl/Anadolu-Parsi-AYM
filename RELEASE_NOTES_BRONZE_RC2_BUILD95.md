# Panthera pardus tulliana Aile — Bronze RC2 Build 95

## Sürüm
- Uygulama: `24.07.2026.95`
- Paket: `24.7.2026-95`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Aile daveti tokenlarının kriptografik üretimi ve SHA-256 özetlenmesi `FamilyDataStore` içindeki doğrudan Node `crypto` kodundan çıkarıldı. Application katmanındaki mevcut `InvitationTokenService` sözleşmesi, masaüstü ana süreçteki `NodeInvitationTokenService` adaptörü tarafından uygulanmaktadır.

Davranış korunmuştur: tokenlar 24 rastgele bayttan Base64URL biçiminde üretilir, veritabanında yalnızca SHA-256 özeti saklanır ve davet kabulünde sunulan token aynı SHA-256 işlemiyle doğrulanır. Davet oluşturma ve kabul use-case'leri aynı servis örneğini kullanır.

## Doğrulama kapsamı
Hedef token kriptografi sınırı, DataStore içindeki doğrudan `randomBytes` ve `createHash` kullanımının kaldırılması, oluşturma ve kabul use-case'lerinin adaptöre delegasyonu, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
