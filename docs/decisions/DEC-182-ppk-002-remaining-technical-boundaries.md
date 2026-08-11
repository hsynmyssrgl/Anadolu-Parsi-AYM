# DEC-182 — PPK-002 kalan teknik sınırları

## Durum

31-U, 31-V ve 31-W yerel uygulaması kabul edildi; PPK-002 üst gereksinimi kısmi kalır.

## Karar

Güvenilir renderer üzerinden gelen bütün uygulama API çağrıları tek bir varsayılan-ret Policy Enforcement Point içinden yürütülür. Bu sınır önbellek isabetlerinde de yeniden çalışır; böylece daha önce yetkilendirilmiş bir cevabın değişmiş oturum veya cihaz durumunda makbuzsuz bırakılması engellenir. Kimlik kurulumu, giriş ve davet kabul/inceleme yolları henüz doğrulanmış bir politika öznesi bulunmadığı için açıkça kayıtlı bootstrap istisnasıdır. Bunların kendi parola, ikinci faktör, cihaz ve davet kanıtı kontrolleri değişmez.

Arşiv iş verisi okumaları artık `PolicyAuthorizedRepositoryExecutionContext` olmadan çağrılamaz. PEP öncesi kaynak çözümleme okumaları ayrı, dar ve `ForPolicyResolution` adlandırmalı porta taşınmıştır. İzinli kararın bütün yükümlülükleri, işlem callback'i açılmadan önce yürütme kontrollerine çevrilir ve makbuz hash'i ile nonce'a bağlı SHA-256 attestation üretir. Kanıtı bulunmayan güçlü yeniden doğrulama yükümlülüğü fail-closed reddedilir.

Korunan makbuz günlüğünün başı her ekleme, idempotent doğrulama ve güvenilir yeniden başlatma incelemesinde ayrı Core Service sürecindeki HMAC korumalı monotonik otoriteye gönderilir. Daha düşük sıra, aynı sırada farklı baş veya boyut gerilemesi reddedilir. Otorite durumu atomik yazılır ve fsync edilir; Desktop otorite yoksa açılmaz.

Bu karar, IPC dışı iç zamanlayıcıların bütün ordinary repository context çağrılarını imzalı PEP context'ine taşımış saymaz. DEC-138'in bu kalan koşulu nedeniyle PPK-002 `COMPLETE` yapılmaz.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
