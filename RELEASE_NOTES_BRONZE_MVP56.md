# Bronze MVP-56 Sürüm Notları

## Yeni

- Arşiv repository ve application use-case katmanı
- `SqliteArchiveRepository`
- `ListArchiveItemsUseCase`
- `ListArchiveVersionsUseCase`
- `ImportArchiveItemUseCase`
- `RepositoryBackedArchiveQueryPort`
- `RepositoryBackedArchiveUnitOfWork`
- `archive.item.imported` transactional outbox olayı
- Migration 11: `archive_application_indexes`

## Güvenlik ve bütünlük

- Arşiv içeriği AES tabanlı mevcut kasa şifrelemesiyle saklanmaya devam eder.
- Açılan dosyanın SHA-256 değeri metadata ile karşılaştırılır.
- Metadata, ilk sürüm, audit ve outbox tek transaction içindedir.
- Bağlı etkinlik bulunamazsa bütün metadata değişiklikleri rollback edilir.
- Rollback sonrasında diskte yetim kasa dosyası bırakılmaz.
- Aynı arşiv öğesinde aynı SHA-256 içeriğinin ikinci sürüm olarak kaydı engellenir.

## Düzeltmeler

- Yedekleme akışında oluşturulmuş dosya yolunun kesinlik kontrolü sertleştirildi.
- Arşiv sürümleri gerçek `stored_name` alanını taşır hâle getirildi.
