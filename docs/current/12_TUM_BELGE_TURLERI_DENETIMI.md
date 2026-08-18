# Tüm Belge Türleri Denetimi

- Sürüm: **GUNCEL-2026-08-17-V1**
- Kök: `C:\PPT\AYM`
- Denetlenen belge/config/metin dosyası: **30151**
- Okunabilir/önceki temelde okunabilirliği kanıtlı: **30151**
- Okunamayan/bozuk: **0**
- `DEC-252` gereği bu çalışmada yeniden açılmayan dondurulmuş tarihsel kayıt: **24455**
- Office/RTF/PDF: **704**; okunabilir **704**
- Benzersiz içerik hash'i: **5201**; tekrar kopya: **24950**

> `Güncel Dosyalar` çıktı klasörü öz-referanslı envanter oluşturmamak için kaynak taramasından çıkarılır; paket tamamlanınca içeriği ayrı SHA-256 manifestiyle doğrulanır.
> Bu dosyanın ilk üretimi tarihsel kayıtlar için son içerik-okunabilirlik temelidir. Sonraki çalışmalarda tarihsel dosyalar önceki satırlarıyla taşınır; yeniden açılmaz, render edilmez veya semantik güncellik denetimine alınmaz.

## Uzantı dağılımı

| Uzantı | Dosya |
|---|---:|
| `.csv` | 118 |
| `.docx` | 341 |
| `.html` | 14 |
| `.json` | 11512 |
| `.md` | 17405 |
| `.pdf` | 349 |
| `.rtf` | 14 |
| `.txt` | 358 |
| `.yaml` | 12 |
| `.yml` | 28 |

## Üst klasör dağılımı

| Klasör | Dosya |
|---|---:|
| `00_PROJE` | 666 |
| `01_YONETIM` | 363 |
| `02_GEREKSINIM` | 36 |
| `03_TASARIM` | 13 |
| `04_UYGULAMA` | 25 |
| `05_TEST` | 769 |
| `06_KOD` | 4056 |
| `07_DOKUMAN` | 520 |
| `08_VERI` | 17 |
| `09_ARSIV` | 23633 |
| `10_YEDEK` | 4 |
| `11_FUTURE_PATCHES` | 48 |
| `README.md` | 1 |

## Sınıflandırma

| Sınıf | Dosya |
|---|---:|
| `ACTIVE_REFERENCE` | 47 |
| `HISTORICAL` | 24455 |
| `MACHINE_READABLE_SOURCE_OR_EVIDENCE` | 3127 |
| `SOURCE_OR_REFERENCE` | 2522 |

## Bulunmayan Office türleri

`.doc`, `.odp`, `.ods`, `.odt`, `.ppt`, `.pptx`, `.xls`, `.xlsx`

## Okuma sorunları

- Yok. Denetlenen tüm dosyalar türüne uygun biçimde açıldı/ayrıştırıldı.

## Yetki ve tarih ilkesi

- `09_ARSIV`, `Arşiv`, checkpoint ve geçmiş Build DOCX/PDF dosyaları tarihsel kanıttır; güncel otorite değildir.
- Güncel iş gerçeği aktif config, `docs/current`, DEC/ADR/threat modelleri, kaynak kod ve testlerden üretilir.
- Excel veya PowerPoint dosyası bulunmaması eksiklik olarak yorumlanmaz; bu projede tablo ve sunum otoritesi tanımlanmamıştır.
- Tam dosya/yol/hash envanteri `artifacts/manifests/ALL_PROJECT_DOCUMENT_FORMAT_AUDIT.json` içindedir.
