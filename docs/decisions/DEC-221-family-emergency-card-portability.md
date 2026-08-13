# DEC-221 — Yönetişimli çevrimdışı acil kart, yazdırılabilir/PDF çıktı, şifreli belge paketi ve pil-duyarlı kip

- Tarih: 13.08.2026
- Durum: ACTIVE
- Gereksinimler: B5-03, EXT-016
- Uygulama paketi: 33-J
- Kalıcılık hedefi: Migration 88 (`family_emergency_card_portability_ledger`, planlanan)

## Karar

B5-03 ve EXT-016, 33-I'nin bağımsız `private` acil yardım profilini kaynak alan tek
yönetişimli dikey dilimde uygulanacaktır. Kullanıcı yalnız kapalı bir alan kodu
matrisinden seçtiği profil alanlarını, güncel çocuk kayıtlarını ve ayrıca yetkilendirilmiş
arşiv belgelerini karta ekleyebilir. Seçim/configuration, belge bağlantısı, başarılı
çıktı olayı ve pil-duyarlı kip olayı Migration 88 ile planlanan append-only
`family_emergency_card_portability_ledger` içinde tutulacaktır. Kök yetki kaynağı
33-I profilidir; aile acil planı görünürlüğü bu `private` profile veya çıktıya erişim
vermez.

Çıktı kipleri `print`, `pdf` ve `encrypted_pack` ile kapalıdır. Yazdırma ve düz PDF
çıktısı açık kullanıcı onayı ve düz metin uyarısı gerektirir. Electron `printToPDF`
çıktısı parola korumalı PDF olarak sunulamaz. Şifreli paket, PDF/belge yükünü ayrı bir
uygulama konteynerinde taşıyacaktır: her paket için rastgele DEK, normalize edilmiş en
az 12 karakterlik paket parolasından benzersiz salt ve scrypt ile türetilen KEK,
AES-256-GCM ve bağlam verisi kullanılacaktır. Cihaz kasası veya arşiv anahtarı taşınabilir
paket anahtarı olarak yeniden kullanılmayacak; düz metin geçici dosya oluşturulmayacak;
atomik yazım ile parse/decrypt/hash readback tamamlanmadan başarı kaydedilmeyecektir.

## Politika ve güçlü kimlik doğrulama sınırı

Configuration ve seçim yazımları exact `update/profileId` + `family.write` makbuzuna
bağlanır. Gerçek dosya dışa aktarımı, genel `no_export` kuralını gevşetmeden yalnız
yerel, açıkça seçilmiş, güçlü biçimde yeniden doğrulanmış acil çıktı için exact
`share/profileId` + `file.share` kararı gerektirir. Mevcut politika modeli bu özel yerel
istisnayı henüz temsil etmediği için bu kararın güvenli uygulaması tamamlanmadan çıktı
özelliği açılmayacaktır.

Parola/TOTP doğrulaması ayrı ve tekrar kullanılabilir bir “yeniden doğrulandı” bayrağı
olarak tutulmaz; renderer session, işlem, profil ve seçili alan özetiyle aynı sunucu
işlemine bağlanır ve dosya seçimi/yazımı öncesinde yeniden kontrol edilir. Windows Hello
ileride kullanılırsa aynı bağlara sahip kısa ömürlü, tek kullanımlık main-process grant
olmadan kabul edilmez. PIN etiketi çevrimdışı kaba kuvvete dayanıklı şifreleme iddiası
taşımaz; şifreli paket için varsayılan en az 12 karakterlik paket parolasıdır.

Arşiv belgesi eklenecekse belge aynı ailede, yok edilmemiş ve izin verilen hassasiyet
sınıfında olmalı; her belge için ayrıca exact arşiv okuma PEP kararı alınmalıdır.
Mevcut düz metin geçici dosya üreten materialize yolu kullanılmayacak, içerik bellekte
yetkili ve sınırlandırılmış biçimde çözülecektir. Audit/outbox seçilen sağlık içeriğini,
telefonu, belge içeriğini, parolayı veya çıktı yolunu taşımaz.

## Pil-duyarlı kip ve gerçeklik sınırı

Desktop çalışma zamanı yalnız `battery`, `ac` veya `unknown` güç kaynağını gözleyebilir;
pil yüzdesi ölçmez. Bu nedenle kip kullanıcı tarafından manuel açılır veya cihazın pil
gücünde olduğu görüldüğünde önerilir. `batteryLevel` exact `not_measured`,
`automaticLowBatteryDetection` exact `not_performed` ve `lowBatteryClaimed` `false`
kalır. Kip görsel/işlemsel maliyeti azaltabilir, ancak kalan süre, düşük pil eşiği,
çalışma garantisi veya acil müdahale garantisi vermez.

Tek yeni desktop IPC adayı `life:exportEmergencyCard` olacaktır; kapalı girdi, boyut ve
seçim sınırı uygular, çıktı yolu renderer tarafından verilmez ve save/print işlemi main
process tarafından yönetilir. Ağ, mesaj, bulut yükleme veya acil servis kanalı açılmaz.

Migration ratchet 87'den 88'e planlanır. Uygulama öncesi güncel PPK-021 tabanı
545 exact allowlist ve 277 use-case composition yüzeyi, PPK-022 tabanı 242 capability
yüzeyidir. Yeni doğrudan `node:fs`/dialog yüzeyi açmak yerine onaylı main-process dosya
yazım yüzeyleri yeniden kullanılacak; yine de gerçek uygulama sonrasında exact PPK
yeniden sayımı, `file.share` signed application manifest/policy-package ratchet'i ve
bağımsız boundary kanıtı zorunludur. Bu aktivasyon yeni bir PPK sayısını PASS saymaz.

## Etkinleştirme durumu

Bu belge 33-J yönetişim aktivasyonudur. Migration 88, domain/application/repository,
policy, IPC/UI, yazdırma/PDF, şifreli paket, test, tehdit modeli ve kapanış kanıtları
henüz `PENDING` durumundadır. B5-03 ve EXT-016, tam karar-kod-ekran-test-belge-kanıt
zinciri ve kalıcı Library makbuzu oluşmadan uygulanmış veya tamamlanmış sayılmaz.
