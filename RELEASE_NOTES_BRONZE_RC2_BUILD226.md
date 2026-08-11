# Release Notes — Bronze RC2 Build226

Build226 yalnız exact Build225 gerçek Windows fresh-profile tanısında kanıtlanan cihaz kimliği başlangıç sırası hatasını düzeltir.

## Security correction

- OS-korumalı cihaz kimliği startup preflight sonrasında, cihaz-bağlı bakım restore/persist işleminden önce oluşturulur veya doğrulanır.
- Bakım cihaz-bağlama özeti yalnız doğrulanmış `deviceId` ve `fingerprint` üzerinden türetilir.
- Ham `device-identity.json` ilk-açılış varsayımı kaldırılmıştır.
- Bozuk kimlik, yanlış provider, açılamayan ciphertext ve kullanılamayan OS koruması fail-closed kalır.

## Regression preservation

Build225 OPEN-021/OPEN-022, fatal startup ve PR-172 davranışları ile Build224 lisans ve Build223 preload regresyonları PASS kalmıştır.

## Limitation

Gerçek Windows development ve installed/package closure probları henüz `NOT_RUN`; OPEN-021 ve OPEN-022 bağımsız olarak `NOT_READY` kalır.

