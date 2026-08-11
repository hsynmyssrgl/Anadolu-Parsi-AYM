# DEC-118 — Build225 Fresh-Profile Device Identity Initialization Order

## Decision

Build226, `startupSecurityPreflight` başarıyla tamamlandıktan hemen sonra OS-korumalı `FileDeviceIdentityProvider` üzerinden cihaz kimliğini oluşturur veya doğrular. Cihaz-bağlı bakım yeniden doğrulama durumu ancak bu işlemden sonra restore/persist edilir.

## Proven cause

Exact Build225 gerçek Windows fresh-profile çalıştırmasında `VAULT_INITIALIZATION` aşaması, henüz mevcut olmayan `user-data\secrets\device-identity.json` dosyasını ham JSON olarak okumaya çalıştı. Boş bakım durumu ilk persist yoluna girdiğinde aynı eksik kimlik varsayımı tetiklendi ve OPEN-021/OPEN-022 probe dosyaları üretilemeden başlangıç kesildi.

## Constraints

- Build225 tarihsel kaynak ve kanıtları değişmez.
- Cihaz bağı kaldırılmaz; sahte kimlik veya hash üretilmez.
- Windows safeStorage/DPAPI zorunluluğu gevşetilmez.
- Koruma kullanılamaz, provider değişmiş veya ciphertext açılamazsa başlangıç fail-closed ve non-zero kalır.
- OPEN-021 ve OPEN-022 yalnız gerçek development + installed kanıtları PASS olduğunda ayrı ayrı kapanabilir.

