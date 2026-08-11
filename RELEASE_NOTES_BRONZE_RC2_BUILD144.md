# Sürüm Notları — Bronze RC2 Build 144

## Eklenenler

- Kök güven sağlayıcısına bağlı HTTPS uç noktası profili
- Birincil ve isteğe bağlı geçiş TLS SPKI SHA-256 pini
- En fazla 14 günlük çift-pin geçiş penceresi
- En fazla 90 gün ileri tarihli geçiş planlaması
- Güçlü doğrulamalı profil oluşturma, güncelleme ve devre dışı bırakma
- Geçerli pin kümesinin ana süreçte zamana göre çözümlenmesi
- Son güvenli alım başarısı veya hatasının kalıcı kaydı
- Güvenlik ve Ayarlar ekranında profil/pin yönetimi

## Güvenlik davranışı

Profil devre dışıysa, sağlayıcı iptal edilmişse veya o anda geçerli pin yoksa ağ
bağlantısı kurulmaz. TLS pin eşleşmesi yalnız taşıma kanalını doğrular; belge yine
Ed25519 imza, sıra numarası ve geçerlilik penceresi kontrollerinden geçer.

## Ertelenenler

Gerçek sağlayıcı endpoint’i, gerçek sertifika değişimi, periyodik otomatik
senkronizasyon, Electron production build ve Windows installer testleri bu ara
derlemede çalıştırılmadı.
