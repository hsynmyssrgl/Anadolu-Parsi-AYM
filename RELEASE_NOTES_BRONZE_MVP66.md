# Panthera pardus tulliana — Bronze MVP-66

## Denetim günlüğü mimari geçişi

- Denetim günlüğü listeleme sorgusu DataStore doğrudan SQL katmanından çıkarıldı.
- `AuthorizationQueryPort` içine denetim kayıtlarını listeleme portu eklendi.
- `ListAuditEntriesUseCase` ile aktif hesap ve yönetici yetkisi denetimi application katmanına taşındı.
- `SqliteAuditRepository.listEntriesDescending` ile ters kronolojik ve sınırlandırılmış sorgu repository katmanına alındı.
- Masaüstü authorization adapter’ı repository kayıtlarını `AuditEntryView` modeline dönüştürüyor.
- Mevcut denetim zinciri bütünlük doğrulaması korunmuştur.

## Doğrulama

MVP-66 hedefe özel mimari doğrulaması: 10/10 başarılı.
