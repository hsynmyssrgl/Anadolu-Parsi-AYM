# Bronze RC2 Build 79 Sürüm Notları

- Uygulama: `24.07.2026.80`
- Paket: `24.7.2026-80`
- Aşama: Bronze RC2 Aktif Geliştirme

## Değişiklik

Geçerli oturum hesabının yüklenmesi `SqliteAccountRepository.findById` üzerinden transaction sınırına taşındı. AI izin application context içindeki doğrudan `accounts` SQL sorgusu kaldırıldı ve merkezi `#currentAccount()` akışı yeniden kullanıldı. Üyelik durumu ve başlangıç/bitiş tarihi kontrolleri korunmuştur.

## Doğrulama kapsamı

Hedef mimari sınır doğrulaması, sürüm zinciri, manifest ve ZIP bütünlüğü. Tam TypeScript/Electron üretim derlemesi bu pakette çalıştırılmamıştır.
