# ADR-048 — Bakım kurtarması sonrası hesap güvenlik dönemi

## Durum

Kabul edildi — Bronze RC2 Build 175.

## Bağlam

Build 173 yetkili bakım kilidi kurtarmasını, Build 174 ise işlem sonrası zorunlu oturum sonlandırma ve 15 dakikalık kalıcı soğuma süresini ekledi. Buna rağmen daha önce güvenilir olarak kaydedilmiş cihazların yalnız `revoked_at` ve cihaz parmak izi üzerinden değerlendirilmesi, gelecekteki çoklu istemci veya eşzamanlı oturum senaryolarında eski güven bağlarının yeniden kullanılmasına açık bir sınır bırakıyordu.

## Karar

- Her hesap için artan, 32 bit imzalı tamsayı sınırında bir `security_epoch` tutulur.
- Her güvenilir cihaz kaydı, güven oluşturulduğu andaki hesap güvenlik dönemini taşır.
- Güvenilir cihaz yalnız cihaz kimliği, kriptografik kanıt, iptal durumu ve güvenlik dönemi birlikte eşleşirse geçerli kabul edilir.
- Başarılı bakım kilidi kurtarması tek transaction içinde:
  1. hesabın güvenlik dönemini bir artırır,
  2. bütün aktif güvenilir cihaz kayıtlarını iptal eder,
  3. denetim kaydı ekler.
- Transaction doğrulanmadan oturum sonlandırma aşamasına geçilmez.
- Eski cihaz kaydı yeni dönemde otomatik olarak güvenilir hale gelmez; kullanıcı yeniden giriş yapar, ikinci faktörü tamamlar ve cihazı yeniden açıkça yetkilendirir.
- Güvenlik dönemi ilerletme aile verilerini, dijital arşivi, adaptif kaynak bütçesini ve yedek içeriklerini değiştirmez.

## Sonuçlar

- Eski cihaz güveni bakım kurtarması sonrasında replay edilemez.
- `revoked_at` savunması, dönem eşleşmesiyle ikinci bir bağımsız güven sınırı kazanır.
- Veritabanı şeması migration 27 ile genişler; legacy hesap ve cihaz kayıtları dönem `0` ile uyumlu biçimde başlar.
- Dönem üst sınıra ulaşırsa işlem fail-closed reddedilir.
