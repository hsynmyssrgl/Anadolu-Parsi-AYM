# Panthera pardus tulliana — Bronze MVP-56 Build Durumu

- Kullanıcı sürümü: `24.07.2026.56`
- Paket sürümü: `24.7.2026-56`
- Milestone: `B060-M16 Document Archive & Versioning Application Migration`
- Kanal: Bronze
- Durum: Başarılı

## Tamamlanan mimari

- Arşiv metadata erişimi `SqliteArchiveRepository` üzerinden yürütülüyor.
- Listeleme, ilk sürüm sorgusu ve içe aktarma application use-case katmanına taşındı.
- Şifreli kasa dosyası ile SQLite metadata transaction'ı birlikte yönetiliyor.
- Başarısız transaction sonrasında oluşturulan yetim `.vault` dosyası kaldırılıyor.
- İlk sürüm kaydı içerik SHA-256 değeri ve gerçek saklama adıyla tutuluyor.
- Arşiv içe aktarma audit hash zinciri ve transactional outbox ile aynı transaction'da tamamlanıyor.
- Merkezi nesne seviyesi yetkilendirme arşiv okuma ve oluşturma işlemlerine uygulanıyor.
- Migration 11 arşiv sürüm saklama adı ve sorgu indekslerini ekliyor.

## Doğrulama

- Workspace TypeScript paket derlemesi: 12/12
- Electron main/preload TypeScript kontrolü: başarılı
- Otomatik kontrol: 217/217
- Arşiv uygulama senaryoları: 16/16
- Migration: 11
- SQLite tablo sayısı: 42
- SQLite kolon sayısı: 376
- IPC preload çağrısı: 132
- Şema fingerprint: `33b93d5b2479e83d4af415e150ac837c61f58ba9137a89432644527e0246a49b`

Bronze kararı gereği tam renderer production bundle, Windows installer, manuel ekran ve ekran görüntüsü doğrulamaları Silver aşamasında toplu yürütülecektir.
