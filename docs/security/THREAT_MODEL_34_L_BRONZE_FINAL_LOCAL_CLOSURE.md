# 34-L Tehdit Modeli

- Eski artifact veya takip referansı güncel kanıt sayılmaz; step/mode, kaynak HEAD, 24 saatlik tazelik ve requirement-false alanları exact doğrulanır.
- `PASS` doğrulayıcı sonucu requirement kabulüne otomatik dönüştürülemez.
- Manifest/index/source receipt üretiminden sonra çalışma ağacı değişirse kaynak koruması geçersizdir.
- Receipt dosyası sessizce üzerine yazılamaz; her kaynak HEAD'i ve evidence digesti ayrı versioned no-overwrite receipt üretir, eski sabit receipt yalnız tarihsel kalır.
- GitHub ve D: eşitliği canlı uç hash'iyle doğrulanır; yalnız local tracking ref yeterli değildir.
- Harici takvim, AI, relay, Raft, mTLS, Apple, Windows installer, soak veya sertifikasyon kanıtı uydurulamaz.

Residual risk: kabul registry'sindeki gerçek dünya ve bağımsız inceleme gereksinimleri tamamlanana kadar Bronze final ürün kapanışı blokludur.
