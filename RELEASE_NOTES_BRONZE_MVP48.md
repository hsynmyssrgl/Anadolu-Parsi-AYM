# Panthera pardus tulliana — Bronze MVP-48 Release Notları

**Sürüm:** `23.07.2026.48`  
**Milestone:** `B060-M8 — Timeline & Important Days Application Migration`

## Yeni

- Zaman tüneli read-model’ini application katmanında oluşturan `GetTimelineReadModelUseCase` eklendi.
- Önemli gün ayrıntısını yetki kontrollü döndüren `GetImportantDayDetailsUseCase` eklendi.
- Önemli gün oluşturmayı doğrulama, audit ve outbox ile yöneten `CreateImportantDayUseCase` eklendi.
- SQLite etkinlik işlemleri için `SqliteTimelineRepository` eklendi.
- SQLite konum okumaları için `SqliteLocationRepository` eklendi.
- Application portlarını Electron main içinde uygulayan timeline query ve unit-of-work adapter’ları eklendi.
- `timeline.important_day.created` event’i için iki idempotent handler eklendi.
- Timeline modülüne özel 17 senaryolu gerçek SQLite doğrulama seti eklendi.

## Değişen

- `FamilyDataStore.getSnapshot()` etkinlik ve konumları doğrudan SQL yerine timeline use-case/repository katmanından alıyor.
- `FamilyDataStore.createEvent()` doğrudan SQL ve manuel transaction yerine application use-case’ini kullanıyor.
- Hatırlatma bildirimleri application read-model katmanında üretiliyor.
- `timeline:createImportantDay` IPC çağrısı transaction sonrasında outbox dispatcher’ı çalıştırıyor.
- Katılımcılar tekrarsızlaştırılıyor; bilinmeyen aile üyeleri sessizce çıkarılmak yerine kontrollü hata oluşturuyor.
- Seçilen konumun canonical adı event kaydına uygulanıyor.
- Sürüm sırası Temmuz 2026 içindeki 48. geliştirme olarak kaydedildi.

## Korunan uyumluluk

- Renderer ve preload API adları değişmedi.
- IPC kanal sayısı 124 olarak korundu.
- Mevcut kişi, ilişki, zaman tüneli, önemli gün ve yedek verileri korunuyor.
- SQLite tablo ve migration sayısı değişmedi.
- AI kullanıcı rızası olmadan authoritative domain verisini değiştiremez.
- Gold artifact’in Silver’da test edilen aynı artifact olması kuralı korunuyor.
