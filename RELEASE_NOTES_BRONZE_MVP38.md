# Panthera pardus tulliana — Bronze MVP-38

Sürüm: 21.07.2026.38

## Güvenlik sertleştirmesi
- Denetim kayıtları SHA-256 bağlı kayıt zincirine geçirildi.
- Her kayıt önceki kaydın özetini, işlem sahibini ve kendi bütünlük özetini taşır.
- Eski denetim kayıtları ilk geçişte geriye dönük olarak zincire alınır; mevcut zincir sonradan sessizce yeniden yazılmaz.
- Denetim zinciri bütünlüğünü doğrulayan servis ve Ayarlar ekranı işlemi eklendi.
- Veritabanında sonradan değiştirilmiş bir denetim kaydının tespiti otomatik testle doğrulandı.
- Denetim listesinde işlem sahibi ve kayıt özeti alanları desteklendi.

## Doğrulama
- TypeScript kontrolü başarılı.
- 4 test dosyasında 38/38 test başarılı.
- Electron ve React üretim derlemeleri başarılı.
- Windows installer ön doğrulaması başarılı.
