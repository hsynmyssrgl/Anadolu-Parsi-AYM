# DEC-138 — PPK-002 Merkezi Policy Enforcement Temeli

## Durum

30-M kapsamında kabul edildi ve uygulanıyor.

## Karar

Yeni güvenlik-kritik transaction yolu, çağıranın tam `PlatformPolicyRequest` veya bağlantı otoritesi nesnesi göndermesine güvenmez. Çağıran yalnız bounded intent bildirir; PEP kurulumunda enjekte edilen ve intent almayan güvenilir authority resolver özne, rol, cihaz, üyelik, grant, consent ve çevrimiçi durum bağını; güvenilir resource resolver ise kaynak sahibi ve hassasiyetini üretir.

Merkezi Policy Enforcement Point kararı kernel içinde strict modda yeniden değerlendirir; authority içindeki aile/hane/dal kapsamı kaynakla uyuşmazsa veya owner/explicit grant yoksa örtük public/internal izin kullanmaz. Request hash'ine bağlı imzalı receipt üretir, receipt'i transaction başlamadan önce sink'e yazar ve yalnız izinli kararda işlem callback'ini açar. Receipt yazılamaz, doğrulanamaz, süresi geçer, nonce tekrar edilir veya resolver başarısız olursa işlem fail-closed durur.

Transaction context yalnız PEP callback'i süresince ve Core Service cluster fence epoch'u değişmeden aktiftir. Yakalanıp daha sonra kullanılması, başka resource/action için kullanılması veya dışarıdan taklit edilmesi reddedilir. Replay rezervasyonu enjekte edilebilir store üzerinden yapılır; varsayılan store yalnız aynı process içindeki PEP örnekleri arasında ortaktır ve kalıcı çok-düğüm koruması sayılmaz. Mevcut receiptless ve caller-resolved yollar tarihsel uyumluluk borcu olarak korunur; yeni işlem yolu bunları kullanmaz. 34 doğrudan rol kontrolü ve tüm legacy repository context çağrıları taşınmadan PPK-002 `COMPLETE` ilan edilmez.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
