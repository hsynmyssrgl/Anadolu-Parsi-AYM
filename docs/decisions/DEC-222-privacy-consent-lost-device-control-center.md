# DEC-222 — Gizlilik, süreli rıza ve kayıp cihaz kapatma merkezi

Durum: Aktif uygulama (33-K)

B5-06 ve EXT-039 tek bir yönetilen işlem paketiyle ele alınır. Canlı konum paylaşım yetkisi varsayılan kapalıdır; açılması açık kullanıcı rızası ve 15 dakika ile 30 gün arasında sonlu süre gerektirir. Etkin durum görünür gösterilir, süre değerlendirme anında otomatik biter ve kullanıcı rızayı derhal iptal edebilir. Her değişiklik içeriksiz audit kaydı üretir. Bu karar gerçek bir konum aktarım kanalı eklemez.

Kayıp cihaz kapatma; güçlü yerel doğrulama, güncel oturum security_epoch kontrolü ve hedef trusted_devices kaydının aynı hesaba ait olduğunun doğrulanmasından sonra tek merkezi UoW içinde hesap security_epoch değerini ilerletir, etkin güvenilir cihazları, ilgili çevrimdışı kiraları ve verilmiş rızaları iptal eder. Başarılı commit sonrasında mevcut yerel oturum temizlenir.

Yetkilendirme yalnız merkezi PEP (`CentralAuthorizationService`) üzerinden yapılır; doğrudan rol bypass'ı yoktur. Mevcut migration 88 şeması ve `trusted_devices`, `offline_capability_leases`, `ai_consents`, `accounts.security_epoch`, audit altyapısı yeniden kullanılır.

Bu sınır uzaktan silme değildir, MDM değildir ve kayıp cihaza ağ üzerinden komut teslimi veya teslim alındısı garantisi vermez. Sonuç yalnız yerel otorite ve sonraki yerel doğrulamalarda fail-closed etkidir.
