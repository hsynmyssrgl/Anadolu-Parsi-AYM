# ADR-088 — Adımlı doğrulama ve kalıcı ilerleme kanıtı

## Bağlam

Uzun tek-parça komut zincirleri zaman aşımı, kısmi çıktı kaybı ve hangi alt-adımın gerçekten doğrulandığının belirsizleşmesi riskini artırır.

## Karar

Build214 ve sonraki geliştirme oturumları mantıksal atomlara ayrılır. Her atomun kaynak değişikliği ve doğrulama kanıtı ayrı dosya/ledger kaydıyla kalıcılaştırılır. Bir atom başarısızsa sonraki atom fail-closed bekler. Kullanıcıya verilen kısa durum, yalnız o ana kadar doğrulanmış sonucu bildirir.

Paketleme gibi teknik olarak atomik olması zorunlu tek işlem istisnadır; bunun çevresindeki hazırlık, doğrulama ve teslim yine ayrı adımlardır.

## Sonuçlar

- Zaman aşımı sonrası devam noktası kanıttan bulunabilir.
- `PASS` yalnız gerçekten çalıştırılan adım için yazılır.
- Tarihsel dosyalar yeniden numaralandırılmaz.
- Active/historical ayrımı version sweep tarafından korunur.
