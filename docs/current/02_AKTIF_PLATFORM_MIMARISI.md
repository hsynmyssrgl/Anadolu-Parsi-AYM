# Aktif Platform Mimarisi

- Hedef mimaride Windows Core Service otoritatif iş ve veri hizmetidir; bu sürümde Core Service ayrı Electron utility companion sürecinde politika otoritesi olarak çalışır, aile verisi ve SQLite yazma sahipliği Desktop'ta kalır.
- Her Windows node yalnız kendi yerel şifreli SQLite projection'ını açar; ağdan ortak SQLite yasaktır.
- Değişiklikler çoğaltılmış append-only mutation log ile taşınır. Otomatik failover için quorum ve witness/üçüncü oy gerekir.
- Apple istemcileri sürümlü HTTPS/mTLS API üzerinden beslenir; ilk aşamada salt okunur companion ve şifreli cache kullanır.
- Platform Policy Kernel bütün istemci, servis, worker ve eklentiler için tek karar otoritesidir.
- İletişim katmanı MLS/SFrame/WebRTC/SFU/TURN sınırlarıyla sağlayıcıdan bağımsızdır.
- OCR/AI/çeviri workerları sandbox, kaynak politikası mirası ve yerel işleme önceliğiyle çalışır.
- Eklentiler imzalı capability manifest, sandbox, ağ allowlist ve politika receipt olmadan çalışamaz.

Bu sürümde Platform Policy Kernel, Core Service süreç sınırı, yerel OCR, iletişim, dağıtık çekirdek/istemci ve Windows dayanıklılık katmanları için yerel bileşim ve hedefli kanıtlar vardır. Core Service companion; rastgele yerel named-pipe ve başlangıç tokenı, CurrentUser DPAPI korumalı kalıcı politika anahtarı, process-message bootstrap, içeriksiz hazır/hata protokolü ve bounded shutdown ile paketlenmiştir. Güncel `win-unpacked` uygulaması aynı kullanıcı profilinde iki ardışık gerçek açılışta `created` ve `verified` DPAPI sentinel sonuçlarıyla PASS vermiştir. Bu durum imzalı installer veya ürün kabulü değildir: production Authenticode sertifikası, kurulu uygulama/upgrade/repair/uninstall yaşam döngüsü, gerçek çoklu node, gerçek Apple istemcileri, gerçek uzak sağlayıcılar ve uzun süreli soak `NOT_RUN` kaldığı için ilgili paketler `PARTIAL/PLANNED` ve Silver `BLOCKED` durumundadır.
