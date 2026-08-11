# Panthera pardus tulliana Aile — Bronze RC2 Build 78

## Sürüm
- Uygulama: `24.07.2026.78`
- Paket: `24.7.2026-78`
- Aşama: Bronze RC2 Aktif Geliştirme

## Değişiklikler
- Arşiv arama ölçütleri `SearchArchiveItemsUseCase` içinde normalleştirildi.
- Arşiv arama SQL'i `SqliteArchiveRepository.search` metoduna taşındı.
- Arama sonuçları merkezi nesne bazlı okuma yetkilendirmesinden geçirildi.
- `FamilyDataStore.searchArchive` içindeki doğrudan SQL kaldırıldı.
- İmha edilmiş arşiv kayıtları arama sonuçlarından hariç tutuldu.

## Doğrulama sınırı
Hedef mimari ve kaynak sınırı doğrulamaları çalıştırıldı. Tam TypeScript/Electron üretim derlemesi, paket içinde kurulmuş `node_modules` bulunmadığı için bu ortamda iddia edilmemektedir.

Bu sürüm RC2 Final, Code Freeze veya Silver değildir.
