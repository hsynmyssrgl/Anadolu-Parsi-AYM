# DEC-238 — İletişim politika çekirdeği ve MLS güvenlik temeli

## Durum

`34-A` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu başlangıç setiyle değiştirilmez. `countsAsRequirementPass=false`; kalıcı governance receipt ile dış ve manuel kanıtların tamamı `NOT_RUN` kalır.

## Karar

İletişim odası, cihaz kimliği, üyelik ve anahtar dönemi metadata'sı yalnız merkezi Life PEP receipt/fence altında; aile, hesap, kişi sahibi ve mevcut güvenilir cihazla bağlanarak yazılır. Yedi oda türü desteklenir. Mutation ve epoch ledgerları immutable; current satırlar optimistic revision, request fingerprint ve last-mutation bağı taşır. Yeni üye varsayılan olarak katılım öncesi geçmişi göremez. Kayıp veya iptal edilmiş cihaz aktif üyelikte kaldığı sürece yeni epoch mutasyonu reddedilir; kullanıcı açık yeniden anahtarlama komutuyla üyeliği çıkarıp yeni epoch kanıtını kaydeder.

Kriptografik sınır yalnız exact canonical Ed25519 sağlayıcı kanıtını, güven zamanı penceresini ve `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` sözlüğünü doğrular. Uygulama veritabanı özel anahtar, key package, provider sealed state, mesaj içeriği, ek, tepki veya düzenleme olayı taşımaz. Renderer yalnız güvenli metadata, sabit truth alanları ve dokuz bounded kanala erişir; mesaj, anahtar, hash, receipt, sealed reference, relay veya ağ otoritesi alamaz.

Production `CommunicationMlsFoundationPort` bu pakette yapılandırılmamıştır. Varsayılan DataStore yazmaları fail-closed reddeder. Bu nedenle metadata zinciri gerçek RFC 9420 uygulaması, conformance, ileri gizlilik, saldırı sonrası güvenlik, relay içerik körlüğü, mesaj olayı imzası veya ağ teslimi kanıtı değildir. Explicit snapshot geçmiş politikası yalnız karar metadata'sıdır; tarihsel mesaj aktarmaz.

## Dürüstlük sınırı

COM-002'nin oda türü ve yönetim temeli ile SEC-COM-003/007/008'in yerel metadata/state-machine parçaları uygulanmıştır. COM-001 mesajlaşma yaşam döngüsü, SEC-COM-001/002'nin gerçek MLS sağlayıcısı ve üretim kriptografik kanıtı, SEC-COM-004 mesaj olay bütünlüğü, SEC-COM-005 relay teslimi ve SEC-COM-006 trafik/metadata minimizasyonunun canlı ağ kanıtı uygulanmış sayılmaz. PPK-001 ve XPF-002 için yalnız mevcut merkezi PEP bileşimi kanıtlanır; tüm iletişim/kayıt/rıza/retention kapsamı kapanmaz.

## Yerel kanıt

Migration 105 `communication_policy_mls_foundation` SHA-256 değeri `3c02d8f0ac6e2b5bf4d6a05bfc73e82fbd14d6144b0c3ef93a49786e45b8b7d7` ile doğrulanır. Altı hedef dosyada 29 test geçer. PPK-015 500 dosya ve sıfır bulgu; PPK-021 500 dosya / 779 exact yüzey / `6db3beb33e735c2bf46eb2af7250f700cd771536f850b1ffbc9c425556a342f1`; PPK-022 500 dosya / 345 exact yüzey / `2f58fd1c0a82afa41ca8f1930ae15ebb792075d47d0f9e2e24872c4aa0facd50` yerel teknik kanıttır. Bunlar production MLS, mesaj teslimi veya requirement kapanışı değildir.
