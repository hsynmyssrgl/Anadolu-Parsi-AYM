# Panthera pardus tulliana — Bronze MVP-36

Sürüm: 21.07.2026.36  
Aşama: MVP-36

## Değişiklikler

- Renderer için ortak UI bileşen katmanı eklendi (`ui.tsx`).
- PageHeader, Button, EmptyState ve Modal bileşenleri ana uygulama dosyasından ayrıştırıldı.
- Yeni Surface, SectionHeader, StatRow ve StatusMessage bileşenleri eklendi.
- Otomasyon ekranı ortak yüzey, bölüm başlığı, istatistik satırı ve erişilebilir durum mesajlarına geçirildi.
- Raporlama ekranı ortak yüzey ve istatistik satırı bileşenlerine geçirildi.
- Modal sürüm etiketi sabit eski MVP değerinden ortak APP_META kaynağına bağlandı.
- Boş durum ve hata/başarı mesajlarına erişilebilir `role` tanımları eklendi.
- Ortak bileşenlerin görsel kuralları merkezi CSS katmanına eklendi.

## Doğrulama

- TypeScript kontrolü: başarılı
- Otomatik testler: 34/34 başarılı
- Electron main/preload derlemesi: başarılı
- React/Vite üretim derlemesi: başarılı
- Windows installer ön doğrulaması: başarılı
- npm güvenlik denetimi: 0 açık
