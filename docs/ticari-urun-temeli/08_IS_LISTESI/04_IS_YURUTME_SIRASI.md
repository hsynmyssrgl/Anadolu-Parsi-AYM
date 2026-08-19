# Is Yurutme Sirasi

## Faz 0 — Yonetisim ve kaynak gercegi

1. IS-0001 ticari temel ve gate.
2. IS-0002 kirli calisma agacini kapsamli teslimlere ayirma.
3. IS-0004 aktif/tarihsel belge sinirini sabitleme.
4. IS-0005 karar senkron otomasyonu.
5. IS-0003 uzak repo ve yedek politikasi.

Bu faz tamamlanmadan ticari installer, Silver veya Gold kapanis iddiasi yoktur.

## Faz 1 — Calisan Bronze temelini sertlestirme

- Kurulum/acilis/kapanis/update/uninstall: IS-0201–IS-0207.
- Marka, kanal temasi, tipografi, saydamlik ve yardim: IS-0101–IS-0107.
- Tam regresyon ve guvenlik kapilari: IS-0601–IS-0604.

## Faz 2 — Veri ve yerel zeka

- Yerel AI: IS-0401–IS-0402.
- Harita: IS-0403.
- OCR: IS-0404–IS-0407.
- Yedek/restore/silme: IS-0501–IS-0506.

## Faz 3 — Lisans ve ticari operasyon

- Deneme ve Gold aktivasyon: IS-0301–IS-0303.
- Sirket, marka, web, fiyat, destek: IS-0701–IS-0704.
- Gelistirici hesaplari ve global yayin: IS-0705–IS-0706.

## Faz 4 — Dis kanit ve yayin

- Gercek cihaz/passkey: IS-0304.
- Uretim imzasi: IS-0305.
- Erisilebilirlik ve temiz Windows UAT: IS-0605–IS-0606.
- Hukuk/gizlilik/vergi ve saglayici onaylari.

## Paralellik kurali

Birbirinden bagimsiz teknik isler paralel tasarlanabilir; ayni kaynak dosyada cakisan degisiklik, ayni kanit artifacti veya ayni migration numarasi paralel yazilamaz. Her anda buyuk governed zincirde en fazla bir adim `IN_PROGRESS` olur. Dis kaynak bekleyen is, bagimsiz yerel isi durdurmaz.

## Tamamlanmis sayma

Bir is; kod, hedefli test, gerekli regresyon, belge, kanit ve kabul olcutu birlikte PASS olmadan `TAMAMLANDI` olamaz. `NOT_RUN`, `BLOCKED`, `PARTIAL`, yerel mock veya taslak kanit PASS yerine gecmez.

