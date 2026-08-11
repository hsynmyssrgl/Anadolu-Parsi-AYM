# Panthera pardus tulliana — Bronze MVP-53 Build Durumu

- Kullanıcı sürümü: `23.07.2026.53`
- Paket sürümü: `23.7.2026-53`
- Kanal: `Bronze`
- Milestone: `B060-M13 Membership Collaboration & Notifications`
- Sonuç: **Başarılı kaynak teslimi**

## Tamamlanan temel işler

- Aile hesabı davetleri repository ve application use-case katmanına taşındı.
- Davet oluşturma, listeleme, iptal ve tek kullanımlık kabul akışları transaction, audit ve outbox korumasına alındı.
- Davet kabulünde aile kişisi ile kullanıcı hesabı bağlantısı ve üyelik süresi korunuyor.
- Önemli gün katılımcıları, görünürlüğü, davetiye metni ve notları ayrı application komutlarıyla güncelleniyor.
- Geçersiz katılımcı güncellemesinde event, audit ve outbox kayıtlarının tamamı rollback ediliyor.
- Timeline bildirimleri kullanıcı hesabı bazında kalıcı ve idempotent biçimde okundu olarak işaretleniyor.
- Migration 8 ile `event_notification_states` ve bekleyen davet tekilliği eklendi.
- Önemli gün düzenleme ve bildirim onaylama işlemleri mevcut renderer akışına bağlandı.
- Renderer global IPC bildirimi içindeki yinelenen yöntem ve eksik type importları düzeltildi.

## Doğrulama

- TypeScript workspace: `12/12`
- Electron main/preload smoke typecheck: başarılı
- Renderer TSX sözdizimi ve global declaration parse: başarılı
- Foundation: `14/14`
- Runtime: `6/6`
- Migration: `9/9`
- SQLite smoke: `14/14`
- Repository/outbox: `10/10`
- Transaction atomikliği: `9/9`
- Event dispatcher: `3/3`
- Family use-case: `14/14`
- Genealogy: `6/6`
- Timeline: `17/17`
- Dashboard/navigation: `14/14`
- Authentication/session: `16/16`
- MFA/güvenilir cihaz: `16/16`
- Authorization/audit: `9/9`
- Membership/collaboration/notification: `17/17`
- Toplam: `174/174`
- IPC eşleşmesi: `132/132`
- Migration: `8`
- Uygulama/güvenlik tablosu: `42`
- Altyapı tablosu: `4`

## Temiz kaynak paketi

- Kaynak envanteri: `495 dosya`
- TypeScript kaynak dosyası: `95`
- Paket manifesti: `496 dosya`
- İç SHA-256 listesi: `497/497`
- Sembolik bağlantı: `0`
- `node_modules`, `dist`, `release`, `.tmp`, `coverage`: `0`

## Sınırlar

- Temiz kaynak teslimi kurulu `node_modules` ağacını içermez. Bu nedenle standart Vite/React/Electron renderer dependency typecheck ve production bundle Silver üretim zincirinde çalıştırılacaktır.
- Windows installer, upgrade, kapsamlı manuel UI, erişilebilirlik ve ekran görüntüsü doğrulamaları Silver aşamasında toplu yürütülecektir.
