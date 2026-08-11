# DEC-140 — PPK-002 Arşiv Üretim Bileşimi ve SQLite Runtime Dilimi

## Durum

30-N kalıcı receipt zinciri, 33/33 semantik kapanış kontrolü ve 5/5 gerçek süreç kapısı PASS olduktan sonra DEC-137 tam otomatik önceliklendirme yetkisiyle 30-O kapsamında kabul edildi.

## Öncelik kararı

PPK-002 hâlâ `PARTIAL` durumundadır. 30-N arşiv yazma dikey diliminde merkezî PEP, korumalı receipt sink'i ve repository context doğrulaması kanıtlandı; fakat üretim başlangıç bileşimi açık, cihaz-secret koruması kontrollü test sınırında ve gerçek SQLite repository runtime kanıtı yoktur. Bu açıklar aktif `P0` güvenlik ve veri bütünlüğü zincirinin doğrudan devamıdır ve DEC-137 bağlayıcılarına göre henüz başlanmamış daha düşük etkili işlerden önce gelir.

## Uygulama sınırı

30-O yalnız arşiv alanında üretim desktop başlangıç bileşimini güvenilir authority/resource resolver, sağlayıcı tarafından son doğrulanan cluster fence, yerel COMMIT öncesi fence denetimi, PEP ve korumalı receipt journal ile açıkça bağlar. Core Service süreç giriş noktası yalnız doğrulanmış yerel endpoint, token ve imza anahtarıyla gerçek yönetim dinleyicisini başlattıktan sonra hazır duruma geçer; ilk yönetici kurulumu da kriptografik cihaz kanıtını, güvenilir cihaz kaydını ve yalnız `archive` amacı için üç açık nesne iznini aynı transaction içinde kalıcılaştırır. Aynı dilim gerçek SQLite veritabanında governed create/update/delete/record yollarını çalıştırır; receipt kalıcı yazma ve geri okuma işlemi business mutation başlamadan önce gerçekleşmelidir. Receipt sonrasında hesap, kişi, güvenilir cihaz, arşiv izinleri ve kaynak durumu aynı business transaction içinde yeniden okunur; değişiklik varsa mutation başlamadan fail-closed reddedilir.

Bu dilim kalıcı çok-process replay korumasını, journal ile korumalı head verisinin birlikte eski bir geçerli sürüme döndürülmesini algılayan haricî monoton rollback korumasını, receipt ile business commit'in tek atomik commit olmasını veya süreçler arası fence ile SQLite COMMIT'in database-enforced fencing token üzerinden atomik olmasını iddia etmez. Windows kurulu-hizmet/SCM yaşam döngüsü `NOT_RUN_NOT_PASS`; endpoint, token ve imza anahtarının cihaz-bağlı korumalı provisioning, rotation ve ACL sahipliği `NOT_IMPLEMENTED` kalır. Obligation execution, audit/outbox dâhil bütün repository yüzeyleri ve PPK-002'nin evrensel tamamlanması da bu dilimin dışındadır. PPK-002 `PARTIAL`; evrensel repository enforcement `NOT_COMPLETE` kalacaktır. Native etkileşimli Windows Hello donanım kanıtı ayrıca `NOT_RUN_NOT_PASS` kalır ve bu çalışmanın kapsamına alınmaz.

## Makine tarafından doğrulanan açık sınırlar

- Installed-service registration and SCM lifecycle: `NOT_RUN_NOT_PASS`
- Protected Core Service authority provisioning, rotation and ACL enforcement: `NOT_IMPLEMENTED`
- Durable multi-process replay protection: `NOT_RUN_NOT_PASS`
- Complete-tail journal rollback detection: `NOT_IMPLEMENTED`
- Receipt/business commit atomicity: `NOT_IMPLEMENTED`
- Cross-process fence/SQLite COMMIT atomicity: `NOT_IMPLEMENTED`

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
