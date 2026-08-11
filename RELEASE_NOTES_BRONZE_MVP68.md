# Bronze MVP-68 Sürüm Notları

- `SqliteAutomationRepository` eklendi.
- `automation-use-cases` application modülü eklendi.
- `RepositoryBackedAutomationAdapter` eklendi.
- DataStore içindeki automation_rules listeleme, ekleme ve durum güncelleme SQL sorguları kaldırıldı.
- DataStore içindeki automation_runs geçmiş listeleme SQL sorgusu kaldırıldı.
- Başlık ve 0-365 gün doğrulaması application katmanına taşındı.
- Çalışma geçmişi limiti 1-500 aralığında güvenli biçimde sınırlandı.
