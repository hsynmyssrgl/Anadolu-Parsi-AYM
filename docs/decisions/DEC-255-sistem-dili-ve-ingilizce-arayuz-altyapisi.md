# DEC-255 — Sistem Dili ve İngilizce Arayüz Altyapısı

## Karar

ParsYuva AYM ve Windows kurulum sihirbazı açılış dilini kurulduğu makinenin işletim sistemi dilinden belirler. Türkçe ve İngilizce desteklenir. Sistem dili desteklenmiyorsa, boşsa veya güvenilir biçimde çözülemiyorsa İngilizce kullanıcı verisi açılmadan önce güvenli varsayılan olarak seçilir.

Dil kararı Electron ana sürecinde `app.getLocale()` üzerinden verilir. Renderer dili seçemez; preload köprüsünden yalnız doğrulanmış `language`, `locale`, `fallbackUsed` ve desteklenen dil listesini alır. Köprü hatasında renderer İngilizce başlar ve Türkçe ilk-kare parlaması üretmez.

## Uygulanan kapsam

- Türkçe/İngilizce kanonik dil çözümleyicisi ve desteklenmeyen dil için İngilizce fallback.
- İlk tanıtım, güvenlik kurulumu, aile alanı oluşturma/giriş, parola gösterme, ana menü, komut araması ve sistem tepsisi çekirdek metinleri.
- Türkçe ve İngilizce sesli ilk tanıtım ile F1 Sesli Yardım Merkezi.
- İngilizce varsayılan, Türkçe destekli NSIS kurulum metinleri ve iki yerelleştirilmiş lisans.
- Görünür tarih/saat biçimlendirmesinde seçili locale kullanımı.
- Dağıtık operasyon, evrensel UX ve imzalı eklenti uzman panellerinin Türkçe/İngilizce görünür metinleri; English locale sunucu tarafı render testinde görünür Türkçe karakter sayısı sıfırdır.
- Aile konum haritası, yerel çeviri/dil ve aile AI panellerinin Türkçe/İngilizce görünür metinleri; ikinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- İletişim denetimi, kayıt/saklama ve iletişim güvenliği panellerinin Türkçe/İngilizce görünür metinleri; üçüncü English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Gerçek zamanlı çağrı hazırlığı panelinin Türkçe/İngilizce görünür metinleri; dördüncü English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Akıllı ev ve enerji panelinin Türkçe/İngilizce görünür metinleri; beşinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Finans içe aktarma panelinin Türkçe/İngilizce görünür metinleri; altıncı English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Yerel mühürlü mesajlaşma panelinin Türkçe/İngilizce görünür metinleri; yedinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Dosya paylaşımı ve aile iletişim araçları panelinin Türkçe/İngilizce görünür metinleri; sekizinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Hafıza Stüdyosu panelinin Türkçe/İngilizce görünür metinleri; dokuzuncu English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Yer, seyahat, varlık ve evcil hayvan panelinin Türkçe/İngilizce görünür metinleri; onuncu English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Sağlık ve bakım koordinasyonu panelinin Türkçe/İngilizce görünür metinleri; on birinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Çocuk ve eğitim koordinasyonu panelinin Türkçe/İngilizce görünür metinleri; on ikinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Hane operasyonları panelinin Türkçe/İngilizce görünür metinleri; on üçüncü English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Aile toplantıları panelinin Türkçe/İngilizce görünür metinleri; on dördüncü English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Finans planlama panelinin Türkçe/İngilizce görünür metinleri; on beşinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Yerel OCR panelinin Türkçe/İngilizce görünür metinleri; on altıncı English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Uzun vadeli portföy panelinin Türkçe/İngilizce görünür metinleri; on yedinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Yönetilen yaşam, ev envanteri ve acil durum panelinin Türkçe/İngilizce görünür metinleri; on sekizinci English locale render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Ana aile panosu ile ilk-kullanım panosunun Türkçe/İngilizce görünür metinleri ve locale-uyumlu tarih biçimleri; ana kabuk birinci dalga render testinde görünür Türkçe karakter sayısı sıfırdır.
- Arama destekli kişi/olay katalog kontrolleri, aile üyeleri ve büyük soy ağacı ekranlarının Türkçe/İngilizce görünür metinleri; aynı ana kabuk render dalgasında görünür Türkçe karakter sayısı sıfırdır.
- Zaman tüneli ile önemli günler ekranlarının filtre, arşivleme, davetiye, not ve locale-uyumlu tarih metinleri; ana kabuk ikinci dalga render testinde görünür Türkçe karakter sayısı sıfırdır.
- Birleşik yetkili arama panelinin kaynak-yetkisi ve kısmi sonuç vermeme gerçeğini koruyan Türkçe/İngilizce metinleri; ana kabuk üçüncü dalga render testinde görünür Türkçe karakter sayısı sıfırdır.
- Doküman Merkezi'nin arama, sınıflandırma, sürüm, ilişki kanıtı, saklama ve güvenli imha metinleri; ana kabuk dördüncü dalga render testinde görünür Türkçe karakter sayısı sıfırdır. Kullanıcı tarafından yazılan değerler çeviri katmanının dışında korunur.
- İlk kurulum/giriş ile aile daveti ekranlarının Türkçe/İngilizce metinleri; ana kabuk beşinci dalga render testinde görünür Türkçe karakter sayısı sıfırdır. Dil sağlayıcısı mesajları küresel varsayılandan değil kendi doğrulanmış bootstrap dilinden çözer.
- Aile ilişkisi ekleme penceresi ile Dijital Miras ekranının Türkçe/İngilizce metinleri; ana kabuk altıncı dalga render testinde görünür Türkçe karakter sayısı sıfırdır. Yönetim kayıtlarına giren onay, geri alma ve iptal açıklamaları seçili dilde üretilir.
- Yapay Zekâ İzin Merkezi'nin standart AI izni, süreli hassas veri rızası ve dışa gönderim önizlemesi metinleri; ana kabuk yedinci dalga render testinde görünür Türkçe karakter sayısı sıfırdır. Bu üç yetki yüzeyi birbirinden bağımsız kalır.

## Açık kalan iş

İlk yirmi dört uzman panel ile ana pano, kişi kataloğu, aile, soy ağacı, zaman tüneli, önemli günler, birleşik yetkili arama, Doküman Merkezi, ilk kurulum/giriş, aile daveti, ilişki ekleme, dijital miras ve AI izin merkezi tamamlanmış olsa da ana uygulama kabuğunun kalan ekranlarındaki tarihsel görünür Türkçe metinlerin son taraması henüz bitmedi. Bu nedenle İngilizce altyapı ve çekirdek kullanıcı yolculuğu `COMPLETE`, uygulamanın uçtan uca bütün ekran İngilizcesi `PARTIAL` ve `countsAsFullApplicationEnglishPass=false` durumundadır. Eksik metinler Türkçeye sessiz fallback yapılarak tamamlanmış sayılamaz.

## Kanıt

- `packages/domain/tests/ui-localization.test.ts`
- `apps/desktop/tests/ui-system-localization.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-one.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-two.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-three.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-four.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-five.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-six.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-seven.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-eight.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-nine.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-ten.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-eleven.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-twelve.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-thirteen.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-fourteen.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-fifteen.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-sixteen.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-seventeen.test.ts`
- `apps/desktop/tests/feature-panel-localization-wave-eighteen.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-nineteen.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-twenty.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-twenty-one.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-twenty-two.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-twenty-three.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-twenty-four.test.ts`
- `apps/desktop/tests/app-shell-localization-wave-twenty-five.test.ts`
- `apps/desktop/tests/accessibility-preference-center.test.ts`
- `apps/desktop/tests/narrated-help-center.test.ts`
- `apps/desktop/tests/installer-narration-experience.test.ts`
- `apps/desktop/scripts/verify-installer.mjs`
