# 33-K üst kapanış — Gizlilik, süreli rıza ve kayıp cihaz kapatma merkezi

- Tarih: 13.08.2026
- Karar: DEC-222
- Gereksinimler: B5-06, EXT-039
- Uygulama durumu: COMPLETE; yerel doğrulama PASS
- Şema: mevcut Migration 88 yeniden kullanılır; yeni migration yoktur
- Yetkilendirme: CentralAuthorizationService

## Uygulanan sınır

Canlı konum paylaşımı varsayılan kapalıdır. Açılması açık kullanıcı işlemi ve 15 dakika
ile 30 gün arasında sonlu süre gerektirir. Etkinlik göstergesi değerlendirme anında
süreyi uygular; kullanıcı rızayı derhal iptal edebilir. Bu merkez konum verisi iletmez.

Kayıp cihaz kapatma güçlü yerel doğrulama, güncel oturum/security_epoch ve aynı hesaba
ait etkin trusted_devices hedefi ister. Tek merkezi UoW içinde security_epoch ilerletilir,
hesabın etkin trusted device kayıtları, offline capability lease kayıtları ve verilmiş
rızaları iptal edilir; içeriksiz audit yazılır. Commit sonrasında mevcut yerel oturum,
dosya-import oturumları, reauthentication guard, hassas offline cache ve kullanıcı vault
oturumu kapatılır.

Yetki yalnız CentralAuthorizationService merkezi PEP üzerinden verilir. Doğrudan rol
bypass'ı yoktur. Mevcut accounts.security_epoch, trusted_devices,
offline_capability_leases, ai_consents ve audit_log altyapısı yeniden kullanılır.

Bu işlem uzaktan silme veya MDM değildir. Bir ağ komutu göndermez, kayıp cihaza teslim
ya da teslim alındısı garantisi vermez. Sonuç açıkça scope=local_authority_only,
remoteWipePerformed=false, mdmOperationPerformed=false ve
networkDelivery=not_performed değerlerini taşır.

## Kanıt zinciri

- `artifacts/validation/33-K-privacy-consent-lost-device-control-boundary.json`
- `artifacts/validation/33-K-privacy-consent-lost-device-control-contract.json`
- `artifacts/validation/33-K-privacy-consent-lost-device-control-runtime.json`
- `packages/application/tests/privacy-control-use-cases.test.ts`
- `apps/desktop/tests/b5-privacy-control-ipc-integration.test.ts`
- `docs/security/THREAT_MODEL_33_K_PRIVACY_CONSENT_LOST_DEVICE_CONTROL.md`
- `config/33-k-privacy-consent-lost-device-control-scope.json`
- `config/33-k-privacy-consent-lost-device-control-inventory.json`

Platform ratchet değerleri PPK-021 için 557 exact yüzey / 284 use-case composition ve
PPK-022 için 246 exact capability yüzeyidir. Ağ kanalı sayısı sıfırdır.

Yerel doğrulama boundary 19/19, contract 13/13 ve runtime 9/9 kontrolde PASS;
iki hedefli dosyada 6/6 test PASS; tam Vitest 127/127 dosya ve 1044/1044 test PASS;
18/18 production workspace build PASS sonucudur.
