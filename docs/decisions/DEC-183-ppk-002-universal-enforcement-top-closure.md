# DEC-183 — PPK-002 evrensel enforcement üst kapanışı

## Durum

31-X kapsamında kabul edildi ve tamamlandı. PPK-002 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Üretim `FamilyDataStore` bileşimi, bütün SQLite repository örneklerine aynı fail-closed yürütme koruyucusunu verir. Repository taban sınıfı hem normal `execute` girişinde hem de doğrudan `database` erişiminde aktif politika kapsamını doğrular. Aktif kapsam yoksa, korelasyon değişmişse, imzalı transaction context süresi dolmuşsa veya cluster fence değişmişse repository işlemi başlamadan reddedilir. Daha önce receipt-bound dikey dilimlerde kullanılan `PolicyAuthorizedRepositoryExecutionContext` bağımsız olarak doğrulanmaya devam eder.

Güvenilir renderer API'lerinin tamamı ortak Desktop PEP bileşiminden geçer. Kimlik öznesi oluşmadan çalışması zorunlu olan istisna kümesi wildcard içermez ve dokuz kanalla sınırlıdır: uygulama bilgisi, dış kimlik sağlayıcıları, auth durumu, Windows Hello durumu, kurulum, iki giriş yolu ve davet inceleme/kabul. Diğer bütün `auth:*` kanalları imzalı politika kararına tabidir. Bootstrap ve authority-resolution kapsamları korelasyonla bağlıdır; imzalı callback açıldıktan sonra async-local yetkili repository kapsamı bunların yerini alır.

IPC dışı üretim yolları da aynı sınırın içindedir. Arka plan scheduler çevrimi imzalı `family.write` PEP callback'i içinde yürür ve async revocation işi callback bitmeden beklenir. Vault session guard her denetimde imzalı PEP kararı alır; otorite çözülemez veya politika reddederse kullanıcı veri oturumu fail-closed mühürlenir. Böylece ordinary legacy repository context nesneleri yalnız aktif, doğrulanmış üst PEP transaction'ı içinde kullanılabilir; DEC-138'in kalan repository geçiş koşulu tamamlanır.

Kalıcı policy transaction tabloları ve migration zinciri, katı on iki obligation yürütmesi, Core Service dış monotonik makbuz-günlük otoritesi, read-cache yeniden yetkilendirmesi ve sıfır doğrudan yetkilendirme rol karşılaştırması önceki receipt zincirleriyle korunur. Renderer UI ve menü eylemleri sandbox preload IPC köprüsünün dışına çıkmaz.

## Kapanış kanıtı

- `artifacts/validation/31-X-ppk-002-top-closure-contract.json`: 24/24 PASS.
- `artifacts/validation/31-X-ppk-002-top-closure-runtime.json`: 3/3 PASS.
- `artifacts/validation/31-U-W-ppk-002-remaining-boundaries-runtime.json`: 10/10 PASS; tam Vitest 51 dosya/271 test.
- `apps/desktop/tests/desktop-universal-api-policy-enforcement.test.ts`: 9/9 hedefli test.
- Kök TypeScript: sıfır diagnostic.

Bu kapanış yalnız PPK-002 gereksinimini tamamlar; diğer Bronze gereksinimlerinin durumunu veya Silver/Gold kapılarını kendiliğinden değiştirmez. Çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
