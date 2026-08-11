# DEC-157 - PPK-002 aile veri aktarımı merkezi yetkilendirme yerel devam dilimi

## Durum

ACTIVE - 2026-08-10 tarihli yerel devam kararı.

## Karar

DEC-137 sırası ve DEC-156 ile açılan PPK-002 yerel devam yetkisi korunarak, aile veri aktarımı servisindeki üç doğrudan `family_admin` rol kontrolü merkezi yetkilendirme servisine taşınmıştır. Bu çalışma `LOCAL_CONTINUATION_ONLY` kapsamındadır; yeni Build değildir, resmî 30-Z adımını ilerletmez ve haricî Library receipt durumunu `PENDING` olarak korur.

## Uygulama sınırı

- Ön izleme ve listeleme `read`, uygulama `create`, geri alma `delete` eylemiyle `family_data_import:{familyId}` kaynağında değerlendirilir.
- Hesap etkinliği, üyelik tarih aralığı, rol ve kişi bağlamı repository kaydıyla doğrulanır.
- Etkin nesne izinleri merkezi karara dahil edilir; explicit deny rol izninden önce gelir.
- Yetkisiz ön izleme dosya sistemine erişmeden reddedilir.
- Uygulama ve geri alma, güçlü kimlik doğrulama öncesinde yetki kontrolünden geçer; değişiklik transaction'ı içinde tekrar yetkilendirilir.
- Ham konum, etkinlikte `locationId` ve receipt batch'i olmayan etkinlik aktarımı fail-closed kalır.

## Açık kalanlar

Bu dilim doğrudan rol bypass borcunu üç azaltır; kalıcı platform-policy receipt batch'i üretmez. Multi-receipt import, obligation execution, evrensel API/IPC/UI/repository enforcement, haricî monoton otorite ve 30-Z haricî receipt açık kalır. Bu nedenle PPK-002 `PARTIAL` durumundadır.

## İzlenebilirlik

- Öncelik ve kapsam: `DEC-137`, `DEC-152`, `DEC-156`
- Uygulama: `apps/desktop/src/main/family-data-import-service.ts`
- Composition: `apps/desktop/src/main/data-store.ts`
- Regresyon: `apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts`
- Doğrulayıcı: `scripts/verify-ppk002-family-data-import-policy-local-continuation.mjs`
- Kanıt: `artifacts/validation/PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json`
- Denetim: `docs/audit/PPK-002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.md`

Çalıştırılmayan veya kapsam dışı kontroller PASS sayılmamıştır.
