# Teknik Yığın ve Mimari Kararı — Build 185

**Aktif sürüm:** 02.08.2026.228

## Masaüstü çalışma zamanı

- Electron `43.2.0`
- React `19.2.7`
- Vite `8.1.5`
- TypeScript `7.0.2`
- Node.js `24.18 LTS` hedefi
- Vitest `4.1.10`
- Windows NSIS installer

Sürümler lockfile, aktif sürüm sözleşmesi ve güvenli araç zinciri kontrolleriyle
sabitlenir. Kullanılmayan Squirrel.Windows zinciri fail-closed uyumluluk paketiyle
devre dışıdır.

## Mimari

- Modüler monolit
- Alan odaklı workspace paketleri
- `UI → Application → Domain → Infrastructure` bağımlılık yönü
- Port/adapter yaklaşımı
- Somut repository oluşturma yalnız composition root içinde
- Application/renderer katmanında ham SQL veya native SQLite yürütme yok
- Provider bağımsız AI, harita, bildirim, depolama ve bulut yedek adapterleri

## Veri ve dosya depolama

- Birincil veri deposu: SQLite
- Şema: sürümlü migration zinciri
- Büyük dosya: içerik-adresli şifreli kasa
- Metadata: kimlik, hash, sürüm, sahiplik, görünürlük ve saklama kuralı
- Denetim: append-only/hash zinciri
- Arama: nesne ve izin filtreli indeks

## Platform stratejisi

- Windows masaüstü ilk platform
- macOS için taşınabilir Electron/alan modeli
- iPhone, iPad, Watch ve Vision Pro için gelecekte companion istemciler
- Saf TypeScript domain ve application sözleşmeleri platformlar arasında paylaşılabilir
- Yeni cihazda yedekten dönüş otomatik cihaz güveni vermez

## Electron güvenlik sınırı

Renderer sandbox, context isolation ve kapalı Node erişimi kullanır. IPC yalnız
kayıtlı ana renderer, ana frame, tam güvenilir belge ve merkezi payload bütçesiyle
çalışır. Permission, download, navigation, redirect ve webview varsayılan reddedilir.
`app.enableSandbox()` global olarak uygulanır; BrowserWindow tercihleri tek güvenli
fabrikadan üretilir. Veri deposu açılmadan önce `safeStorage` şifreleme turu ve
kalıcı başlangıç sentinel doğrulaması çalışır. Windows gerçek açılış kanıtı aynı
kullanıcı veri diziniyle iki ayrı süreçte DPAPI kalıcılığını doğrular.

## UI teknolojisi

- React tabanlı tek masaüstü kabuğu
- Ortak yüzey/kontrol bileşenleri
- Merkezi Apple sistem font zinciri ve semantik tipografi tokenları
- Açık/koyu tema ve kullanıcı tercihi
- Klavye/ekran okuyucu/ölçeklenebilir metin uyumu

## Kaynak ve teslim modeli

- `manifest.json` ve `SHA256SUMS.txt`
- Deterministik ZIP32/STORE arşivi
- Byte-identical yeniden üretim
- Dış SHA-256 ve ayrık teslim kanıtı
- Aktif belge ve sürüm drift kontrolleri

## Katı yaşam döngüsü politikası — Build 182

`PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır: Silver veya Gold için planlanmış bütün ürün geliştirmeleri Bronze kanalında tamamlanır. Yalnız ağır haricî API üretim adaptörü; port, adaptör, yapılandırma, yerel fallback, test ikizi, tipli hata ve güvenlik/gizlilik sınırlarının tamamı Bronze kaynakta hazırsa askıya alınabilir. Silver yeni ürün geliştirmesi içermez; mevcut altyapı iyileştirmesi, hata düzeltme ve bütün testler içindir. Gold başarılı Silver sonrası üretim paketleme ve operasyon kanalıdır. Build 179 sürüm rengi ile varsayılan aile yakınlık kataloğu kararları bu politikanın değişmez parçasıdır.

## Ağır API entegrasyon hazırlığı — Build 182

`PPT-LIFECYCLE-STRICT-V1` gereği üretim API adaptörü askıya alınsa bile domain/application portu, infrastructure adaptör sınırı, config/sır kaynağı, çevrimdışı fallback, fake adaptör, tipli hata/retry ve güvenlik/gizlilik sözleşmesi Bronze’da bulunur. Sağlayıcı SDK’sı domain veya renderer’a sızamaz.

## Build 181 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1` ve DEC-071 gereği, imzalı sağlayıcı iptal listesi eşitleme durumu işletim sistemi korumalı ve yeniden başlatmaya dayanıklıdır. Bekleyen liste kaynak/TLS profil değişiminde geri çekilir; doğrulanmış liste yok, 24 saat içinde sona erecek veya süresi dolmuşsa kullanıcıya kaynak bazında görünür uyarı verilir. Bu ürün geliştirmesi Bronze içinde tamamlanır; Silver yalnız altyapı iyileştirmesi, hata düzeltmesi ve tam test kampanyasını yürütür.

## Build 182 bağlayıcı güncellemesi

`PPT-LIFECYCLE-STRICT-V1`, DEC-072 ve ADR-055 gereği yeni bir haricî kanıt sağlayıcısının kök Ed25519 anahtarı yalnız yönetici tarafından yapıştırılarak güvenilir sayılamaz. Resmî tüzel kişi kimliği ile anahtar SHA-256 parmak izi iki ayrı kurum dışı kanaldan doğrulanır; uygulamaya girilen beklenen parmak izi ayrıştırılan Ed25519 anahtarıyla birebir eşleşir. Bağımsız tanık adı/kurumu ve kontrol zamanı kaydedilir; sabit kanonik doğrulama makbuzunun SHA-256 özeti saklanır. Eski kayıtlar `legacy_unverified` olarak görünür uyarı taşır; imzalı anahtar döndürmeyle gelen ardıl anahtarlar `rotation_inherited` güven yöntemini kullanır. Ham kimlik belgesi uygulama veritabanına alınmaz.
## Build 183 teknik sınırı

Migrasyon 29, repository portları, uygulama use-case'leri, ana-süreç `AutomaticCleanBackupRewriteService`, scheduler ve IPC/renderer bağlantısı tek bağımlılık yönünde çalışır. Çalışma sahipliği veritabanında kalıcıdır; yeni yedek doğrulanmadan eski yönetilen kopya karantinaya taşınmaz.

## Build 184 teknik sınırı

Migrasyon 30 `backup_clean_rewrite_runs` defterini kurar. Repository, politika ve defter satırını aynı unit-of-work içinde sonuçlandırır; gerçek SQLite regresyonu bağlayıcı sayısı ve sütun anlamlarını doğrudan çalıştırır. Application, IPC ve renderer yalnız tipli port üzerinden son çalışma geçmişini okur.

## Build 185 teknik sınırı

Desktop main başlangıçta `nowIso()` ile duvar saatini ve `node:perf_hooks`
`performance.now()` ile monotonik başlangıcı alır. `executeManagedBackupPropagation`
`completedAt` girdisi kabul etmez; karantina ve final zamanlarını kendi kronoloji
sınırında üretir. Son final zaman `completePending` ve kalıcı çalışma kaydı arasında
paylaşılır.

## Build 186 teknik sınırı

Application servisi üst çalışma zamanını bağlı propagation `completedAt`
değerinden alır. Migrasyon 31 insert/update tetikleyicileri bağlantı ve kronoloji
sırasını SQLite sınırında doğrular.

## Build 187 teknik sınırı

Ana süreç yalnız gözlenen duvar saatini iletir. SQLite repository kalıcı çalışma
defteri başlangıcını okur, `max(observedAt, persistedStartedAt)` zamanını ve 360
dakikalık geri çekilmeyi aynı transaction içinde üretir. Migrasyon 32 durum,
sahiplik ve sonraki deneme kronolojisini insert/update tetikleyicileriyle korur.

## Build 188 teknik sınırı

`AutomaticCleanBackupRewriteService`, gözlenen saati kalıcı politika kronolojisiyle karşılaştırarak güvenli claim zamanı üretir. Repository bu zamanı ve saklama kesimini yeniden doğrular. Migrasyon 33 politika/defter zaman gerilemesini, değiştirilen başlangıç/kesim alanlarını ve ikinci `running` defter kaydını reddeder.

## Build 189 teknik sınırı

Uygulama ön kontrolü, repository atomik koşulu ve migrasyon 34 SQLite tetikleyicileri birlikte operasyonel izolasyon sağlar. Kurtarma tabanı çalışma defteri `updated_at` değerini içerir.


## Build 190 teknik sınırı

Yayılım üretmeyen temiz-yedek terminal zamanları güvenli claim duvar başlangıcına eklenen monotonik geçen süreden türetilir. Retry/erteleme aynı terminal zamana bağlıdır; geçersiz veya geriye giden monotonik saat fail-closed reddedilir. DEC-080 ve ADR-063 bağlayıcıdır.


## Build 191 teknik sınırı

Gecikme seçimi servis ve repository katmanında tipli trigger ile yapılır; SQLite migration 35 politika ve çalışma defteri retry farkını reddeder.

## Build 192 teknik sınırı

Servis otomatik etkinlik kontrolünü tetikleyiciye göre uygular. Repository claim koşulu otomatik için `enabled=1`, manuel için mevcut sahiplik ve retry koşullarını kullanır. Migrasyon 36 devre dışı politikada yalnız manuel `running` duruma izin verir.



## Build 193 teknik sınırı

Repository transaction içindeki policy update + ledger insert akışı; insert sonucu, policy–ledger ownership join ve migrasyon 37 SQLite tetikleyicileriyle doğrulanır. `PPT-LIFECYCLE-STRICT-V1` bağlayıcıdır.


## Build 195 teknik sınırı

`running` temiz-yedek politika ve defter anlık görüntüsü terminal geçişe kadar değiştirilemez; bütün değişiklikler migrasyon 39, hedefli gerçek SQLite kanıtı ve `PPT-LIFECYCLE-STRICT-V1` ile korunur.

## Build 196 teknik sınırı

SQLite migrasyon 40 aktif politika parametreleri için `BEFORE UPDATE` koruması uygular.

## Build 197 atomik terminal geçişi

DEC-087 → ADR-070 → migrasyon 41 zinciri; politika tek başına `running` durumundan çıkarılamaz ve terminal çalışma defteri politikayı aynı SQLite cümlesinde sonuçlandırır.

## Build 208 — Anayasa teknik kapıları

`config/project-constitution.json`, `config/ui-visual-reference-manifest.json` ve `config/project-progress-model.json` aktif teknik yönetişim girdileridir. Aktif sürüm taraması, provenance, kişisel kimlik, production-clean-data, belge kapanışı ve artifact index kapıları fail-closed çalışır.

## Build 210 — Terminal clean-backup ledger değişmezliği

`backup_clean_rewrite_runs` terminal kayıtları Migrasyon 49 ile SQLite düzeyinde değişmez tarihsel kanıttır. `running` dışı kayıtta gerçek veri değiştiren UPDATE ve DELETE reddedilir. Aynı terminal kimliğe `INSERT OR REPLACE` girişimi `BEFORE INSERT` korumasıyla, `recursive_triggers=0` durumundan bağımsız olarak reddedilir. Normal `running → terminal` atomik sonuçlandırma ve gerçek no-op UPDATE davranışı korunur. DEC-100, ADR-083 ve `CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1.md` bağlayıcıdır.
