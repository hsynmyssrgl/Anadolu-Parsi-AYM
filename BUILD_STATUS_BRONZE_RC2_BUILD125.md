# Bronze RC2 Build 125 Durum Kaydı

- Application Version: `27.07.2026.125`
- Package Version: `27.7.2026-125`
- Stage: **Bronze RC2 Active Development**
- Next: **Build 126 Active Development**

Build 125, zaman tüneli ve önemli günler modüllerini yalnız görüntüleyen
ekranlar olmaktan çıkarıp tamamlanmış bir kayıt yaşam döngüsüne bağlar:

- Başlık, açıklama, tarih-saat, konum, gizlilik, katılımcılar, davetiye,
  notlar, tekrar, hatırlatma ve yapay zekâ izni tek pencereden düzenlenir.
- Zaman tüneli başlık, açıklama, konum ve notlarda aranabilir.
- Kişi, olay türü ve yıl filtreleri birlikte kullanılabilir.
- Etkinlikler veri kaybetmeden arşivlenir ve geri alınabilir.
- Aktif zaman tüneli arşivlenmiş kayıtları göstermez.
- Olay ile ona bağlı doküman arşivi arasında doğrudan geçiş korunur.
- Migration 15 mevcut etkinliklere güncelleme ve arşiv zamanlarını ekler.
- Yetki, application/use-case, repository ve IPC sınırları korunur.

Temiz resmî kurulum, tam TypeScript, 60 test, production build, Bronze smoke
zinciri, 42 maddelik Build 125 sözleşmesi ve NSIS installer üretimi geçti.
Tarayıcı ön izlemesinde filtreler, olay oluşturma ve tüm alanları düzenleme
gerçek etkileşimle doğrulandı. Resmî development ve paketli Windows açılışı bu
yönetilen hostta GPU alt süreç hatasıyla başarısızdır. Installer imzasızdır.
Bronze RC2 Final ilan edilmedi.
