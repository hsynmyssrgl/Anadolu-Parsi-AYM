# DEC-259 — Ticari Temel Alani ve Asilamaz Belge Kapisi

- Tarih: 19.08.2026
- Durum: ACTIVE
- Kaynak: Acik kullanici karari

## Karar

ParsYuva AYM icin Git deposu icindeki `docs/ticari-urun-temeli` altinda yeni, duzenli ve makinece dogrulanan bir ticari urun belge temeli kurulur. Kullanici erisimi icin `C:\PPT\AYM\12_TICARI_URUN_TEMEL_SURUMU` yolu bu kanonik dizine baglanan uyumluluk yolu olarak korunur. Mevcut kanonik kurallar istisnasiz ve fail-closed kalir. Yeni alan; kural bagini, karar degisiklik sicilini, is analizini, mimari semalari, kalite ve kanit modelini, ticari lisans on incelemesini, dis kaynak ayrimini, tek ana is listesini ve proje tarihcesini birlikte tasir.

## Sinirlar

1. `00_PROJE` ile `11_FUTURE_PATCHES` arasindaki tarihsel kayitlar silinmez veya yeniden yazilmaz.
2. Tarihsel kayitlar yeni karar, aktif gereksinim veya tamamlanma kaniti sayilmaz.
3. Yeni klasor kanonik kural sicilini kopyalayarak ikinci otorite olusturmaz; sicilin kimligini, sayisini ve SHA-256 degerini dogrulanmis bag olarak tutar.
4. Yeni kullanici karari; karar defteri, etkilenen aktif belge ve ana is listesiyle ayni degisiklikte senkronize edilir.
5. Sertifika, hukuk, gizlilik, gercek cihaz ve gercek saglayici kaniti yoksa ilgili durum PASS olamaz.
6. Ticari temel alan dogrulama kapisi governed preflight icinden calisir; kapinin kaldirilmasi veya atlanmasi yeni acik kullanici karari olmadan yasaktir.

## Etki

- Yeni ticari belge kokunun tek kanonik giris belgesi `docs/ticari-urun-temeli/00_OKU_BENI.md` olur.
- Makine sicilleri JSON semalariyla dogrulanir.
- Acik isler neden, eksik kanit, dis kaynak ve requirement PASS durumuyla izlenir.
- Ticari yayin uygunlugu varsayilan olarak `false` kalir.

## Kabul

- Ticari temel dogrulama kapisi PASS.
- Governed preflight yeni kapiyi zorunlu calistirir.
- Karar defteri ve aktif belgelerde `DEC-259` gorunur.
- Tarihsel alanlarda yeniden yazim yoktur.
