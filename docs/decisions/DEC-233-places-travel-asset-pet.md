# DEC-233 — Yer, seyahat, taşınma ve evcil hayvan iş akışları

Durum: `PLANNED / LOCAL_IMPLEMENTATION_STARTED`. Bu karar 33‑V’nin yerel bileşen modelini kaydeder; gereksinimleri kapatmaz ve `countsAsRequirementPass=false` kalır.

## Karar

Mevcut Yaşam Merkezi içinde dört alan ve on dört kanonik kayıt türü kullanılır. Her kayıt aynı aile, sahip kişi, görünürlük, merkezi PEP makbuzu, iyimser revizyon ve idempotent işlem kimliğiyle bağlanır. Özel kayıtları yalnız sahibi yönetir; diğer görünürlüklerde sahip dışı erişim açık izin gerektirir. Katılımcılar etkin aynı-aile kişileridir ve sahip listede bulunur.

Koordinat ile adres etiketi çevrimdışı geri dönüş olarak birlikte veya ayrı saklanabilir. Taşınma OCR alanı yalnız opak yerel iş kimliğidir ve öneriyi otomatik kabul etmez. Pasaport, vize, sigorta, paket, dil ve albüm içerikleri burada çoğaltılmaz; yalnız opak arşiv öğesi kimliği tutulur. Sağlık, ilaç, çocuk ve evcil hayvan gereksinimleri ayrıntıyı çoğaltmadan opak referansa bağlanır.

## Kesin sınırlar

Harita sağlayıcısı, okul/seyahat sağlayıcısı senkronu, rezervasyon yapma, ödeme, canlı takip, belge doğrulama, paket teslimi, dil paketi indirme, albüm medyası saklama, AI işleme ve dış paylaşım yapılmaz. Evcil hayvan kaydı sağlık tavsiyesi değildir. Fiziksel silme veya yedek yayılımı iddia edilmez.

## Kanıt durumu

Yerel hedef testler migration 100, repository, PEP, DataStore, IPC ve UI zincirini doğrular. Gerçek harita/seyahat/evcil hayvan kullanımı, hukuk ve gizlilik incelemesi `NOT_RUN`; persistent closure receipt üretilmedi. Registry, roadmap, plan ve aktif ledger bu başlangıçta değiştirilmez.
