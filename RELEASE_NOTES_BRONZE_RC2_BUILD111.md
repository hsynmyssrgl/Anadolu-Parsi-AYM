# Bronze RC2 Build 111 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.111`
- Package Version: `25.7.2026-111`
- Kanal: Bronze RC2 Active Development

## Eklenenler

- Bağımlılıktan bağımsız kaynak ön-kontrol yöneticisi
- Kaynak ön-kontrolü için makine tarafından okunabilir JSON kanıtı
- RC2 kapılarında faz ve `blockedBy` raporlaması
- CI ve Windows RC2 artifact kapsamına kaynak ön-kontrol kanıtı

## Değiştirilenler

- RC2 doğrulama sırası, dış npm erişiminden önce yerel kaynak sözleşmelerini çalıştıracak şekilde düzenlendi.
- Platforma uygun olmayan kapılar artık sonraki uygun kapıları otomatik engellemiyor.
- Aktif sürüm doğrulaması ağ kapısının arkasından alınarak kaynak ön-kontrolüne taşındı.

## Değişmeyen güvenlik durumu

Bronze RC2 Final, Code Freeze, Silver veya Gold aşamasına geçilmemiştir. Tam temiz kurulum, root type-check, production build, smoke, Windows gerçek açılış ve installer kapıları gerçekten geçmeden PASS olarak raporlanmaz.
