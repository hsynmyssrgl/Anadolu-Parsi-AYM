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

Migration 104 `signed_plugin_external_provider_platform` SHA-256 değeri `6380b0fde34fd54d9743d234ad7915f4ddd81564a90681164596e77691f9edf5` ile doğrulanır. Altı hedef dosyada 30 test geçer. Güncel ratchet altında PPK-015 563 dosya / `f6fb78533a4776d3286a98e8caa3342549ad9f7c7672a1a1061cd483f2820c1b` ve sıfır bulgu; PPK-021 563 dosya / 886 exact yüzey / `58a90febf9382776c2b1472e6ffd6a645c9a24a4cd69e499a8afc1fff2e72b30`; PPK-022 563 dosya / 422 exact yüzey / `dc0234d84a50ff1872f9cde4fb7ab286446b236a69019034055fa938dbb3be1e` yerel teknik kanıttır. Bunlar production code-signing, eklenti yürütme, sağlayıcı bağlantısı veya requirement kapanışı değildir.
