# Panthera pardus tulliana — Bronze MVP-25

Sürüm: 21.07.2026.25

## Tamamlananlar
- 0–100 aralığında sistem sağlık puanlama modeli
- Mükemmel, iyi, dikkat ve kritik sağlık dereceleri
- Veritabanı bütünlüğü, sistem durumu, bellek baskısı, başarısız yedekler, uzun görevler ve aktif bildirimlere göre puan kesintileri
- Tanılama olaylarında metin, önem seviyesi, olay kodu ve tarih aralığı filtreleri
- Filtre sonuçlarının güvenli limitlerle listelenmesi
- Dışa aktarılan tanılama raporlarının kalıcı geçmişe kaydedilmesi
- Rapor dosyası, oluşturulma zamanı, boyut, SHA-256 ve sağlık puanının saklanması
- Aktif sağlık bildirimlerinden otomatik yüksek/kritik öncelikli görev oluşturulması
- Aynı açık bildirim için yinelenen görev üretiminin engellenmesi
- Sistem Yönetimi ekranında sağlık puanı, puan kesintileri, filtreli olay günlüğü ve rapor geçmişi görünümü
- Electron IPC, preload ve renderer türlerinin MVP-25 kapsamına genişletilmesi

## Doğrulama
- TypeScript: başarılı
- Vitest: 4/4 test dosyası, 26/26 test başarılı
- Sistem sağlık puanı testi: başarılı
- Tanılama filtreleme testi: başarılı
- SHA-256 rapor geçmişi testi: başarılı
- Electron ana süreç derlemesi: başarılı
- React/Vite üretim derlemesi: başarılı
