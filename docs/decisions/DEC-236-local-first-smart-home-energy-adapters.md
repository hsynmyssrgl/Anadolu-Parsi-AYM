# DEC-236 — Yerel-first akıllı ev ve enerji adapterleri

## Durum

`33-Y` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu başlangıç setiyle değiştirilmez. `countsAsRequirementPass=false`; kalıcı governance receipt ile dış ve manuel kanıtların tamamı `NOT_RUN` kalır.

## Karar

Akıllı ev ve enerji merkezi yalnız oturumdaki hesap, aile ve kişi sahibine bağlanan merkezi Life PEP receipt/fence altında çalışır. Cihaz kaydı yalnız main-process tarafından sağlanan doğrulanmış imza sonucu, adapter manifest özeti ve içeriksiz yerel kimlik özetiyle kabul edilir. Renderer bu güven kanıtlarını, sağlayıcı gözlemlerini veya cihaz durumunu yazamaz.

Gözlemler yalnız cihaz türüyle uyumlu, sınırlandırılmış boolean ya da sayısal metadata taşır. Ham kamera, ses, dosya yolu veya sağlayıcı payload'ı veritabanına, audit'e, outbox'a ve IPC'ye girmez. Kamera ve kapı zili erişimi varsayılan kapalıdır; yalnız görünür kullanıcı işlemiyle beş ile altmış dakika arasında izin verilebilir ve geri alınabilir. Gizli gözetim yasaktır.

Yerel işleme kapalıyken yeni gözlem yazımı hem uygulama hem veritabanı sınırında reddedilir. Süresi dolmuş fakat durable olarak aktif kalan kamera izinleri renderer'a aktif diye sunulmaz. Komutlar exact plain-object sözleşmesi, canonical fingerprint, 160 karakter kimlik sınırı ve monoton zamanla doğrulanır. Sahip başına cihaz, gözlem, izin ve mutation üst sınırları sırasıyla 500, 50.000, 2.000 ve 100.000'dir; kapasite dolunca yeni yazım fail-closed kapanır. Otomatik retention/kota kurtarması uygulanmadığından bu sınırlar kalıcı kapanış veya saklama politikası kanıtı değildir.

Bu paket cihaz kontrolü yapmaz. Matter eşleme, canlı sağlayıcı bağlantısı, gerçek sensör/enerji sağlayıcı ingestion'ı, kamera akışı, uzaktan komut ve bulut teslimatı uygulanmış sayılmaz. Yerel UI mevcut Yaşam Merkezi'ni genişletir; ayrı rota eklemez.

## Dürüstlük sınırı

Uygulanan yüzey imzalı-adapter metadata sınırı, immutable mutation ledger, optimistic revision, idempotent replay, exact komut şekli, monoton zaman, bounded storage, içeriksiz audit/outbox, dört renderer-safe kanal ve süreli görünür kamera iznidir. Gerçek Matter cihazı, sağlayıcı, enerji sayacı, kamera/kapı zili, cihaz kontrolü, retention tasarımı, privacy/safety ve legal UAT'ları `NOT_RUN` durumundadır. Bu nedenle EXT-064–EXT-069 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 103 `local_first_smart_home_energy` SHA-256 değeri `5aeba0e97de40f58119c08d215771146fbf065b9d51645c428735038a358cd80` ile doğrulanır. Beş hedef dosyada 25 test; PPK-021 için 555 dosya / 873 exact yüzey ve `843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc`; PPK-022 için 555 dosya / 392 exact yüzey ve `cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c` yerel teknik kanıttır. Bunlar dış sağlayıcı, gerçek cihaz, güvenlik sertifikasyonu veya requirement kapanışı değildir.
