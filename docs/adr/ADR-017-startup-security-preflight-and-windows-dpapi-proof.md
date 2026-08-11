# ADR-017 — Başlangıç Güvenlik Ön Kontrolü ve Windows DPAPI Kanıtı

- Durum: Kabul edildi
- Tarih: 27.07.2026
- Build: 132
- Karar: DEC-046

## Bağlam

Build 128 ve Build 129 ile cihaz özel anahtarı, TOTP sırrı ve yönetilen yedek
parolası Electron `safeStorage` sınırına taşındı. Ancak kaynak sözleşmesi tek
başına gerçek çalışma zamanında güvenli depolamanın kullanılabildiğini, aynı
kullanıcı profiliyle ikinci süreçte tekrar açılabildiğini veya uygulamanın
sandbox’ı zayıflatan komut satırı seçenekleriyle başlamadığını kanıtlamıyordu.

Ayrıca Windows açılış testi yalnız renderer’ın yüklenmesini gözlüyor, DPAPI
korumalı değerin süreçler arası kalıcılığını sınamıyordu.

## Karar

Uygulama `app.ready` sonrasında veri deposu açılmadan önce fail-closed bir
başlangıç güvenlik ön kontrolü çalıştırır.

Ön kontrol:

1. İşletim sistemi sır korumasının kullanılabilir olduğunu doğrular.
2. Rastgele bir meydan okumayı koruyup geri açarak şifreleme turunu sınar.
3. `startup-security-sentinel.json` adlı OS korumalı kalıcı işareti ilk açılışta
   atomik olarak oluşturur.
4. Sonraki açılışta aynı işareti çözüp SHA-256 bütünlüğünü sabit zamanlı
   karşılaştırmayla doğrular.
5. `--no-sandbox`, `--single-process`, `--disable-gpu-sandbox` ve renderer
   güvenlik özelliklerini kapatan seçenekleri normal çalışmada reddeder.
6. Renderer tercihlerini tek güvenli fabrika üzerinden üretir ve `sandbox`,
   `contextIsolation`, `webSecurity` ile diğer zorunlu değerleri doğrular.
7. Sonucu atomik ve `0600` izinli `startup-security-preflight.json` kanıtına
   yazar.

Windows geliştirme ve paketli açılış kanıtı aynı geçici kullanıcı veri diziniyle
iki ayrı süreç çalıştırır. İlk süreç `created`, ikinci süreç `verified` işaretini
üretmelidir. Windows sağlayıcı kimliği `windows-dpapi`, şifreleme turu ve
sandbox politikası PASS olmadıkça resmî açılış PASS sayılamaz.

Güvenliği zayıflatan tanısal seçenekler yalnız açık test ortam değişkenleriyle
çalıştırılabilir ve sonuç `DIAGNOSTIC_PASS` olarak sınıflandırılır; promotion
kanıtı değildir.

## Sonuçlar

- Güvenli depolama geçici olarak kullanılamıyorsa uygulama veri deposunu açmaz.
- Bozuk veya farklı sağlayıcıya ait başlangıç işareti sessizce yenilenmez.
- Windows DPAPI süreçler arası kalıcılığı gerçek Windows koşusunda doğrudan
  kanıtlanabilir.
- Renderer güvenlik tercihleri farklı kod yollarında drift edemez.
- Linux veya yönetilen bu geliştirme ortamındaki hedefli test, gerçek Windows
  DPAPI PASS yerine geçmez.

## Doğrulama

- `scripts/verify-build132-startup-security-contract.mjs`
- `scripts/verify-build132-startup-security-runtime.mjs`
- `scripts/windows-real-launch-test.mjs`
- `scripts/windows-release-validation.ps1`

Gerçek Windows development açılışı, paketli uygulama açılışı ve installer yaşam
döngüsü Bronze Final öncesi ayrıca çalıştırılmalıdır.
