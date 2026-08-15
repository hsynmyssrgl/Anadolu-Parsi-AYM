# DEC-237 — İmzalı eklenti ve dış sağlayıcı aday platformu

## Durum

`33-Z` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu başlangıç setiyle değiştirilmez. `countsAsRequirementPass=false`; kalıcı governance receipt ile dış ve manuel kanıtların tamamı `NOT_RUN` kalır.

## Karar

Yerel aday kayıt merkezi yalnız main-process tarafında güvenilen public anahtarla doğrulanan exact `ppt-signed-plugin-manifest` v1 zarfını kabul eder. Manifest Ed25519 imzasını; eklenti ve sürüm kimliğini; paket, entrypoint, SBOM, lisans envanteri ve provenance SHA-256 kanıtlarını; minimum capability kümesini; veri hassasiyeti, amaç, erişim ve en çok otuz günlük retention beyanını; exact public-host egress allowlistini ve fail-closed sandbox sözleşmesini bağlar. Renderer manifest, imza, anahtar, hash, paket yolu, credential, token veya egress hostu gönderemez.

Kayıt, güncelleme, istenen durum, acil kapatma ve geri alma merkezi Life PEP receipt/fence altında; aile, hesap ve kişi sahibiyle; optimistic revision, idempotent request fingerprint, immutable mutation ve release ledgerlarıyla atomik yürür. Yeni sürüm varsayılan kapalıdır. Acil kapatılmış sürüm aynı release ile yeniden etkinleştirilemez. Geri alma yalnız exact önceki, süresi geçerli ve daha önce doğrulanmış release kaydına yapılır.

Bu paket üçüncü taraf kodu çalıştırmaz ve dış sağlayıcıya bağlanmaz. Banka, okul, Matter, FHIR, OneDrive, harita, OCR, AI ve tarayıcı yalnız manifest provider/capability sözlüğüdür. Production imza güveni, Authenticode, gerçek sandbox, işletim sistemi ağ izolasyonu, provider credential kasası ve canlı provider adapterleri uygulanmış sayılmaz.

## Dürüstlük sınırı

Uygulanan yüzey yerel aday manifest doğrulaması, kalıcı metadata kayıt merkezi, rollback/acil kapatma kaydı, dört renderer-safe kanal ve içeriksiz audit/outbox zinciridir. PPK-025 gerçek production sertifika ve iki PE Authenticode kanıtı olmadığı için açık kalır. Gerçek provider, sandbox, ağ izolasyonu, zafiyet/lisans, privacy, legal ve security incelemeleri `NOT_RUN` durumundadır. Bu nedenle B6-05, PPK-025 ve EXT-075–EXT-081 tamamlanmış sayılmaz.

## Yerel kanıt

Migration 104 `signed_plugin_external_provider_platform` SHA-256 değeri `91a16031e87986f5b6e561cd9e767ad0b7e68d3c030ceace4276441b921b6547` ile doğrulanır. Altı hedef dosyada 26 test geçer. PPK-015 493 dosya ve sıfır bulgu; PPK-021 493 dosya / 763 exact yüzey / `386c030def9a2dda0dec8a24a8ba3a1ef0abba1b4f068bb3ab43f078d244923e`; PPK-022 493 dosya / 345 exact yüzey / `2f58fd1c0a82afa41ca8f1930ae15ebb792075d47d0f9e2e24872c4aa0facd50` yerel teknik kanıttır. Bunlar production code-signing, eklenti yürütme, sağlayıcı bağlantısı veya requirement kapanışı değildir.
