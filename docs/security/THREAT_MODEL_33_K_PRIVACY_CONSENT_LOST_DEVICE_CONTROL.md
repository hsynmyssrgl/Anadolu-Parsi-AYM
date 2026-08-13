# 33-K / DEC-222 tehdit modeli — gizlilik, süreli rıza ve kayıp cihaz kapatma

Bu model B5-06 ve EXT-039 gereksinimlerini CentralAuthorizationService sınırında bağlar.

Korunan varlıklar hesap otoritesi, security_epoch, trusted_devices, çevrimdışı lease hash'leri, hassas rıza kayıtları ve audit zinciridir.

- Örtük veya süresiz rıza: varsayılan ret, explicitConsent ve 15–43.200 dakika sınırıyla engellenir. Süresi dolan kayıt değerlendirme anında aktif sayılmaz; etkinlik göstergesi kapanır.
- Rıza replay/bypass: tam IPC nesne allowlist'i ve merkezi PEP kullanılır; doğrudan rol kontrolü yazma yetkisi sağlamaz.
- Başka hesaba ait cihazın kapatılması: hedef aktif trusted_devices satırı mevcut oturum hesabının aynı transaction snapshot'ında aranır.
- Eski oturum yarışı: güçlü doğrulamadan sonra UoW içinde session security_epoch tekrar kontrol edilir; epoch ilerletme, tüm cihaz güvenleri, lease'ler, rızalar ve audit aynı transaction'dadır.
- Bozuk lease iptali: platform-policy `revokeOfflineCapabilityLease` mevcut hash'i doğrular ve iptal hash'ini yeniden üretir; hata transaction'ı geri alır.
- Hassas içerik sızıntısı: audit yalnız eylem, kaynak kimliği, aktör ve zaman içerir; konum veya kimlik bilgisi içeriği yazılmaz.
- Yanlış uzaktan etki iddiası: çıktı `scope=local_authority_only`, `remoteWipePerformed=false`, `mdmOperationPerformed=false`, `networkDelivery=not_performed` taşır. Ağ/MDM/silme kanalı yoktur.

Artık risk: kayıp cihaz çevrimdışı kalırsa daha önce cihaz dışında kopyalanmış kullanıcı verisinin fiziksel silinmesi garanti edilemez. Epoch ve kira kontrolünü yeniden değerlendiren yerel erişimler fail-closed olur; ağ teslim zamanlaması iddia edilmez.
