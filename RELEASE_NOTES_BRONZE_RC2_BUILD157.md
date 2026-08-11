# Bronze RC2 Build 157 Sürüm Notları

- Uygulama sürümü: `29.07.2026.157`
- Paket sürümü: `29.7.2026-157`
- Aşama: **Bronze RC2 Active Development**

## Tek ana geliştirme konusu

Mutasyonlardan sonra tam aile snapshot'ı döndürülmesinin kaldırılması; sınırlı
mutasyon sonuçları ve hedefli grafik/katalog revizyon sinyalleri.

## Eklenenler

- `FamilyMutationResultView` ve hedefli revizyon sözleşmeleri.
- Kişi, ilişki, konum, olay ve bildirim mutasyonlarında tek-nesne sonuçları.
- Grafik, zaman tüneli, kişi kataloğu, olay kataloğu, dashboard, bildirim ve
  arşiv için bağımsız monoton revizyon sayaçları.
- Yinelenen bölüm/revizyon anahtarları için fail-closed red.
- Renderer'da yalnız yüklü bölümde tek kayıt ekleme/güncelleme/kaldırma.
- Tam snapshot uygulayan eski `applyFullSnapshot` mutasyon yolu kaldırıldı.
- Eski use-case/repository doğrulamalarında snapshot okuması açık ayrı sorguya
  dönüştürüldü.

## Hedefli doğrulama

- Bounded mutation contract: **PASS — 54/54**
- Mutation revision runtime: **PASS — 10/10**
- Syntax and IPC parity: **PASS — 7/7 files, 183/183 channels**
- Controlled TypeScript: **PASS — 2/2**

Bu sürüm Bronze RC2 Final, Code Freeze, Silver veya Gold değildir.
