# Build 132 Mimari Doğrulama Raporu

- Product: Anadolu Parsı Aile Yaşam Merkezi
- Application Version: `27.07.2026.132`
- Package Version: `27.7.2026-132`
- Stage: **Bronze RC2 Active Development**
- Build: **132**

## Sonuç

- Başlangıç güvenlik ön kontrolü sözleşmesi: **PASS — 59/59**
- OS sır koruması, sentinel ve güvensiz anahtar runtime senaryoları: **PASS — 22/22**
- İlk süreç sentinel oluşturma: **PASS**
- İkinci süreç sentinel yeniden doğrulama: **PASS**
- Bozuk sentinel fail-closed reddi: **PASS**
- `--no-sandbox` ve renderer güvenlik özelliği kapatma reddi: **PASS**
- Güvenli renderer tercih fabrikası: **PASS**
- Kontrollü package-source TypeScript: **PASS — TypeScript 5.8.3**
- Kontrollü desktop-main TypeScript: **PASS**

## Sınır

Bu rapor gerçek Windows DPAPI API’si, Electron development executable açılışı,
paketli uygulama açılışı, production build veya installer yaşam döngüsünü
kanıtlamaz. Windows sağlayıcısı ve iki süreçli açılış sözleşmesi kaynak/runtime
seviyesinde hazırlanmıştır; resmî Windows PASS gerçek Windows bilgisayarda
çalıştırılmalıdır.

## Kaynak teslim zinciri

- Kaynak preflight: **PASS — 19/19**
- Kaynak bütünlüğü: **PASS — 1.074 kaynak / 1.075 SHA girdisi**
- Deterministik tekrar üretilebilirlik: **PASS — 1.076 giriş / byte-identical**
