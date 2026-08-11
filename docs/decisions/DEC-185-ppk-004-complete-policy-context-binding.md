# DEC-185 — PPK-004 tam politika bağlamı ve kriptografik işlem bağı

## Durum

31-Z kapsamında kabul edildi ve tamamlandı. PPK-004 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Sıkı platform politika kararları; hesap/kullanıcı, kişi, cihaz, uygulama, güven ve üyelik durumu, rol kümesi, aile, hane ve aile dalı kapsamları, kaynak ve veri sahibi, amaç, zaman, eylem, yetenek, çevrimiçi durum, küme yazma fence’i ve istenen alanlar birlikte doğrulanmadan izin veremez. Boş rol, eksik aile kapsamı, eksik amaç veya korelasyon, sıkı modda bulunmayan hane/dal dizileri ve yinelenen kapsam kimlikleri `INVALID_REQUEST` ile varsayılan-ret sonuçlanır.

Doğrulanmış bağlam, kanonik bir `PlatformPolicyContextSnapshot` üzerinden SHA-256 `contextHash` değerine dönüştürülür. Bu değer politika kararına eklenir, imzalı makbuzun parçası olur, PEP tarafından sağlayıcı cevabına karşı yeniden hesaplanır, aktif işlem bağlamında taşınır ve depo işlem sınırında tekrar doğrulanır. Karar, makbuz, işlem bağlamı veya kalıcı kayıt aynı bağlam kimliğini taşımıyorsa korunan işlem açılmaz.

Core Service yerel yönetim `policy.authorize` ve `policy.verify` uçları yalnız tam sıkı bağlam kabul eder. Desktop UI ve menü eylemleri mevcut sandbox preload IPC ve ortak PEP yolunda kalır; doğrudan renderer veya depo geçişi eklenmez.

Veritabanı göçü 69, geçmiş makbuzları değiştirmeden `context_hash` sütununu ekler. Yeni makbuzlarda bağlam kimliği zorunludur. SQLite tetikleyicisi sütunu kayıt JSON’u, karar, imzalı makbuz, kullanıcı, cihaz, uygulama, rol, aile kapsamı, amaç, zaman, eylem ve yetenek alanlarıyla eşleştirir. Eski satırlar okunabilir kalır; yeni eksik veya tutarsız bağlam kayıtları reddedilir.

## Güvenlik ve gerçeklik sınırı

Bu karar gerçek kasa veya aile verisini Core Service’e taşımaz, SQLite yazma sahipliğini değiştirmez, DEC-171 cutover kilidini kaldırmaz ve yeni Build vermez. Eski Desktop kasası aktif ve yetkilidir.

## Kapanış kanıtı

- `packages/platform-policy/policy-context-binding.test.ts`: 13/13 PASS; tam bağlam mührü, alan değişimi duyarlılığı, eksik bağlam reddi, aile/hane/dal kapsam reddi, sağlayıcı tahrifatı ve aktif işlem bağı.
- `artifacts/validation/31-Z-ppk-004-complete-policy-context-binding-contract.json`: 28/28 PASS.
- `artifacts/validation/31-Z-ppk-004-complete-policy-context-binding-runtime.json`: 7/7 PASS; göç 69, depo regresyonu, Core Service sınırı, kök TypeScript ve tam Vitest kanıtı.
- Tam Vitest: 53 dosya, 294 test PASS.
- Kök TypeScript: 0 diagnostic.
- `docs/audit/31-Z_PPK-004_TAM_POLITIKA_BAGLAMI_UST_KAPANIS.md`: üst kapanış denetimi.

Bu kapanış yalnız PPK-004 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
