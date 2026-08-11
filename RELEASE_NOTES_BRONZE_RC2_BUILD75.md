# Panthera pardus tulliana — Bronze RC2 Aktif Geliştirme Build 75

**Sürüm:** 24.07.2026.75  
**Paket sürümü:** 24.7.2026-75  
**Durum:** Aktif geliştirme; Code Freeze ve RC2 Final değildir.

## Tamamlanan geliştirme

- Bakım önerisi kararları `GetMaintenanceRecommendationsUseCase` içine taşındı.
- Başarısız yedekleme sayımı `OperationalHealthQueryPort` üzerinden okunuyor.
- DataStore içindeki doğrudan `backup_runs` sayım SQL'i kaldırıldı.
- Bakım eşikleri ve sağlıklı sistem fallback davranışı application katmanında merkezileştirildi.

## Doğrulama

- Build 75 hedef kontrolü: 10/10 başarılı.
- Doğrudan SQL kalıntı taraması: temiz.
- Sürüm ve paket metadata zinciri 24.07.2026.75 olarak eşitlendi.
