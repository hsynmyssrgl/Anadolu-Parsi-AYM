# 33-M Erişilebilirlik Tercihleri Tehdit Modeli

## Kapsam ve varlıklar

Korunan varlıklar; tercih bütünlüğü, kullanıcı tarafından görülebilen tüm bilgi, klavye odağı, semantik ad/rol/değer/durum, hata ve canlı bölge duyuruları ile erişilebilirlik profillerinin yerel kalmasıdır.

## Tehditler ve kontroller

| Tehdit | Kontrol |
|---|---|
| Bozuk veya değiştirilmiş tercih verisi görünümü kullanılamaz kılar | Parser yalnız tanımlı enum ve yüzde 100–225 tam sayı ölçeğini kabul eder; bozuk veri güvenli varsayılana döner. |
| Kompakt/kolay okuma profili bilgi veya yetkili eylem saklar | Profiller yalnız sunumu değiştirir; içerik ve yetki yüzeyleri aynı kalır, progressive disclosure bilgi silmez. |
| Renk tek başına durum taşır | Metin/ikon/şekil işaretleri korunur; yüksek kontrast ve forced-colors sözleşmeleri uygulanır. |
| Büyütme küçük pencerede içeriği keser veya yatay odağı kaybettirir | Reflow kırılımları, taşma denetimi, görünür odak ve ana içerik odağı kaynak/runtime testleriyle korunur. |
| Hareket ya da ses tercihi kritik durumu görünmez yapar | Hareket/ses kapatılsa da yazılı ve görsel durum korunur; canlı bölge ve altyazı tercihleri ayrıdır. |
| Yardımcı teknoloji etiketi eksik ya da yanıltıcıdır | Ortak semantik bileşenler ad/rol/değer/durum ve `aria-live` sözleşmelerini taşır; hedefli kaynak kontrolleri fail-closed çalışır. |
| Yerel görünüm başlangıcı yetkili profil kaydını ezer | Oturum açılınca merkezi PEP/UoW ile kişisel kalıcı profil okunur; `localStorage` yalnız giriş öncesi güvenli başlangıçtır. |
| Renderer başka hesap/aile/kişi tercihini okur veya yazar | Exact PEP subject/resource bağları, aktif hesap ve kişi triggerları, optimistic revizyon ve idempotent istek parmak izi fail-closed çalışır. |
| Tercih mekanizması OS ayarlarını değiştirir veya ağa sızdırır | İşletim sistemi yazma ve ağ kanalı yoktur; sistem sinyalleri yalnız okunur, tercih etkileri yerel uygulama kapsamındadır. |
| Otomasyon sonucu gerçek cihaz sertifikası gibi sunulur | Narrator, Magnifier, donanım ve insan UAT sertifikası açıkça dışlanır; ayrı kanıt yoksa iddia üretilemez. |

## Negatif testler

- Bilinmeyen profil, tema, yoğunluk, okuma modu ve bozuk JSON güvenli varsayılana döner.
- 99, 226 ve kesirli ölçek reddedilir; 100 ve 225 kabul edilir.
- Boş roving liste `-1` verir; Home/End ve sarma davranışı deterministiktir.
- Forced-colors/reduced-motion ve yüksek kontrast kaynak markerları yoksa boundary FAIL olur.
- 44 px hedef, semantik duyuru, küçük pencere reflow veya 16 px görünür metin sözleşmesi yoksa contract FAIL olur.

## Artık risk

CSS/source ve jsdom tabanlı otomasyon, gerçek Windows ölçekleme rasterizasyonunu veya yardımcı teknolojinin bütün sürümlerini kanıtlamaz. Bu artık risk açık tutulur ve ayrı cihaz/Narrator/Magnifier/UAT matrisiyle ele alınır.
