# Sürüm Notları — Bronze RC2 Build 124

## Yeni ürün kimliği

- Uygulama adı **Anadolu Parsı Aile Yaşam Merkezi** olarak değiştirildi.
- Windows app id, ürün adı, kısayol adı ve varsayılan kurulum klasörü yeni
  kimliğe bağlandı.
- Lisans, yedek, PDF ve dışa aktarma dosya adları güncellendi.
- Yeni özgün SVG/PNG/ICO marka simgesi üretildi ve uygulama ile installera
  bağlandı.

## Güvenli veri geçişi

- Üretim veritabanı başlangıcında sentetik seed kapalı kalır.
- Eski ürün veri dizini silinmez; yeni dizin yoksa güvenli biçimde kopyalanır.
- Migration 14 yalnız bilinen sabit demo kimliklerini temizler.
- Demo hesaba bağlı yerel hesap varsa önce gerçek yerel kişi kaydı oluşturulur;
  hesap bağı kopmadan korunur.
- Kullanıcının demo dışı kişi, olay ve içerik kayıtlarına dokunulmaz.

## Tamamlanan menüler

- Soy Ağacı: nesil, dal ve bütünlük analizleri görünür oldu.
- Arşiv: kategori oluşturma işlemi eklendi.
- Ayarlar: güvenlik, tam/DB yedek, geri yükleme, parola, 2FA, güvenilen cihaz
  ve audit işlemleri bağlandı.
- Bildirim ve Otomasyon: kuralları şimdi çalıştırma ve koşu geçmişi eklendi.
- Raporlama: sistem PDF raporu üretimi eklendi.
- Yetkiler: profil rolü ve hesap durumu yönetimi eklendi.
- Eski “sonraki sürümde” ve “Silver kapsamı” boş ekran metinleri kaldırıldı.

## Arayüz

- Formlar, kartlar, paneller, modallar, düğmeler, odak halkaları, kaydırma
  çubukları ve boş durumlar ortak Apple-esintili tasarım diline taşındı.
- Koyu ve açık tema davranışı korunur.

Bu sürüm Bronze RC2 Active Development kapsamındadır; Final değildir.
