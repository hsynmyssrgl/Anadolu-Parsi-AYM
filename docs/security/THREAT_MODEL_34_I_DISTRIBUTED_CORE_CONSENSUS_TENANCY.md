# 34-I Tehdit Modeli

- Eski lider ve stale fencing token yazıları reddedilir; quorum kaybı safe mode açar.
- Cluster/family, policy, revocation ve key epoch çaprazlığı tenancy ihlalidir.
- Network-share ve traversal biçimli SQLite yolları sözlüksel olarak reddedilir; gerçek local-volume kimliği ayrıca kanıtlanmadığından bu kontrol fiziksel volume garantisi sayılmaz.
- Provider majority evidence, exact commit index, provider kimliği ve evidence hash olmadan mutation log'a commit yazılamaz.
- Aynı idempotency anahtarı farklı request fingerprint'iyle ve aynı mutation kimliği ikinci kez kullanılırsa işlem reddedilir; kalıcı replay kaydı doğrulanmadan sonuç döndürülmez.
- Quorum commit ile yerel projection tek persistence çağrısında atomik uygulanır. Provider commit sonrası yerel uygulama hatası `consensusCommitted=true`, `locallyApplied=false` olarak görünür ve runtime safe mode'a girer.
- Snapshot hash doğru olsa bile provider, policy, epoch ve provider evidence doğrulaması olmadan bootstrap yapılamaz.
- Providerın gerçek ağ kullanımı kendi boolean kanıtından alınır; exception halinde bilinmiyor (`null`) tutulur, yapılandırma varlığından ağ kullanımı çıkarılmaz.
- Bilinmeyen kaynak türleri `offline_read` yerine fail-closed `strong` tutarlılığa gider; NaN, kesirli ve unsafe integer durumları reddedilir.
- Migration 113 current leader/fence/policy/epoch bağlarını, monotonik sequence/entity version/commit index'i ve append-only ledger immutability'sini triggerlarla korur.

Residual risk: üretim Raft providerı ve runtime composition'ı, gerçek 3-node quorum, network partition/failover, mTLS CA ve sertifika rotation/revocation, Windows Service host, gerçek local-volume identity kontrolü, encrypted projection ve gerçek snapshot bootstrap/fault testleri yoktur. Bu nedenle kabul ve gereksinim kapanışı yoktur.
