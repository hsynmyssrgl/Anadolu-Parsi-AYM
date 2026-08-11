# Panthera pardus tulliana — Bronze MVP-46 Build Durumu

- Kullanıcı sürümü: `23.07.2026.46`
- Paket sürümü: `23.7.2026-46`
- Kanal: Bronze
- Milestone: `B060-M6 — Family Application Use Cases`
- Durum: Tamamlandı

## Tamamlanan kodlama

- `GetFamilyGraphUseCase`
- `CreateFamilyMemberUseCase`
- `CreateFamilyRelationUseCase`
- SQLite bağımsız application portları ve unit-of-work sözleşmesi
- `SqliteFamilyRepository`
- `SqliteRelationRepository`
- `SqlitePersonRepository.listByFamily`
- Electron main için `RepositoryBackedFamilyApplicationUnitOfWork`
- Electron main için `RepositoryBackedFamilyGraphQueryPort`
- Aile grafiği okumasının repository/use-case katmanına taşınması
- Üye oluşturmanın application transaction akışına taşınması
- İlişki oluşturmanın application transaction akışına taşınması
- Üye ve ilişki için audit + outbox atomikliği
- `family.relation.created` structured log ve diagnostic handler'ları
- Application→Infrastructure ters bağımlılığının kaldırılması
- Timeline repository port sahipliğinin application katmanına taşınması

## Doğrulama özeti

- TypeScript workspace derlemesi: 12/12
- Electron main/preload typecheck: başarılı
- Foundation: 14/14
- Runtime: 6/6
- Migration: 9/9
- SQLite smoke: 14/14
- Repository/outbox: 10/10
- Transaction atomikliği: 9/9
- Dispatcher scenario grubu: 3/3
- Family application use-case: 14/14
- IPC eşleşmesi: 124/124
- Uygulama tablosu: 40
- Altyapı tablosu: 4
- Migration: 5

## Ertelenen kapsam

Tam Electron/Vite/Vitest üretim zinciri, Windows installer, ekran görüntüsü ve kapsamlı manuel doğrulama kalıcı proje kararına uygun olarak Silver aşamasında toplu yapılacaktır.
