# Bronze MVP-7 — 21.07.2026.7

## Eklenenler
- Çok kullanıcılı aile hesabı modeli
- Aile yöneticisi, yetişkin üye, sınırlı üye, bakım veren ve danışman rolleri
- Başlangıç ve bitiş tarihli süreli üyelik
- Tek kullanımlık, özeti saklanan güvenli davet kodu
- Davet kabulüyle parola belirleyerek hesap etkinleştirme
- Bekleyen, kabul edilen, iptal edilen ve süresi dolan davet durumları
- Yönetici tarafından hesap rolü, durum, kişi bağlantısı ve üyelik süresi güncelleme
- Nesne düzeyi allow/deny izin kayıtları
- read, create, update, delete ve share eylemleri
- Süreli nesne izinleri
- Davet, üyelik ve izin işlemleri için denetim günlüğü
- Electron IPC ve güvenli preload API bağlantıları

## Doğrulama
- TypeScript: başarılı
- Otomatik test: 13/13 başarılı
- Electron üretim derlemesi: başarılı
- React/Vite üretim derlemesi: başarılı

## Sonraki dilim
- Hesap, davet ve izin yönetiminin gerçek arayüz ekranlarına bağlanması
- Veri sorgularında nesne düzeyi izinlerin uygulanması
- Üyelik geçmişi ve davet geçmişi görünümü
