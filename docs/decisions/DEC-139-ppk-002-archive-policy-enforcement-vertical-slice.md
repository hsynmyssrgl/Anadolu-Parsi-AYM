# DEC-139 — PPK-002 Arşiv Policy Enforcement Dikey Dilimi

## Durum

30-M kalıcı receipt zinciri PASS olduktan sonra DEC-137 tam otomatik önceliklendirme yetkisiyle 30-N kapsamında kabul edildi.

## Öncelik kararı

PPK-002 hâlâ `PARTIAL` durumundadır. Merkezi PEP temeli hazır olsa da use-case ve repository çağrı yolları henüz bu sınıra taşınmamıştır. Arşiv alanındaki beş doğrudan `family_admin` kontrolü, `archive.read` ve `archive.write` capability'leri hazır olduğu için sınırlı ve doğrulanabilir ilk dikey dilimdir. Bu çalışma güvenlik ve bağımlılık açma etkisi nedeniyle aynı `P0 / PARTIAL` grubundaki B0-02 adlandırma işinden önce gelir.

## Uygulama sınırı

30-N yalnız arşiv write/use-case/repository transaction sınırını merkezî PEP kararına ve request-bound receipt'e bağlar; arşivdeki doğrudan rol kontrollerini bu kanıtlanmış yol içinde kaldırır. Receipt, repository işlemi başlamadan önce kalıcı sink'e yazılmalı ve transaction context kaynak, eylem ve capability ile yeniden doğrulanmalıdır. PEP veya güvenilir authority/resource çözümleyicisi yoksa işlem fail-closed durur.

Bu dilim PPK-002'nin tüm uygulama, API ve repository yüzeylerinde tamamlandığı anlamına gelmez. Production composition wiring, kalıcı çok-process replay, receipt ile business commit atomikliği, obligation execution ve diğer legacy yollar açık kalır. PPK-002 `PARTIAL`; evrensel repository enforcement `NOT_COMPLETE` kalacaktır.

## Uygulanan karar

Arşiv yazma use-case'leri sekiz kanonik intent ile PEP sınırına bağlandı. PEP tarafından üretilen güvenilir subject/resource snapshot'ı, capability, action, correlation ve cluster-fence bilgisi transaction callback'i içinde repository context olarak yeniden doğrulanıyor. Repository mutasyonları sahte, süresi geçmiş, farklı kaynak/eylem için üretilmiş veya callback dışına taşınmış context'i fail-closed reddediyor. Desktop üretim bileşimi PEP resolver ya da yazılabilir fence sağlamazsa legacy authorization yoluna düşmeden yazmayı reddediyor.

Receipt journal dosya sink'i cihaz-korumalı AES-256-GCM envelope, hash zinciri, exclusive lock, fsync ve tam geri-okuma doğrulaması kullanıyor. Bu kanıt yalnız tek süreçte doğrulanan korumalı journal davranışını kapsar; kalıcı çok-process replay koruması ve receipt ile business commit atomikliği iddia edilmez. Event attachment cross-aggregate bağlama, secure file deletion ile database commit atomikliği, obligation execution, production key/resolver composition ve diğer legacy repository yüzeyleri açık kalır.

Bu teslim, yukarıdaki kanıtlarla sınırlıdır; çalıştırılmayan hiçbir kontrol PASS sayılmamıştır.
