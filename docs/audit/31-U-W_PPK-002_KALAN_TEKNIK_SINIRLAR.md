# 31-U-W PPK-002 kalan teknik sınırlar denetimi

- 31-U: 221 Desktop IPC kanalı ortak PEP bileşimine bağlandı; önbellek dönüşü de yeniden yetkilendiriliyor.
- Arşiv listeleme, arama, açma planı, sürüm, saklama ve sınıflandırma okumaları receipt-bound repository context gerektiriyor.
- 31-V: on iki politika yükümlülüğü için fail-closed yürütme kontrolü ve makbuza bağlı attestation eklendi.
- 31-W: Core Service dış monotonik günlük otoritesi; rollback, equivocation ve boyut gerilemesi reddi eklendi.
- Doğrudan ana süreç/uygulama/repository `family_admin` yetkilendirme karşılaştırması sıfırlandı; renderer sunum koşulları yetki vermeyen ayrı gözlem olarak raporlanıyor.
- Üst gereksinim gerçeği: IPC dışı iç ordinary repository context geçişi bitmediği için PPK-002 kısmi kalır.

Kanıtlar:

- `artifacts/validation/31-U-W-ppk-002-remaining-boundaries-contract.json`
- `artifacts/validation/31-U-W-ppk-002-remaining-boundaries-runtime.json`
- `artifacts/validation/platform-policy-gate.json`
- `apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts`
- `apps/core-service/tests/platform-policy-obligation-execution.test.ts`
- `apps/core-service/tests/policy-journal-monotonic-authority.test.ts`
- `apps/desktop/tests/archive-production-policy-runtime.test.ts`

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
