# Panthera pardus tulliana — Bronze MVP-48 Build Durumu

- Kullanıcı sürümü: `23.07.2026.48`
- Paket sürümü: `23.7.2026-48`
- Kanal: Bronze
- Milestone: `B060-M8 — Timeline & Important Days Application Migration`
- Durum: Tamamlandı

## Tamamlanan kodlama

- `GetTimelineReadModelUseCase`
- `GetImportantDayDetailsUseCase`
- `CreateImportantDayUseCase`
- `SqliteTimelineRepository`
- `SqliteLocationRepository`
- `RepositoryBackedTimelineQueryPort`
- `RepositoryBackedTimelineApplicationUnitOfWork`
- Zaman tüneli konum ve etkinlik okumalarının repository katmanına taşınması
- Önemli gün eklemenin application use-case katmanına taşınması
- Konum, katılımcı, görünürlük, davetiye, not, tekrar ve hatırlatma doğrulaması
- AI işleme izni alanının authoritative event kaydında korunması
- Event, audit ve transactional outbox kayıtlarının tek transaction içinde oluşturulması
- `timeline.important_day.created` event’i için structured log ve diagnostic handler’ları
- Hatırlatma bildirimlerinin application read-model içinde üretilmesi
- Mevcut snapshot ve `timeline:createImportantDay` IPC sözleşmesinin korunması

## Doğrulama özeti

- TypeScript workspace derlemesi: 12/12
- Electron main/preload typecheck: başarılı
- Foundation: 14/14
- Runtime: 6/6
- Migration: 9/9
- SQLite smoke: 14/14
- Repository/outbox: 10/10
- Transaction atomikliği: 9/9
- Dispatcher: 3/3
- Family application use-case: 14/14
- Genealogy read-model: 6/6
- Timeline/important-day use-case: 17/17
- IPC eşleşmesi: 124/124
- Uygulama tablosu: 40
- Altyapı tablosu: 4
- Migration: 5

## Ertelenen kapsam

Tam Electron/Vite/Vitest üretim zinciri, Windows installer, ekran görüntüsü ve kapsamlı manuel doğrulama kalıcı proje kararına uygun olarak Silver aşamasında toplu yapılacaktır. Kaynak ve Electron main/preload TypeScript kontrolleri bu Bronze sürümünde tamamlanmıştır.
