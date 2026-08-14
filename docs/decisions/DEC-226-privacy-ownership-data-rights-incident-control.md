# DEC-226 — Gizlilik, sahiplik, veri hakları ve olay kontrol merkezi

- Tarih: 2026-08-14
- Durum: COMPLETED
- İş adımı: 33-O
- Gereksinimler: B6-02, PPK-028, AUD-COM-006, EXT-036, EXT-037, EXT-038, EXT-040, EXT-041, EXT-042
- Doğrulama: PASS_AUTOMATED_MANUAL_NOT_RUN_NO_CERTIFICATION

## Karar

Dokuz gereksinim tek bir merkezi PEP/UoW sınırında ele alınacaktır. Kullanıcı AI hafıza kayıtlarını görebilecek, append-only düzeltme ve sınırlama yapabilecek, süre sonunu yönetebilecek ve silme talebini audit ile PPK-019 yayılımına bağlayabilecektir. Veri hakları merkezi; tutulan veri sınıflarını, yerel erişim aktörünü, amacı, son erişim zamanını, retention durumunu ve türetilmiş veri zincirini içerik sızdırmadan gösterecektir.

Migration 92 tasarım hedefidir ve henüz uygulanmış değildir. Planlanan yetkili tablolar scope envanterinde kayıtlıdır. PPK-016 türetilmiş veri zincirinin, PPK-019 kaynak silme yayılımının tek otoritesi olarak kalır. 33-K yerel security epoch, güvenilir cihaz, çevrimdışı capability lease ve rıza iptalini sağlar. 33-N ortak asenkron durum ve stale sonuç koruması UI tarafından yeniden kullanılacaktır.

Politika ihlali şüphesi yerel incident kaydı, atomik yerel oturum/cihaz/capability/rıza iptali, içeriksiz karantina envanteri ve kullanıcı tarafından seçilen yerel şifreli olay paketi üretebilir. Bu işlem remote wipe veya MDM değildir; uzaktaki cihaza komut göndermez ve ağ teslimi ya da teslim alındısı garanti etmez.

Apple senkronu, AI, OCR ve çeviri görünümü yalnız uygulamanın yerelde gözlemlediği kayıtları `observed`, `not_observed`, `not_performed` veya `unknown` olarak sunacaktır. Uzaktaki hizmetin güncel veya eksiksiz durumu, AI inference/training gerçekleştiği ya da verinin dış sisteme gönderildiği iddia edilmeyecektir.

Şifreli dışa aktarım yalnız kullanıcı tarafından seçilen yerel dosya, authenticated encryption, parola tabanlı anahtar türetme, canonical manifest, SHA-256 ve readback kanıtıdır. Teslim, alıcının açması veya veri mirası sahibine ulaşma garantisi değildir. İzin simülasyonu yalnız preview üretir; grant, mutation veya yeni yetki oluşturamaz.

## Kapanış sınırı

Otomatik kapanış ratchet'i boundary 45, contract 18, runtime 18, 11 hedefli dosya ve 167 testtir. Kapsamla filtrelenen paket gerçek dosyadan decrypt edilerek, miras verisi ile ilgisiz ve başka kişiye ait kayıtların dışarıda kaldığı doğrulanır. İnsan gizlilik UAT'si, hukuk incelemesi ve gerçek cihaz kanıtı `NOT_RUN`; hukuk veya gizlilik sertifikasyonu iddia edilmez. Registry, plan, receipt ve `COMPLETE` geçişi yalnız fail-closed hazırlama ve persistent receipt zinciriyle yapılır.

- Manuel kapanış kanıtı: legalReview=NOT_RUN; privacyReview=NOT_RUN; realDevice=NOT_RUN; humanUat=NOT_RUN; certificationClaimed=false.
