# Sürüm Notları — Bronze RC2 Build 123

## Yeni uygulama kabuğu

- Ana gezinme; Ana Merkez, Aile Hafızası, Yaşam ve Gizlilik ve Sistem
  bölümlerine ayrıldı.
- Kenar menüsü daraltılabilir hâle getirildi; tercih cihazda saklanır.
- Açık ve koyu görünüm eklendi; seçim cihazda saklanır.
- Komut araması eklendi. Kullanıcı `Ctrl+K` veya `Ctrl+F` ile modül arayıp
  doğrudan açabilir.
- Bildirim düğmesi gerçek kayıtları gösterir ve okundu işaretleyebilir.
- Yerel profil menüsü ayarlara geçiş, tema değişimi ve çıkış işlemlerini yapar.
- Aile seçici artık yanıltıcı, işlevsiz bir yüzey değildir; tek yerel aile
  alanını açıkça tanımlar.

## Düzeltilen işlevsiz kontroller

- Soy ağacındaki ilişki ekleme düğmesi gerçek forma bağlandı.
- Yakınlaştır, uzaklaştır ve sıfırla kontrolleri çalışır hâle getirildi.
- Arama, profil ve bildirim alanları `div` görünümünden erişilebilir düğmelere
  dönüştürüldü.

## Korunan düzeltmeler

- Uygulama kapanırken yok edilmiş `webContents` nesnesine erişilmesini önleyen
  Build 122 düzeltmesi korunur ve regresyon sözleşmesiyle doğrulanır.

Bu sürüm Bronze RC2 Active Development kapsamındadır; Final değildir.
