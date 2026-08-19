# ParsYuva AYM Ticari Urun Temel Surumu

- Belge temel tarihi: 19.08.2026
- Belge seti surumu: 1.0.0-belge.20260819.1
- Kaynak urun surumu: Bronze 19.08.2026.33
- Durum: AKTIF_CALISMA / TICARI_YAYIN_HAZIR_DEGIL
- Dil: Turkce; dosya adlari Turkce anlamli ve ASCII karakterlidir.

Bu klasor ParsYuva AYM icin bugun baslatilan ilk temiz ticari urun belge temelidir. Eski karar, test ve teslim belgeleri silinmez; tarihsel kanit olarak mevcut `00_PROJE` ile `11_FUTURE_PATCHES` arasindaki alanlarda kalir. Bu klasordeki belgeler yeni calismalar icin tek aktif yonlendirme katmanidir.

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

19.08.2026 tarihinde kanonik kural sicilinde 217 kural ve `b79db92a03d559f33ccd49348bad159a70b6034fbcf10a07abe5a407549bf0be` SHA-256 ozeti bulunmaktadir. `GOVERNED_PREFLIGHT` ayni tarihte PASS olmustur. Calisma agaci temiz degildir; bu nedenle yeni teslim, kurulum veya uretim imzasi kaniti uretilmeden once degisiklikler kapsamli regresyondan gecmelidir.

`C:\PPT\AYM` koku bir Git deposu degildir; kaynak kodun Git deposu `C:\PPT\AYM\06_KOD\app` altindadir. Bu ticari belge kokunun uzak depo, commit, tag ve bagimsiz yedek kaniti henuz yoktur; `IS-0003` kapanmadan belge alani kayba karsi korunmus sayilmaz.

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

Bu kapi kural SHA bagini, `DEC-259` karar senkronunu, 49 is kaydini, JSON semalarini, dis kanit durumlarini ve yeni dosya adlarini fail-closed denetler. Ayni kapi `GOVERNED_PREFLIGHT` icinde zorunludur.
