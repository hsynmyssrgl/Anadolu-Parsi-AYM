# Bronze RC2 Build 119 Sürüm Notları

## Sürüm

- Application Version: `25.07.2026.119`
- Package Version: `25.7.2026-119`
- Kanal: **Bronze RC2 Active Development**

## Eklenenler

- Electron session izin talepleri için varsayılan reddet politikası.
- Permission check yüzeyi için koşulsuz reddet politikası.
- Renderer kaynaklı dosya indirmelerini iptal eden session sınırı.
- Navigation ve redirect için güvenilir renderer belgesi eşleşmesi.
- Webview ekleme girişimini ve taşınan parametreleri temizleyen güvenlik sınırı.
- Tekrarlı pencere oluşturulmasında session download listener çoğalmasını önleyen koruma.
- BrowserWindow için açık `webSecurity`, insecure-content, webview ve drag-drop navigasyon ayarları.
- 33 assertion’lık çalıştırılabilir renderer session security sözleşmesi.

## Güvenlik etkisi

Renderer belgesi veya içerdiği kod izin istemeye, dosya indirmeye, başka belgeye yönlenmeye ya da webview eklemeye çalışsa bile bu girişimler merkezi Electron oturum politikasında işlenmeden reddedilir.

## Doğruluk kuralı

Bu kaynak güvenlik artırımıdır. Clean install, tam derleme, Electron production build ve Windows kapıları gerçekten çalıştırılmadan PASS raporlanmaz.
