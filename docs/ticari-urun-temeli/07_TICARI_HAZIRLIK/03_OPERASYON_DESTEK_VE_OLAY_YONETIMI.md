# Operasyon Destek ve Olay Yonetimi

## Destek siniflari

| Seviye | Ornek | Ilk hedef | Kural |
|---|---|---|---|
| SEV-1 | Veri kaybi, yetkisiz erisim, imza/anahtar ihlali | Derhal | Dagitimi durdur, kaniti koru, fail-closed |
| SEV-2 | Uygulama acilmiyor, migration veya backup restore hatasi | 1 is gunu hedefi | Etkilenen surumu durdur, recovery rehberi |
| SEV-3 | Ana ozellik bozuk veya ciddi erisilebilirlik sorunu | 3 is gunu hedefi | Workaround ve duzeltme paketi |
| SEV-4 | Kozmetik, belge veya dusuk etkili sorun | Planli surum | Is listesine kanitli kayit |

Bu hedefler ticari SLA degildir; sirket ve destek kapasitesi kurulunca sozlesmeye donusturulur.

## Olay akisi

1. Olay kimligi ve ilk zaman damgasi uretilir.
2. Kullanici verisi icermeyen teknik kanit toplanir.
3. Etki, veri sinifi, surum ve dagitim kanali belirlenir.
4. Gerekiyorsa yayin/aktivasyon durdurulur.
5. Kok neden ve kalici onlem yazilir.
6. Hedefli, regresyon ve gercek ortam testleri kosulur.
7. Belge, risk, is listesi ve surum notu ayni degisiklikte guncellenir.
8. Yetkili onay olmadan olay kapanmaz.

## Log ve gizlilik

- Loglar varsayilan content-free olur.
- Parola, token, recovery code, ham belge, OCR/AI metni, saglik/finans icerigi ve dosya yolu yazilmaz.
- Destek paketi kullaniciya onizleme ve secme sansi verir.
- Harici destek aktarimi ayri onay, sifreleme ve sureli silme ister.

## Surum geri cekme

- Uygulama kodu geri alinabilir; veri semasi körlemesine downgrade edilmez.
- Eski binary yeni semayi okuyamiyorsa kontrollu forward fix tercih edilir.
- Geri cekme once staging/UAT verisiyle kanitlanir.
- Kullanici verisi yedegi readback dogrulamasi olmadan destructive recovery yapilmaz.

