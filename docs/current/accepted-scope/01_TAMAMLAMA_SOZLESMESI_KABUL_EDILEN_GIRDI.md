# Anadolu Parsı Aile Yaşam Merkezi
## Bronze 03.08.2026 — Tamamlama Sözleşmesi ve Yol Haritası

### 1. Bağlayıcı sonuç

Bu belge yeni bir fikir listesi değildir. Bronze geliştirme tamamlanmadan Silver'a geçilmemesi için ürünün tek kapsam ve kapanış sözleşmesidir.

- **Bronze:** Bütün kullanıcı işlevleri, veri modelleri, ekranlar, menüler, yerel adapterler, güvenlik davranışları, görsel sistem ve erişilebilirlik kodlanır. Eksik özellik varken Silver yoktur.
- **Silver:** Yeni özellik geliştirilmez. Yalnız tam test, kullanıcı kabulü, güvenlik doğrulaması, Windows kurulum doğrulaması ve testte çıkan sorunların düzeltilmesi yapılır. Test sırasında yeni özellik ihtiyacı bulunursa ürün Bronze'a döner.
- **Gold:** Silver'ın tüm zorunlu kapıları PASS olduktan, üretim imzası ve operasyon paketi tamamlandıktan ve kullanıcı açıkça onayladıktan sonra gerçek kullanım sürümüdür.
- **NOT_RUN, BLOCKED, PENDING veya DIAGNOSTIC_PASS hiçbir zaman PASS değildir.**
- **Tamamlandı ölçütü:** karar → domain → schema → migration → use-case → repository → IPC → UI → menü → hedefli doğrulama → belge zincirinin tamamıdır.

### 2. Yeni adlandırma kararı

Kullanıcıya görünen sürüm ve dosya adlarında `RC`, `RC2` ve `Build` kullanılmayacaktır.

- Uygulama: **Bronze 03.08.2026**
- Kaynak teslimi: `Anadolu_Parsi_Aile_Yasam_Merkezi_Bronze_03.08.2026.zip`
- Silver: **Silver gg.aa.yyyy**
- Gold: **Gold gg.aa.yyyy**

Aynı gün içindeki teknik revizyonların karışmaması için kullanıcıya gösterilmeyen iç manifestte benzersiz `releaseId`, `revision`, kaynak SHA-256 ve migration generation tutulur. Kullanıcı arayüzü ve normal teslim adı yalnız kanal+tarih gösterir.

### 3. Gerçek durum

Eski ilerleme yüzdesi build sayısını ve çok sayıdaki altyapı/doğrulama betiğini fazla ağırlıklandırmıştır. Build228 kaynak paketi 2.179 dosya, 17 üst menü, 7 güçlü ekran ve 10 kısmi ekran içerir. 14 aktif API renderer tarafından çağrılmamaktadır. Temiz npm kurulumu, tam TypeScript, tüm testler, production build ve blocking smoke açık durumdadır.

#### İki ayrı gerçeklik

- **Build228'in önceki dar kapsamına göre kaynak kod olgunluğu:** yaklaşık **%61–65**
- **Bu belgeyle sabitlenen eksiksiz aile platformu kapsamına göre Bronze tamamlanma:** **%46,7** (güven aralığı %47–52)
- **Silver tam doğrulama:** **%0** — ana zincir başlamış sayılmaz; OPEN-002 dahil kapılar NOT_RUN/BLOCKED
- **Gold üretim hazırlığı:** **%0**

### 4. Ağırlıklı ilerleme modeli

| Alan | Ağırlık | Mevcut |
|---|---:|---:|
| Yönetişim, adlandırma ve belge tutarlılığı | %3 | %60 |
| Mimari, veri katmanı ve migration | %6 | %82 |
| Kimlik, yetkilendirme ve güvenlik | %8 | %65 |
| Aile, hane, üyelik ve soy ağacı | %7 | %55 |
| Zaman tüneli, önemli günler ve arşiv | %6 | %75 |
| Finans, bankacılık, kart ve kredi | %12 | %22 |
| Sağlık ve bakım | %5 | %55 |
| Yaşam yönetimi, sigorta ve varlıklar | %4 | %50 |
| Bildirim, otomasyon ve raporlama | %4 | %68 |
| Konum ve acil durum | %3 | %25 |
| Yapay zekâ, arama ve yardımcı | %4 | %15 |
| Dijital miras ve zaman kapsülü | %3 | %55 |
| Erişilebilirlik, kullanılabilirlik ve görsel tasarım | %10 | %40 |
| Yedekleme, geri yükleme ve dayanıklılık | %7 | %75 |
| Bulut, OIDC, açık bankacılık ve diğer entegrasyonlar | %5 | %10 |
| Windows kurulum, güncelleme ve operasyon | %4 | %55 |
| Test, kalite kapıları ve yayın kanıtı | %9 | %15 |

**Ağırlıklı toplam:** **%46.7**

### 5. Güçlü olan mevcut temel

- Modüler monolit, repository/use-case ayrımı, SQLite migration ve audit/outbox yaklaşımı.
- Yerel öncelikli veri kasası, parola/TOTP/kurtarma/güvenilir cihaz, IPC güvenlik katmanları.
- Zaman tüneli, arşiv, bildirim/otomasyon, raporlama, güvenlik merkezi ve sistem/bakım ekranlarının önemli kısmı.
- Yedekleme, restore, veri yaşam döngüsü, tanılama ve performans altyapısının büyük bölümü.
- Deterministik kaynak paketleme, manifest ve SHA zinciri.

### 6. Silver öncesi kapanması zorunlu ana eksikler

1. Normalleştirilmiş hane, aile dalı, çoklu üyelik ve kişi profil yaşam döngüsü.
2. Amaç/dal/süre bağlamlı yetkilendirme ve davet kabul UI'si.
3. Windows Hello ve FIDO2/WebAuthn.
4. Finans modülünün banka, IBAN, kredi kartı, kredi, bütçe, hedef, ortak sahiplik ve varlıklarla tamamlanması.
5. Sağlık bakım planı, acil kart ve kategoriye özgü yaşam kayıtları.
6. Harita, canlı konum rızası/süresi ve acil durum planı.
7. Gerçek AI kullanıcı işlevleri ve AI hafıza yönetimi.
8. Zaman kapsülü.
9. Birleşik yetki filtreli arama.
10. Görsel manifesto uyumu ve erişilebilirlik kapanışı.
11. Dead UI/API ve belge-kod driftinin sıfırlanması.
12. Kurulum, güncelleme, rollback ve dış adapter sınırları.

### 7. Finans ve bankacılık kesin kapsamı

#### Banka hesabı
- Banka/kurum, resmi ad, kurum kodu, güvenli logo veya nötr ikon.
- Hesap takma adı, hesap türü, para birimi, IBAN, şube, maskeli hesap numarası.
- Kişisel/ortak sahiplik yüzdesi, bakiye, kullanılabilir bakiye, ek hesap, faiz ve durum.
- IBAN biçim, ülke, uzunluk, checksum ve banka kodu doğrulaması.
- Yapısal doğruluk ile gerçek hesap/sahiplik doğrulaması ayrı gösterilir.

#### Kredi kartı
- Banka, kart ürünü, ağ, yalnız son dört hane, kart sahibi, ana/ek/sanal kart.
- Limit, kullanılabilir limit, güncel borç, dönem borcu, asgari ödeme.
- Ekstre kesim ve son ödeme günü, otomatik ödeme, taksitler, ücret, puan/mil ve uyarılar.
- Tam kart numarası, CVV/CVC, PIN ve internet bankacılığı parolası kaydedilmez.

#### Krediler
- İhtiyaç, konut, taşıt ve diğer kredi türleri.
- Ana para, faiz, efektif maliyet, vade, taksit, kalan anapara, ödeme planı.
- Gecikme, erken kapama, teminat, sigorta ve ödeme geçmişi.

#### Finansal yönetim
- Gelir/gider, kategori, bütçe, nakit akışı, yinelenen ödeme ve finansal hedef.
- Net değer, borç oranı, yaklaşan ödeme, bütçe sapması.
- Nakit, mevduat, döviz, altın, yatırım, emeklilik, gayrimenkul ve araç.
- CSV/Excel benzeri kontrollü içe aktarma ve gelecekte açık bankacılık adapteri.

### 8. Erişilebilirlik ve kullanıcı deneyimi kesin kapsamı

- Varsayılan gövde metni en az 16 px; kritik bilgi küçük dipnot boyutuna sıkıştırılmaz.
- Windows metin ölçeği %100–225 ve uygulama içi özel ölçek.
- DPI ve ekran ölçeği %100–400; 1280×720, 1366×768, Full HD, QHD ve 4K.
- Küçük pencere, geniş ekran ve çoklu monitörde responsive reflow.
- Tam klavye, mantıklı tab sırası, görünür odak, kısayollar.
- Narrator ve diğer ekran okuyucular için ad/rol/değer/durum.
- Windows Magnifier, On-Screen Keyboard, yüksek kontrast ve forced-colors.
- Renk tek başına anlam taşımaz; ikon+metin+durum birlikte kullanılır.
- En az 44 px etkileşim hedefi.
- Hareket azaltma, ses kapatma, altyazı ve görsel alternatif.
- Kolay Okuma modu: büyük metin, yüksek satır aralığı, sade dil, düşük yoğunluk.
- Genç, standart, ileri yaş, düşük görme ve bakım veren tercih profilleri.
- Taslak/otomatik kayıt, geri al, anlaşılır hata, alan odağı ve işlem özeti.
- Açık tema teal/gold görsel manifesto; karanlık tema ayrıca tam erişilebilir.
- Bilgi saklamayan progressive disclosure; rahat/standart/kompakt yoğunluk.

### 9. Kalite ve güvenlik hedefi

“Hiç çökmeyen, mutlak kusursuz yazılım” teknik olarak garanti edilemez. Bunun yerine ölçülebilir yayın kapıları uygulanır:

- Bilinen P0/P1 hata: sıfır.
- İşlevsiz menü/düğme/form/API: sıfır.
- Yetkisiz veri sızıntısı: sıfır tolerans.
- Kritik akışlarda kaydedilmemiş veri kaybı: sıfır tolerans.
- Crash/power-loss sonrası veri bütünlüğü ve açılış kurtarma.
- En az bir doğrulanmış tam yedek.
- Hata halinde anlaşılır mesaj, güvenli retry ve rollback.
- Electron güvenlik checklist, OWASP ASVS yaklaşımı ve NIST SSDF geliştirme disiplini.
- Sağlık/finans/çocuk/konum verisi varsayılan kapalı ve açık rızalı.
- Üretim anahtarları, tokenlar ve parolalar düz metin saklanmaz.

### 10. Bronze çalışma sırası ve süre

| Aşama | Tahmini odaklı iş günü |
|---|---:|
| B0 Kapsam/adlandırma/gerçeklik kapıları | 3–5 |
| B1 Temel veri modeli ve yetki düzeltmeleri | 8–12 |
| B2 Kimlik ve güvenlik kapanışı | 8–12 |
| B3 Aile, soy ağacı, zaman tüneli ve arşiv | 7–10 |
| B4 Finans ve bankacılık | 12–18 |
| B5 Sağlık, yaşam, konum ve acil durum | 9–14 |
| B6 AI, dijital miras ve adapter sınırları | 9–14 |
| B7 Görsel sistem ve erişilebilirlik | 12–18 |
| B8 Dayanıklılık, kurulum ve güncelleme | 7–11 |
| B9 Bronze kapanış ve teslim | 3–5 |

Bazı işler paralel yürütülebilir. Tek kaynak ağacı üzerinde düzenli ve kanıtlı ilerleme için:

- **Bronze gerçekçi süre:** **55–75 odaklı iş günü**, yaklaşık **11–15 hafta**
- **Silver test ve düzeltme:** **20–30 iş günü**, yaklaşık **4–6 hafta**
- **Gold üretim kapanışı:** **5–10 iş günü**, yaklaşık **1–2 hafta**
- **Toplam:** yaklaşık **4–5,5 ay**

Canlı açık bankacılık, Apple/Google/Microsoft OIDC, OneDrive, harita ve kod imzası dış hesap, sözleşme, kimlik bilgisi veya sertifika beklerse takvim uzar. Bu bağımlılıklar yerel Bronze veri modeli/UI/adapter kodunun yapılmasını engellemez; yalnız gerçek üretim PASS'ini engeller.

### 11. Silver kapıları

1. Temiz ve tekrarlanabilir npm ci iki kez PASS; lockfile değişmez.
2. Root ve tüm workspace TypeScript PASS.
3. Tüm birim, entegrasyon, repository, SQLite, IPC, güvenlik ve migration testleri PASS.
4. Electron production build ve paketleme PASS.
5. Blocking smoke: onboarding, giriş, kasa, tüm modüller, yedek, kapanış, yeniden açılış PASS.
6. Gerçek Windows kurulum/yükseltme/onarım/kaldırma/rollback PASS.
7. Narrator, Magnifier, On-Screen Keyboard, yüksek kontrast, 100–225% metin ve DPI matrisi PASS.
8. 7 günlük uzun çalışma, büyük veri ve hata enjeksiyonu PASS.
9. OWASP/Electron/NIST güvenlik kontrol listesi, dependency audit ve tehdit modeli kapanışı.
10. Genç, yetişkin, ileri yaş ve bakım veren persona UAT; P0/P1 hata sıfır.

### 12. Gold kapıları

1. Gold sürüm kararı için açık kullanıcı onayı.
2. Authenticode/kod imzası ve imzalı installer.
3. SBOM, lisans, gizlilik, saklama, destek ve güvenlik bildirim belgeleri.
4. Üretim API kimlik bilgileri, sağlayıcı sözleşmeleri ve canlı entegrasyon kabulü.
5. Nihai ekran görüntüleri, kurulum/kurtarma/taşıma kullanıcı kılavuzu.
6. Geri alma paketi ve acil durum destek planı.

### 13. Çalışmayı gerçekten engelleyebilecek dış ihtiyaçlar

- İnternete ve resmî npm registry'ye erişebilen gerçek Windows test makinesi.
- Gold için kod imzalama sertifikası.
- Canlı OIDC sağlayıcı uygulama kayıtları ve redirect bilgileri.
- OneDrive/harita/AI sağlayıcı hesapları ve üretim kimlik bilgileri.
- Canlı açık bankacılık için mevzuata uygun lisanslı/kontratlı erişim veya sağlayıcı ortaklığı.
- Banka logoları için resmî marka varlığı/lisans koşullarının kontrolü.
- Çocuk, sağlık, konum ve dijital miras için nihai gizlilik/hukuk metinlerinin uzman incelemesi.
- Silver UAT için genç, yetişkin, ileri yaş ve bakım veren senaryolarını temsil eden testler.

### 14. Bundan sonraki değişmez bitiş metni

Her çalışma/bölüm sonunda aşağıdaki alanlar yazılacaktır:

- Kanal ve tarih
- Yapılan iş
- Tamamlanan gereksinim kimlikleri
- Değişen kaynak alanları
- Çalıştırılan kontroller ve gerçek PASS/FAIL/NOT_RUN
- Açık hata ve riskler
- Güncel ağırlıklı Bronze yüzdesi
- Kalan Bronze işleri
- Silver'a geçiş durumu: `YASAK / HAZIR DEĞİL` veya `HAZIR`
- Üretilen kaynak ZIP, manifest ve SHA
- Sonraki tek resmî iş
- **Bitiş cümlesi:** “Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.”

### 15. İlk uygulanacak sıra

1. Bu kapsam ve adlandırma kararını yeni aktif kural/karar setine geçir.
2. FEATURE_REALITY_GATE oluştur.
3. Veri modeli: hane/aile dalı/üyelik/amaçlı yetki.
4. Finans/bankacılık domain ve şema tasarımı.
5. Windows Hello/FIDO2.
6. Modül kapanışları.
7. Görsel ve erişilebilirlik kapanışı.
8. Bronze kapanış sweep.
9. Ancak bundan sonra Silver `npm ci` ve tam test zinciri.
