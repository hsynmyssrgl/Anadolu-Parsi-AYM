# Bronze RC2 Build 109 — Platformlar Arası Doğrulama Zinciri Güçlendirmesi

- Uygulama: `25.07.2026.109`
- Paket: `25.7.2026-109`
- Kanal: Bronze RC2 Active Development

## Değişiklikler

- RC2 validation gate komutları Windows, Linux ve macOS için platform-duyarlı şekilde çözümlenir.
- Windows’ta npm komutları mevcut `npm_execpath` üzerinden Node ile; bu bilgi yoksa `cmd.exe` üzerinden güvenli yedek stratejiyle başlatılır.
- Gate raporlarına istenen ve çözümlenen komut ile çözümleme stratejisi eklenmiştir.
- Gate config doğrulaması zorunlu hâle getirilmiştir.
- SIGINT/SIGTERM kesintilerindeki çift sonuç üretme riski kapatılmıştır.
- `verify:dashboard` içindeki Unix’e özgü `rm -rf` kaldırılmıştır.
- Repository kökünü veya repository dışındaki bir yolu silemeyen platformlar arası güvenli dizin temizleyicisi eklenmiştir.
- İzole gate konfigürasyonlarıyla PASS, kesinti ve geçersiz config senaryolarını gerçek alt süreçlerle sınayan Build 109 doğrulayıcısı eklenmiştir.

Bu sürüm üretim sürümü değildir; Bronze RC2 aktif geliştirme devam etmektedir.
