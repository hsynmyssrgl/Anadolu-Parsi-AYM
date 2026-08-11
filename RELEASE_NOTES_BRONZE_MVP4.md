# Bronze MVP-4 — 21.07.2026.4

Bu sürüm dijital arşiv ve yerel işletim güvenliğini güçlendirir.

## Eklenenler
- Arşiv dosyalarının AES-256-GCM ile şifreli kasada saklanması
- Cihaza özel 256 bit kasa anahtarı
- Arşiv dosyası açılırken geçici çözme ve SHA-256 bütünlük doğrulaması
- Parola değiştirme
- Tam şifreli `.pptbackup` yedeği: SQLite veritabanı, kasa anahtarı ve şifreli arşiv içerikleri
- Ayrı veritabanı yedeği
- Son denetim kayıtlarını görüntüleme
- Hassas veri işlemlerinde açık oturum zorunluluğu

## Temel doğrulama
- TypeScript kontrolü başarılı
- Electron ana süreç derlemesi başarılı
- React/Vite üretim derlemesi başarılı

Kapsamlı test kampanyası ve ekran görüntüleri, tüm kodlama tamamlandığında topluca gerçekleştirilecektir.
