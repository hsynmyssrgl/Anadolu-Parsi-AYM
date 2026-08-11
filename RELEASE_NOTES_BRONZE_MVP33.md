# Panthera pardus tulliana — Bronze MVP-33

Sürüm: 21.07.2026.33  
Kanal: Bronze  
Aşama: MVP-33

## Eklenenler

- Tam yedek biçimi v2'ye yükseltildi.
- Veritabanı, dijital kasa anahtarı ve her arşiv girdisi için ayrı SHA-256 bütünlük kaydı eklendi.
- Arşiv girdilerine boyut doğrulaması eklendi.
- Geri yükleme öncesinde mevcut verilere dokunmadan çalışan `inspectFullBackup` ön incelemesi eklendi.
- Bozuk manifest, veritabanı, anahtar veya arşiv girdileri güvenlik yedeği oluşturulmadan ve canlı veri değiştirilmeden reddediliyor.
- MVP-31/32 dönemindeki v1 tam yedeklerle geriye dönük uyumluluk korundu; bu yedekler `legacy` olarak işaretleniyor.
- Electron IPC ve preload katmanına tam yedek inceleme işlevi eklendi.

## Testler

- v2 yedek manifest ve SHA-256 doğrulama testi
- Bozuk yedeğin canlı veriye dokunmadan reddedilmesi testi
- v1 yedek geriye dönük uyumluluk testi

Toplam otomatik test: 33/33 başarılı.
