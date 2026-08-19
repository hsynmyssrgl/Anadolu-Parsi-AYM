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

## Silver

| Token | Deger | Kullanim |
|---|---|---|
| `--release-accent` | `#718494` | Ana vurgu |
| `--release-accent-strong` | `#4F5F6B` | Metin/hover |
| `--release-accent-soft` | `#D4DDE4` | Secili zemin |
| `--release-accent-edge` | `#AEBCC7` | Ikincil vurgu |
| `--release-primary` | `#607888` | Ana eylem |

## Gold

| Token | Deger | Kullanim |
|---|---|---|
| `--release-accent` | `#A57E17` | Ana vurgu |
| `--release-accent-strong` | `#6E5411` | Metin/hover |
| `--release-accent-soft` | `#FFE9A0` | Secili zemin |
| `--release-accent-edge` | `#F0CC58` | Ikincil vurgu |
| `--release-primary` | `#8A6A18` | Ana eylem |

## Saydamlik

Apple benzeri saydamlik; beyaz zemin uzerinde hafif blur, sinir ve golge olarak uygulanir. Metin veya form alaninin arkasinda kontrasti bozacak kadar saydamlik kullanilmaz. Windows reduce-transparency veya reduce-motion tercihleri saydamligi/animasyonu azaltir.

## Dogrulama

- Kanal degisimi uygulama yeniden acilisinda dogru paleti etkinlestirir.
- Installer buyuk renk alani etkin kanal rengindedir.
- Mavi varsayilan NSIS gorseli kalmaz.
- Ekran goruntusu kontrast ve tema snapshot testi her kanal icin kosar.
