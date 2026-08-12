# PPK-021 Platform Policy AST fail gate tehdit modeli

## Korunan özellikler

- Üretim TypeScript/JSX kaynaklarının tamamı parse edilmeden build ilerlemez.
- Ayrıcalıklı yüzeyler exact dosya ve sembol kimliğiyle default-deny değerlendirilir.
- Doğrudan rol yetkilendirmesi sıfır istisnalıdır; renderer presentation koşulu yetki vermez.
- Yeni yüzey kadar stale ve wildcard izin de reddedilir.
- Statik allowlist runtime authority sayılmaz ve mevcut PEP/receipt/no-cache kontrollerini gevşetmez.

## Tehditler ve kontroller

1. **Regex kaçışı:** alias import, computed member, destructuring, `Reflect.construct`, dynamic import ve `require` AST düğümleriyle yakalanır.
2. **Parçalı dinamik modül adı:** statik çözülemeyen import/require hedefi `DYNAMIC_IMPORT_UNRESOLVED` olarak fail-closed reddedilir.
3. **Doğrudan SQL/SQLite:** driver importu, constructor, SQL prepare/exec/pragma/transaction ve SQL metot aliası exact yüzey dışında reddedilir.
4. **Somut repository/database erişimi:** `@ppt/repositories`, `@ppt/database` ve relative somut katman importları client veya yeni adapter yolunda otomatik olarak build'i durdurur.
5. **Kripto kaçışı:** Node crypto importu, alias'lanmış Web Crypto ve protected method çağrıları exact manifest dışında reddedilir.
6. **Network kaçışı:** Node transport modülleri, global/member/alias `fetch` ve browser transport constructorları exact manifest dışında reddedilir.
7. **Rol tabanlı fail-open:** comparison, includes/has, destructured alias ve switch rol dalları renderer dışında koşulsuz reddedilir; allowlist bunu geçersiz kılamaz.
8. **Politikasız use-case composition:** `new`, import aliası, member erişimi ve `Reflect.construct` ile use-case construction yalnız exact gözden geçirilmiş production composition anahtarında kabul edilir.
9. **Allowlist genişletme:** wildcard ve duplicate yasaktır; yeni giriş exact olmalı ve meaningful kategori gerekçesi taşımalıdır. Manifest değişikliği runtime grant değildir ve code review/contract hash zincirine girer.
10. **Stale izin:** koddan kaldırılmış yüzey allowlistte kalırsa gate FAIL verir; unutulmuş genişleme kalıcılaşmaz.
11. **Parser devre dışı bırakma:** explicit root dependency, pretypecheck/prebuild hooku, birleşik policy gate ve contract markerları birlikte doğrulanır.
12. **İstemci bilgi sızıntısı:** durum IPC'si source path, allowlist key/hash, SQL veya payload taşımaz ve cache edilmez.
13. **Statik PASS'i runtime yetkisi sayma:** policy snapshot ve UI açıkça `buildGateReplacesRuntimePolicy=false` taşır; PEP ve receipt regresyonları final demette ayrıca çalışır.
14. **Migration ile sahte kanıt:** PPK-021 persistence eklemez; migration 77, Desktop vault ve SQLite sahipliği değişmez.

## Sınırlar

AST ratchet yalnız kaynakta görünen üretim sözdizimini ve exact mevcut composition/import yüzeylerini denetler. Runtime reflection, native eklenti, dış binary veya capability manifest kapsamı bu paketle tamamlanmış sayılmaz. PPK-022 capability manifest build/runtime reddini ayrıca kuracaktır. Final doğrulamada hedefli fixture, tam test, production build, bağımlılık/workspace/karar defteri ve contract/runtime kanıtları gerçekten çalıştırılmış ve PASS vermiştir.
