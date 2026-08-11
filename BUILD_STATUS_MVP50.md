# Panthera pardus tulliana — Bronze MVP-50 Build Durumu

- Kullanıcı sürümü: `23.07.2026.50`
- Paket sürümü: `23.7.2026-50`
- Kanal: `Bronze`
- Milestone: `B060-M10 — Authentication & Session Application Migration`
- Sonuç: **Başarılı kaynak teslimi**

## Tamamlanan temel işler

- Kullanıcı hesabı repository katmanı oluşturuldu.
- Yönetici kurulumu, giriş, çıkış ve parola değişimi application use-case katmanına taşındı.
- Parola hash/verify işlemleri security adapter üzerinden kullanıldı.
- Boşta kalma zaman aşımı uygulayan in-memory session manager eklendi.
- Beş başarısız girişten sonra 15 dakikalık hesap kilidi uygulandı.
- Login failure, account lock, session start/end ve password change audit kayıtları atomik işlendi.
- E-posta normalizasyonu locale bağımsız hâle getirildi.
- Mevcut TOTP doğrulaması geriye uyumlu biçimde korundu; tam TOTP/güvenilir cihaz geçişi MVP-51 kapsamındadır.

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
- Toplam: `132/132`
- IPC eşleşmesi: `125/125`
- Migration: `5`
- Uygulama tablosu: `40`
- Altyapı tablosu: `4`

## Sınırlar

Tam Electron/Vite/Vitest üretim build’i, Windows installer ve kapsamlı manuel ekran doğrulaması Bronze ara geliştirme politikasına göre bu turda yapılmadı. Bunlar Silver toplu doğrulama aşamasında yürütülecektir.
