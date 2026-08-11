# Panthera pardus tulliana — Bronze MVP-45 Build Durumu

- Kullanıcı sürümü: `23.07.2026.45`
- Paket sürümü: `23.7.2026-45`
- Kanal: Bronze
- Milestone: `B060-M5 — Event Dispatcher & Idempotency`
- Durum: Tamamlandı

## Tamamlanan kodlama

- Transactional outbox event dispatcher
- Exponential retry/backoff politikası
- Maksimum deneme sonrası kalıcı failed durumu
- Handler receipt tabanlı idempotency
- Yarım kalan processing kayıtlarının stale recovery mekanizması
- `family.member.created` structured log handler'ı
- `family.member.created` diagnostic projection handler'ı
- Deterministik diagnostic kayıt anahtarı ile duplicate önleme
- Electron arka plan scheduler outbox çevrimi
- Aile üyesi ekleme IPC akışında anlık event dispatch
- Migration 5: `processing_started_at` ve processing index'i

## Doğrulama özeti

- TypeScript workspace derlemesi: 12/12
- Electron main/preload typecheck: başarılı
- Foundation: 14/14
- Runtime: 6/6
- Migration: 9/9
- SQLite smoke: 14/14
- Repository/outbox: 10/10
- Transaction atomikliği: 9/9
- Dispatcher scenario grubu: 3/3
- IPC eşleşmesi: 124/124
- Uygulama tablosu: 40
- Altyapı tablosu: 4
- Migration: 5

## Ertelenen kapsam

Kapsamlı Electron/Vite/Vitest üretim zinciri, Windows kurulum testi, ekran görüntüsü ve manuel doğrulama kalıcı proje kararına uygun olarak Silver aşamasında toplu yapılacaktır.
