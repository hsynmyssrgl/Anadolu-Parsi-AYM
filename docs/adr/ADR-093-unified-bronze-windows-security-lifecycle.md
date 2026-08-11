# ADR-093 — Birleşik Bronze gerçek Windows güvenlik yaşam döngüsü

**Aktif sürüm:** 01.08.2026.219

## Bağlam

Build217 OPEN-021 ve Build218 OPEN-022 için dar, gerçek Windows kapanış kapıları oluşturdu. Ayrı çalıştırma iki kez dependency bootstrap, iki installer üretimi ve iki kurulum/kaldırma döngüsü gerektiriyordu. Bu tekrar kullanıcı yükünü ve çevresel hata yüzeyini artırıyordu.

## Mimari

Build219 tek Windows oturumunda aşağıdaki sıralı yaşam döngüsünü kullanır:

1. exact-source integrity,
2. tek `npm ci`,
3. tek `package:win`,
4. development OPEN-021 EFS probe,
5. development OPEN-022 safeStorage/DPAPI + Protected Side Artifact probe,
6. tek sessiz kurulum,
7. installed/package OPEN-021 probe,
8. installed/package OPEN-022 probe,
9. tek sessiz kaldırma,
10. OPEN-021 ve OPEN-022 için bağımsız readiness doğrulaması,
11. tek exact-source-bound kanıt ZIP/SHA üretimi.

## Fail-closed ilkeleri

- Build/install/uninstall ortak yaşam döngüsü başarısızsa iki kapanış da NOT_READY olur.
- Yalnız OPEN-021 probu başarısızsa OPEN-022 geçerli kanıtı korunur; tersi de geçerlidir.
- `KeepInstalled` resmi kapanış PASS'i vermez; kaldırma PASS zorunludur.
- `READY_TO_CLOSE` hiçbir ledger mutasyonu yapmaz.
- Gerçek Windows, EFS ve Electron safeStorage/DPAPI kanıtı taklit edilemez.

## Sonuç

Build219 kullanıcı tarafındaki Windows işlemini tek tıklamaya indirirken iki OPEN kaleminin kanıt bütünlüğünü ve bağımsız kapanış semantiğini korur.
