# Asilamaz Kurallar

## 1. Yetki sirasi

1. Son acik kullanici karari.
2. Bu ticari temel belge setindeki aktif kural.
3. Kanonik kural sicili ve guncel karar kaydi.
4. Kodlanmis fail-closed denetim.
5. Tarihsel belgeler yalniz aciklayici kanittir.

Alt siradaki kaynak ust siradaki karari sessizce degistiremez.

## 2. Tamamlanma kurali

Bir is ancak asagidaki zincirin gerekli tum halkalari PASS ise tamamlanir:

`karar -> gereksinim -> tasarim -> kod -> test -> guvenlik kapisi -> belge -> kanit -> kullanici kabul durumu`

Eksik halka varsa durum `ACIK`, `BLOCKED`, `PARTIAL`, `NOT_RUN` veya `FAIL` olur. Yuzde veya PASS uydurulamaz.

## 3. Degisiklik kurali

- Her yeni karar karar siciline ayni is gununde eklenir.
- Her karar benzersiz `TKR-YYYYMMDD-NNN` kimligi alir.
- Degisen kural onceki kaydi silmez; `SUPERSEDED` iliskisi kurar.
- Kod degisikligi ilgili gereksinim ve test kimligini tasir.
- Belge degisikligi degisiklik sicilinde dosya yolu ve gerekceyle kaydedilir.
- Aynı teslimde kaynak, test ve belge gercekligi yeniden dogrulanir.

## 4. Dosya ve klasor kurali

- Dosya ve klasor adlari Turkce anlamli, ASCII ve bosluksuzdur.
- Sira gereken alanlarda iki haneli sayisal on ek kullanilir.
- Kok dizine gecici rapor, log, kurulum veya belge atilmaz.
- Uretilen dosya uygun alanina yazilir; gecici dosya `tmp` disina cikmaz.
- Ayni belgenin `son`, `final`, `final2` gibi belirsiz kopyalari yasaktir; surum manifestten okunur.
- Tarihsel kopya `09_TARIHCE` referansi ile korunur, aktif belge olarak taranmaz.

## 5. Surum ve tema kurali

- Gorunur surum `Kanal GG.AA.YYYY.AylikSira` bicimindedir.
- Her derlemede aylik sira artar; derleme tarihi gercek takvim tarihidir.
- Bronze, Silver ve Gold paletleri ana kodda tanimlidir.
- Acilista etkin kanal dogrulanir ve yalniz o kanal paleti uygulanir.
- Kurulum, uygulama, yardim ve raporlar ayni etkin kanal kimligini gosterir.
- Varsayilan ana zemin acik/beyazdir; saydamlik okunabilirlik ve erisilebilirlik sinirlarini asamaz.

## 6. Veri kurali

- Guncelleme kullanici verisini korur.
- Yeni sema eski veriyi geri alinabilir ve testli migration ile donusturur.
- Fabrika ayarina donus acik onay ister; kisinin verisi ile yonetilen yedekleri icin geri donussuz silme plani kanitlanmadan basarili sayilmaz.
- Kaldirma akisi yedekleme veya tam silme tercihini aciklar; bulut hedefi kullanici oturumu ve saglayici izni olmadan acilmaz.
- Hassas veri, receipt, gizli anahtar, token ve dosya yolu renderer'a sizdirilmaz.

## 7. Guvenlik kurali

- Yetki yoksa islem kapali reddedilir.
- Gercek sertifika, cihaz veya saglayici kaniti yoksa uretim uygunlugu false kalir.
- Ag erisimi merkezi izin, host/pin ve zaman asimi denetiminden gecmeden acilmaz.
- Dis bilesen ticari lisans ve kaynak dogrulamasi olmadan uretime girmez.
- Guvenlik kapisi test kolayligi icin devre disi birakilamaz.

## 8. Kullanici deneyimi kurali

- Sol, sag, ust ve alt alanlarda tipografi olcegi tutarlidir.
- Buton var fakat islev yok veya islev var fakat gorunur erisim yok durumu kabul edilmez.
- Parola alaninda erisilebilir goster/gizle denetimi bulunur.
- Pencere carpisi varsayilan olarak sistem tepsisine kucultur; acik `Tamamen kapat` komutu gercek kapanistir.
- Ilk kullanim tanitimi metin ve yerel sesli anlatim sunar; ses yoksa metin her zaman erisilebilirdir.
- Sistem dili desteklenmiyorsa arayuz Ingilizce acilir.

## 9. Ticari yayin kurali

Asagidakiler tamamlanmadan ticari yayin etiketi verilemez:

- Uretim kod imzalama sertifikasi ve zaman damgasi.
- Kurulum ve kurulu EXE Authenticode dogrulamasi.
- Kullanilan tum bilesenlerin ticari lisans envanteri.
- Gizlilik ve kullanim kosullari icin uzman incelemesi.
- Desteklenen gercek cihaz ve saglayici UAT matrisi.
- Geri yukleme ve guncelleme veri koruma kaniti.
- Kritik ve yuksek acik hata sayisinin sifir olmasi.

## 10. Aşilamazlik uygulamasi

Bu belge tek basina teknik kapı degildir. `11_OTOMASYON` altindaki dogrulayici; klasor, manifesto, zorunlu belge, kimlik, durum ve hash alanlarini denetler. Uygulama deposundaki governed preflight ile bag kurulmadan ticari teslim PASS sayilmaz.

