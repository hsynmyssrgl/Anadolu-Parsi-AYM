# 34-J Tehdit Modeli

- Discovery sonucu güven/kimlik sayılmaz; candidate şeması, duplicate node, provider kimliği, production verification, evidence hash ve network-used kanıtı fail-closed doğrulanır.
- Control plane yalnız rendezvous, certificate-revocation, APNs-wake, witness-vote ve health exact şemalarını kabul eder; accessor, prototype, nested payload, ek anahtar ve içerik alanı reddedilir.
- Control-plane cluster kimliği runtime cluster'ıyla exact eşleşir; eski certificate-revocation epoch ve sıfır placeholder hashler reddedilir.
- Relay bağlantısı current certificate/policy/key/revocation epoch authorization evidence'ı olmadan açılamaz; provider exception'ı `networkUsed=null` üretir, yapılandırmadan ağ kullanımı çıkarılmaz.
- Apple UI izni Core Service reddini aşamaz; karar evidence hash'i zorunludur ve offline cache ana veri kaynağı değildir.
- Replica ile backup karıştırılamaz; yedek doğrulayıcıdan immutable/independent hedef, manifest, size ve provider evidence ister; kayıt ayrıca current cluster-state evidence hash'ine bağlanır. Restore testi çağıran inputundan alınmaz ve doğrulanmış restore provider kanıtı yokken false kalır. Client operation fingerprint'i ve hash chain replay/tamper'ı engeller.
- Backup/update/fault client-operation ve kayıt kimlikleri cluster/family kapsamındadır; başka tenant anahtarı önceden tüketemez. Kanıt hashleri sıfır olamaz ve backup/fault kronolojisi gerileyemez.
- Rolling update exact cluster-state evidence, sağlıklı/eş epoch ve commit indexli node envanteri, tek lider, benzersiz node listesi, doğrulanmış paket imzası, N-1 uyumluluk ve rollback artifact kanıtı olmadan planlanamaz; lider son sıradadır.
- Fault injection providerı yalnız açık test bayrağıyla çalışır; kanıt append-only zincirde `syntheticOnly=true` ve `realWindowsNode=false` kalır.
- Monotonic zaman equal/fraction/unsafe değerleri ve sync budget eşit sessiz-saat aralığını reddeder.
- Migration 114 backup/fault sequence ve previous hash'i, cluster/family/key/policy/commit bağını ve update planının eksiksiz gerçek cluster envanterini triggerlarla doğrular; üç tablo STRICT ve immutable'dır.

Residual risk: production discovery/relay/backup/update providerları, runtime composition, Apple uygulaması, APNs/BGTask/ATS/Keychain kanıtı, gerçek farklı-cihaz restore, break-glass recovery, rolling update ve gerçek Windows fault matrisi eksiktir. Append-only operasyon kanıtlarının retention/archival politikası kararlaştırılmadığından sınırsız büyüme riski de açıktır. Yerel model ve sentetik kanıtlar bu dış UAT gereksinimlerini kapatmaz.
