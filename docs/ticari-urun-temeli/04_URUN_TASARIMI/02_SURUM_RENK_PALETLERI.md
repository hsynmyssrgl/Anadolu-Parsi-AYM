# Surum Renk Paletleri

## Kesin kural

Uygulama, installer, tanitim, yardim ve raporlar etkin surum kanalini ana koddan okur. Kanal adina gore tek palet etkinlesir. Bilesen icinde sabit Bronze/Silver/Gold rengi kullanilmaz.

## Bronze

| Token | Deger | Kullanim |
|---|---|---|
| `--kanal-ana` | `#A96532` | Ana vurgu |
| `--kanal-koyu` | `#7A4524` | Metin/hover |
| `--kanal-acik` | `#F2E3D4` | Secili zemin |
| `--kanal-parlak` | `#C8844A` | Ikincil vurgu |
| `--kanal-metal` | `#B87333` | Metalik bronz |

## Silver

| Token | Deger | Kullanim |
|---|---|---|
| `--kanal-ana` | `#6F7B87` | Ana vurgu |
| `--kanal-koyu` | `#46515C` | Metin/hover |
| `--kanal-acik` | `#E7EBEF` | Secili zemin |
| `--kanal-parlak` | `#A9B2BC` | Ikincil vurgu |
| `--kanal-metal` | `#C0C0C0` | Metalik gumus |

## Gold

| Token | Deger | Kullanim |
|---|---|---|
| `--kanal-ana` | `#B8860B` | Ana vurgu |
| `--kanal-koyu` | `#6E5208` | Metin/hover |
| `--kanal-acik` | `#F7EBC4` | Secili zemin |
| `--kanal-parlak` | `#D6AE3D` | Ikincil vurgu |
| `--kanal-metal` | `#D4AF37` | Metalik altin |

## Saydamlik

Apple benzeri saydamlik; beyaz zemin uzerinde hafif blur, sinir ve golge olarak uygulanir. Metin veya form alaninin arkasinda kontrasti bozacak kadar saydamlik kullanilmaz. Windows reduce-transparency veya reduce-motion tercihleri saydamligi/animasyonu azaltir.

## Dogrulama

- Kanal degisimi uygulama yeniden acilisinda dogru paleti etkinlestirir.
- Installer buyuk renk alani etkin kanal rengindedir.
- Mavi varsayilan NSIS gorseli kalmaz.
- Ekran goruntusu kontrast ve tema snapshot testi her kanal icin kosar.

