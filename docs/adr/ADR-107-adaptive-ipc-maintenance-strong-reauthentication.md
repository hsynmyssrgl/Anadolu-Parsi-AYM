# ADR-107 — Adaptif IPC bakımında güçlü yeniden doğrulama

**Durum:** Kabul edildi  
**Tarih:** 29.07.2026  
**Build:** 169

## Bağlam

Build 167 tek kullanımlık, işlem türüne bağlı bakım oturumunu; Build 168 ise etkin `family_admin` ve güvenilir cihaz yetkisini getirdi. Etkin bir yönetici oturumunun ele geçirilmesi hâlinde teknik bakım işlemlerinin yalnız mevcut oturum güvenine dayanması yeterli değildir.

## Karar

Adaptif IPC bütçe sıfırlama ve gizlilik güvenli tanı paketi dışa aktarma işlemlerinde bakım oturumu açılmadan önce hesap parolası yeniden doğrulanır. Hesapta TOTP etkinse geçerli ikinci faktör kodu da zorunludur.

Kimlik bilgileri yalnız renderer → preload → ana süreç IPC çağrısında kısa ömürlü girdi olarak taşınır. Oturum kaydına, bakım parmak izine, denetim metadatasına, telemetriye veya tanı paketine yazılmaz. IPC politika katmanı yalnız `password` ve isteğe bağlı `code` alanlarını, sınırlı uzunluklarla kabul eder.

Başarılı yeniden doğrulama tek başına işlem yapmaz; Build 167'nin tek kullanımlık ve 90 saniyelik bakım oturumu ile Build 168'in rol/güvenilir cihaz kontrolleri birlikte uygulanmaya devam eder. Renderer alanları işlem tamamlandığında, hata aldığında veya kullanıcı vazgeçtiğinde temizler.

## Sonuçlar

- Ele geçirilmiş açık oturum tek başına bakım işlemi için yeterli değildir.
- TOTP etkin hesaplarda ikinci faktör atlanamaz.
- Ham parola ve TOTP kodu kalıcı kanıt veya tanı verisi olmaz.
- Kullanıcı her bakım işlemi için açık ve yeniden doğrulanmış irade gösterir.
- Geniş RC2 doğrulama kapıları bağımlılık paketi dönene kadar `NOT_RUN` kalır.
