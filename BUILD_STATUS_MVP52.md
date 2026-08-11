# Panthera pardus tulliana — Bronze MVP-52 Build Durumu

- Kullanıcı sürümü: `23.07.2026.52`
- Paket sürümü: `23.7.2026-52`
- Kanal: `Bronze`
- Milestone: `B060-M12 — RBAC & Audit Chain Hardening`
- Sonuç: **Başarılı kaynak teslimi**

## Tamamlanan temel işler

- Merkezi `CentralAuthorizationService` eklendi.
- Rol, kayıt sahipliği ve açık nesne izinleri tek değerlendirme zincirinde birleştirildi.
- Etkin `deny` kaydı sahiplik, rol ve wildcard `allow` kararlarından önce uygulanıyor.
- Süreli `allow/deny` nesne izinleri repository ve application use-case katmanına taşındı.
- İzin listeleme, ekleme/güncelleme ve silme işlemleri yalnızca etkin `family_admin` hesabına açıldı.
- İzin değişiklikleri audit kaydıyla aynı transaction içinde yürütülüyor.
- Audit zinciri sıra numarası, hash sürümü ve correlation kimliğiyle v2 formatına yükseltildi.
- Audit kayıtları SQLite trigger’larıyla update/delete işlemlerine kapatıldı.
- Audit zinciri yeniden hesaplanarak dış müdahale ve zincir kırılması tespit ediliyor.
- Migration 7 ve yeni uygulama şeması fingerprint’i eklendi.
- Workspace sıfırdan derleme sırası düzeltildi.

## Doğrulama

- TypeScript workspace: `12/12`
- Electron main/preload typecheck: başarılı
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
- Toplam: `157/157`
- IPC eşleşmesi: `128/128`
- Migration: `7`
- Uygulama/güvenlik tablosu: `41`
- Altyapı tablosu: `4`

## Sınırlar

- Tam Electron/Vite/Vitest production build’i ve Windows installer bu Bronze ara geliştirme turunda yeniden çalıştırılmadı.
- Kapsamlı manuel UI, kurulum ve ekran görüntüsü doğrulamaları Silver aşamasında toplu yürütülecektir.
