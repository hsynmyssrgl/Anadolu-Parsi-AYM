# Bronze RC2 Build 77 Sürüm Notları

**Sürüm:** 24.07.2026.77  
**Paket:** 24.7.2026-77  
**Aşama:** Bronze RC2 Aktif Geliştirme

## Değişiklik
Arşiv dosyası açma akışı DataStore doğrudan SQL erişiminden application/repository hattına taşındı. Yetkilendirilmiş açma planı `PrepareArchiveOpenUseCase` ile hazırlanıyor; açılma denetim kaydı `RecordArchiveOpenedUseCase` ve unit-of-work üzerinden yazılıyor. Şifre çözme, SHA-256 bütünlük kontrolü ve geçici dosya üretimi masaüstü sınırında kaldı.

Bu sürüm RC2 Final değildir ve Code Freeze başlatmaz.
