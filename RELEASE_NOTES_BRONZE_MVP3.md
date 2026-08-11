# Bronze MVP-3 — 21.07.2026.3

Bu sürümde gerçek kaynak koda eklenenler:

- İlk çalıştırmada aile yöneticisi hesabı oluşturma
- Scrypt tabanlı parola özeti ve güvenli parola doğrulama
- E-posta/parola ile yerel oturum açma ve oturum kapatma altyapısı
- Eski verileri koruyan accounts ve archive_items SQLite göçleri
- Soy ağacında iki kişi arasında ebeveyn, eş, kardeş, vasi veya diğer ilişki oluşturma
- Yinelenen ilişki ve kişinin kendisiyle ilişkilendirilmesi kontrolleri
- Dijital arşive yerel dosya kopyalama
- 250 MB dosya sınırı
- Dosya boyutu, özgün dosya adı ve SHA-256 bütünlük özeti
- Arşiv kaydını önemli güne bağlama ve olay içerik sayısını güncelleme
- İlk kurulum, giriş, ilişki ekleme ve arşiv kullanıcı arayüzleri

Temel doğrulama:
- TypeScript: başarılı
- Üretim derlemesi: başarılı
- Mevcut testler: 9/9 başarılı

Not: Arşiv dosyaları bu Bronze sürümünde yerel uygulama alanına kopyalanır ve SHA-256 ile doğrulanır. Dosya içerik şifrelemesi sonraki güvenlik dilimindedir.
