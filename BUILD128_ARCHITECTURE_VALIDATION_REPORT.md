# Build 128 Architecture and Security Validation Report

## Kimlik

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.128`
- Package Version: `27.7.2026-128`
- Stage: **Bronze RC2 Active Development**

## Mimari etki

Cihaz kimliği dosya sağlayıcısı, işletim sistemi sır korumasından ayrılmış bir
`DeviceSecretProtector` portuna bağlandı. Electron composition root bu portu
`safeStorage` adaptörüyle sağlar. Veri deposu ve güvenilir cihaz use-case'leri
özel anahtarı doğrudan görmez; mevcut imza/proof sözleşmesi korunur.

## Güvenlik davranışı

- Yeni cihaz kimliği, güvenli backend kullanılabiliyorsa sürüm 2 şifreli zarfla yazılır.
- Legacy açık kimlik aynı cihaz kimliği ve anahtar çifti korunarak migrate edilir.
- Şifreli zarfın özel anahtarı yalnız `safeStorage.decryptString` ile belleğe alınır.
- Zarf koruma kimliği farklıysa veya güvenli backend yoksa kayıt reddedilir.
- Migration geçici dosya, kısa ömürlü rollback kopyası ve atomik rename kullanır.
- Özel/açık anahtar eşleşmesi imzalı meydan okumayla doğrulanır.

## Hedefli doğrulama

- Build 128 security contract: **PASS — 49 assertion**.
- SafeStorage adapter runtime: **PASS — 7 assertion**.
- Controlled Electron-main source type-check: **PASS**.
- Version sequence: **PASS — Build 128**.
- Package source controlled type-check: **PASS — TypeScript 5.8.3**.
- Lockfile integrity: **PASS — 973 assertion / 14 workspace**.
- Workspace dependency contract: **PASS — 360 assertion / 14 workspace**.

Bu doğrulamalar gerçek Windows DPAPI davranışının platform kabul kanıtı değildir.
