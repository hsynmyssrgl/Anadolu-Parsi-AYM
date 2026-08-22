# DEC-264 — Görünür sürüm kanalının tek kez gösterilmesi

- Tarih: 22.08.2026
- Durum: ACTIVE
- Etkili sürüm: Bronze 22.08.2026.43
- Kaynak: Açık kullanıcı kararı

## Karar

ParsYuva'nın kullanıcıya görünür sürüm satırlarında sürüm kanalı yalnız bir kez gösterilir. `Bronze 22.08.2026.43 · Bronze · Aktif Geliştirme` gibi yinelenen biçimler yasaktır. Kural Bronze, Silver ve Gold sürümlerinin tamamı için geçerlidir.

Kanal adı yalnız kanonik `releaseLabel` alanında bulunur. Yaşam döngüsü durumu olan `stage` yalnız `Aktif Geliştirme`, `Doğrulama` veya ilgili kanal-bağımsız durumu taşır; Bronze, Silver ya da Gold adını içeremez. Türkçe ve İngilizce yüzeyler aynı tekilleştirme kuralına uyar.

## Teknik uygulama

- `formatUserVisibleReleaseSummary` görünür sürüm özeti için tek ortak biçimlendiricidir.
- `toUserVisibleAppInfo`, `stage` içinde herhangi bir kanal adı görürse fail-closed reddeder.
- İlk kurulum, güvenli başlangıç ve ana uygulama sürüm yüzeyleri kanal ile sürüm etiketini ayrı ayrı birleştiremez.
- `scripts/verify-user-visible-release-display-policy.mjs` kuralı `GOVERNED_PREFLIGHT` içinde zorunlu doğrular.

## Doğrulama

- `packages/domain/tests/user-visible-release.test.ts`
- `apps/desktop/tests/user-visible-release-boundary-runtime.test.ts`
- `artifacts/validation/user-visible-release-display-policy.json`

Bu karar sürüm numarası, kanal terfi yetkisi veya kanal paleti kurallarını değiştirmez; yalnız kullanıcıya görünür metindeki gereksiz kanal tekrarını yasaklar.
