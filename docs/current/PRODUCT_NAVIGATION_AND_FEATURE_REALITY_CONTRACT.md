# Ürün Navigasyonu ve Feature Reality Sözleşmesi

Bu belge DEC-208 ve `packages/domain/src/product-surface-governance.ts` kaynak
sözleşmesinin okunabilir karşılığıdır. Sayılar: **17 ürün modülü + 5 yönetişim
yüzeyi = 22 rota = 22 menü girdisi = 22 ekran dispatch'i**.

## Kanonik rota envanteri

| Rota | Grup | Sınıf |
|---|---|---|
| dashboard | Ana Merkez | Ürün modülü |
| family | Aile Hafızası | Ürün modülü |
| households | Aile Hafızası | Ürün modülü |
| people-lifecycle | Aile Hafızası | Ürün modülü |
| tree | Aile Hafızası | Ürün modülü |
| timeline | Aile Hafızası | Ürün modülü |
| important-days | Aile Hafızası | Ürün modülü |
| archive | Aile Hafızası | Ürün modülü |
| finance | Yaşam | Ürün modülü |
| health | Yaşam | Ürün modülü |
| life-center | Yaşam | Ürün modülü |
| automation | Yaşam | Ürün modülü |
| reports | Yaşam | Ürün modülü |
| location | Yaşam | Ürün modülü |
| invitations | Gizlilik ve Sistem | Ürün modülü |
| data-repair | Gizlilik ve Sistem | Yönetişim yüzeyi |
| permissions | Gizlilik ve Sistem | Yönetişim yüzeyi |
| ai | Gizlilik ve Sistem | Ürün modülü |
| legacy | Gizlilik ve Sistem | Ürün modülü |
| windows-hello | Gizlilik ve Sistem | Yönetişim yüzeyi |
| security | Gizlilik ve Sistem | Yönetişim yüzeyi |
| settings | Gizlilik ve Sistem | Yönetişim yüzeyi |

## Kullanılmayan renderer API sınıflandırması

| Preload metodu | IPC kanalı | Sınıf | B9-01 yönü |
|---|---|---|---|
| getDiagnosticReport | system:getDiagnosticReport | DIAGNOSTIC_OPERATOR_API | Uyumluluk incelemesi sonrası kaldır |
| runDueBackups | system:runDueBackups | BACKGROUND_OPERATIONAL | Non-UI tut |
| getAdaptiveState | system:adaptiveState | BACKGROUND_OPERATIONAL | Non-UI tut |
| verifyDiagnosticReport | system:verifyDiagnosticReport | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |
| searchMaintenanceHistory | system:searchMaintenanceHistory | DIAGNOSTIC_OPERATOR_API | Uyumluluk incelemesi sonrası kaldır |
| exportMaintenanceHistory | system:exportMaintenanceHistory | DIAGNOSTIC_OPERATOR_API | Uyumluluk incelemesi sonrası kaldır |
| searchAllDiagnosticArchives | system:searchAllDiagnosticArchives | DIAGNOSTIC_OPERATOR_API | Uyumluluk incelemesi sonrası kaldır |
| listArchiveClassifications | archive:listClassifications | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |
| listPermissions | permissions:list | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |
| propagatePurgedBackups | dataLifecycle:propagatePurgedBackups | BACKGROUND_OPERATIONAL | Non-UI tut |
| getSnapshot | data:getSnapshot | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |
| listArchive | archive:list | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |
| searchArchive | archive:search | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |
| listArchiveRetentionStatus | archive:listRetentionStatus | SUPERSEDED_READ_MODEL | Uyumluluk incelemesi sonrası kaldır |

Sınıflandırılmış kayıt sayısı 14, çözümlenmemiş kayıt sayısı 0'dır. Envanter
drift'i, eksik ekran kolu veya yanlış COMPLETE zinciri `pretypecheck` ve
`prebuild` aşamalarını fail-closed durdurur. B9-01 bu belgeyle kapanmaz.
