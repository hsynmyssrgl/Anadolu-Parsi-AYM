# Bronze RC2 Build 137 Sürüm Notları

- Application Version: `28.07.2026.137`
- Package Version: `28.7.2026-137`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Kalıcı imha sonrasında kritik öncelikli `backup.propagation` görev kuyruğu.
- Etkin yönetilen her yedek hedefinde retention devre dışıyken yeni şifreli tam yedek oluşturma.
- Yeni yedeğin dosya okuma sonrası SHA-256 doğrulaması ve başarılı çalışma kaydı zorunluluğu.
- Yalnız başarılı `backup_runs` kayıtlarına bağlı eski yönetilen yedek yollarının işlenmesi.
- Eski yönetilen yedeklerin `.purge-quarantine/<işlem-kimliği>/` altında atomik ve geri alınabilir karantinaya taşınması.
- Hata sırasında taşınan dosyaları eski konumlarına geri alan rollback akışı.
- Dosya adı, boyut, SHA-256 ve açık kayıt kimliği içermeyen tombstone parmak izlerini taşıyan dayanıklı manifest.
- Hedef ve dosya yolu sınırı doğrulaması; taze yedeğin karantinaya alınmasının engellenmesi.
- Manuel/yönetilmeyen `.pptbackup` dosyalarına dokunmama ve aktif kopya varsa hedefi başarısız sayma.
- Tüm etkin hedefler başarıyla tamamlanmadan `backupPropagationPending` işaretini kapatmama.
- Tombstone kapanışında `updatedAt` tabanlı karşılaştırmalı güncelleme ve eşzamanlı değişiklik reddi.
- Hedef bazlı taze yedek, karantina ve yönetilmeyen kopya sonuç geçmişi.
- Güvenlik ve Ayarlar ekranında yayılım başlatma ve çalışma geçmişi görünümü.

## Sınır

Karantina fiziksel imha değildir. Karantina saklama/nihai imha süresi, manuel
kopyalar, çevrimdışı medya, snapshotlar ve bulut sürüm geçmişi ayrı hukuk,
gizlilik ve promotion kapısıdır.

## Kaynak doğrulaması

- Build 137 sözleşmesi: **PASS — 78/78**
- Yönetilen yayılım runtime: **PASS — 37/37**
- Renderer/bridge söz dizimi: **PASS — 3/3**
- Ağır derleme, tam test ve Windows/installer kapıları: **NOT_RUN**
