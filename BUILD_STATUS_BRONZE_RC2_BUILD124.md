# Bronze RC2 Build 124 Durum Kaydı

- Application Version: `27.07.2026.124`
- Package Version: `27.7.2026-124`
- Stage: **Bronze RC2 Active Development**
- Next: **Build 125 Active Development**

Build 124 doğrudan kullanıcının gördüğü ve kullandığı ürünü yeniler:

- Ürün adı **Anadolu Parsı Aile Yaşam Merkezi** oldu.
- Kurulum kimliği, kısayol, yerel veri yolu, lisans, yedek ve dışa aktarma
  adları yeni kimliğe taşındı.
- Eski kullanıcı verisi silinmeden yeni veri yoluna kopyalanabilir.
- Yeni özgün uygulama simgesi ve marka işareti eklendi.
- Üretim başlangıcı sentetik veri oluşturmuyor.
- Bilinen sabit demo profilleri migration 14 ile mevcut veritabanlarından
  temizleniyor; gerçek kullanıcı kayıtları korunuyor.
- Soy ağacı analizleri, arşiv kategorileri, güvenlik/yedek merkezi, 2FA ve
  güvenilen cihazlar, otomasyon çalıştırma geçmişi, PDF raporu ve profil
  yetkilendirme işlemleri gerçek ekranlara bağlandı.
- Ortak Apple-esintili kontrol ve yüzey dili tüm modül formlarına yayıldı.

Temiz kurulum, tam TypeScript, 59 test, production build, smoke zinciri ve NSIS
installer üretimi geçti. Paketli açılış probu bu yönetilen Windows hostunda GPU
alt süreç hatasıyla başarısızdır. Installer imzasızdır. Bronze RC2 Final ilan
edilmedi.
