# ADR-044 — Bakım yeniden doğrulama kilidinin işletim sistemi korumasıyla kalıcılaştırılması

## Durum

Kabul edildi — Bronze RC2 Build 171.

## Bağlam

Build 170, adaptif IPC bakım işlemlerinde beş başarısız güçlü doğrulama denemesinden sonra beş dakikalık geçici kilit uyguluyordu. Sayaç yalnız çalışma zamanı belleğinde tutulduğu için uygulamanın yeniden başlatılması kalan denemeyi ve etkin kilidi sıfırlayabiliyordu.

## Karar

- Başarısız deneme sayaçları, kilit bitiş zamanı ve güvenli toparlanma beklemesi uygulama yeniden başlatmaları arasında korunur.
- Kalıcı kayıtta yalnız 64 karakterlik SHA-256 kimlik/oturum/cihaz bağlam anahtarı ile sayısal zaman ve sayaç alanları bulunur.
- Parola, TOTP, görünen kullanıcı adı, IPC payload'ı ve oturum belirteci kalıcı kayda girmez.
- Durum payload'ı Electron `safeStorage` aracılığıyla işletim sisteminin sır koruması altında şifrelenir.
- Korunan zarf atomik geçici dosya, `fsync`, yeniden adlandırma ve mümkün olduğunda `0600` dosya izniyle yazılır.
- Şema, dosya boyutu, koruma sağlayıcısı ve payload SHA-256 bütünlüğü doğrulanmadan kayıt geri yüklenmez.
- Bozuk, değiştirilen veya açılamayan kayıt karantinaya alınır; en fazla dört karantina dosyası tutulur.
- Reddedilen kayıt sonrasında bütün bakım bağlamları beş dakikalık güvenli toparlanma kilidine alınır ve bu bekleme yeni korunan duruma yazılır.
- Süresi dolan kilitler ve on dakikayı aşan başarısız denemeler hem bellekten hem kalıcı kayıttan temizlenir.
- Normal uygulama kapanışı yalnız çalışma zamanı belleğini temizler; kalıcı güvenlik durumu silinmez.

## Sonuçlar

- uygulamayı yeniden başlatmak geçerli bakım kilidini veya kalan deneme sayısını sıfırlamaz.
- Yerel durum dosyası hassas kimlik bilgisi taşımaz ve işletim sistemi koruması olmadan okunamaz.
- Bozuk durum tüm uygulamayı kullanılamaz hale getirmek yerine bakım işlemlerini sınırlı süre fail-closed tutar.
- Bu kayıt hesaplar veya cihazlar arasında eşitlenmez; yalnız aynı yerel uygulama kullanıcı verisi dizininde geçerlidir.
