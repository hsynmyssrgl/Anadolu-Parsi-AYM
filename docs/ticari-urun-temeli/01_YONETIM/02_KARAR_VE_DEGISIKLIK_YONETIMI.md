# Karar ve Degisiklik Yonetimi

## Karar yasam dongusu

`TASLAK -> ANALIZ -> ONAYLANDI -> UYGULAMADA -> DOGRULANDI -> KAPANDI`

Alternatif son durumlar: `REDDEDILDI`, `ERTELENDI`, `SUPERSEDED`, `BLOCKED`.

## Zorunlu karar alanlari

- Karar kimligi ve basligi.
- Karar tarihi ve kaynak kullanici talebi.
- Problem ve is gerekcesi.
- Kapsam ici ve kapsam disi.
- Etkilenen urun surumleri ve platformlar.
- Veri, guvenlik, UX, lisans ve migration etkisi.
- Alternatifler ve tercih gerekcesi.
- Kabul olcutleri.
- Kod, test, belge ve kanit baglantilari.
- Acik riskler ve dis kaynaklar.
- Durum ve onceki/sonraki karar iliskileri.

## Degisiklik siniflari

| Sinif | Ornek | Zorunlu kapilar |
|---|---|---|
| D0 Belge | Yazim veya aciklama | Belge dogrulama, link kontrolu |
| D1 Gorsel | Renk, boyut, yerlesim | Ekran goruntusu, erisilebilirlik, tema testi |
| D2 Islev | Yeni menu veya is akisi | Birim, entegrasyon, IPC/API ve UI testi |
| D3 Veri | Sema veya migration | Yedek, migration, geri donus ve veri kaybi testi |
| D4 Guvenlik | Yetki, sifreleme, ag | Tehdit modeli, negatif test, policy kapisi |
| D5 Dagitim | Surum, installer, imza | Temiz paket, imza, kurulum/kaldirma/UAT |

## Degisiklik kaydi sablonu

```text
Degisiklik: DGS-YYYYMMDD-NNN
Ilgili karar: TKR-...
Sinif: D0..D5
Onceki durum:
Yeni durum:
Etkilenen dosyalar:
Veri migrationi:
Guvenlik etkisi:
Testler:
Kanıtlar:
Geri alma plani:
Durum:
```

## Ilk sicil kaydi

`DGS-20260819-001`: Ticari urun icin temiz belge temeli ve yeni klasor yapisi olusturuldu. Eski belgeler silinmedi. Yeni alan ticari calismalarin aktif yonlendirme katmani olarak tanimlandi.

