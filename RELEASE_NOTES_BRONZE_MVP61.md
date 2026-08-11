# Panthera pardus tulliana — Bronze MVP-61

## Kapsam

Arka plan görev izleme ve görev kuyruğu veri erişimleri `FamilyDataStore` içindeki doğrudan SQL kullanımından application/repository mimarisine taşındı.

## Eklenen bileşenler

- `packages/application/src/task-use-cases.ts`
- `packages/repositories/src/task-repository.ts`
- `apps/desktop/src/main/task-application-adapter.ts`
- `scripts/verify-task-use-cases.mjs`

## Taşınan akışlar

- Arka plan görevi başlatma, bitirme ve geçmiş listeleme
- Kuyruğa görev ekleme ve öncelikli listeleme
- Çalıştırılabilir görevleri kapasiteye göre alma
- Görevi çalışıyor, tamamlandı, ertelendi, yeniden denenecek veya başarısız durumuna geçirme
- `processTaskQueue` orkestrasyonunun repository/application portları üzerinden çalışması

## Korunan davranışlar

- Kritik > yüksek > normal > düşük öncelik sırası
- Adaptif kaynak yöneticisi nedeniyle erteleme
- Azami deneme sayısı
- Bakım, performans örneği ve zamanı gelen yedek görevlerinin çalıştırılması
- Uzun süren görev tanılama kaydı
