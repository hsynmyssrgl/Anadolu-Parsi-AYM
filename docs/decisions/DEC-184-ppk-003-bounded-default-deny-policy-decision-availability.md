# DEC-184 — PPK-003 sınırlı süreli varsayılan-ret politika kararı erişilebilirliği

## Durum

31-Y kapsamında kabul edildi ve tamamlandı. PPK-003 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Platform Policy Enforcement Point, korunan işlem başlamadan önce ihtiyaç duyduğu bütün güvenilir bağımlılıkları sınırlı sürede sonuçlandırmak zorundadır. Yetki bağlamı, kaynak bağlamı, replay rezervasyonu, politika yetkilendirmesi, imzalı makbuz doğrulaması veya zorunlu makbuz kalıcılığı belirlenen sürede sonuçlanmazsa işlem `POLICY_DECISION_UNAVAILABLE` ile reddedilir. Hata yalnız sabit bir aşama kimliği taşır; veri yolu, anahtar, parola, token veya aile verisi taşımaz.

Varsayılan üretim süresi her bağımlılık aşaması için beş saniyedir. Geçersiz bileşim kurulum sırasında `ENFORCEMENT_UNAVAILABLE` ile durur. Süre aşımından sonra gelen gecikmiş bir izin kararı, işlem callback'ini açamaz. İzin ancak yetki ve kaynak çözümü, nonce rezervasyonu, imzalı karar, makbuz doğrulaması, küme fence kontrolü, obligation yürütmesi ve gerekli makbuz kalıcılığı tamamlandıktan sonra etkili olabilir.

Desktop tarafındaki bütün kimliği doğrulanmış renderer API'leri ortak PEP üzerinden çalışmaya; üretim SQLite repository sınıfları aktif, imzalı ve korelasyonla bağlı kapsam istemeye devam eder. UI ve menü eylemleri sandbox preload IPC köprüsü dışına çıkamaz. Mevcut policy transaction şeması ve migration zinciri korunur; karar otoritesi yokken veritabanına ikincil veya güvenilmez bir “izin” kaydı yazılmaz.

## Güvenlik sınırı

Bu karar gerçek kasa veya aile verisini Core Service'e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Eski Desktop kasası aktif ve yetkilidir.

## Kapanış kanıtı

- `packages/platform-policy/policy-decision-availability.test.ts`: 9/9 PASS; altı asenkron bağımlılık aşaması, eksik bileşim, başarılı yol ve gecikmiş izin reddi.
- `artifacts/validation/31-Y-ppk-003-default-deny-availability-contract.json`: 22/22 PASS statik sözleşme kanıtı.
- `artifacts/validation/31-Y-ppk-003-default-deny-availability-runtime.json`: 4/4 PASS; tam Vitest 52 dosya/280 test ve PPK-002 evrensel enforcement 9/9 regresyon kanıtı.
- Kök TypeScript: 0 diagnostic.
- `docs/audit/31-Y_PPK-003_VARSAYILAN_RET_UST_KAPANIS.md`: üst kapanış denetimi.

Bu kapanış yalnız PPK-003 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
