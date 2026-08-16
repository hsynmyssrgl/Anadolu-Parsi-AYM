# DEC-237 — İmzalı eklenti ve dış sağlayıcı aday platformu

## Durum

`33-Z` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu başlangıç setiyle değiştirilmez. `countsAsRequirementPass=false`; kalıcı governance receipt ile dış ve manuel kanıtların tamamı `NOT_RUN` kalır.

## Karar

Yerel aday kayıt merkezi yalnız main-process tarafında güvenilen public anahtarla doğrulanan exact `ppt-signed-plugin-manifest` v1 zarfını kabul eder. Manifest Ed25519 imzasını; eklenti ve sürüm kimliğini; minimum host sürümünü; paket, entrypoint, SBOM, lisans envanteri ve provenance SHA-256 kanıtlarını; çift yönlü provider/capability kümesini; en az bir veri hassasiyeti, amaç, erişim ve en çok otuz günlük retention beyanını; exact public-host egress allowlistini ve fail-closed sandbox sözleşmesini bağlar. Renderer manifest, imza, anahtar, hash, paket yolu, credential, token veya egress hostu gönderemez.

Kayıt, güncelleme, istenen durum, acil kapatma ve geri alma merkezi Life PEP receipt/fence altında; aile, hesap ve kişi sahibiyle; optimistic revision, canonical idempotent request fingerprint, immutable mutation ve release ledgerlarıyla atomik yürür. Yeni sürüm varsayılan kapalıdır. Acil kapatma durumu normal kapatma veya rollback ile temizlenemez; yalnız daha yüksek yeni imzalı sürüm bu kilidi kaldırır. Geri alma yalnız exact önceki, süresi geçerli ve daha önce doğrulanmış release kaydına yapılır. Owner başına 200 kurulum, eklenti başına 64 sürüm ve owner başına 100.000 mutasyon üst sınırı fail-closed uygulanır; otomatik retention kurtarması uygulanmış sayılmaz.

Bu paket üçüncü taraf kodu çalıştırmaz ve dış sağlayıcıya bağlanmaz. Banka, okul, Matter, FHIR, OneDrive, harita, OCR, AI ve tarayıcı yalnız manifest provider/capability sözlüğüdür. Production imza güveni, Authenticode, gerçek sandbox, işletim sistemi ağ izolasyonu, provider credential kasası ve canlı provider adapterleri uygulanmış sayılmaz.

## Dürüstlük sınırı

Uygulanan yüzey yerel aday manifest doğrulaması, minimum-host ve kapasite kapıları, kalıcı metadata kayıt merkezi, rollback/acil kapatma kilidi, dört renderer-safe kanal ve içeriksiz audit/outbox zinciridir. PPK-025 gerçek production sertifika ve iki PE Authenticode kanıtı olmadığı için açık kalır. Gerçek provider, sandbox, ağ izolasyonu, zafiyet/lisans, privacy, legal ve security incelemeleri `NOT_RUN` durumundadır. Bu nedenle B6-05, PPK-025 ve EXT-075–EXT-081 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 104 `signed_plugin_external_provider_platform` SHA-256 değeri `6380b0fde34fd54d9743d234ad7915f4ddd81564a90681164596e77691f9edf5` ile doğrulanır. Altı hedef dosyada 30 test geçer. Güncel ratchet altında PPK-015 555 dosya / `aa3dd95d42449907db73c768a556affd194f97a0752a9c9ac53a3bf2491b6bc4` ve sıfır bulgu; PPK-021 555 dosya / 873 exact yüzey / `843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc`; PPK-022 555 dosya / 392 exact yüzey / `cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c` yerel teknik kanıttır. Bunlar production code-signing, eklenti yürütme, sağlayıcı bağlantısı veya requirement kapanışı değildir.
