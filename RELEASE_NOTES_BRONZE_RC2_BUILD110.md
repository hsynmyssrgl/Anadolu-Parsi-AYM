# Bronze RC2 Build 110 — Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.110`
- Package Version: `25.7.2026-110`
- Kanal: Bronze RC2 Active Development

## Değişiklikler

- Temiz `npm ci` kapısı için resmî npm registry’ye kilitli erişim politikası eklendi.
- Geçici HTTP/ağ hataları için en fazla üç denemeli kontrollü retry yürütücüsü oluşturuldu.
- Dış servis kesintisi, lockfile/politika, paket bütünlüğü, yerel izin ve sınıflandırılamayan hata ayrımı eklendi.
- Her kurulum denemesinin makine tarafından okunabilir bağımlılık erişim kanıtı üretmesi sağlandı.
- Kanıt çıktılarında kimlik bilgisi ve token maskelemesi eklendi.
- Windows RC2 workflow artifact kapsamına npm erişim raporu eklendi.

## Değişmeyen aşama

Build 110 bir Bronze RC2 aktif geliştirme artırımıdır. Final, Code Freeze, Silver veya Gold değildir.
