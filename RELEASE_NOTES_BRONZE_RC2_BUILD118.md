# Bronze RC2 Build 118 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.118`
- Package Version: `25.7.2026-118`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- IPC çağrılarında kayıtlı ana renderer `webContents` kimliği doğrulaması.
- Ana frame zorunluluğu ve alt frame reddi.
- Prefix tabanlı renderer URL kontrolü yerine kanonik tam belge eşleşmesi.
- Paketli `file:` renderer ve loopback geliştirme renderer politikası.
- Güvenilmeyen IPC çağrıları için yapılandırılmış güvenlik olayı kaydı.
- Yalnız kimlik bilgisi içermeyen HTTPS dış bağlantı politikası.
- 40 assertion’lık çalıştırılabilir IPC sender trust sözleşmesi.

## Güvenlik etkisi

Renderer’a beklenmeyen bir belge yüklenmesi, farklı bir BrowserWindow veya alt frame’in preload API yüzeyini kullanması hâlinde main-process IPC handler’ları çağrıyı iş mantığına ulaşmadan reddeder.

## Doğruluk kuralı

Bu kaynak güvenlik artırımıdır. Clean install, tam derleme, Electron production build ve Windows kapıları gerçekten çalıştırılmadan PASS raporlanmaz.
