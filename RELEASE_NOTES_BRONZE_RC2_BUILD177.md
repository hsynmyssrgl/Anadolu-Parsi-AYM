# Sürüm Notları — Bronze RC2 Build 177

## Yeni

- Sol menüye ayrı **Güvenlik Merkezi** hedefi eklendi.
- Güvenlik Merkezi profil menüsünden doğrudan açılabilir hale getirildi.
- Komut paleti güvenlik ekranını aranabilir ve klavyeyle açılabilir hedef olarak gösterir.
- Kurtarma sonrası cihaz yeniden yetkilendirmesi gerekiyorsa Güvenlik Merkezi menüsünde dikkat işareti gösterilir.
- Route, ekran etiketi, yeniden yetkilendirme onayı ve buton hazır olma politikası merkezi renderer modülüne taşındı.
- Yeniden yetkilendirme düğmesi parola, 2FA kodu ve tam onay metni olmadan etkinleşmez.

## Düzeltme

- Güvenlik ve yedekleme bileşeni Sistem ve Bakım ekranının içinden çıkarılarak ayrı route'a bağlandı.
- Erişilebilirlik durumu ve güncelleme callback'i `SettingsSecurity` bileşeninin açık prop sözleşmesine eklendi.
- Build 176 devamlılık doğrulayıcıları, merkezileştirilen onay sabitini kabul edecek biçimde güncellendi; güvenlik davranışı zayıflatılmadı.

## Menüden erişilen gerçek işlemler

- Parola değiştirme ve 2FA yönetimi
- Güvenilir cihaz kaydı, iptali ve kurtarma sonrası yeniden yetkilendirme
- Ed25519 imzalı güvenlik olayı makbuzunun görüntülenmesi/kopyalanması
- Denetim kayıtlarının listelenmesi ve hash zinciri doğrulaması
- Parola korumalı yedek, yedek inceleme ve geri yükleme
- Aile verisi içe aktarma ve kontrollü geri alma
- Veri saklama, arşivleme, imha, karantina ve dış yedek kanıtı yönetimi
- Yerel erişilebilirlik tercihleri
