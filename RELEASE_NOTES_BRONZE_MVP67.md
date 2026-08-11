# Bronze MVP-67 Sürüm Notları

## Üyelik hesabı yönetimi mimari geçişi

- Aile hesaplarını listeleme işlemi `ListFamilyAccountsUseCase` üzerinden application katmanına taşındı.
- Hesap rolü, durumu, kişi bağlantısı ve üyelik tarihlerini güncelleme işlemi `UpdateFamilyAccountUseCase` üzerinden yürütülüyor.
- Yönetici hesabının kendi yöneticilik yetkisini veya aktif durumunu kaldırması application katmanında engelleniyor.
- Kişi bağlantısı ve üyelik tarihleri application katmanında doğrulanıyor.
- Hesap listeleme ve üyelik güncelleme sorguları `SqliteAccountRepository` içine taşındı.
- Güncelleme işlemi denetim kaydı ve transactional outbox olayıyla aynı işlem biriminde tamamlanıyor.
- `FamilyDataStore.listAccounts()` ve `updateAccount()` içindeki doğrudan hesap SQL sorguları kaldırıldı.

## Doğrulama

- Application TypeScript derlemesi: başarılı.
- Repositories TypeScript derlemesi: başarılı.
- DataStore smoke TypeScript derlemesi: başarılı.
- MVP-67 üyelik hesabı yönetimi doğrulaması: 10/10 başarılı.
- Mevcut üyelik ve iş birliği regresyon doğrulaması: 17/17 başarılı.
