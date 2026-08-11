# ADR-043 — Adaptif IPC bakım yeniden doğrulamasında sınırlı deneme ve geçici kilit

## Durum

Kabul edildi — Bronze RC2 Build 170.

## Bağlam

Build 169 bakım oturumu açılmadan önce parola ve etkinse TOTP ile güçlü yeniden doğrulama getirdi. Sınırsız yeniden deneme, yerel olarak açık bırakılmış bir oturumda kaba kuvvet ve sürekli deneme riskini artırıyordu.

## Karar

- Aynı kimlik/oturum/cihaz parmak izi bağlamında en fazla **beş başarısız deneme** kabul edilir.
- Beşinci sayılan hata sonrasında bakım yeniden doğrulaması **beş dakika** geçici olarak kilitlenir.
- Başarısız denemeler **on dakikalık** hareketli olmayan hata penceresinde tutulur; pencere aşılırsa sayaç sıfırlanır.
- Yalnız yanlış parola ve yanlış ikinci faktör kodu sayılır. Eksik ikinci faktör, oturum yokluğu veya yetki reddi kaba kuvvet sayacını artırmaz.
- Başarılı güçlü doğrulama sayacı hemen temizler.
- Durum yalnız SHA-256 kimlik bağlamı anahtarıyla tutulur; parola, TOTP, kullanıcı görünen adı veya IPC payload’ı saklanmaz.
- Bellek kullanımı 256 bağlamla sınırlandırılır; en eski bağlam kapasite aşıldığında çıkarılır.
- Kilit durumu yetki API’si ve arayüzde kalan deneme/bekleme bilgisiyle görünür; kilitliyken işlemler fail-closed kapalıdır.

## Sınır ve gerekçe

Bu Build’de sayaç çalışma zamanı belleğindedir. Uygulama **yeniden başlatma** sonrasında sayaç korunmaz. Bunun nedeni, yerel bakım işlemi için kalıcı kimlik doğrulama hata verisi üretmeden önce davranışın güvenli ve geri döndürülebilir biçimde kanıtlanmasıdır. Kalıcı ve cihazlar arası hız sınırlama ayrı bir güvenlik kararı ve veri yaşam döngüsü değerlendirmesi gerektirir.

## Sonuçlar

- Yanlış kimlik bilgileriyle sınırsız bakım oturumu denemesi engellenir.
- Kullanıcı kalan denemeyi ve geçici bekleme süresini görebilir.
- Kimlik bilgileri ve hassas kullanıcı verileri deneme korumasına girmez.
- Uygulama yeniden başlatması kilidi sıfırladığı için bu katman tek başına hesap seviyesi çevrimiçi saldırı koruması olarak kabul edilmez.
