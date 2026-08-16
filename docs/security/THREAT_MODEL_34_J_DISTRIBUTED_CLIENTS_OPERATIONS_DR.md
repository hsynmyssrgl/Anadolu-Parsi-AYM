# 34-J Tehdit Modeli

- Discovery sonucu güven/kimlik sayılmaz; candidate şeması, duplicate node, provider kimliği, production verification, evidence hash ve network-used kanıtı fail-closed doğrulanır.
- Control plane yalnız rendezvous, certificate-revocation, APNs-wake, witness-vote ve health exact şemalarını kabul eder; accessor, prototype, nested payload, ek anahtar ve içerik alanı reddedilir.
- Relay bağlantısı current certificate/policy/key/revocation epoch authorization evidence'ı olmadan açılamaz; provider exception'ı `networkUsed=null` üretir, yapılandırmadan ağ kullanımı çıkarılmaz.
- Apple UI izni Core Service reddini aşamaz; karar evidence hash'i zorunludur ve offline cache ana veri kaynağı değildir.
- Replica ile backup karıştırılamaz; yedek doğrulayıcıdan immutable/independent hedef, manifest, size ve provider evidence ister; kayıt ayrıca current cluster-state evidence hash'ine bağlanır. Restore testi çağıran inputundan alınmaz ve doğrulanmış restore provider kanıtı yokken false kalır. Client operation fingerprint'i ve hash chain replay/tamper'ı engeller.
- Rolling update exact cluster-state evidence, sağlıklı quorum, tek lider, benzersiz node listesi ve doğrulanmış paket imzası olmadan planlanamaz; lider son sıradadır.
- Fault injection providerı yalnız açık test bayrağıyla çalışır; kanıt append-only zincirde `syntheticOnly=true` ve `realWindowsNode=false` kalır.
- Monotonic zaman equal/fraction/unsafe değerleri ve sync budget eşit sessiz-saat aralığını reddeder.
- Migration 114 backup/fault sequence ve previous hash'i, cluster/family/key/policy/commit bağını ve update planının eksiksiz gerçek cluster envanterini triggerlarla doğrular; üç tablo STRICT ve immutable'dır.

Residual risk: production discovery/relay/backup/update providerları, runtime composition, Apple uygulaması, APNs/BGTask/ATS/Keychain kanıtı, gerçek farklı-cihaz restore, break-glass recovery, rolling update ve gerçek Windows fault matrisi eksiktir. Append-only operasyon kanıtlarının retention/archival politikası kararlaştırılmadığından sınırsız büyüme riski de açıktır. Yerel model ve sentetik kanıtlar bu dış UAT gereksinimlerini kapatmaz.
