# Teslim, Sohbet ve Kalıcı Kayıt Sözleşmesi

- Görünür sürüm: **Bronze 20.08.2026.35**
- Yeni kalıcı Library kökü: `/ParsYuva/ParsYuva AYM`
- Bu sürümün zorunlu Library dalı: `/ParsYuva/ParsYuva AYM/Bronze 20.08.2026.35`
- Önceki `/Panthera pardus tulliana/Anadolu Parsı Aile Yaşam Merkezi` kayıtları tarihsel ve değişmezdir; yeni kayıtlar o dala yazılmaz.

## Teslim bitiş alanları

Her bitiş raporunda yüzde, kalan yüzde, Bronze/Silver/Gold tahmini, güven düzeyi, gerçek test durumları, sohbet kapasitesi, devir durumu, kaynak ZIP/SHA, kalıcı Library yolu, tam belge dizini ve sıradaki tek resmî iş bulunur.

## Sohbet kapasitesi

Yalnız platform actual yüzdesi kullanılabilir. Ölçüm sağlanmıyorsa `UNAVAILABLE` yazılır. Yüzde uydurulmaz. Gerçek yüzde 90 veya üzerindeyse yeni sürüm başlatılmaz ve eksiksiz devir promptu aynı yanıtta oluşturulur.

## Geçici ve kalıcı alan

`/mnt/data` üretim/işleme için geçicidir ve kalıcı teslim değildir. Yerel Windows diski, haricî disk ve OneDrive ancak gerçek erişim ve doğrulama kanıtıyla `PASS` olabilir.

## Karar-belge eşzamanlılığı

`DEC-251` gereği her bağlayıcı karar, aynı değişiklikte DEC ve makine defteri kaydına, etkilenen aktif belgelere ve iş listesine işlenir. Açık kalan işin yerel durumu, açık kalma nedeni, eksik kanıtı ve requirement PASS gerçeği yazılmadan teslim tamamlanamaz. Kapı: `scripts/verify-documentation-synchronization-policy.mjs`.
