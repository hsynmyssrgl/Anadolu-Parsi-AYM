# Build 122 Teslim Doğrulama Raporu

- Product: Panthera pardus tulliana Aile
- Application Version: `26.07.2026.122`
- Package Version: `26.7.2026-122`
- Stage: **Bronze RC2 Active Development**

## Çalıştırılan kapılar

- Clean `npm ci`: **PASS — 312 paket**
- Tam root `tsc --noEmit` (temiz kaynak): **PASS**
- Unit/integration tests (temiz kaynak): **PASS — 8/8 dosya, 57/57 test**
- Electron production build (temiz kaynak): **PASS**
- Bronze smoke zinciri (temiz kaynak): **PASS**
- Production dependency audit: **PASS — 0 bulgu**
- Build toolchain audit: **PASS — 0 bulgu**
- NSIS-only build toolchain sözleşmesi: **PASS**
- Windows installer üretimi: **PASS**
- NSIS Türkçe lisans kodlama sözleşmesi: **PASS**
- Sandbox’lı development launch: **FAIL**
- Sandbox’lı packaged launch: **FAIL**
- Minimal Electron sandbox tanısı: **BLOCKED_ENVIRONMENT**
- `--no-sandbox` development/packaged tanısı: **DIAGNOSTIC_PASS**
- Tanısal geçici kurulum + kurulu uygulama açılışı + kaldırma:
  **DIAGNOSTIC_PASS — 5/5 adım**
- Resmî sandbox’lı yaşam döngüsü: **FAIL — development launch ortam engeli**
- Authenticode: **NotSigned**
- Normal Windows Final doğrulama başlatıcısı: **PASS — kaynak ve mimari kontrol**

## Yorum

Minimal, Panthera kodu içermeyen Electron renderer da aynı hostta
`launch-failed 49` ile başlatılamadı. Bu bulgu ürün kodu ile ortam engelini
ayırır; ancak resmî Windows launch kapısını PASS yapmaz. Normal Windows
oturumunda `npm run verify:windows-release` çalıştırılmalıdır.

Kodlama veya komut yazma gerektirmeyen
`BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd`, normal Windows bilgisayarda bütün resmî
kapıları çalıştırır ve `Bronze_Final_Windows_Kanitlari_*.zip` üretir.

Güvenliği azaltılmış ve resmî kapı sayılmayan ayrı koşuda installer üretildi,
yalnız mevcut kullanıcı için yalıtılmış dizine sessiz kuruldu, kurulu uygulama
açıldı ve sessizce kaldırıldı. Uygulama dosyası ile kullanıcı kayıt defteri
kalıntısı bırakılmadığı doğrulandı.

Yalnız gerçekten çalıştırılan kontroller PASS olarak raporlanmıştır. Bu teslim
Final değildir.
