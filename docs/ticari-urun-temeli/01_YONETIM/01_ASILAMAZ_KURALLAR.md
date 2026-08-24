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
- Kod veya Windows paketleme davranisi degistiginde onceki installer EXE, blockmap ve SHA-256 dosyalari yeni build oncesinde silinir; release klasorunde yalniz guncel surum seti kalabilir.
- Varsayilan ana zemin acik/beyazdir; saydamlik okunabilirlik ve erisilebilirlik sinirlarini asamaz.
- Ozel installer, uc bilgi karti arasinda gecisli fakat sahte ilerlemesiz karsilama, kurulum icinde ayni dilde kadin ses onceligi/erkek veya kurulu ses yedegi, 900x640 tek pars ilk aile ekrani, kilitli kasa yeniden dogrulamasi ve ilk 2FA guvenilir cihaz bootstrap siniri PR-233 kabul zincirinden ayrilamaz.
- Bronze, Silver ve Gold legacy kokun disindaki `C:\Program Files\PPT\ParsYuva-<Kanal>` kardes program dizinlerini kullanir; EXE, kisayol, appId, `ParsYuva/<Kanal>` kullanici veri koku, kaldirma kapsami, Git worktree ve branch yalitilir. Interactive kaldirma current-user AppData baglamindan sonra all-users baglamini geri yukler; legacy kanal dizini varsa recursive silme durur ve otomatik legacy veri tasima/silme yapilmaz.
- Surum tahsisi exact `--expected-release-id` ile acik ve tek seferli mutasyondur. Preview salt okunur; uyusmazlik lock, gecici dosya, yazim veya installer temizligi oncesi durur. Signed, local unsigned ve dir paket girisleri allocator calistiramaz ve yalniz onceden tahsisli exact current kimligini tuketir.
- Windows installer teslimi yalniz metadata-only kanonik UAT110 gercek N->N+1 yukseltme ile ayri same-version maintenance ve schema2 kurulu on yuz UAT111 makbuzlarini ayni package provenance, expected release ID ve source commit uzerinde kanitladiginda kabul edilir. Mevcut kullanici verisi icerigi okunmaz, adi makbuza yazilmaz, silinmez veya tasinmaz; NotSigned yalniz local-test siniridir.
- Guncel PR-239 kapisi schema2 exact-commit package provenance ile Bronze 50 previous paket/runtime kabul etmeyen bootstrap fresh-install + maintenance veya Bronze 51+ immutable previous package archive ile canli sibling N exact eslesen N to N+1 + maintenance modlu UAT110 V3'u, zorunlu installer-experience V2, parent-run UAT111 V3 dinamik outcome kapsamını ve final V3 source/producer/path/hash/kronoloji/screenshot/secret canli readbackini zorunlu kilar; legacy nested runtime trusted predecessor degildir.
- Her mutasyon exact changed-file etki analiziyle kural, karar, belge, manifest, ratchet, test ve UAT baglarina islenir. Baseline Bronze kanalina sabit harici append-only SHA-256 zincirinde tutulur; repo yalniz hash-bagli pointer tasir. BOOTSTRAP_ADOPTION producer'i pointer sourceCommit kayit commitinde base-pointer-HEAD ancestry ile, normal PRE_MUTATION producer'i kendi baseline commitinde exact path/boyut/SHA ile dogrulanir. Kalici completion/paket yalniz ayni temiz committe hedefli test, tam regresyon ve kaynak butunlugu PASS ile; installer teslimi paket sonrasi ayni paket/commite bagli gercek kurulu ana EXE taze UAT PASS ile yapilir.
- PR-240 geregi en kucuk degisiklikte etkilenen ana ve kanal kaynaklari, butun siciller, aktif/ticari belgeler, is listesi, kapsam/envanter/ratchet/manifest/indeks, ana DOCX/PDF ve kanit sozlesmeleri ayni zincirde UPDATED veya kanitli NOT_AFFECTED olarak kapanir. Hedefli ve filtresiz tam regresyon, typecheck, sozdizimi, kaynak butunlugu ve UI etkisinde butun etkilesim/gorsel UAT zorunludur. Gercek FAIL `wip(rejected)` checkpoint olur; tam kapanistan once ara installer yoktur.

## 6. Veri kurali

- Guncelleme kullanici verisini korur.
- Yeni sema eski veriyi geri alinabilir ve testli migration ile donusturur.
- Fabrika ayarina donus acik onay ister; kisinin verisi ile yonetilen yedekleri icin geri donussuz silme plani kanitlanmadan basarili sayilmaz.
- Kaldirma akisi yedekleme veya tam silme tercihini aciklar; bulut hedefi kullanici oturumu ve saglayici izni olmadan acilmaz.
- Hassas veri, receipt, gizli anahtar, token ve dosya yolu renderer'a sizdirilmaz.
- Yukseltme ve sessiz bakim kisisel veri kaldirma secimini acmaz; ilk aile kurulumu tek SQLite unit-of-work icinde ya tamamen tamamlanir ya tamamen geri alinir.

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

Her durum degistiren islemden once `scripts/verify-operation-rule-check.mjs` ile guncel kanonik kural, hash, kullanici onayi ve aktif enforcement baglari kontrol edilir. PASS olmayan kontrol sonrasinda kod, dosya, test, build, kurulum, silme veya yayin islemi baslatilamaz; waiver ve atlama yoktur.
