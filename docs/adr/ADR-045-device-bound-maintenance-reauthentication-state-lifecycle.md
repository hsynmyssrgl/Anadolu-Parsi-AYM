# ADR-045 — Cihaz bağlı bakım yeniden doğrulama durumu yaşam döngüsü

## Bağlam

Build 171 başarısız bakım yeniden doğrulama denemelerini ve geçici kilidi Electron `safeStorage` ile işletim sistemi koruması altında kalıcılaştırdı. Ancak koruma hizmetinin geçici olarak kullanılamaması, profilin başka cihaza taşınması, koruma sağlayıcısının değişmesi ve eski şema kaydının yükseltilmesi ayrı sonuçlar olarak sınıflandırılmıyordu. Ayrıca aktif kayıt ve süre aşımıyla budanan karantina dosyaları yalnız normal silme ile kaldırılıyordu.

## Karar

- Yeni yazımlar şema 2 korunan zarf kullanır.
- Zarf yalnız cihaz kimliği ve açık anahtar parmak izinden üretilen SHA-256 cihaz bağlama özetini içerir; ham cihaz kimliği veya parmak izi yazılmaz.
- Aynı işletim sistemi koruma sağlayıcısı ve aynı cihaz bağlama özeti doğrulanmadan payload açılmaz.
- Koruma hizmeti geçici olarak kullanılamadığında geçerli dosya karantinaya alınmaz, değiştirilmez veya silinmez; bakım işlemleri çalışma zamanı boyunca fail-closed toparlanma kilidine alınır.
- Farklı cihaz bağlamı, farklı koruma sağlayıcısı, çözülemeyen şifreli payload, bütünlük hatası veya şema hatası ayrı sınıflandırılır ve kayıt karantinaya alınır.
- Şema 1 kayıtları geriye uyumlu olarak açılır ve başarılı yüklemeden hemen sonra şema 2 cihaz bağlı zarfa yeniden yazılır.
- Aktif kayıt açıkça temizlendiğinde ve karantina saklama sınırı aşıldığında dosya, boyut sınırı içinde rastgele veriyle üzerine yazma, `fsync` ve kaldırma adımlarıyla en iyi çaba güvenli silme işleminden geçirilir.
- Güvenli silme, SSD denetleyicisi veya dosya sistemi düzeyi fiziksel yok etmeyi garanti ettiği iddiasında bulunmaz; kriptografik koruma asıl gizlilik sınırıdır.

## Sonuçlar

- Geçici koruma kesintisi güvenli durumu yok etmez ve yeniden başlatma yoluyla kilit aşma fırsatı oluşturmaz.
- Yalnız runtime-state klasörünün başka cihaza kopyalanması aktif kilit kaydını o cihazda kabul ettirmez.
- Eski Build 171 kayıtları veri kaybı olmadan şema 2'ye taşınır.
- Ret, taşıma ve anahtar değişikliği olayları hassas kimlik bilgisi taşımayan sınıflandırmalarla denetlenebilir.
