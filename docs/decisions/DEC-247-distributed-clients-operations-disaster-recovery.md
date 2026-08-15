# DEC-247 — Dağıtık istemciler, bağlantı, operasyon ve felaket kurtarma

Durum: PLANNED / LOCAL_IMPLEMENTATION_STARTED

34-J keşfi yalnız adres ipucu sayar; mDNS veya manuel IP/QR sonucu mTLS pairing yerine geçmez. Remote varsayılan kapalıdır, inbound port gerektirmeyen outbound relay veya kullanıcı VPN'i kullanılabilir ve control plane aile içeriği taşıyamaz. Apple istemci yalnız read-only cache ve Core Service authorization ile planlanır; push teslimi garanti değildir.

Replica yedek değildir. Immutable offline/offsite yedek, policy/key epoch uyumu, break-glass recovery, follower-first/leader-last rolling update, monotonic timer, adaptive sync ve fault matrix sözleşmeleri yerel olarak modellenir.

Migration 114 ve sentetik testler gerçek mDNS, relay/VPN, Apple uygulaması, farklı cihaz restore, rolling update veya Windows fault matrix değildir. Bu kanıtlar `NOT_RUN`, `countsAsRequirementPass=false` kalır.
