# ADR-049 — Güvenlik Dönemine Bağlı Oturum, Cihaz Yeniden Yetkilendirme ve İmzalı Makbuz

- Durum: Kabul edildi
- Tarih: 30.07.2026
- Build: 176

## Bağlam

Build 175 bakım kilidi kurtarması sonrasında hesap güvenlik dönemini ilerletmiş ve eski güvenilir cihaz kayıtlarını iptal etmiştir. Ancak yalnız cihaz kayıtlarını iptal etmek yeterli değildir: kurtarma öncesinde açılmış bir uygulama oturumu bellekte yaşamaya devam ederse, sonraki korunan işlemlerde yeni güvenlik dönemini taşımadan kullanılma riski oluşur. Ayrıca cihazın yeniden güvenilir yapılması kullanıcıya ve denetim zincirine doğrulanabilir bir güvenlik olayı kanıtı bırakmalıdır.

## Karar

1. Her kimlik doğrulama oturumu, açıldığı anda hesabın güncel `security_epoch` değeriyle bağlanır.
2. Korunan veri veya bakım işleminden önce oturum dönemi hesap dönemiyle karşılaştırılır. Eşleşmeyen oturum temizlenir ve yeniden giriş zorunlu tutulur.
3. Bakım kurtarması sonrası cihaz yeniden yetkilendirmesi ayrı bir use-case üzerinden yürütülür. Geçerli oturum, güncel dönem, parola, etkinse ikinci faktör, cihaz özel anahtar kanıtı ve tam onay ifadesi birlikte doğrulanır.
4. Yeniden yetkilendirme yalnız güncel dönemde yeni güvenilir cihaz kaydı oluşturur; eski dönem kaydı canlandırılmaz.
5. Başarılı işlem için Ed25519 imzalı, kanonik ve değişikliğe duyarlı bir güvenlik olayı makbuzu üretilir.
6. Makbuz ham hesap kimliği içermez; ad alanlı SHA-256 hesap parmak izi, cihaz parmak izi, güvenlik dönemi, denetim kimliği, zaman ve imza taşır.
7. Makbuzdaki alan, hash veya imza değişikliği doğrulamayı geçersiz kılar.

## Güvenlik sonuçları

- Kurtarma öncesi oturumlar veri katmanına erişmeden reddedilir.
- Yeniden yetkilendirme parola veya ikinci faktörü kalıcılaştırmaz.
- İmza için mevcut OS korumalı cihaz özel anahtarı kullanılır; özel anahtar makbuza veya renderer'a taşınmaz.
- Ham hesap kimliği renderer makbuzunda veya dışa aktarılabilir makbuz içeriğinde bulunmaz.
- SQL güvenilir cihaz yazımı tam sütun/yer tutucu eşleşmesiyle düzeltilmiştir; `security_epoch` yanlış alana kayamaz.

## Sınırlamalar

Bu karar kaynak ve izole runtime davranışını kapsar. Temiz bağımlılık kurulumu, tam test zinciri, paketli Electron çalışması ve gerçek Windows kurulum/yeniden başlatma kampanyası ayrıca tamamlanmalıdır.
