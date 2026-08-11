# Bronze MVP-60 Sürüm Notları

Yedekleme hedefleri ve yedek çalışma geçmişi `FamilyDataStore` içindeki doğrudan SQL akışından application/repository mimarisine taşındı.

## Tamamlananlar
- `BackupApplicationContext`, query/write portları ve yedekleme use-case'leri eklendi.
- `SqliteBackupRepository` ve `RepositoryBackedBackupAdapter` oluşturuldu.
- Hedef listeleme, hedef bulma, hedef ekleme/güncelleme, çalışma geçmişi, etkin hedefler ve zamanı gelen hedef sorguları repository katmanına taşındı.
- Başarılı/başarısız yedek çalışma kayıtları ile hedef durum güncellemeleri application katmanından yürütülüyor.
- Saklama politikası eski çalışma kayıtlarını repository üzerinden siliyor.
- Dosya kopyalama, boş alan kontrolü, hash doğrulaması ve adaptif zamanlayıcı davranışı korunmuştur.
