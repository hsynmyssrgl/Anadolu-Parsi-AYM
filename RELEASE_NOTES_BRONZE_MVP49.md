# Panthera pardus tulliana — Bronze MVP-49 Release Notları

**Sürüm:** `23.07.2026.49`  
**Milestone:** `B060-M9 — Dashboard Query & Navigation State`

## Yeni

- Ana merkez verilerini tek application use-case üzerinden sağlayan `GetDashboardOverviewUseCase` eklendi.
- Dashboard SQL okumalarını kapsülleyen `SqliteDashboardRepository` eklendi.
- Application portunu Electron main sürecine bağlayan `RepositoryBackedDashboardQueryPort` eklendi.
- 15 ana modül için kayıt sayısı, dikkat durumu, boş durum açıklaması ve hazır durum açıklaması üretildi.
- Yeni `dashboard:getOverview` IPC kanalı eklendi.
- Renderer gezinmesi için reducer, geçmiş ve geri dönüş modeli eklendi.
- Dashboard ve navigation için 14 senaryolu gerçek SQLite ve reducer doğrulaması eklendi.

## Değişen

- Dashboard üye, nesil, yaklaşan gün, zaman tüneli ve içerik sayılarını renderer içinde hesaplamak yerine merkezi query katmanından alıyor.
- Aile üyesi, ilişki, önemli gün ve diğer modül değişikliklerinden sonra Dashboard özeti merkezi olarak yenileniyor.
- Son seçili modül session storage üzerinde korunuyor.
- IPC kanal sayısı 124’ten 125’e yükseldi.
- Yönetici olmayan hesapların özel modül sayaçları kullanıcıya bağlı kişi ve hesap kapsamıyla sınırlandırıldı.
- Sürüm sırası Temmuz 2026 içindeki 49. geliştirme olarak kaydedildi.

## Korunan uyumluluk

- Renderer doğrudan SQLite, dosya sistemi veya secret store kullanmıyor.
- Mevcut 124 IPC kanalı değiştirilmeden korunuyor; yalnızca yeni Dashboard kanalı ekleniyor.
- Mevcut aile, soy ağacı, zaman tüneli, önemli gün ve backup verileri korunuyor.
- SQLite tablo ve migration sayısı değişmedi.
- AI kullanıcı rızası olmadan authoritative domain verisini değiştiremez.
- Gold artifact’in Silver’da test edilen aynı artifact olması kuralı korunuyor.
