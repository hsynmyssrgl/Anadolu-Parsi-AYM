# Bronze RC2 Build 138 Sürüm Notları

- Application Version: `28.07.2026.138`
- Package Version: `28.7.2026-138`
- Stage: **Bronze RC2 Active Development**

## Eklenenler

- Varsayılan 90 günlük operasyonel yedek karantina saklama politikası.
- Karantina grubu bazında hukuki/koruma bekletmesi.
- Aile yöneticisi. parola ve etkinse TOTP ile güçlü yeniden doğrulama.
- `KARANTİNA İMHA <batchId>` kesin onay metni.
- `retained → destroying → destroyed` karşılaştırmalı yaşam döngüsü.
- Manifest boyut ve SHA-256 doğrulamalı dosya imhası.
- Atomik `.destroying-*` sahiplenmesi ve dayanıklı işlem durumu.
- Yarım işlemi devam ettirme ve içeriksiz idempotent imha makbuzu.
- Güvenlik ve Ayarlar ekranında politika. bekletme ve nihai imha yönetimi.

## Sınır

90 gün yasal saklama tavsiyesi değildir. Tek geçişli sıfır yazma + `fsync` +
unlink. SSD/snapshot/bulut/çevrimdışı kopyalar için mutlak fiziksel imha kanıtı
değildir. Gerçek Windows ve sağlayıcı kanıtları ayrı promotion kapısıdır.

## Hedefli kaynak doğrulaması

- Sözleşme: **PASS — 106/106**
- Runtime: **PASS — 36/36**
- Renderer/bridge sözdizimi: **PASS — 3/3**
- Kaynak preflight: **PASS — 33/33**
- Kaynak bütünlüğü: **PASS — 1.136/1.136; 1.137 SHA-256 girdisi**
- Ağır derleme. tam test ve Windows/installer kapıları: **NOT_RUN**
