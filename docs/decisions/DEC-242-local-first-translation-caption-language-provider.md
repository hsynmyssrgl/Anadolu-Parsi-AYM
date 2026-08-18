# DEC-242 — Yerel öncelikli çeviri, altyazı ve dil sağlayıcısı

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED
Karar tarihi: 2026-08-15
Gereksinimler: AI-LNG-001..AI-LNG-011
Bağımlılıklar: 33-Q, 33-W, 34-C, 34-D

## Karar

Mesaj, canlı altyazı, belge ve toplantı özeti için tek `TranslationProviderPort` sözleşmesi kullanılacaktır. Bu sözleşme içerik veya sağlayıcı yetkisini renderer'a vermez. Üretim bileşimi bugün yalnız sahibine bağlı dil profili, kişisel sözlük, sağlayıcı kullanmadan hazırlık talebi, açık izinli düzeltme özeti ve iptal metadata'sını kalıcılaştırır.

Her yazım merkezi PEP kararından üretilen kalıcı receipt, writable fence ve journal projection ile aynı SQLite transaction'ına bağlanır. Mutasyon ve olay kayıtları append-only, current satırlar optimistic revision, replay ise `clientOperationId + requestFingerprint` eşliği ile korunur. Politika çözümleyicisi payload taşımaz. Audit ve outbox yalnız mutation türü, kaynak kimliği ve revision taşır.

Kişisel sözlük açık izin gerektirir; mantıksal silme kaynak ve tercih terimini boşaltır. Düzeltmenin plaintext'i mutation, event, audit ve outbox'a yazılmaz; yalnız SHA-256 ve karakter sayısı current request metadata'sında tutulur. Dış sağlayıcı modu ancak önizleme kabulü ve ayrı açık onay birlikte verildiğinde hazırlanabilir. Bu yine de provider çağrısı veya içerik aktarımı değildir.

## Fail-honest sınır

`TranslationProviderPort` ortak seam'i modellenmiştir fakat production adapter yoktur. Yerel dil paketi kurulmamıştır. Dil algılama, çeviri, konuşmadan metne, canlı altyazı, konuşmacı ayrımı, altyazı çevirisi ve metinden sese çalıştırılmaz. Orijinal ses susturulmaz. Dış sağlayıcı yapılandırılmaz, önizleme teslim edilmez, içerik ağa gönderilmez. Şifreli cihazlar arası tercih/sözlük eşitlemesi çalıştırılmaz.

Bu nedenle `countsAsRequirementPass=false`; gerçek provider, gerçek cihaz ve kalite kanıtları `NOT_RUN` kalır. Registry, roadmap, work plan, active ledger, persistent receipt, prepare/finalize/completion ve release yetkisi bu başlangıç paketiyle değiştirilmez.

## Kanıt

- Migration 109: `619461d7ce65e87d9095fc2ea88cf9f801261b9309da67c0b67183c46094e71b`
- Hedefli matris: 5 dosya / 23 test
- PPK-015: 563 dosya, sıfır bulgu
- PPK-019: sıfır bulgu
- PPK-021: 563 dosya / 886 yüzey / `58a90febf9382776c2b1472e6ffd6a645c9a24a4cd69e499a8afc1fff2e72b30`
- PPK-022: 563 dosya / 422 yüzey / `dc0234d84a50ff1872f9cde4fb7ab286446b236a69019034055fa938dbb3be1e`

Dış sağlayıcı önizlemesi ayrıca profil düzeyinde etkin olmalıdır. Kişisel sözlük girdisinin kaynak dil/hedef dil/kaynak terim kimliği güncellemeyle değiştirilemez. Düzeltme metni ve onun SHA-256 özeti renderer'a verilmez; yalnız düzeltme varlığı ile sınırlandırılmış karakter sayısı gösterilir.

Gerçek provider, network, cihazlar arası senkronizasyon, gizlilik, hukuk, güvenlik, erişilebilirlik ve dil kalitesi UAT kanıtları `NOT_RUN` durumundadır.
