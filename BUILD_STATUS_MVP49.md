# Panthera pardus tulliana — Bronze MVP-49 Build Durumu

- Kullanıcı sürümü: `23.07.2026.49`
- Paket sürümü: `23.7.2026-49`
- Kanal: Bronze
- Milestone: `B060-M9 — Dashboard Query & Navigation State`
- Durum: Tamamlandı

## Tamamlanan kodlama

- `GetDashboardOverviewUseCase`
- `DashboardQueryPort`
- `SqliteDashboardRepository`
- `RepositoryBackedDashboardQueryPort`
- Merkezi Dashboard aile, üye, nesil, zaman tüneli ve yaklaşan gün özetleri
- 15 ana modül için `ready`, `attention` ve `empty` durum modeli
- Kullanıcı rolü ve bağlı kişi kimliğine göre özel modül sayaçlarının sınırlandırılması
- Yönetici olmayan kullanıcılar için başka kişilere ait sağlık, finans, yaşam ve arşiv sayı bilgilerinin gizlenmesi
- `dashboard:getOverview` IPC sözleşmesi
- Renderer Dashboard’unun merkezi overview modeline geçirilmesi
- Kalıcı aktif modül, önceki modül ve gezinme geçmişi yöneten navigation reducer
- Session storage tabanlı son modül hatırlama
- Veri değişikliklerinden sonra Dashboard özetlerinin merkezi yenilenmesi

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
- Dashboard/navigation use-case: 14/14
- IPC eşleşmesi: 125/125
- Uygulama tablosu: 40
- Altyapı tablosu: 4
- Migration: 5

## Ertelenen kapsam

Tam Electron/Vite/Vitest üretim zinciri, Windows installer, ekran görüntüleri ve kapsamlı manuel UI doğrulaması kalıcı proje kararına uygun olarak Silver aşamasında toplu yapılacaktır. Bu Bronze sürümünde package derlemeleri, Electron main/preload typecheck’i, gerçek SQLite doğrulamaları ve kaynak kalite kapıları tamamlanmıştır.
