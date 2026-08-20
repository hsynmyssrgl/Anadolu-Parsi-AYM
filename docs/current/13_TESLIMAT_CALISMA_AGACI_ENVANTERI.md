# 34-L Teslimat Çalışma Ağacı Envanteri

Bu belge çalışma ağacındaki değişiklikleri silmeden ve yazarlık/sahiplik iddiası kurmadan teslimat kümelerine ayırır. Otomatik commit, push, kurulum paketi veya gereksinim kabul kanıtı değildir.

- Kaynak HEAD: `06a9f53c3cf770ffdabacfe710f05a8f49e92c55`
- Anlık görüntü SHA-256: `082eb2407347ad1e13043501705e0646ce4a14438bd51361e4d12f58ed87b0c0`
- Durum: `CLEAN`
- Toplam girdi: `0` (izlenen `0`, izlenmeyen `0`)
- Stage edilmiş girdi: `0`; silinen: `0`; ikili dosya: `0`
- Son commit bağı: `KURULMADI`; kurulum paketi: `OLUŞTURULMADI`

## Teslimat kümeleri

| Küme | Dosya sayısı |
| --- | ---: |
| TEMIZ_CALISMA_AGACI | 0 |

## Önerilen teslimat sırası

1. `URUN_KAYNAGI`: uygulama, paketler ve yerel Windows servis kaynağı.
2. `TEST_VE_FIXTURE`: kaynakla aynı davranış kümesine ait testler ve görsel fixture'lar.
3. `YONETISIM_VE_KONFIGURASYON`: kapsam, manifest ve politika ratchet'leri.
4. `DOGRULAMA_VE_URETIM_OTOMASYONU`: doğrulayıcılar, üreticiler ve bakım komutları.
5. `BELGE`: karar, tehdit modeli, denetim ve güncel durum belgeleri.
6. `YARDIMCI_ARAC`: Gold aktivasyon yöneticisi gibi bağımsız araçlar; ayrı ürün sınırı olarak incelenir.
7. `URETILMIS_KANIT_VE_INDEKS`: kaynak kümeleri sabitlendikten sonra yeniden üretilir ve ayrı kanıt kümesinde tutulur.

## Güvenlik ve kullanım kuralı

- Bu envanter yalnız mevcut Git durumunu ve dosya SHA-256 değerlerini kaydeder.
- Değişikliklerin kullanıcıya veya belirli bir geliştiriciye ait olduğunu varsaymaz.
- `URETILMIS_KANIT_VE_INDEKS` girdileri kaynak kod commitinden ayrı ele alınmalı veya kanıt komutlarıyla yeniden üretilmelidir.
- `ELLE_INCELENECEK_DIGER` girdileri sahiplik ve teslim amacı belirlenmeden commitlenmemelidir.
- Dış cihaz, sağlayıcı, sertifika, soak veya inceleme kanıtı bu belgeyle PASS sayılmaz.

## Dosya listesi

| Git | Yol | Küme | Bayt | SHA-256 |
| --- | --- | --- | ---: | --- |
| - | Çalışma ağacı temiz; listelenecek değişiklik yok. | TEMIZ_CALISMA_AGACI | 0 | - |
