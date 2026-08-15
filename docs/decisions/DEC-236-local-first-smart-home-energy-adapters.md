# DEC-236 — Yerel-first akıllı ev ve enerji adapterleri

## Durum

`33-Y` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu başlangıç setiyle değiştirilmez. `countsAsRequirementPass=false`; kalıcı governance receipt ile dış ve manuel kanıtların tamamı `NOT_RUN` kalır.

## Karar

Akıllı ev ve enerji merkezi yalnız oturumdaki hesap, aile ve kişi sahibine bağlanan merkezi Life PEP receipt/fence altında çalışır. Cihaz kaydı yalnız main-process tarafından sağlanan doğrulanmış imza sonucu, adapter manifest özeti ve içeriksiz yerel kimlik özetiyle kabul edilir. Renderer bu güven kanıtlarını, sağlayıcı gözlemlerini veya cihaz durumunu yazamaz.

Gözlemler yalnız cihaz türüyle uyumlu, sınırlandırılmış boolean ya da sayısal metadata taşır. Ham kamera, ses, dosya yolu veya sağlayıcı payload'ı veritabanına, audit'e, outbox'a ve IPC'ye girmez. Kamera ve kapı zili erişimi varsayılan kapalıdır; yalnız görünür kullanıcı işlemiyle beş ile altmış dakika arasında izin verilebilir ve geri alınabilir. Gizli gözetim yasaktır.

Bu paket cihaz kontrolü yapmaz. Matter eşleme, canlı sağlayıcı bağlantısı, gerçek sensör/enerji sağlayıcı ingestion'ı, kamera akışı, uzaktan komut ve bulut teslimatı uygulanmış sayılmaz. Yerel UI mevcut Yaşam Merkezi'ni genişletir; ayrı rota eklemez.

## Dürüstlük sınırı

Uygulanan yüzey imzalı-adapter metadata sınırı, immutable mutation ledger, optimistic revision, idempotent replay, içeriksiz audit/outbox, dört renderer-safe kanal ve süreli görünür kamera iznidir. Gerçek Matter cihazı, sağlayıcı, enerji sayacı, kamera/kapı zili, cihaz kontrolü, privacy/safety ve legal UAT'ları `NOT_RUN` durumundadır. Bu nedenle EXT-064–EXT-069 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 103 `local_first_smart_home_energy` SHA-256 değeri `d41d1a1e1bff6b89638a44096eb2ef62358e4d5370ef82d58ae2f0b4de211513` ile doğrulanır. Beş hedef dosyada 21 test; PPK-021 için 486 dosya / 751 exact yüzey ve `63e2766aa18e42b1472a9ccf9521c586b81ac19e36d7d9ca72fe48e872be2aa2`; PPK-022 için 486 dosya / 345 exact yüzey ve `1b8625264023eb79d3f36a3c25ca19480569bea6aa1f4589841b1b4d14d5ec3e` yerel teknik kanıttır. Bunlar dış sağlayıcı, gerçek cihaz, güvenlik sertifikasyonu veya requirement kapanışı değildir.
