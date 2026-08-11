# DEC-199 — PPK-018 değişmez policy karar audit zinciri

## Durum

32-N kapsamında kabul edildi. PPK-018 üst gereksinimi hedefli testler, tam regresyon, üretim build'i, bütünlük kontrolleri ve final contract/runtime kanıtlarıyla `COMPLETE` durumundadır.

## Karar

Her `PlatformPolicyEnforcementPoint` izin veya ret kararı için tek kanonik `PlatformPolicyReceiptRecord` üretir. Ret kararı çağırana dönmeden, non-deferred izin kararı ise payload operasyonu açılmadan önce receipt sink'e yazılmak zorundadır. Audit persistence başarısız olursa `RECEIPT_PERSISTENCE_FAILED` üretilir ve kullanıcı verisi operasyonu çalışmaz. Deferred SQLite akışlarında business transaction ile allowed receipt aynı atomik transactionda kalıcılaştırılır; commit sonrası exact `ensure`, kriptografik projection proof ve acknowledge tamamlanmadan başarı dönmez.

Yeni `ImmutablePolicyDecisionAuditPolicy`, receipt kaydını fail-closed doğrular ve ayrı bir audit gövdesi üretir. Gövde; allow/deny kararı, açık karar/ret nedeni, policy sürümü, policy package sürümü ve SHA-256'sı, exact yükümlülükler, correlation, request/context/receipt/record hashleri, receipt nonce, karar otoritesi, uygulama/cihaz kimlik bağları, kaynak türü/kimliği, veri sınıfları, action, capability ve kayıt zamanını taşır. Allowed kararda strict obligation executor attestationı zorunludur; denied kararda obligation execution iddiası yasaktır. `auditHash`, kanonik audit gövdesinin SHA-256 bağıdır.

Desktop `PlatformPolicyReceiptFileSink`, yeni kayıtları `{schemaVersion:1, kind:'immutable-policy-decision-audit', auditRecord, receiptRecord}` zarfı olarak AES-256-GCM ile korur. Journal entry schemaVersion 2 değişmez. Her entry ayrı cihaz-korumalı MAC anahtarıyla HMAC-SHA-256 zincirine bağlanır; nonce replay, eksik/bozuk satır, hash/MAC sapması ve readback uyuşmazlığı fail-closed reddedilir. Dosya ve dizin fsync'i ile tam readback zorunludur. Core Service monotonic checkpoint, tam kuyruk geri alma/equivocation sınırını korur. Restartta receiptler trusted policy provider ile ve yeni audit zarfları merkezi audit policy ile yeniden doğrulanır.

## Geriye uyumluluk ve şema kararı

Yeni database migration eklenmez; latest migration 77 kalır. Migration 56/57 ile başlayan `platform_policy_transaction_receipts` allowed transaction temeli değiştirilmez ve denied karar zinciri sayılmaz. Genel `audit_log` da PPK-018 otoritesi değildir.

PPK-018 öncesinde aynı journal entry schemaVersion 2 altında doğrudan korunan receipt payloadları okunmaya ve trusted provider ile doğrulanmaya devam eder. Bunlar `legacyReceiptEntryCount` içinde ayrı sayılır, yeni audit kaydı sayılmaz ve historical backfill uygulanmaz. Yeni yazımlar yalnız korumalı audit zarfı biçimindedir. Gerçek kullanıcı verisi taşınmaz, Desktop vault veya SQLite sahipliği değişmez ve cutover yapılmaz.

## İstemci ve görünürlük sınırı

Tipli `system:getPolicyDecisionAuditBoundary` IPC'si sıfır argümanlı ve policy-sensitive no-cache'tir. Domain/use-case/adapter zinciri yalnız content-free doğrulama duruşu, giriş sayıları ve zincir hash durumunu taşır. Receipt, audit gövdesi, correlation, kişi/aile/kaynak kimliği, karar nedeni veya yükümlülük payloadı renderer'a verilmez. Sistem ekranı bu sınırlı duruşu gösterir.

## Statik kaçış kapısı

`verify-immutable-policy-decision-audit-boundary.mjs`, bütün `apps/*/src` ve `packages/*/src` alanlarını tarar. Receipt sink'siz veya no-op sink'li PEP bileşimi, doğrulanmamış deferred projection, plaintext audit serialization, ret audit'inden önce dönüş ve istemciye audit payloadı çıkarma reddedilir. Gerçek sink, startup trusted verification, HMAC/fsync/readback/monotonic bağları ve no-cache IPC markerları ayrıca doğrulanır.

## Gerçeklik sınırı

Bu karar yeni bir SQLite policy audit tablosu oluşturmaz ve geçmiş kayıtları dönüştürmez. Korumalı journal tek-host append-only karar audit otoritesidir; harici monotonic checkpoint tam kuyruk geri alma savunmasını sağlar. Bu karar çok süreçli dağıtık consensus veya WORM donanımı iddiası değildir.

PPK-012 çevrimdışı lease/no-cache, PPK-013 istemci veri erişim yasağı, PPK-014 sürümlü Core API, PPK-015 ağ egress, PPK-016 türetilmiş veri mirası ve PPK-017 content-free log sınırları gevşetilmez. Kaynak silme/retention işleminin OCR, indeks, thumbnail, AI hafızası, cache, replica ve yedeğe yayılması PPK-019'un ayrı kabul şartıdır; PPK-018 bunu tamamlamış sayılmaz.

## Sonuç

PPK-018 `COMPLETE` olarak kapanmıştır. Yeni policy karar üreticisi, receipt sink, audit payload alanı, journal sahibi veya istemci görünürlük ihtiyacı ayrı kapsam, açık karar ve aynı fail-closed doğrulama zincirini gerektirir. PPK-019 ve sonraki Bronze kapsamı açık kalır.
