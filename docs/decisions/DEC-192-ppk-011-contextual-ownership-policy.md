# DEC-192 — PPK-011 bağlamsal yetki ve sahiplik oranı

## Durum

32-G kapsamında kabul edildi ve tamamlandı. PPK-011 üst gereksinimi `COMPLETE` durumuna geçirilir.

## Karar

Nesne izni amacı, aile dalını, başlangıç/bitiş aralığını, izin veya açık ret etkisini ve isteğe bağlı sahiplik oranını tek bağlamsal kayıt olarak taşır. Sahiplik oranı yüzde kayan noktasıyla değil, 1–10.000 arasındaki tam sayı baz puanla saklanır; böylece `%0,01` ile `%100` aralığı kesin ve tekrarlanabilir biçimde temsil edilir.

Sahiplik oranı yalnız `allow` kaydında bulunabilir. `deny` kaydı oran taşıyamaz ve en az beş karakterlik açık ret gerekçesi taşımayı sürdürür. Politika değerlendirmesinde bağlamla eşleşen açık ret, oranı yeterli bir izin kaydından önce uygulanır. İstenen asgari sahiplik payını karşılamayan veya geçersiz oranlı izin fail-closed kapanır. Kaynağın kesin sahibi politika bakımından 10.000 baz puanlık tam sahip olarak değerlendirilir.

Hem `CentralAuthorizationService` hem imzalı Platform Policy Kernel aynı eşiği uygular. Platform isteğindeki `minimumOwnershipBasisPoints` alanı politika context hash’ine ve dolayısıyla imzalı karar/makbuza bağlanır. Başarılı açık izin kararı eşleşen sahiplik baz puanını karar kanıtında taşır. Desktop üretim otoritesi, izin oranını grant dönüşümüne ve güvenlik parmak izine dahil eder; oran değişikliği eski otorite snapshot’ını geçersiz kılar.

Domain ve IPC tipleri oranı taşır. Use-case aralığı ve allow/deny ayrımını doğrular. Repository `ownership_basis_points` değerini yazar ve geri okur. Göç 75 sütun, kısmi indeks ve insert/update trigger’larıyla geçersiz veya ret kaydına eklenmiş oranı SQLite seviyesinde durdurur. Bağlamsal Yetkiler ekranı oran girişini yüzde olarak sunar ve kayıtlı oranları görünür kılar.

## Gerçeklik sınırı

Bu karar PPK-011’in politika bağlamını tamamlar. B4-02 banka hesabı, IBAN, ortak varlık/borç katılımcıları ve toplam pay mutabakatı ayrıca açık kapsamdır; bu karar B4-02’yi tamamlanmış saymaz. Gerçek aile verisi taşınmamış, SQLite yazma sahipliği değiştirilmemiş, DEC-171 cutover kilidi kaldırılmamış ve yeni Build verilmemiştir.

## Kapanış kanıtı

- Hedefli PPK-011 testi: 12/12 PASS.
- Platform ve merkezi politika regresyonu: 8 dosya, 102 test PASS.
- Yetkilendirme/use-case/repository runtime: 12/12 PASS.
- Kapanış sözleşmesi: 32/32 PASS.
- Runtime kapanış demeti: 8/8 PASS.
- Veritabanı göç zinciri: 75/75 PASS.
- Tam Vitest: 60 dosya, 392 test PASS.
- Kök TypeScript: 0 diagnostic.

Bu kapanış yalnız PPK-011 gereksinimini tamamlar; diğer Bronze gereksinimleri açık kalır ve çalıştırılmayan hiçbir kontrol PASS sayılmaz.
