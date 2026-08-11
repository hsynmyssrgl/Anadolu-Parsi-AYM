# Build226 Fresh-Profile Device Identity Security Validation

## Scope

Bu doğrulama exact Build225 gerçek Windows kanıtında görülen `VAULT_INITIALIZATION` başlangıç hatasının dar Build226 düzeltmesini kapsar.

## Required properties

- Startup preflight cihaz kimliğinden önce tamamlanır.
- Cihaz kimliği yalnız production `FileDeviceIdentityProvider` ile oluşturulur/yüklenir.
- Private key, schema v2 zarfında OS secret protector ciphertext'i olarak saklanır.
- Doğrulanmış kimlik, bakım yeniden doğrulama cihaz-bağlama özetinden önce hazırdır.
- Bozuk JSON, yanlış provider, açılamayan ciphertext ve kullanılamayan OS koruması fail-closed'dur.
- İlk açılış boş bakım durumunu korumalı persist eder; ikinci açılış restore eder.

## Source validation

- Fresh-profile ordering contract: PASS (25/25)
- Fresh-profile runtime/tamper: PASS (8/8)
- Device identity protection regression: PASS (10/10)
- Maintenance reauthentication persistence regression: PASS (11/11)
- Package source typecheck: PASS
- Desktop main controlled TypeScript: PASS

## Windows closure boundary

Kaynak doğrulaması gerçek Windows development/installed kanıtının yerine geçmez. OPEN-021 ve OPEN-022 bu kanıtlar üretilene kadar bağımsız olarak `NOT_READY` kalır; `NOT_RUN` hiçbir zaman PASS değildir.

