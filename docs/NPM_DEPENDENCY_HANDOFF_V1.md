# NPM Dependency Handoff V1

## Amaç

Build 154, çevrimdışı geliştirme makinesi ile internet bağlantılı edinme makinesi
arasında taşınan npm bağımlılık talebi ve yanıtının aynı işlem zincirine ait
olduğunu kanıtlar.

## Talep kimliği

Talep kimliği; ürün adı, paket sürümü, aktif `package-lock.json` SHA-256 değeri,
temel edinme planı SHA-256 değeri, resmi npm edinme politikası SHA-256 değeri ve
gerekli tarball sayısından deterministik olarak türetilen 64 haneli SHA-256
değeridir.

Talep ZIP'i şu içerikleri taşır:

- aktif lockfile,
- 117 tarballı edinme planı,
- yalnız `https://registry.npmjs.org/` kaynağına izin veren politika,
- Node yerleşik modülleriyle çalışan minimal edinme runtime'ı,
- Linux/macOS Bash ve Windows PowerShell yardımcıları,
- her payload için boyut ve SHA-256 envanteri.

## Yanıt bağlaması

Bağlantılı makinede üretilen cache transfer manifesti talep kimliğini
`handoffRequestId` alanında taşır. Çevrimdışı makinede yanıt;

1. talep ZIP'i ve checksum,
2. aktif paket sürümü ve lockfile,
3. yanıt ZIP'i ve checksum,
4. yanıt manifestindeki talep kimliği,
5. 117 tarballın lockfile SHA-512 bütünlüğü

üzerinden yeniden doğrulanır.

Kimlik uyuşmazlığında paket içe aktarılmaz; kabul sınırı fail-closed çalışır ve
paket gerekçeli red makbuzuyla karantinaya alınır. Geçerli kabulde talep kimliği
kabul makbuzuna ve `current-accepted.json` pointerına yazılır.

## Durum modeli

- `WAITING / BOUND_RESPONSE_NOT_PRESENT`: talep doğrulanmış, bağlı yanıt henüz yok.
- `READY / BOUND_RESPONSE_VERIFIED`: yanıt talep kimliği ve lockfile ile uyumlu.
- `REJECTED / BOUND_RESPONSE_REJECTED`: checksum, arşiv, sürüm, lockfile veya
  talep kimliği uyuşmuyor.

Bu model geniş RC2 kapılarının sonucu değildir. Yanıt `READY` olmadan clean
`npm ci`, tam TypeScript, bütün testler, production build ve smoke zinciri
başlatılmaz.
