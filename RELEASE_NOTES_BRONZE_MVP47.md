# Panthera pardus tulliana — Bronze MVP-47 Release Notları

**Sürüm:** `23.07.2026.47`  
**Milestone:** `B060-M7 — Genealogy Read Model`

## Yeni

- Soy ağacı ve nesil özetlerini application katmanında üreten `GetGenealogyReadModelUseCase` eklendi.
- Kayıtlı nesli uyumluluk tabanı olarak kullanan, geçerli ebeveyn bağlarıyla alt nesilleri güvenli biçimde derinleştiren nesil hesaplama algoritması eklendi.
- Parent ve child yönlerini ortak ebeveyn–çocuk kenarına dönüştüren normalizasyon eklendi.
- Döngüsel ilişki zincirlerini algılayan ve sonsuz nesil hesaplamasını engelleyen koruma eklendi.
- Eksik kişiye yönelen bozuk ilişki kayıtlarını görmezden gelerek bütünlük özetinde raporlayan koruma eklendi.
- Genealogy timeline olaylarını SQLite repository üzerinden okuyan `SqliteGenealogyRepository` eklendi.
- Application portunu Electron main içinde uygulayan `RepositoryBackedGenealogyReadModelQueryPort` eklendi.

## Değişen

- `FamilyDataStore.getGenealogyInsights()` doğrudan SQL yerine genealogy application use-case’ini kullanıyor.
- Soy ağacı ekranına sağlanan aile grafiği, güvenli hesaplanan nesil değerlerini kullanıyor.
- Genealogy insight cevabına geriye uyumlu `integrity` özeti eklendi.
- Application ve repository paket export katalogları genealogy bileşenleriyle genişletildi.
- Sürüm sırası Temmuz 2026 içindeki 47. geliştirme olarak kaydedildi.

## Korunan uyumluluk

- Renderer ve preload API adları değişmedi.
- IPC kanal sayısı 124 olarak korundu.
- Mevcut kişi, ilişki, zaman tüneli ve yedek verileri korunuyor.
- SQLite tablo ve migration sayısı değişmedi.
- Gold artifact’in Silver’da test edilen aynı artifact olması kuralı korunuyor.
