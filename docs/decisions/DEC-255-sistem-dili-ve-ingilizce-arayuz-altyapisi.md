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

## Açık kalan iş

İlk on dokuz uzman panel tamamlanmış olsa da kalan geniş özellik panellerindeki tarihsel Türkçe metinlerin tamamı henüz İngilizce sözlük anahtarlarına taşınmadı. Bu nedenle İngilizce altyapı ve çekirdek kullanıcı yolculuğu `COMPLETE`, uygulamanın uçtan uca bütün ekran İngilizcesi `PARTIAL` ve `countsAsFullApplicationEnglishPass=false` durumundadır. Eksik metinler Türkçeye sessiz fallback yapılarak tamamlanmış sayılamaz.

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
- `apps/desktop/tests/accessibility-preference-center.test.ts`
- `apps/desktop/tests/narrated-help-center.test.ts`
- `apps/desktop/tests/installer-narration-experience.test.ts`
- `apps/desktop/scripts/verify-installer.mjs`
