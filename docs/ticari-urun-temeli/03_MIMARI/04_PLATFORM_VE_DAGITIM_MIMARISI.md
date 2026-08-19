# Platform ve Dagitim Mimarisi

## Mevcut platform

- Birincil: Windows x64 Electron masaustu.
- Kurulum: NSIS tabanli tek gercek dosya ilerleme cubugu.
- Kalici teknik kimlik: veri uyumlulugu icin mevcut Windows appId ve eski user-data dizini korunur.
- Gorunur kimlik: ParsYuva AYM.
- Kısayol: ParsYuva AYM.
- Varsayilan kurulum hedefi: urun politikasinda belirlenen sabit Program Files hedefi.

## Gelecek platformlar

| Platform | Yaklasim | Durum |
|---|---|---|
| macOS | Yerel imzali/notarized istemci, ortak domain sozlesmesi | PLANNED |
| iPhone/iPad | Companion, minimum veri ve E2EE | PLANNED |
| Watch/Vision | Sinirli companion bildirim/gorunum | PLANNED |
| Web | Hassas veri otoritesi olmayan destek/hesap veya sinirli portal | UNDECIDED |

## Dagitim zinciri

```mermaid
flowchart LR
  S[Temiz kaynak] --> G[Governed Preflight]
  G --> T[Test ve Typecheck]
  T --> B[Deterministik Build]
  B --> SBOM[SBOM ve Provenance]
  SBOM --> SIG[Uretim Imzasi]
  SIG --> I[Installer]
  I --> UAT[Temiz Makine UAT]
  UAT --> R[Yayin]
```

## Kanal kurali

- Bronze: gelistirme gercekligi; uretim iddiasi yok.
- Silver: tam regresyon, gercek cihaz/saglayici ve yayin adayi dogrulamasi.
- Gold: uretim imzasi, hukuk/gizlilik, dagitim ve destek kanitlari tamam.

## Guncelleme uyumlulugu

Paket ismi, gorunur marka veya renk kanali degisebilir; veri dizini ve appId migration plani olmadan degismez. Her guncelleme mevcut kullanici verisini korur ve gerekirse yeni semaya donusturur.

