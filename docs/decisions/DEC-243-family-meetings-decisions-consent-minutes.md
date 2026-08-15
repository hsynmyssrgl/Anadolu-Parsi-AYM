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
- Hedefli matris: 6 dosya / 31 test
- PPK-015: 532 dosya / `3638caa9263243a507538e7026fbf5a362906f4e774642e6cbc44861dbb718ec` / sıfır bulgu
- PPK-019: 532 dosya / sıfır bulgu
- PPK-021: 532 dosya / 851 yüzey / `27b67ea57816f95a2293428d96a743b19c1dace6d32bd1a7c8c2dc0af0ad42b2`
- PPK-022: 532 dosya / 375 yüzey / `8f597570bb8ddcee6fa549badbd87b39754d71687314d9ae8c9a63f3bafc20f8`

Gerçek çok katılımcılı UAT, AI provider, dış takvim/hatırlatıcı, uzaktan işbirliği, gizlilik, hukuk, güvenlik, erişilebilirlik ve retention kanıtları `NOT_RUN` durumundadır.
