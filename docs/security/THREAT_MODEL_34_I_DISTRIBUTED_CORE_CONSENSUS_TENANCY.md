# 34-I Tehdit Modeli

- Eski lider ve stale fencing token yazıları reddedilir; quorum kaybı safe mode açar.
- Cluster/family, policy, revocation ve key epoch çaprazlığı tenancy ihlalidir.
- Network-share ve traversal biçimli SQLite yolları sözlüksel olarak reddedilir; gerçek local-volume kimliği ayrıca kanıtlanmadığından bu kontrol fiziksel volume garantisi sayılmaz.
- Provider majority evidence, exact commit index, provider kimliği ve evidence hash olmadan mutation log'a commit yazılamaz.
- Aynı idempotency anahtarı farklı request fingerprint'iyle ve aynı mutation kimliği ikinci kez kullanılırsa işlem reddedilir; kalıcı replay kaydı doğrulanmadan sonuç döndürülmez.
- Idempotency ve mutation tekrar aramaları exact cluster/family kapsamında yapılır; başka tenantın tahmin edilebilir anahtarı önceden tüketmesi kabul edilmez.
- Provider commit index kalıcı tenant head'inden kesin ileri olmalı; exact boolean ve sıfır olmayan evidence/projection hash şarttır. Provider serbest hata ayrıntısı dış karara yansıtılmaz.
- Quorum commit ile yerel projection tek persistence çağrısında atomik uygulanır. Provider commit sonrası yerel uygulama hatası `consensusCommitted=true`, `locallyApplied=false` olarak görünür ve runtime safe mode'a girer.
- Snapshot hash doğru olsa bile provider, policy, epoch ve provider evidence doğrulaması olmadan bootstrap yapılamaz.
- Providerın gerçek ağ kullanımı kendi boolean kanıtından alınır; exception halinde bilinmiyor (`null`) tutulur, yapılandırma varlığından ağ kullanımı çıkarılmaz.
- Bilinmeyen kaynak türleri `offline_read` yerine fail-closed `strong` tutarlılığa gider; NaN, kesirli ve unsafe integer durumları reddedilir.
- Migration 113 current leader/fence/policy/epoch bağlarını, node applied index ile exact commit/snapshot sınırını, monotonik sequence/entity version/commit index/zamanı, certificate revocation geri-dönüşsüzlüğünü ve append-only ledger immutability'sini triggerlarla korur.

Residual risk: üretim Raft providerı ve runtime composition'ı, gerçek 3-node quorum, network partition/failover, mTLS CA ve sertifika rotation/revocation, gerçek local-volume identity kontrolü, encrypted projection ve gerçek snapshot bootstrap/fault testleri yoktur. İnce Windows Service Host yerel olarak derlenir; DPAPI LocalMachine korumalı yapılandırma, exact yerel kontrol pipe'ı, tek kullanımlı shutdown ve sınırlı restart uygular. Ancak Authenticode imzası ve gerçek SCM kurulum/oturum-kapalı çalışma/stop/recovery UAT'si yoktur. Bu nedenle `windowsServiceHostVerified=false` kalır; kabul ve gereksinim kapanışı yoktur.
