# Build 143 Sürüm Notları

Build 143, Build 142'de doğrulanan Ed25519 imzalı iptal listesinin güvenli HTTPS kaynağından alınabilmesi için ağ güvenlik sınırı ekler. Ağdan gelen belge otomatik uygulanmaz; önce TLS SPKI pini, hedef ağ sınıfı, yönlendirme, boyut, içerik türü ve şema kontrollerinden geçerek kullanıcı incelemesine sunulur. İmza, sıra numarası, tarih penceresi ve güçlü doğrulama Build 142 uygulama akışında tekrar doğrulanır.
