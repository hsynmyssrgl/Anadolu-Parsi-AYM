# Panthera pardus tulliana — Bronze MVP-28

Sürüm: 21.07.2026.28

## Tamamlananlar
- Sağlık grafiğinde 7, 30, 90 ve 365 günlük zaman aralığı seçimi.
- Performans anomalilerinde 24 saat, 7 gün ve 30 günlük değerlendirme aralığı.
- İki tanılama raporunun sağlık puanı, sistem durumu ve üst düzey bölümler bakımından karşılaştırılması.
- Tanılama olay arşivlerinin SHA-256 doğrulamasından sonra geri yükleme yapılmadan okunması.
- Arşiv içeriğinin uygulama içinde salt okunur önizlenmesi.
- maintenance.integrity_check, maintenance.wal_checkpoint, maintenance.analyze ve maintenance.vacuum görevlerinin gerçek SQLite bakım işlemlerine bağlanması.
- Yeni Electron IPC, preload API ve renderer türleri.

## Doğrulama
- TypeScript: başarılı
- Otomatik testler: 29/29 başarılı
- Electron üretim derlemesi: başarılı
- React/Vite üretim derlemesi: başarılı
