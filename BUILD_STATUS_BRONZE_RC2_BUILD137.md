# Bronze RC2 Build 137 Durumu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `28.07.2026.137`
- Package Version: `28.7.2026-137`
- Stage: **Bronze RC2 Active Development**
- Build: **137**

## Kapsam

Kalıcı imha tombstone kayıtlarının etkin yönetilen yedek hedeflerine yayılması;
her hedefte önce yeni parola korumalı tam yedek oluşturulup SHA-256 ile
doğrulanması, yalnız başarılı yönetilen çalışma kayıtlarına bağlı eski yedeklerin
geri alınabilir karantinaya taşınması ve bütün hedefler tamamlanmadan tombstone
bekleme işaretinin kapatılmaması.

## Hedefli doğrulama

- Build 137 yedek imha yayılımı sözleşmesi: **PASS — 78/78**
- Yönetilen yayılım ve gerçek dosya sistemi runtime senaryoları: **PASS — 37/37**
- Renderer/preload/global söz dizimi: **PASS — 3/3 dosya**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**
- Temiz `npm ci`, tam root typecheck, tüm testler, Electron production build, gerçek Windows ve installer: **NOT_RUN**

Build 137 Bronze RC2 Active Development içinde kalır; Final, Freeze, Silver veya Gold değildir.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 30/30**
- Kaynak bütünlüğü: **PASS — 1.123/1.123 kaynak dosyası; 1.124 SHA-256 girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.125 giriş / byte-identical**
- Aktif sürüm sözleşmesi: **PASS — 178 assertion / 14 workspace**
- Aktif teslim belgeleri: **PASS — 121 assertion / 5 belge**
- Teslim tasdiki sözleşmesi: **PASS — 28 kanıt dosyası / 8 kapı iddiası**
