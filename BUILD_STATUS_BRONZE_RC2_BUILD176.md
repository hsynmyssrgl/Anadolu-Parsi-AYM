# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 176

- Application Version: `30.07.2026.176`
- Package Version: `30.7.2026-176`
- Stage: **Bronze RC2 Active Development**
- Main topic: **Güvenlik dönemine bağlı oturumlar, kontrollü cihaz yeniden yetkilendirme ve Ed25519 imzalı güvenlik olayı makbuzu**

## Uygulanan değişiklik

Oturumlar açıldıkları hesap güvenlik dönemine bağlandı. Hesap dönemi değişmişse eski oturum korunan işleme ulaşmadan temizleniyor ve yeniden giriş zorunlu tutuluyor. Bakım kurtarması sonrasında cihaz, parola, etkin ikinci faktör, kriptografik cihaz kanıtı ve açık onay ile yeniden yetkilendiriliyor; başarılı işlem değişikliğe duyarlı Ed25519 imzalı makbuz üretiyor.

Build 175'ten kalan güvenilir cihaz INSERT yer tutucu/sütun eşleşmesi hatası da giderildi; `security_epoch` artık doğru sütuna atomik olarak yazılıyor.

## Çalıştırılan kaynak kontrolleri

- Build 176 sözleşme: **52/52 PASS**
- Build 176 izole runtime: **23/23 PASS**
- Build 176 sözdizimi/bağlantı: **14/14 PASS**
- Build 175 devamlılığı: **50/50 + 15/15 + 12/12 PASS**
- Build 174 devamlılığı: **10/10 + 6/6 PASS**
- Build 173 devamlılığı: **81/81 + 42/42 + 13/13 PASS**
- Paket kaynak TypeScript: **PASS**
- Desktop-main kontrollü TypeScript: **PASS**

## Nihai kaynak doğrulaması

- Source preflight: **144/144 PASS**
- Source integrity: **PASS**
- Validation boundary: **2 PASS / 0 FAIL / 6 NOT_RUN — INCOMPLETE**

## Aşama sınırı

Build 176 Final, Code Freeze, Silver veya Gold değildir. Temiz bağımlılık kurulumu, tam root TypeScript, bütün testler, production Electron build, smoke ve Windows installer kapıları gerçekten çalıştırılmadan PASS sayılmaz.
