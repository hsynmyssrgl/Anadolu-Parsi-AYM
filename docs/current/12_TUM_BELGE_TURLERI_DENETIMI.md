# Tüm Belge Türleri Denetimi

- Sürüm: **GUNCEL-2026-08-17-V1**
- Kök: `C:\PPT\AYM`
- Denetlenen belge/config/metin dosyası: **37023**
- Okunabilir/önceki temelde okunabilirliği kanıtlı: **36854**
- Okunamayan/bozuk: **0**
- `DEC-252` gereği bu çalışmada yeniden açılmayan dondurulmuş tarihsel kayıt: **24624**
- Office/RTF/PDF: **872**; okunabilir **752**
- Benzersiz içerik hash'i: **7585**; tekrar kopya: **29269**

> Her ana konu klasöründeki `ESKI_TARIHLI_KAYITLAR` dizini, dondurulmuş geçmiş kayıtların yeniden açılmasını veya güncellik denetimine alınmasını önlemek için kaynak taramasından çıkarılır. Güncel belgeler ilgili `00`-`11` konu klasörlerinde yerinde taranır.
> Bu dosyanın ilk üretimi tarihsel kayıtlar için son içerik-okunabilirlik temelidir. Sonraki çalışmalarda tarihsel dosyalar önceki satırlarıyla taşınır; yeniden açılmaz, render edilmez veya semantik güncellik denetimine alınmaz.

## Uzantı dağılımı

| Uzantı | Dosya |
|---|---:|
| `.csv` | 128 |
| `.docx` | 420 |
| `.html` | 21 |
| `.json` | 14126 |
| `.md` | 21398 |
| `.pdf` | 431 |
| `.rtf` | 21 |
| `.txt` | 429 |
| `.yaml` | 15 |
| `.yml` | 34 |

## Üst klasör dağılımı

| Klasör | Dosya |
|---|---:|
| `00_PROJE` | 668 |
| `01_YONETIM` | 365 |
| `02_GEREKSINIM` | 36 |
| `03_TASARIM` | 29 |
| `04_UYGULAMA` | 25 |
| `05_TEST` | 799 |
| `06_KOD` | 10740 |
| `07_DOKUMAN` | 541 |
| `08_VERI` | 17 |
| `09_ARSIV` | 23658 |
| `10_YEDEK` | 7 |
| `11_FUTURE_PATCHES` | 48 |
| `12_TICARI_URUN_TEMEL_SURUMU` | 86 |
| `AGENTS.md` | 1 |
| `README.md` | 1 |
| `output` | 2 |

## Sınıflandırma

| Sınıf | Dosya |
|---|---:|
| `ACTIVE_REFERENCE` | 175 |
| `HISTORICAL` | 24624 |
| `MACHINE_READABLE_SOURCE_OR_EVIDENCE` | 5701 |
| `SOURCE_OR_REFERENCE` | 6523 |

## Bulunmayan Office türleri

`.doc`, `.odp`, `.ods`, `.odt`, `.ppt`, `.pptx`, `.xls`, `.xlsx`

## Okuma sorunları

- Yok. Denetlenen tüm dosyalar türüne uygun biçimde açıldı/ayrıştırıldı.

## Yetki ve tarih ilkesi

- `09_ARSIV`, `Arşiv`, checkpoint ve geçmiş Build DOCX/PDF dosyaları tarihsel kanıttır; güncel otorite değildir.
- Güncel iş gerçeği aktif config, `docs/current`, DEC/ADR/threat modelleri, kaynak kod ve testlerden üretilir.
- Excel veya PowerPoint dosyası bulunmaması eksiklik olarak yorumlanmaz; bu projede tablo ve sunum otoritesi tanımlanmamıştır.
- Tam dosya/yol/hash envanteri `artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json` içindedir.
