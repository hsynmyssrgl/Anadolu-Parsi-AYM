# 33-Y — Yerel-first akıllı ev ve enerji tehdit modeli

## Korunan varlıklar

- Aile, hesap, kişi ve cihaz sahipliği ile merkezi PEP receipt/fence bağları.
- İmzalı adapter kimliği, manifest özeti ve cihaz yaşam döngüsü.
- Sensör ve enerji gözlemlerinin sınırlandırılmış scalar metadata'sı.
- Görünür, süreli ve geri alınabilir kamera/kapı zili izinleri.
- Mutation ledger, optimistic revision, idempotency ve içeriksiz audit/outbox.

## Tehditler ve kontroller

1. **Sahte adapter veya cihaz:** Kayıt main-only akışta doğrulanmış imza sonucu, exact manifest özeti, signer kimliği ve aynı receipt/fence ile kabul edilir. Renderer güven kanıtı sağlayamaz.
2. **Yabancı sahip cihazı:** Bütün current ve ledger satırları exact hesap, aile ve kişi sahibiyle bağlanır; yabancı kaynak fail-closed reddedilir.
3. **Provider payload sızıntısı:** Yalnız türle uyumlu boolean/sayısal metadata kalıcıdır. Ham kamera, ses, dosya yolu, credential, token, manifest özeti ve yerel cihaz özeti renderer'a çıkmaz.
4. **Gizli gözetim:** Kamera erişimi varsayılan kapalıdır. İzin görünürdür, beş ile altmış dakika arasında sona erer ve geri alınabilir; gizli gözetim truth alanı daima yasaktır.
5. **Cihaz kontrolü yanılgısı:** Mutation receipt'leri `providerActionPerformed=not_performed` taşır. Termostat, ışık, priz, EV şarjı veya kamera üzerinde gerçek komut çalıştırılmaz.
6. **Gözlem türü karıştırma:** Observation türü, birim ve cihaz türü eşliği application ve migration triggerlarında doğrulanır; sayı aralığı ve zaman penceresi sınırlandırılır.
7. **Replay ve yarış:** `clientOperationId`, request fingerprint, optimistic revision, immutable mutation ledger ve current-row last-mutation bağı zorunludur.
8. **Ağ/bulut/sağlayıcı yanılgısı:** Ağ ve bulut kullanılmaz; Matter commissioning, live provider, sensör ingestion ve provider availability truth alanları false kalır.
9. **Dekoratif işleme tercihi ve süresi dolmuş izin:** İşleme kapalıyken yeni observation uygulama ve SQL trigger sınırında reddedilir. Durable izin satırı süresi dolduğunda renderer-safe görünüm `expired` üretir; aktif gibi sunamaz.
10. **Komut karışıklığı ve zaman geri sarma:** Komutlar exact plain-object/own-property sözleşmesiyle, canonical fingerprint ve exact UTC zaman biçimiyle doğrulanır. Cihaz, izin ve ayar güncellemeleri zamanı geriye taşıyamaz; no-op mutation reddedilir.
11. **Sınırsız disk büyümesi:** Sahip başına 500 cihaz, 50.000 gözlem, 2.000 kamera izni ve 100.000 mutation sınırı hem uygulama hem migration triggerında fail-closed uygulanır. Otomatik retention/kurtarma uygulanmamıştır; kapasite dolduğunda yazımın kapanması açık ürün ve retention riskidir.

## Açık kanıtlar

Gerçek Matter, sensör sağlayıcısı, enerji sayacı, kamera/kapı zili ve cihaz kontrolü UAT'ları ile otomatik retention tasarımı, privacy/safety ve legal incelemeler `NOT_RUN` durumundadır. Persistent governance receipt yoktur; registry ve roadmap kapanmamıştır. `33-Y` yalnız kısmi yerel teknik kanıttır ve `countsAsRequirementPass=false` kalır.

## 24.08.2026 değişiklik-etki doğrulaması

PR-235 kapsamında güncel kullanıcı dili ve renderer sözleşmesi bu tehdit modeline yeniden bağlandı; 52/52 sınır-sözleşme-çalışma zamanı zinciri PASS oldu. Sonuç dış/manual kanıtları kapatmaz ve production kabulü değildir.
