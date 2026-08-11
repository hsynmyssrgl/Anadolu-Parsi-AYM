# Bronze RC2 Build 121 Sürüm Notları

- Application Version: `25.07.2026.121`
- Package Version: `25.7.2026-121`
- Stage: **Bronze RC2 Active Development**

## Düzeltilenler

- Windows `path.join()` çıktılarının lockfile anahtarlarıyla karşılaştırılmasındaki ayırıcı uyumsuzluğu giderildi.
- Aktif sürüm sözleşmesinin Windows’ta 14 workspace girdisini yanlış biçimde eksik sayması engellendi.
- Güvenli sürüm artırıcının Windows’ta workspace lockfile sürümlerini atlaması engellendi.

## Eklenenler

- Güvenli, repository-relative ve ileri eğik çizgili ortak workspace yol normalizasyonu
- Mutlak yol, traversal, boş segment ve nokta segmenti reddi
- Windows ve POSIX yol biçimlerini kapsayan bağımlılıksız regresyon sözleşmesi
- Build 121 mimari entegrasyon kapısı
- TypeScript 7 için kaldırılmış `baseUrl` seçeneğinin temizlenmesi ve alias yollarının açık göreli biçime geçirilmesi
- TypeScript compiler’ının Windows `.cmd` başlatma davranışından bağımsız Node entrypoint çözümlemesi
- `@ppt/core` production build’inde gerekli Node tiplerinin açıkça tanımlanması

Bu sürüm Bronze RC2 Active Development aşamasındadır. Final, Code Freeze, Silver veya Gold değildir.
