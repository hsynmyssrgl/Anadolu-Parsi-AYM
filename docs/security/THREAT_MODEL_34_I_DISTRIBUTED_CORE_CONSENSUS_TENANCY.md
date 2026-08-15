# 34-I Tehdit Modeli

- Eski lider ve stale fencing token yazıları reddedilir; quorum kaybı safe mode açar.
- Cluster/family, policy, revocation ve key epoch çaprazlığı tenancy ihlalidir.
- Network-share SQLite ve doğrudan çoklu node açılışı yasaktır.
- Provider majority evidence olmadan mutation log'a commit yazılamaz.
- Snapshot hash doğru olsa bile provider, policy ve epoch doğrulaması olmadan bootstrap yapılamaz.

Residual risk: üretim Raft, gerçek 3-node quorum, mTLS CA, cert rotation/revocation, Windows Service host, encrypted projection ve fault testleri yoktur.
