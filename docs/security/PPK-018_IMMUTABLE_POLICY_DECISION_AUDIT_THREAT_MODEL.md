# PPK-018 — Değişmez policy karar audit tehdit modeli

## Durum ve varlıklar

Durum: `VALIDATED / COMPLETE`.

Korunan varlıklar; allow/deny kararı, karar/ret nedeni, policy sürümü ve imzalı package bağı, exact yükümlülükler, obligation execution attestationı, request/context/receipt/record hashleri, karar otoritesi, uygulama/cihaz kimliği, kaynak/action/capability bağı, journal sırası ve monotonic head ankrajıdır.

## Tehditler

1. Ret kararının audit yazılmadan çağırana dönmesi veya izin operasyonunun audit persistence öncesi açılması.
2. Üretim PEP bileşimine no-op/in-memory receipt sink bağlanması.
3. Policy sürümü/package hash'i, reason, yükümlülük, kaynak ya da kimlik bağının audit gövdesinden çıkarılması veya sonradan değiştirilmesi.
4. Allowed kararın yükümlülükleri yürütülmeden audit edilmiş görünmesi ya da denied kararın sahte execution taşıması.
5. Journal satırının silinmesi, sırasının değiştirilmesi, tek bitinin oynanması, nonce replay veya complete-tail rollback.
6. Şifreli payloadın plaintext olarak dosyaya, loga veya renderer IPC'sine sızması.
7. Restart sırasında yalnız yerel şekil/hash kontrolüyle sahte receiptin kabul edilmesi.
8. Deferred SQLite transaction commitinden sonra journal projectionının kaybolması veya kanıtsız acknowledge edilmesi.
9. Tarihsel direct receipt payloadının sessizce yeni audit kaydı sayılması ya da zorunlu backfill/cutover tetiklemesi.
10. Genel business audit_log veya allowed-only SQLite receipt tablosunun denied karar audit kanıtı gibi gösterilmesi.

## Kontroller

- `PlatformPolicyEnforcementPoint`, ret ve non-deferred izin kararlarında sink çağrısını kontrol akışında zorunlu kılar; persistence arızasında operasyonu açmaz.
- `ImmutablePolicyDecisionAuditPolicy`, receipt/request/decision bağlarını, policy/package kimliğini, exact obligations ve obligation execution attestationını doğrulamadan audit üretmez.
- Audit gövdesi ve receipt kaydı birlikte AES-256-GCM korumalı zarfa alınır; plaintext sıfırlanır.
- Journal entry'leri ayrı cihaz korumalı anahtarla HMAC-SHA-256 zincirine bağlanır. `fsync`, tam readback ve audit+receipt exact karşılaştırması append kabul şartıdır.
- Nonce replay ve aynı nonce/farklı kanonik kayıt, tek bayt eklenmeden reddedilir.
- Trusted startup, her receipt/request çiftini Core Service policy provider ile yeniden doğrular; audit zarfları ayrıca merkezi policy ile doğrulanır.
- Harici monotonic checkpoint, head sequence/hash/byte size eşitliğini doğrular ve complete-tail rollback/equivocationı fail-closed kapatır.
- Altı deferred production runtime, committed pending receipt'i `ensure`, projection proof doğrulaması ve `acknowledgeJournalProjection` ile tamamlar; hata halinde pending kayıt korunur.
- Tipli status IPC sıfır argümanlı ve no-cache'tir; audit veya receipt payloadı renderer'a çıkmaz.
- Statik kaynak gate'i eksik/no-op sink, plaintext audit, kontrol-akışı ve istemci payload kaçışlarını üretim kaynaklarında reddeder.

## Fail-closed sonuçlar

Bozuk audit hash'i, receipt/decision/request/context/package/resource/identity/obligation sapması, eksik allowed execution attestationı, denied execution iddiası, journal MAC/hash/sıra/nonce sapması, eksik anahtar, kilit, readback uyuşmazlığı, trusted-provider reddi veya monotonic checkpoint arızasında zincir doğrulanmış sayılmaz ve kullanıcı payload operasyonu açılmaz.

## Kapsam dışı ve korunmuş sınırlar

Journal tek-host append-only dosyadır; çok süreçli consensus veya fiziksel WORM medya iddiası yoktur. Harici monotonic authority complete-tail rollback savunmasının zorunlu parçasıdır. Tarihsel direct receipt kayıtları okunur ancak yeni audit kaydı sayılmaz; backfill yapılmaz. Yeni migration, gerçek veri taşıma, SQLite/vault sahiplik değişimi ve cutover yoktur. PPK-019 retention/silme yayılımı bu paket kapsamında tamamlanmaz.

## Doğrulama durumu

Hedefli politika/journal/IPC matrisi, eski protected journal runtime, statik kaynak gate'i, tam Vitest, üretim bileşen build'leri, proje bütünlük kapıları ve final contract/runtime artefaktları gerçek PASS vermiştir. Root aggregate build wrapper'ı tamamlanmış tarihsel `31-T` çalışma-adımı kapısında bilinçli olarak reddedilmiş; kapı zayıflatılmadan aynı üretim zincirinin 18 workspace bileşeni, Core Service ve Desktop Electron main/preload/renderer doğrudan PASS olmuştur. Bu wrapper denemesi PASS sayılmamıştır.
