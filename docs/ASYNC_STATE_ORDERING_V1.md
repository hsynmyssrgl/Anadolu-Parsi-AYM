# Oturum Güvenli Asenkron State ve Revizyon Sıralaması V1

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `29.07.2026.158`
- Stage: **Bronze RC2 Active Development**

## Amaç

Gecikmiş IPC yanıtlarının, hızlı ekran değişimlerinin veya sıra dışı tamamlanan
mutasyonların daha yeni renderer state'ini geri almasını engellemek.

## Asenkron yazma bileti

Her istek bir kapsam, oturum çağı ve monoton sıra numarası taşır. Aynı kapsamda
daha yeni istek başladığında önceki bilet geçersiz olur. Oturum değişimi tüm
kapsamları tek işlemde geçersiz kılar. State yazımı yalnız bilet hâlâ güncelse
çalışır.

Korunan başlıca kapsamlar:

- kişi ve olay katalog sayfaları ile seçili kimlik lookup'ları,
- aile üyesinin ilişkili olayları,
- soy ağacı ve zaman tüneli sayfaları,
- arşiv sayfası ve sürüm geçmişi,
- graph/timeline snapshot bölümleri,
- ikincil ekran verileri,
- oturum bootstrap'ı, dashboard ve tam aile yenilemesi,
- giriş, profil oluşturma ve çıkış geçişleri.

## Mutasyon revizyon filigranı

Renderer mutasyon kimliklerini sınırlı bir tekrar önleme penceresinde tutar. Her
revizyon anahtarı için görülen en yüksek değer saklanır. Aynı kimlik veya ilgili
anahtarlarda daha düşük/eşit revizyon taşıyan sonuç state'e uygulanmaz. Bağımsız
bir anahtarda ilerleme varsa sonuç yalnız o anahtarların kapsadığı state'i
günceller.

## Snapshot–mutasyon yarışı

Mutasyon graph veya timeline revizyonunu ilerlettiğinde o bölüm için devam eden
snapshot bileti geçersiz kılınır. Bölüm henüz yüklenmemişse eski promise aktif
tek-uçuş kaydından ayrılır ve ekran yükleme turu yeniden başlatılır. Böylece
mutasyondan önce hazırlanmış snapshot daha sonra gelip yeni kaydı ezemez.

## Sınırlar

Bu karar renderer state sıralamasını güvence altına alır. Temiz bağımlılık
kurulumu, tam TypeScript, tüm testler, Electron production build ve Windows
installer doğrulaması ayrı geniş kapılardır.
