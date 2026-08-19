# Guvenlik Mimarisi

## Tehdit sinirlari

1. Renderer guvenilmeyen giris siniridir.
2. IPC yalniz allowlist kanal ve exact sema kabul eder.
3. Main process dosya, cihaz ve yerel saglayici otoritesidir.
4. Core Service merkezi policy karari ve fence saglar.
5. Repository yalniz dogrulanmis execution context ile calisir.
6. Dis ag her host, sertifika/pin, boyut, sure ve redirect sinirinda fail-closed'dur.

## Kimlik guvenligi

- Yerel parola guclu hash ile saklanir.
- MFA ve kurtarma kodlari ilk kullanimda kurulur.
- Windows Hello/passkey private key veya biyometri byte'i uygulamaya girmez.
- Security epoch ve trusted-device durumu oturum acilmasinda kontrol edilir.
- Kayip cihaz islemi yerel guven sinirinda iptal/epoch artisi yapar; uzaktan basari iddiasi yapmaz.

## Kripto

- Gizli anahtarlar renderer'a, loga ve veritabanina duz metin verilmez.
- Sifreli artifactlar AES-256-GCM benzeri authenticated encryption ve baglayici metadata kullanir.
- Imza algoritmalari exact allowlist ve guclu parametre kontrolu tasir.
- RSA exponent, COSE/JWK algoritma ve issuer/audience baglari acik dogrulanir.
- Anahtar rotasyonu onceki veri okuma ve yeni veri yazma politikasiyla tasarlanir.

## Yerel saglayicilar

- Ollama yalniz `127.0.0.1:11434` sabit loopback adresinden kullanilir.
- OCR Windows child process icinde bounded calisir; ag/bulut false kalir.
- Windows Defender malware taramasi gercek temiz sonuc vermeden OCR/dosya kabul edilmez.
- Harita yalniz sabit uygulama protokolunden yerel PMTiles okur.

## Uretim guvenlik aciklari

| Alan | Durum | Yayin etkisi |
|---|---|---|
| Uretim kod imzalama | EXTERNAL_SIGNING_PENDING | Gold yayinini bloklar |
| Gercek cihaz UAT | NOT_RUN | Ilgili cihaz destegi iddiasini bloklar |
| OCR low-privilege sandbox | NOT_VERIFIED | OCR izolasyon iddiasini bloklar |
| OCR PDF rasterizer | NOT_CONFIGURED | PDF OCR'i bloklar |
| Bulut OAuth adapterleri | NOT_IMPLEMENTED | Gercek bulut yedegini bloklar |
| Hukuk/gizlilik incelemesi | NOT_RUN | Ticari yayini bloklar |

## Olay yonetimi

- Guvenlik olaylari iceriksiz audit ve tanilama kodu uretir.
- Hassas payload, parola, token, path, PAN ve ham belge loglanmaz.
- Kritik olayda oturum kilitleme, yetki iptali ve yerel quarantine uygulanabilir.
- Dis bildirim veya uzaktan containment yalniz gercek adapter kanitiyla sunulur.

