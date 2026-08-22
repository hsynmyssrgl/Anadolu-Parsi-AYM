# ParsYuva Aile Yasam Merkezi Ticari Urun Temel Surumu

- Belge temel tarihi: 20.08.2026
- Belge seti surumu: 1.1.0-belge.20260820.1
- Kaynak urun surumu: Bronze 22.08.2026.43
- Durum: AKTIF_CALISMA / TICARI_YAYIN_HAZIR_DEGIL
- Dil: Turkce; dosya adlari Turkce anlamli ve ASCII karakterlidir.

Bu klasor ParsYuva Aile Yasam Merkezi icin bugun baslatilan ilk temiz ticari urun belge temelidir. Eski karar, test ve teslim belgeleri silinmez; tarihsel kanit olarak mevcut `00_PROJE` ile `11_FUTURE_PATCHES` arasindaki alanlarda kalir. Bu klasordeki belgeler yeni calismalar icin tek aktif yonlendirme katmanidir.

## Zorunlu ilkeler

1. Kanit bulunmayan is `TAMAMLANDI` olarak isaretlenemez.
2. Kod, test, belge ve kullanici arayuzu ayni gereksinim kimligine baglanir.
3. Kullanici karari kayda alinmadan kural degistirilemez.
4. Tarihsel belge aktif gereksinim kaynagi olarak kullanilamaz; yalniz kanit ve gecmis aciklamasi olabilir.
5. Ticari lisans veya kullanim kosulu dogrulanmayan dis bilesen uretime alinmaz.
6. Sertifika, gercek cihaz, gercek saglayici, hukuk veya gizlilik incelemesi yapilmadiysa durum `NOT_RUN` kalir.
7. Kisisel veri silme, dis hesaba baglanma, satin alma ve yayina cikma islemleri acik yetki ve ayri kanit gerektirir.

## Klasor haritasi

| Klasor | Amac |
|---|---|
| `01_YONETIM` | Asilamaz kurallar, karar ve degisiklik yonetimi |
| `02_IS_ANALIZI` | Urun, kullanici, surec ve gereksinim analizleri |
| `03_MIMARI` | Uygulama, veri, guvenlik ve platform mimarisi |
| `04_URUN_TASARIMI` | UX, erisilebilirlik, marka ve surum temalari |
| `05_KALITE_TEST_KANIT` | Test stratejisi, kabul ve kanit zinciri |
| `06_DIS_KAYNAK_VE_LISANS` | Ticari lisans ve saglayici degerlendirmesi |
| `07_TICARI_HAZIRLIK` | Lisanslama, aktivasyon, dagitim ve kurumsallasma |
| `08_IS_LISTESI` | Bagimlilik sirali tek ana is listesi |
| `09_TARIHCE` | 20.07.2026 tarihinden itibaren proje tarihcesi |
| `10_SEMALAR` | Makinece dogrulanabilir kayit semalari |
| `11_OTOMASYON` | Klasor ve belge kapilarini dogrulayan araclar |

## Kaynak gercekligi

Guncel ust kayit Bronze 22.08.2026.50 ve DEC-268'dir. Kanonik V21 SHA-256 ozeti `b57ed6bf996709e1522c71e6b61a835ec48df9f0c52b1671dca61f914fab7a5f` olarak yenilenmistir. DEC-268; `.46` NSIS callback, `.47` stale dahili NSIS payload, `.48` ilk 2FA sonrasi policy authority ve `.49` kayitsiz ic checkpoint nedeniyle kasa muhurlenmesi FAIL kayitlarini korur; `.50` ic checkpoint sicil bagini ve ilk guven toreni ertelemesini kalici kapatir, temiz installer ile tam on yuz UAT zincirini yetkilendirir. Asagidaki onceki `.46` ozeti tarihsel baglamdir; guncel kaynak degildir.

22.08.2026 tarihinde kanonik kural sicili V21 olarak 233 kurala genisletildi; SHA-256 ozeti `2fea36f41b4b1f809defed5adb9eb274c6e0eaf35ce4d272a05eee304a730fe0` oldu. EK-001–EK-019 karar tamponu `DEC-260` ile asil sicillere baglandi; `DEC-261` guncel urun adini tam `ParsYuva Aile Yasam Merkezi` olarak kesinlestirdi ve AYM kisaltmasini guncel kullanici yuzeylerinden kaldirdi. `DEC-262` Windows kurulum hedefini `C:\Program Files\PPT\ParsYuva`, kurulu program ve kisayol adini `ParsYuva`, teslim EXE adini `ParsYuva-<Kanal>-GG.AA.YYYY.NN.exe` olarak sabitledi. `DEC-263` kod veya Windows paketleme degisikliginde onceki installer EXE, blockmap ve SHA-256 dosyalarini yeni build oncesinde otomatik siler. `DEC-264` Bronze, Silver ve Gold gorunur surum satirlarinda kanal adini tekillestirir. `DEC-265` her durum degistiren islemden once guncel kural kontrolunu zorunlu kilar. `DEC-267`, DEC-266'nin uc pars ve onceki karsilama modelini superseded eder; ilk kullanici olusturma dilinde uc bilgi karti arasinda gecisli fakat sahte ilerlemesiz installer, kurulum icinde ayni dil kadin sesi onceligi/erkek veya kurulu ses yedegi, eski tek pars, kilitli kasa yeniden dogrulamasi ve ilk 2FA guvenilir cihaz bootstrap sinirini baglar. Temiz tam derleme, veri koruyan yukseltme, paketli runtime ve GitHub + harici Git + D kaynak arsivi readback kanitlari korunur. `GOVERNED_PREFLIGHT`, tam regresyon, kurulum paketi ve Git readback kanitlari ayni kaynak anlik goruntusunde yeniden uretilmeden yeni teslim tamamlanmis sayilmaz.

Kanonik ticari belge koku kaynak kodla birlikte `C:\PPT\AYM\06_KOD\app\docs\ticari-urun-temeli` altinda Git tarafindan izlenir. `C:\PPT\AYM\12_TICARI_URUN_TEMEL_SURUMU` yalniz ayni klasore baglanan kullanici uyumluluk yoludur. GitHub ve `D:\GitYedekleri` bare remote readback kaniti `05_KALITE_TEST_KANIT/05_GIT_YEDEK_DOGRULAMA_KANITI.json` dosyasinda tutulur.

## Okuma sirasi

1. `01_YONETIM/01_ASILAMAZ_KURALLAR.md`
2. `02_IS_ANALIZI/01_URUN_IS_ANALIZI.md`
3. `03_MIMARI/01_SISTEM_MIMARISI.md`
4. `08_IS_LISTESI/01_ANA_IS_LISTESI.md`
5. `06_DIS_KAYNAK_VE_LISANS/01_TICARI_LISANS_ENVANTERI.md`
6. `01_YONETIM/06_RISK_SICILI.md`
7. `02_IS_ANALIZI/03_GEREKSINIM_IZLENEBILIRLIK_MATRISI.md`
8. `08_IS_LISTESI/04_IS_YURUTME_SIRASI.md`

## Makinece dogrulama

Kaynak repo kokunde:

```powershell
npm run verify:commercial-baseline
```

Bu kapi kural SHA bagini, `DEC-259`, `DEC-260`, `DEC-261`, `DEC-262`, `DEC-263`, `DEC-264` ve `DEC-265` karar senkronunu, 52 is kaydini, JSON semalarini, dis kanit durumlarini, yeni dosya adlarini, eski installer temizligini, gorunur kanal tekillestirmesini ve her islem oncesi kural kontrolunu fail-closed denetler. Ayni kapi `GOVERNED_PREFLIGHT` icinde zorunludur.
