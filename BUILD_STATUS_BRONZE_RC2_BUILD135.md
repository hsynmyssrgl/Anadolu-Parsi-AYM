# Bronze RC2 Build 135 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.135`
- Package Version: `28.7.2026-135`
- Stage: **Bronze RC2 Active Development**
- Build: **135**

## Kapsam

Dijital arşiv kasa anahtarının işletim sistemi korumalı sürüm 2 zarfa taşınması;
legacy açık anahtarın atomik migration ve açılış kurtarması; parola korumalı tam
yedekte taşınabilir anahtar dışa aktarımı ve geri yüklemede hedef cihaz için
yeniden sarma.

## Hedefli doğrulama

- Build 135 kasa anahtarı koruma sözleşmesi: **PASS — 52/52**
- Kasa anahtarı migration/rewrap runtime senaryoları: **PASS — 21/21**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Temiz `npm ci`, tam root typecheck, tüm testler, Electron production build, gerçek Windows DPAPI ve installer: **NOT_RUN**

Build 135 Bronze RC2 Active Development içinde kalır; Final, Freeze, Silver veya Gold değildir.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 25/25**
- Kaynak bütünlüğü: **PASS — 1.097/1.097 kaynak dosyası; 1.098 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.099 giriş / byte-identical**
- Aktif sürüm: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 23 kanıt dosyası / 8 kapı iddiası**
