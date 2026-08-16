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

Migration 105 `communication_policy_mls_foundation` SHA-256 değeri `3c02d8f0ac6e2b5bf4d6a05bfc73e82fbd14d6144b0c3ef93a49786e45b8b7d7` ile doğrulanır. Altı hedef dosyada 29 test geçer. PPK-015 555 dosya / `b317ddff292dcc5666f725a43f3425319a1b28fdfd09b6691bb64d3f9b495e6a` ve sıfır bulgu; PPK-021 555 dosya / 873 exact yüzey / `843cb93dce2402bbaeb3d44b5538b88a3a55f4832436ad23aaf61937bc8c99dc`; PPK-022 555 dosya / 392 exact yüzey / `cb879c739cb8ef3a2e92d1f0e451cd21ba7e9d4b0fcd519f343cddd725c9745c` yerel teknik kanıttır. Bunlar production MLS, mesaj teslimi veya requirement kapanışı değildir.
