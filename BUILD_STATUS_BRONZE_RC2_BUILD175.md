# Anadolu Parsı Aile Yaşam Merkezi — Bronze RC2 Build 175

- Application Version: `29.07.2026.175`
- Package Version: `29.7.2026-175`
- Stage: **Bronze RC2 Active Development**
- Main topic: **Bakım kurtarması sonrası hesap güvenlik dönemi ve eski güvenilir cihaz bağlarının iptali**

## Uygulanan değişiklik

Başarılı bakım kilidi kurtarması, kullanıcı oturumu kapatılmadan önce hesap güvenlik dönemini transaction içinde bir artırır ve hesabın bütün aktif güvenilir cihaz kayıtlarını iptal eder. Giriş ve yetki görünümü bir cihazı ancak cihaz parmak izi, kriptografik kanıt, iptal durumu ve hesap güvenlik dönemi birlikte eşleşirse güvenilir kabul eder.

## Çalıştırılan kaynak kontrolleri

- Build 175 sözleşme: **50/50 PASS**
- Build 175 izole runtime: **15/15 PASS**
- Build 175 sözdizimi/kaynak varlığı: **12/12 PASS**
- Build 174 devamlılığı: **10/10 + 6/6 PASS**
- Paket kaynak TypeScript: **PASS**
- Desktop-main kontrollü TypeScript: **PASS**

## Nihai kaynak doğrulaması

- Source preflight: **141/141 PASS**
- Source integrity: **PASS**
- Validation boundary: **2 PASS / 0 FAIL / 6 NOT_RUN — INCOMPLETE**

## Aşama sınırı

Build 175 Final, Code Freeze, Silver veya Gold değildir. Temiz bağımlılık kurulumu, tam root TypeScript, bütün testler, production Electron build, smoke ve Windows installer kapıları gerçekten çalıştırılmadan PASS sayılmaz.
