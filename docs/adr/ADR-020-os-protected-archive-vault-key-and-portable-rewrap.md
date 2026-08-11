# ADR-020 — İşletim sistemi korumalı arşiv kasa anahtarı ve taşınabilir yeniden sarma

- Durum: Kabul edildi
- Tarih: 28.07.2026
- Build: 135
- Karar: DEC-049

## Bağlam

Arşiv dosyaları uygulama kasasında şifreli tutulmasına rağmen bu dosyaları açan
32 baytlık kasa anahtarı yerel dosyada açık ikili veri olarak bulunuyordu. Dosya
izinleri tek başına cihaz ele geçirilmesi, yanlış yedekleme veya başka kullanıcı
bağlamından okuma riskine karşı yeterli değildi. Anahtarı doğrudan DPAPI zarfına
çevirmek ise tam yedeğin başka bir Windows cihazına taşınmasını bozabilirdi.

## Karar

1. Yerel kasa anahtarı `archive-vault-key` amaçlı sürüm 2 korumalı zarfta tutulur.
2. Zarf Electron `safeStorage` sağlayıcı kimliği, Base64 şifreli anahtar, SHA-256
   bütünlük özeti ve oluşturma zamanını içerir.
3. Legacy 32 bayt açık dosya aynı anahtar korunarak atomik biçimde dönüştürülür.
   Dönüşüm sırasında geri alma kopyası tutulur ve yarım işlem açılışta kurtarılır.
4. Koruma kullanılamıyorsa, sağlayıcı kimliği eşleşmiyorsa veya anahtar özeti
   doğrulanmıyorsa uygulama fail-closed durur.
5. Arşiv okuma/yazma adaptörü anahtarı yalnız korumalı sağlayıcı üzerinden alır.
6. Tam yedek oluşturma sırasında sağlayıcı ham anahtarı bellekte dışa verir; ham
   değer yalnız AES-256-GCM ile şifrelenmiş yedek payload’ına girer.
7. Geri yükleme staging aşamasında taşınabilir ham anahtar hedef cihazın
   `safeStorage` sağlayıcısıyla yeniden sarılır. Eski cihazın DPAPI zarfı kopyalanmaz.
8. Dosya yolu ile sağlayıcı yolu eşleşmiyorsa işlem reddedilir.

## Sonuçlar

Yerel kasa anahtarı açık diskte tutulmaz ve tam yedek başka cihaza taşınabilir
kalır. Mevcut arşiv dosyalarının içerik şifreleme biçimi değişmez; aynı anahtar
migrasyon boyunca korunur. Gerçek Windows DPAPI oluşturma, legacy migration,
yedek alma ve farklı cihazda yeniden sarma testleri çalıştırılmadan Windows
promotion kapısı PASS sayılmaz.
