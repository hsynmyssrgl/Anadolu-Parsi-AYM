# DEC-271 — Kardeş kanal program kökleri ve legacy kaldırma güvenliği

- Tarih: 24.08.2026
- Durum: ACTIVE
- Bağlayıcı kural: PR-236

## Karar

Bronze, Silver ve Gold programları legacy `C:\Program Files\PPT\ParsYuva` kökünün altında değil, sırasıyla `C:\Program Files\PPT\ParsYuva-Bronze`, `C:\Program Files\PPT\ParsYuva-Silver` ve `C:\Program Files\PPT\ParsYuva-Gold` kardeş dizinlerine kurulur. Kanal kullanıcı verisi `%APPDATA%\ParsYuva\<Kanal>` olarak ayrı kalır.

Kanal appId, productName, `ParsYuva-<Kanal>.exe`, `ParsYuva <Kanal>` kısayolu, kaldırma kapsamı, kullanıcı verisi, Git worktree ve branch yalıtımı korunur. Build çıktısı ve kullanıcı verisi kanallar arasında yeniden kullanılamaz.

PR-240 kaynak teslimi kapsamında, manifestte kayıtlı fakat Git'te izlenmeyen yönetişim/checkpoint payloadı da kanal dizinlerinde eksik bırakılamaz. Ayrıca aktif çalışma planındaki tamamlanmış adımların bütün `localEvidence` ve persistent receipt yolları governed preflight çalışmadan önce fiziksel olarak mevcut olmalıdır. Worktree kurulumu bu iki kümeyi doğrudan klasör kopyasıyla değil; tracked ve zaten manifest-bound yolları dışlayan, kanonik göreli yol, normal dosya, byte sayısı ve SHA-256 kimliği doğrulanmış seçici eşitlemeyle Bronze, Silver ve Gold'un ayrı çalışma dizinlerine taşır ve canlı readback yapar. Git'te izlenen dosyalar bu yolla üzerine yazılamaz; manifest/çalışma planı dışı stale dosyalar sessizce silinmez.

Yükseltme ve sessiz bakım kişisel veri seçim akışını açmaz. Per-machine kaldırıcı yalnız etkileşimli kaldırmada signed-in kullanıcının AppData bağlamına geçer ve iptal veya tamamlanma çıkışında all-users bağlamını geri yükler.

Legacy 37–44 uygulama kökü temizliği, legacy kökün altında `Bronze`, `Silver` veya `Gold` kanal dizini görürse recursive silmeden fail-closed durur. Legacy kullanıcı verisi otomatik taşınmaz ve silinmez; gerçek migration ayrı açık kullanıcı kararı, kaynak/target envanteri, geri dönüş planı ve canlı N→N+1 UAT kanıtı gerektirir.

## Supersession

DEC-269 ve PR-234'ün exact nested program-path hükmü superseded edilmiştir. DEC-269'un diğer kanal kimliği, kullanıcı verisi ve kaynak worktree yalıtımı bu karar ve PR-236 içinde korunur.

## Doğrulama

- `apps/desktop/build/installer.nsh`
- `apps/desktop/scripts/legacy-upgrade-data-preservation.mjs`
- `apps/desktop/scripts/verify-installer.mjs`
- `scripts/run-windows-installer-experience-uat.ps1`
- `scripts/create-bronze-final-local-test-delivery.mjs`
- `apps/desktop/tests/installer-upgrade-data-retention.test.ts`
- `apps/desktop/tests/installer-narration-experience.test.ts`
- `apps/desktop/tests/windows-installer-experience-uat-contract.test.ts`
- `apps/desktop/tests/brand-release-visual-contract.test.ts`
- `scripts/lib/source-manifest.mjs`
- `apps/desktop/tests/release-channel-isolation.test.ts`
- `apps/desktop/tests/source-manifest-worktree.test.ts`

Bu kaynak/test bağı gerçek installer üretimi, canlı yükseltme veya migration PASS iddiası değildir; paketleme ve kurulum bu değişiklikte yapılmaz.
