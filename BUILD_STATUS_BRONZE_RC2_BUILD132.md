# Bronze RC2 Build 132 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.132`
- Package Version: `27.7.2026-132`
- Stage: **Bronze RC2 Active Development**
- Build: **132**

## Kapsam

Electron veri deposu açılmadan önce fail-closed OS sır koruması doğrulaması,
kalıcı korumalı başlangıç sentineli, global renderer sandbox zorunluluğu ve
Windows development/paketli açılışta iki süreçli DPAPI kalıcılık kanıtı.

## Hedefli doğrulama

- Build 132 başlangıç güvenlik sözleşmesi: **PASS**
- Build 132 başlangıç güvenlik runtime doğrulaması: **PASS — 22/22**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Gerçek Windows development ve paketli uygulama DPAPI açılışı: **NOT_RUN**
- Temiz `npm ci`, tam root typecheck, tüm testler, Electron production build ve Windows installer: **NOT_RUN**

Build 132 Bronze RC2 Active Development içinde kalır; Final, Freeze, Silver veya Gold değildir.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 19/19**
- Kaynak bütünlüğü: **PASS — 1.074 kaynak / 1.075 SHA girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.076 giriş / byte-identical**
- Aktif sürüm: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
