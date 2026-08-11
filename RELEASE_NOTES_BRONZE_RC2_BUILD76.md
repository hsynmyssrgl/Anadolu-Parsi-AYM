# Panthera pardus tulliana — Bronze RC2 Aktif Geliştirme Build 76

**Sürüm:** 24.07.2026.76  
**Paket sürümü:** 24.7.2026-76  
**Durum:** RC2 aktif geliştirme; Final ve Code Freeze değildir.

## Değişiklikler
- Konum oluşturma doğrulaması `CreateFamilyLocationUseCase` içine taşındı.
- Konum kaydı `SqliteLocationRepository.insert` üzerinden gerçekleştiriliyor.
- Kayıt ve denetim izi aynı transaction/unit-of-work sınırında atomik hale getirildi.
- DataStore içindeki doğrudan `INSERT INTO locations` kaldırıldı.

## Doğrulama
- Hedef kaynak sınırı kontrolü: 10/10 başarılı.
- Sürüm zinciri: 75 → 76.
- Tam TypeScript kontrolü, kaynak pakette Node tür bağımlılıkları bulunmadığı için çalıştırılamadı.
