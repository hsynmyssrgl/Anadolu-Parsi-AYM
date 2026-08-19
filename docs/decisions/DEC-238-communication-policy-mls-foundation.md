# DEC-238 — İletişim politika çekirdeği ve MLS güvenlik temeli

## Durum

`34-A` yol haritasında `PLANNED`, yerel zincirde `LOCAL_IMPLEMENTATION_STARTED` durumundadır. Registry, roadmap, çalışma planı ve aktif governance ledger bu başlangıç setiyle değiştirilmez. `countsAsRequirementPass=false`; kalıcı governance receipt ile dış ve manuel kanıtların tamamı `NOT_RUN` kalır.

## Karar

İletişim odası, cihaz kimliği, üyelik ve anahtar dönemi metadata'sı yalnız merkezi Life PEP receipt/fence altında; aile, hesap, kişi sahibi ve mevcut güvenilir cihazla bağlanarak yazılır. Yedi oda türü desteklenir. Mutation ve epoch ledgerları immutable; current satırlar optimistic revision, request fingerprint ve last-mutation bağı taşır. Yeni üye varsayılan olarak katılım öncesi geçmişi göremez. Kayıp veya iptal edilmiş cihaz aktif üyelikte kaldığı sürece yeni epoch mutasyonu reddedilir; kullanıcı açık yeniden anahtarlama komutuyla üyeliği çıkarıp yeni epoch kanıtını kaydeder.

Her ileri epoch kanıtı aynı sağlayıcı kimliği ve implementation'ı ile önceki epoch, commit ve confirmed-transcript özetine bağlanır. Kayıp tek sahip cihazı odayı kalıcı kilitlemez: yalnız aynı kişiye ait aktif ve doğrulanmış yedek credential açık komutta verilirse eski sahip üyeliği kaldırılır ve yedek sahip üyeliği aynı transactionda kurulur. Renderer'ın kapsam kaynağı seçmesine izin verilmez; ikinci kaynak PEP zinciri uygulanana kadar `scopeResourceType/scopeResourceId` uygulama, IPC ve migration sınırında fail-closed reddedilir.

Kalıcı metadata üst sınırları sahip başına 32 cihaz credential'ı, 256 oda ve 100.000 mutation; oda başına 128 üyelik kaydı ve 4.096 epoch kanıtıdır. Uygulama provider çağrısından önce, repository okuma sınırında ve SQLite triggerlarında aynı kotaları uygular; UI mevcut kullanım ve sınırı gösterir. Sessiz kırpma veya otomatik geçmiş silme yoktur. Otomatik retention/kota kurtarması kararlaştırılmadığından kapasite dolması açık uzun-ömür riski olarak kalır.

Kriptografik sınır yalnız exact canonical Ed25519 sağlayıcı kanıtını, güven zamanı penceresini ve `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` sözlüğünü doğrular. Uygulama veritabanı özel anahtar, key package, provider sealed state, mesaj içeriği, ek, tepki veya düzenleme olayı taşımaz. Renderer yalnız güvenli metadata, sabit truth alanları ve dokuz bounded kanala erişir; mesaj, anahtar, hash, receipt, sealed reference, relay veya ağ otoritesi alamaz.

Production `CommunicationMlsFoundationPort` bu pakette yapılandırılmamıştır. Varsayılan DataStore yazmaları fail-closed reddeder. Bu nedenle metadata zinciri gerçek RFC 9420 uygulaması, conformance, ileri gizlilik, saldırı sonrası güvenlik, relay içerik körlüğü, mesaj olayı imzası veya ağ teslimi kanıtı değildir. Explicit snapshot geçmiş politikası yalnız karar metadata'sıdır; tarihsel mesaj aktarmaz.

## Dürüstlük sınırı

COM-002'nin oda türü ve yönetim temeli ile SEC-COM-003/007/008'in yerel metadata/state-machine parçaları uygulanmıştır. COM-001 mesajlaşma yaşam döngüsü, SEC-COM-001/002'nin gerçek MLS sağlayıcısı ve üretim kriptografik kanıtı, SEC-COM-004 mesaj olay bütünlüğü, SEC-COM-005 relay teslimi ve SEC-COM-006 trafik/metadata minimizasyonunun canlı ağ kanıtı uygulanmış sayılmaz. PPK-001 ve XPF-002 için yalnız mevcut merkezi PEP bileşimi kanıtlanır; tüm iletişim/kayıt/rıza/retention kapsamı kapanmaz.

## Yerel kanıt

Migration 105 `communication_policy_mls_foundation` SHA-256 değeri `7756e6e14267e84eb3c7643b4da3534178bf706a2ed551af6f9068451ecfb4f8` ile doğrulanır. Altı hedef dosyada 37 test geçer. PPK-015 568 dosya / `8ef8bf331b1c484c595c2639b9da313d8ae6e0cd5e8751fa921bef2fdcccee64` ve sıfır bulgu; PPK-021 568 dosya / 889 exact yüzey / `3a297f74d43d4675090a709d4359af9245c2971a7fc338afef2fb87b1c8608dd`; PPK-022 568 dosya / 428 exact yüzey / `1bf21d23c862afbccb9611083c093f9ced703adadf7a170c29f53479d21397b1` yerel teknik kanıttır. Bunlar production MLS, mesaj teslimi veya requirement kapanışı değildir.
