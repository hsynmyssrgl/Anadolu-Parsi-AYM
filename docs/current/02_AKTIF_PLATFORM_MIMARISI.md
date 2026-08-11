# Aktif Platform Mimarisi

- Windows Core Service otoritatif iş ve veri hizmetidir; Desktop UI yerel istemcidir.
- Her Windows node yalnız kendi yerel şifreli SQLite projection'ını açar; ağdan ortak SQLite yasaktır.
- Değişiklikler çoğaltılmış append-only mutation log ile taşınır. Otomatik failover için quorum ve witness/üçüncü oy gerekir.
- Apple istemcileri sürümlü HTTPS/mTLS API üzerinden beslenir; ilk aşamada salt okunur companion ve şifreli cache kullanır.
- Platform Policy Kernel bütün istemci, servis, worker ve eklentiler için tek karar otoritesidir.
- İletişim katmanı MLS/SFrame/WebRTC/SFU/TURN sınırlarıyla sağlayıcıdan bağımsızdır.
- OCR/AI/çeviri workerları sandbox, kaynak politikası mirası ve yerel işleme önceliğiyle çalışır.
- Eklentiler imzalı capability manifest, sandbox, ağ allowlist ve politika receipt olmadan çalışamaz.

Bu sürümde yalnız Platform Policy Kernel ile Core Service süreç sınırının temeli kodlanmıştır. Cluster, API, OCR ve iletişim implementasyonları açık gereksinimdir.
