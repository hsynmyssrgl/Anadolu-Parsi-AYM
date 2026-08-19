# Surum Renk Paletleri

## Kesin kural

Uygulama, installer, tanitim, yardim ve raporlar etkin surum kanalini ana koddan okur. Kanal adina gore tek palet etkinlesir. Bilesen icinde sabit Bronze/Silver/Gold rengi kullanilmaz.

## Bronze

| Token | Deger | Kullanim |
|---|---|---|
| `--release-accent` | `#A5672F` | Ana vurgu |
| `--release-accent-strong` | `#71441F` | Metin/hover |
| `--release-accent-soft` | `#FFD39B` | Secili zemin |
| `--release-accent-edge` | `#DC9852` | Ikincil vurgu |
| `--release-primary` | `#467259` | Ana eylem |
| `--release-muted` | `#676B6A` | Kucuk metin; acik zeminde AA |
| `--release-border` | `#8E8A82` | Zorunlu kontrol siniri; 3:1 |
| `--release-focus` | `#3979E6` | Klavye odagi; 3:1 |

## Silver

| Token | Deger | Kullanim |
|---|---|---|
| `--release-accent` | `#718494` | Ana vurgu |
| `--release-accent-strong` | `#4F5F6B` | Metin/hover |
| `--release-accent-soft` | `#D4DDE4` | Secili zemin |
| `--release-accent-edge` | `#AEBCC7` | Ikincil vurgu |
| `--release-primary` | `#607888` | Ana eylem |
| `--release-muted` | `#5F6B73` | Kucuk metin; acik zeminde AA |
| `--release-border` | `#7C8992` | Zorunlu kontrol siniri; 3:1 |
| `--release-focus` | `#3979E6` | Klavye odagi; 3:1 |

## Gold

| Token | Deger | Kullanim |
|---|---|---|
| `--release-accent` | `#A57E17` | Ana vurgu |
| `--release-accent-strong` | `#6E5411` | Metin/hover |
| `--release-accent-soft` | `#FFE9A0` | Secili zemin |
| `--release-accent-edge` | `#F0CC58` | Ikincil vurgu |
| `--release-primary` | `#8A6A18` | Ana eylem |
| `--release-muted` | `#746B58` | Kucuk metin; acik zeminde AA |
| `--release-border` | `#8D7D50` | Zorunlu kontrol siniri; 3:1 |
| `--release-focus` | `#3979E6` | Klavye odagi; 3:1 |

## Saydamlik

Apple benzeri saydamlik; beyaz zemin uzerinde hafif blur, sinir ve golge olarak uygulanir. Metin veya form alaninin arkasinda kontrasti bozacak kadar saydamlik kullanilmaz. Windows reduce-transparency veya reduce-motion tercihleri saydamligi/animasyonu azaltir.

## Dogrulama

- Kanal degisimi uygulama yeniden acilisinda dogru paleti etkinlestirir.
- Installer buyuk renk alani etkin kanal rengindedir.
- Mavi varsayilan NSIS gorseli kalmaz.
- Ekran goruntusu kontrast ve tema snapshot testi her kanal icin kosar.
- Normal ve sessiz metin kontrasti en az 4.5:1; kontrol siniri ve odak gostergesi en az 3:1 olur.
- Acik tema bloklari kanal tokenlarini yeniden tanimlayamaz; tum renkler `--release-*` zincirinden gelir.

## Kalici ekran goruntusu referanslari

Referanslar gercek Electron Chromium ile Windows uzerinde, `1280x800`, yuzde 100 olcek, ag kapali ve kullanici/ornek verisi olmadan uretilir. Uretim komutu `npm run capture:release-palettes` olur. Paketleme oncesi test, dosyanin PNG basligini, boyutunu, SHA-256 degerini, hesaplanan CSS tokenlarini ve uc kanal goruntusunun birbirinden farkli oldugunu dogrular.

| Kanal | Referans |
|---|---|
| Bronze | `apps/desktop/tests/fixtures/surum-paletleri/bronze-palet-ekran-goruntusu.png` |
| Silver | `apps/desktop/tests/fixtures/surum-paletleri/silver-palet-ekran-goruntusu.png` |
| Gold | `apps/desktop/tests/fixtures/surum-paletleri/gold-palet-ekran-goruntusu.png` |

Beklenen hashler ve yakalama ortami `config/ui-visual-reference-manifest.json` icinde baglayicidir. CSS veya palet degisirse ekran goruntuleri bilincli olarak yeniden uretilmeden test gecmez.
