# Panthera pardus tulliana — Bronze MVP-21

Sürüm: 21.07.2026.21

## Tamamlanan geliştirmeler

- Hedef bazında manuel, saatlik, günlük, haftalık ve aylık yedekleme zamanlaması
- Bir sonraki çalışma zamanının kalıcı olarak tutulması
- Hedef bazında 0–5 otomatik yeniden deneme
- Aynı hedef için eşzamanlı yedek çalıştırmayı engelleme
- Hedef dizininde yazma izni ve boş alan kontrolü
- SHA-256 ile yedek bütünlük doğrulaması
- Son N başarılı yedeği koruyan saklama rotasyonu
- Süresi geçen yedek dosyalarının ve çalışma kayıtlarının temizlenmesi
- Zamanı gelen yedek hedeflerini toplu çalıştıran zamanlayıcı çekirdeği
- Donanım profilini düşük, dengeli veya yüksek olarak sınıflandıran Adaptif Kaynak Yöneticisi
- CPU veya bellek baskısında arka plan yedeklerini erteleme
- Dinamik eşzamanlı görev kapasitesi
- Zamanlayıcı ve adaptif kaynak durumu için Electron IPC/preload API'leri

## Doğrulama

- TypeScript: başarılı
- Otomatik testler: 24/24 başarılı
- Electron ana süreç derlemesi: başarılı
- React/Vite üretim derlemesi: başarılı
