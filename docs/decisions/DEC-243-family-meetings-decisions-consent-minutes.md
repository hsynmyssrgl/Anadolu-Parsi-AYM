# DEC-243 — Aile toplantıları, kararlar ve rızaya bağlı tutanaklar

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED
Karar tarihi: 2026-08-15
Gereksinimler: MTG-001..MTG-010
Bağımlılıklar: 34-B, 34-D, 34-E, 33-W

## Karar

Aile toplantıları mevcut Yaşam Merkezi içinde, sahibine bağlı `family_meeting` aggregate'i olarak yönetilecektir. Tek seferlik ve yinelenen plan, katılımcı rolleri ve katılım durumu, gündem ve ön okuma referansları, oylama, değiştirilemez kararlar, sorumlu kişi ve görev takibi aynı merkezi Life PEP/UoW sınırına bağlanır. Yeni menü veya ayrı yetki yüzeyi açılmaz.

Her kalıcı mutasyon merkezi PEP kararından doğan receipt, writable fence ve journal projection ile aynı SQLite transaction'ında yazılır. Current satırlar optimistic revision ile; replay `clientOperationId + requestFingerprint` eşliğiyle korunur. Oylama, karar, anket tanımı ve işbirliği referansları append-only'dir. Audit ve outbox yalnız mutasyon türü, kaynak kimliği ve revision taşır; karar metni, görüş notu veya tutanak içeriği taşımaz.

Toplantı tutanağının plaintext'i SQLite'a yazılmaz. İnsan tarafından onaylanan tutanak, ana süreçte ayrı ve sınırlandırılmış `ProtectedSideArtifactStore` kökünde şifrelenir; no-overwrite atomik yayın, dosya kimliği ve readback doğrulaması zorunludur. Renderer yalnız yetkili, çözülmüş içerik görünümünü alır; dosya yolu, sealed reference, hash, receipt veya owner kimliği almaz.

AI tutanak hazırlığı yalnız 34-D kayıt talebi için tüm katılımcıların açık rıza kanıtı doğrulandığında denenebilir. Production AI provider bugün yapılandırılmamıştır; deneme `provider_unavailable` olarak dürüstçe kapanır ve ağ/cloud kullanılmaz. Buna rağmen kullanıcı tarafından yazılmış ve açıkça onaylanmış yerel şifreli tutanak AI olmadan tamamlanabilir.

## Fail-honest sınır

Yerel planlama ve şifreli tutanak zinciri bileşiktir fakat harici takvim, gerçek bildirim teslimi, uzaktan eşzamanlı işbirliği, belge yükleme veya ağ servisi yoktur. Production AI minutes provider yoktur ve AI kalitesi ölçülmemiştir. Renderer takvim, dosya sistemi, provider, network veya cloud yetkisi kazanmaz.

Mutation ledger hesap başına 4096 satır ve toplantılar sahibine göre 128 satırla sınırlıdır. Yaşam boyu retention/compaction politikası henüz yoktur; uzun ömürlü kullanımda kota kilidi residual riskidir. Şifreli tutanakların backup propagasyonu, fiziksel güvenli silme ve otomatik orphan sweep kanıtı yoktur.

Bu nedenle `countsAsRequirementPass=false`; gerçek katılımcı, kayıt rızası, AI provider, hatırlatıcı, kurtarma ve inceleme kanıtları `NOT_RUN` kalır. Registry, roadmap, work plan, active ledger ve persistent receipt bu yerel başlangıç paketiyle kapanmış sayılmaz.

## Kanıt

- Migration 110: `8bcc5777aa80794122742bcfd73be036234488f5861adbcd34956c56e6d0d6ac`
- Hedefli matris: 6 dosya / 32 test
- PPK-015: 563 dosya / `2a8d8006b6bd5c00d79f1bf69eb1f5a553ece32dd2dd3c96d40454bfcff29f7f` / sıfır bulgu
- PPK-019: 563 dosya / sıfır bulgu
- PPK-021: 563 dosya / 886 yüzey / `58a90febf9382776c2b1472e6ffd6a645c9a24a4cd69e499a8afc1fff2e72b30`
- PPK-022: 563 dosya / 422 yüzey / `dc0234d84a50ff1872f9cde4fb7ab286446b236a69019034055fa938dbb3be1e`

Gerçek çok katılımcılı UAT, AI provider, dış takvim/hatırlatıcı, uzaktan işbirliği, gizlilik, hukuk, güvenlik, erişilebilirlik ve retention kanıtları `NOT_RUN` durumundadır.
