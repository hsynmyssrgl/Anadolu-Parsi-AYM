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

Migration 103 `local_first_smart_home_energy` SHA-256 değeri `5aeba0e97de40f58119c08d215771146fbf065b9d51645c428735038a358cd80` ile doğrulanır. Beş hedef dosyada 25 test; PPK-021 için 568 dosya / 889 exact yüzey ve `3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd`; PPK-022 için 568 dosya / 428 exact yüzey ve `1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1` yerel teknik kanıttır. Bunlar dış sağlayıcı, gerçek cihaz, güvenlik sertifikasyonu veya requirement kapanışı değildir.

## 24.08.2026 değişiklik-etki doğrulaması

PR-235 kapsamında güncel kullanıcı dili ve renderer sözleşmesi bu karara yeniden bağlandı; 52/52 sınır-sözleşme-çalışma zamanı zinciri PASS oldu. Bu kayıt dış/manual kanıtları kapatmaz ve `countsAsRequirementPass=false` sınırını değiştirmez.
