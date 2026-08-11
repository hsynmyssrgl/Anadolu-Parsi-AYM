# Bronze MVP-60 Sürüm Notları

**Sürüm:** 24.07.2026.60  
**Aşama:** Bronze / MVP-60

## Tamamlanan geliştirmeler

- Sistem sağlığı ve tanılama operasyonları için `OperationalHealthApplicationContext`, query/write portları ve use-case katmanı eklendi.
- Performans örneği kaydetme/listeleme ve performans eğilimi hesaplama doğrudan SQL akışından application katmanına taşındı.
- Tanılama kaydı oluşturma ve listeleme `SqliteDiagnosticRepository` üzerinden yürütülür hale getirildi.
- Sistem sağlık puanı geçmişi oluşturma ve listeleme application/repository mimarisine taşındı.
- Bakım işleminin SQLite PRAGMA yürütmesi altyapı sınırında korunurken bakım geçmişi yazımı application/repository katmanına alındı.
- `RepositoryBackedOperationalHealthAdapter` ile transaction ve repository bağlama noktası oluşturuldu.
- Veri deposu smoke doğrulamasındaki migration 12 beklentisi güncellendi.

## Mimari sonuç

`FamilyDataStore`, hedeflenen sağlık/tanılama kalıcılık işlemlerinde SQL üretmez; use-case çağırır. SQL ayrıntıları repository içinde, transaction yönetimi SQLite adaptöründe tutulur.
