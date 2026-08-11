# Panthera pardus tulliana Aile — Bronze RC2 Build 94

## Sürüm
- Uygulama: `24.07.2026.94`
- Paket: `24.7.2026-94`
- Durum: Bronze RC2 aktif geliştirme

## Değişiklik
Sistem sağlığı görünümü, uyarlanabilir arka plan görev profili ve performans örneklemesi için kullanılan işletim sistemi, CPU, bellek, veritabanı boyutu ve arşiv boyutu ölçümleri `FamilyDataStore` içinden çıkarıldı. Ölçüm sözleşmesi application katmanındaki `SystemResourceSnapshotPort` ile tanımlandı ve Node işletim sistemi/dosya sistemi erişimleri masaüstü adaptörüne taşındı.

`FamilyDataStore` artık `InspectSystemResourceSnapshotUseCase` üzerinden hazır kaynak görünümü alır. Bellek kritik ve uyarı eşikleri, 2 GB veritabanı uyarısı, arka plan görevlerinin yüksek yükte ertelenmesi, donanım profiline göre eşzamanlı görev sayısı ve performans örneği alanları korunmuştur.

## Doğrulama kapsamı
Hedef sistem kaynak sınırı, DataStore içindeki doğrudan CPU/bellek/yük ve veritabanı-arşiv boyutu ölçümlerinin kaldırılması, üç tüketici akışın use-case üzerinden delegasyonu, sürüm sırası, workspace sürüm tutarlılığı, hedefli TypeScript sözdizimi aktarımı, manifest ve kaynak paket bütünlüğü doğrulanacaktır. Tam workspace TypeScript derlemesi, `npm typecheck`, Electron production build, kapsamlı fonksiyon testleri ve ekran görüntüsü üretimi bu ara geliştirme adımında çalıştırılmayacaktır.
