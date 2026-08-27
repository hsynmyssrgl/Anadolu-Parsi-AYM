# Ana Is Listesi

Durumlar: `TAMAMLANDI`, `DEVAM`, `ACIK`, `BLOCKED`, `NOT_RUN`.

## 0. Yonetim ve temiz calisma alani

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0001 | Ticari temel klasor ve belge yapisi | Codex | TAMAMLANDI | Zorunlu dosyalar ve otomatik kapı PASS |
| IS-0002 | Mevcut calisma agaci kaydini anlamli teslimlere ayir | Codex | TAMAMLANDI | Ilgisiz degisiklik yok, diff audit PASS |
| IS-0003 | Git dal/commit/tag/yedek politikasi | Codex + Kullanici | TAMAMLANDI | GitHub ve yerel backup ayni committe |
| IS-0004 | Tarihsel belgeleri aktif taramadan ayir | Codex | TAMAMLANDI | Tek aktif belge indeksi |
| IS-0005 | Her karar icin anlik sicil otomasyonu | Codex | TAMAMLANDI | Yeni karar testsiz kaydedilemez |
| IS-0006 | Her islem oncesi zorunlu kural kontrolu | Codex | TAMAMLANDI | Kural/hash/onay/enforcement kontrolu, makine makbuzu ve otomatik giris kapilari PASS |

## 1. Marka, surum ve kullanici deneyimi

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0101 | ParsYuva Aile Yasam Merkezi marka tutarliligi | Codex | TAMAMLANDI | Pencere/installer/yardim/rapor ayni tam ad; AYM yok |
| IS-0102 | Bronze/Silver/Gold merkezi tema tokenlari | Codex | TAMAMLANDI | Token, kontrast, build ve sabit DPI ekran goruntusu matrisi PASS |
| IS-0103 | Acik beyaz zemin ve saydamlik sistemi | Codex | TAMAMLANDI | Normal cam ve opak reduced-motion/transparency Electron matrisi PASS |
| IS-0104 | Sol/alt/sag tipografi orani | Codex | TAMAMLANDI | %200 metin olceginde yatay tasma ve kesilen metin 0 |
| IS-0105 | Tum menu-islev parite taramasi | Codex | TAMAMLANDI | Yetim menu/API sayisi 0 |
| IS-0106 | Tam English uzman panel cevirisi | Codex | DEVAM | Ilk 24 uzman panel ile pano, katalog, aile, soy agaci, zaman tuneli, onemli gunler ve birlesik arama PASS; kalan ana kabuk ekranlarinda gorunur Turkce sabit metin 0 (English locale) |
| IS-0107 | Ilk tanitim ve yardim sesli anlatim | Codex | DEVAM | TR/EN metin-ses, fallback ve erisilebilirlik PASS |
| IS-0108 | Gorunur surum kanalini tek kez goster | Codex | TAMAMLANDI | Bronze/Silver/Gold, TR/EN ortak bicimlendirici ve preflight kapisi PASS |
| IS-0109 | Ozel kurulum ve olcekli ilk aile kabul yuzeyi | Codex | DEVAM | Uc bilgi karti arasinda gecisli/sahte ilerlemesiz kurulum, TR/EN ayni dil kadin ses onceligi ve erkek/kurulu ses yedegi, 900x640 tek pars/reduced-motion ile kilitli kasa ve ilk guvenlik bootstrap kapilari PASS; gercek ses insan UAT acik |

## 2. Kurulum, acilis ve yasam dongusu

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0201 | Tek gercek installer ilerlemesi | Codex | DEVAM | NSIS ve installer kapilari PASS; temiz Windows gercek-yuzde UAT acik |
| IS-0202 | Kurulum metni/DPI/ust uste binme | Codex | DEVAM | Installer derlendi; 100-200% temiz makine DPI matrisi acik |
| IS-0203 | Temiz kurulum hedefi ve kisayol | Codex | DEVAM | Tam adli paket hazir; yukseltilmis kurulum exit 2, temiz makine UAT acik |
| IS-0204 | Acilis, kilit, tepsiye kucultme, tam kapanis | Codex | DEVAM | Iki paketli acilis PASS; kurulu binary tam kapanis insan UAT acik |
| IS-0205 | Guncellemede veri koruma | Codex | ACIK | N-1 migration ve rollback PASS |
| IS-0206 | Kaldirmada yedekle/tam sil secimi | Codex | DEVAM | Gercek hedef ve receipt testleri |
| IS-0207 | Fabrika ayarina donus | Codex | DEVAM | Yeniden kimlik, inventory, silme kaniti |
| IS-0208 | Eski Windows installer artefaktlarini otomatik temizle | Codex | TAMAMLANDI | Prebuild/package temizligi, guncel-surum kapisi ve hedef test PASS |
| IS-0209 | Temiz paket, paketli runtime ve cift yedek kabul zinciri | Codex | DEVAM | Tum workspace rebuild, installer/runtime/surum/hash/imza kaniti, GitHub + harici Git commit esitligi ve D: kaynak readback PASS |
| IS-0210 | Bronze Silver Gold kardes program koku, veri ve kaynak yalitimi | Codex | DEVAM | `ParsYuva-<Kanal>` kardes program dizini, `ParsYuva/<Kanal>` AppData, EXE/kisayol/appId/uninstall/worktree ayrimi, legacy kanal dizininde fail-closed silme ve uc worktree geri-okuma PASS |
| IS-0211 | Mutasyon sonrasi exact commit kanit ve taze kurulu EXE UAT kapisi | Codex | DEVAM | Bronze 51 predecessor PASS. `77a87a87` source-integrity, `4462706a` stale installer retention ve `0854a4ec` preflight unknown-flag retleridir. Strict preflight CLI 2 dosya/12 test PASS; Bronze 52 yeni exact hedefli/tam/bütünlük, paket ve kurulu EXE UAT olmadan teslim yok |
| IS-0212 | Acik tek seferli surum tahsisi ve onceden tahsisli paket kimligi | Codex | DEVAM | Bronze 27.08.2026.52, `bronze-2026-08-27-r52` kimliğiyle tek kez tahsis edildi; allocator tekrar çalıştırılmaz. Aktif son gerçek ret `0854a4ec`, eski `.51` installer artefaktları PR-229 gereği silindi. Kurulu `.51` predecessor ve immutable provenance korunur; `.52` full exact kapılar pendingdir |
| IS-0213 | Kanonik kurulu Windows yukseltme maintenance ve on yuz UAT zinciri | Codex | DEVAM | Bronze 51 packaged runtime bundle kimliğiyle canlı predecessor PASS. İlk Unicode sınıflandırma 2 dosya/17 PASS, 1 FAIL ve fb8683dc; ASCII char düzeltmesi sonrası 2 dosya/18 test PASS. `.52` NSIS kanonik kök/EXE kimliği, N→N+1, maintenance ve UAT111 pendingdir |
| IS-0214 | Adversarial Windows package kurulum ve final teslim kanit zinciri | Codex | DEVAM | UAT110 registry snapshot Windows PowerShell 5.1 strict-mode uyumlu hale getirildi. Bronze 52 full exact kapılar, paket, yeni installer experience, UAT110/UAT111 ve final kurulu UAT NOT_RUN |
| IS-0215 | En kucuk degisiklikte tum kayit ve test kapanisi | Codex | DEVAM | Aktif son ret `0854a4ec`. Strict no-write ve strict preflight CLI odaklı 2 dosya/12 test ile 10/10 byte-exact makbuz değişmezliği PASS; yeni exact zincir ve tam UAT PASS olmadan kapanmaz, ara installer yok |
| IS-0216 | Bronze 51 rejected predecessor recovery bootstrap | Codex | DEVAM | Bronze 50 immutable REJECTED_INVALID_PACKAGE ve Bronze 51 predecessor PASS geçmişi korunur. `.51` release installer artefaktı silinmiş, kurulu predecessor ve provenance korunmuştur; Bronze 52 yeni exact kapılar, paket ve canlı UAT tamamlanmadan teslim edilmez |

## 3. Kimlik, lisans ve ticari guven

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0301 | 30 gunluk deneme modeli | Codex + Kullanici | DEVAM | Yerel 30 gun/saat geri alma PASS; geri alinamaz monoton otorite acik |
| IS-0302 | Gold aktivasyon formati | Codex + Kullanici | DEVAM | Ed25519 ve private-key ayrimi PASS; uretim trust kaydi acik |
| IS-0303 | Gold aktivasyon yonetim uygulamasi | Codex | DEVAM | Ayrik arac PASS; uretim anahtari/audit/kod imzasi acik |
| IS-0304 | Windows Hello/passkey gercek UAT | Kullanici + Codex | NOT_RUN | Desteklenen gercek cihaz kaniti |
| IS-0305 | Uretim kod imzalama | Dis + Kullanici + Codex | BLOCKED | Sertifika/provenance/Authenticode PASS |

## 4. Yerel AI, OCR ve harita

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0401 | Ollama kurulumu ve qwen3:4b | Codex | DEVAM | Loopback model health ve no-cloud testi |
| IS-0402 | AI riza ve kaynak minimizasyon E2E | Codex | DEVAM | Yetki degisiminde output atilir |
| IS-0403 | Turkiye PMTiles paketi | Codex + Dis veri | ACIK | OSM attribution, hash, offline render |
| IS-0404 | Windows Defender OCR tarayicisi | Codex | DEVAM | Gercek temiz/zararli/timeout testleri |
| IS-0405 | PDF OCR rasterizer | Codex | ACIK | Aktif icerik red + bounded page raster |
| IS-0406 | OCR low-privilege OS sandbox | Codex | ACIK | AppContainer/low integrity kaniti |
| IS-0407 | OCR run/cancel transaction topolojisi | Codex | TAMAMLANDI | Gercek SQLite DataStore akisi ve 3 dosya/27 test PASS |

## 5. Yedekleme, bulut ve veri haklari

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0501 | Yerel ve senkron klasor yedegi | Codex | DEVAM | Sifreli coklu hedef/readback PASS |
| IS-0502 | OneDrive/Graph adapteri | Codex + Kullanici + Microsoft | BLOCKED | OAuth app, min scope, upload/readback/delete |
| IS-0503 | Google Drive adapteri | Codex + Kullanici + Google | BLOCKED | OAuth verification ve E2E |
| IS-0504 | iCloud Drive Windows klasor hedefi | Codex + Kullanici | ACIK | Resmi istemci klasor tespiti/UAT |
| IS-0505 | Restore ve disaster recovery | Codex | ACIK | Bozulma, kesinti ve rollback testleri |
| IS-0506 | Yonetilen yedek silme yayilimi | Codex | ACIK | Her hedef exact kanit/pending truth |

## 6. Kalite, performans ve guvenlik

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0601 | Tam regresyonu yeni kaynakta tekrar kos | Codex | DEVAM | e0f85425 turunda hedefli 21 dosya/214 test, filtresiz 399 dosya/2.484 test ve TypeScript PASS; 10 generatedAt drifti source-integrity FAIL olmuş ve 77a87a87 ile korunmuştur. Bronze 52 yeni exact hedefli/tam tur, TypeScript, sözdizimi ve kaynak bütünlüğü zorunlu |
| IS-0602 | SBOM ve lisans kapisi | Codex | TAMAMLANDI | Belirsiz/yasak lisans 0 |
| IS-0603 | SAST/dependency/secret tarama | Codex | TAMAMLANDI | Kritik/yuksek 0 |
| IS-0604 | Performans ve buyuk aile testi | Codex | DEVAM | Buyuk aile ve fresh-profile dogruluk PASS; paketlenmis Electron bellek/CPU/startup SLA baseline acik |
| IS-0605 | Erisilebilirlik test matrisi | Codex + Kullanici | DEVAM | Otomatik matris PASS; kurulu uygulamada Narrator, Magnifier, yalniz klavye ve insan UAT acik |
| IS-0606 | Temiz Windows kurulum UAT | Codex + Kullanici | NOT_RUN | Installer/acilis/kapanis/update/uninstall |

## 7. Kurumsal ve dis yayin

| ID | Is | Sorumlu | Durum | Kabul |
|---|---|---|---|---|
| IS-0701 | Sirket/unvan/marka karari | Kullanici + Dis uzman | NOT_RUN | Resmi kayıt |
| IS-0702 | Alan adi ve web sitesi | Kullanici + Codex | ACIK | Satin alinmis alan, gizlilik/destek sayfalari |
| IS-0703 | Gizlilik ve kullanim kosullari | Codex + Hukuk | BLOCKED | Uzman onayi |
| IS-0704 | Fiyatlama, faturalama, iade ve destek | Kullanici + Dis uzman | ACIK | Ticari isletim proseduru |
| IS-0705 | Microsoft/Apple/Google gelistirici hesaplari | Kullanici + Saglayici | NOT_RUN | Kurumsal hesap ve dogrulama |
| IS-0706 | Global yayin ve dil yol haritasi | Codex + Kullanici | ACIK | English Gold + magazalar/web |

## Kapanis kurali

Bir satir yalnız kabul olcutu ve bagli kanit kaydi PASS oldugunda `TAMAMLANDI` olur. Kullanici veya dis kaynak bekleyen satirlar yerel kodlamayi durdurmaz; ilgili ticari yayin iddiasini kapali tutar.

Güncel mutasyon kapanışı: `c7a3c130`, `80cf2a39` exact Bronze tam regresyonunda 398 dosya/2.469 test PASS sonrasında `33-R` alt sürecinin migration manifesti zaman damgasına yazmasını fail-closed korur. Aktarım düzeltmesi odaklı 1 dosya/6 test ve gerçek 33-R 11/11, 8 dosya/30 test PASS; manifest SHA byte-exact değişmezdir. `IS-0211` ve `IS-0215`, yeni temiz exact commit hedefli/tam regresyonu, exact Bronze kaynak bütünlüğü ve kurulu tam UI UAT tamamlanana kadar `DEVAM` kalır.

Son exact TypeScript/source-integrity kaydı: `e0f85425` hedefli 21 dosya/214 test, filtresiz 399 dosya/2.484 test ve root TypeScript PASS sonrasında 10 izlenen makbuz yalnız `generatedAt` yazımıyla dirty olmuş; `77a87a87` gerçek ret olarak korunmuştur. Strict `--no-write` pretypecheck/prebuild aktarımı 2 dosya/12 test ve 10/10 byte-exact değişmezlik PASS'tir; yeni exact kapanış yine zorunludur.

UAT110 registry harness ve Bronze 52 geçiş kaydı: `059e3787`, `a1aec744`, `8472face`, `15e3c9d0`, `64695e58` ve `2ca29a6d` tarihsel gerçek retlerdir. `.51` packaged runtime kimliğiyle canlı predecessor kurulumu doğrulanmıştır. `d68fd2a4` test başlamadan eksik hedef dosya listesiyle duran invocation-only checkpointtir. Doğru exact hedefli turda 19 dosya/189 test PASS, fail-closed packageStatus ön eki nedeniyle 1 test FAIL olmuş ve `3976994d` ile korunmuştur. Paket durumu `BLOCKED_` semantiğine alınır. `IS-0211`–`IS-0216` ve `IS-0601`, Bronze 52 exact test/paket/N→N+1 UAT kapanana kadar `DEVAM` kalır.

Son komut ortamı kaydı: `51316ac3`, `bfb6db9f` exact Bronze kaynağında hedefli 94 dosya/598 test ve filtresiz 398 dosya/2.469 test PASS iken tam regresyon üreticisinin resmî npm girişi yerine doğrudan `node` ile çağrılmasını korur. 171 ek komuttan 34-B/C/D/F bu nedenle FAIL; kanonik npm ortamında 34-B 13/13, 5 dosya/30 test PASS olmuştur. `IS-0211` ve `IS-0215`, resmî npm tam turu ve sonraki exact kapılar tamamlanana kadar `DEVAM` kalır.

Son kaynak bütünlüğü kaydı: resmî npm `c02744cd` exact Bronze tam regresyonu 398 dosya/2.469 test ve 171/171 ek komut PASS vermiştir. Kaynak bütünlüğü 683 eksik Git-dışı manifest payloadı ve linked-worktree `.git` yönetim dosyasının yanlış kaynak sayılması nedeniyle 684 bulguyla FAIL olmuş, `7d67fcff` ile korunmuştur. Kanal payload eşitlemesi ve `.git` dışlaması 2 dosya/9 test PASS; `IS-0211`, `IS-0215` ve `IS-0601` yeni exact kapılar bitene kadar `DEVAM` kalır.

Son belge render kaydı: `96b9faac` kaynaklı ana DOCX ilk PNG renderında yanlış bundled PATH nedeniyle Poppler `pdfinfo` çözülemeyince gerçek FAIL `e5787764` ile korunmuştur. Doğru Poppler ve LibreOffice yollarıyla retry 28/28 sayfa üretmiş; bütün sayfalar temas sayfalarında, 6–7 ve 27–28 ayrıca özgün çözünürlükte görsel QA PASS vermiştir. `IS-0215`, yeni exact test/kaynak bütünlüğü ve kurulu tam UI UAT tamamlanana kadar `DEVAM` kalır.

Final belge QA kaydı: kapanış sicillerini içeren `7f866e69` kaynağından üretilen master DOCX doğru native Poppler/LibreOffice ile 29/29 sayfa PASS vermiştir. Tüm sayfalar temas sayfalarında, 6–7 ve 26–29 ayrıca özgün çözünürlükte incelenmiştir. Exact test/kaynak bütünlüğü ve kurulu tam UI UAT beklediği için `IS-0215` `DEVAM` kalır.

Son governed preflight kaydı: `607a9a53` temizlenen installer retention ve görünür sürüm makbuzlarının yeniden üretilmeden çağrılmasını; `8b2b5ccc` ise tamamlanmış çalışma adımlarına ait 1.428 kanıt yolundan 803 Git-dışı checkpoint payload dosyasının exact Bronze kanalında eksik olmasını korur. Ana kaynak 1.428/1.428 tamdır. Kanal kurulumu artık tamamlanmış `localEvidence` ve persistent receipt yollarını tracked/manifest dışlamalı SHA-256 ve atomik readback ile Bronze/Silver/Gold'a eşitler. `IS-0211`, `IS-0215` ve `IS-0601` yeni exact kapılar bitene kadar `DEVAM` kalır.

Checkpoint payload düzeltmesi sonrası belge QA kaydı: `65ffd15d` kaynaklı güncel master DOCX doğru native LibreOffice/Poppler ile 29/29 sayfa üretmiş; her sayfa özgün çözünürlükte tek tek incelenerek taşma, örtüşme, kesilme, font ve bozuk karakter kusuru olmadan PASS vermiştir. `IS-0215`, kanal eşitliği, yeni exact kapılar ve kurulu tam UI UAT tamamlanana kadar `DEVAM` kalır.

Aktif yaşam döngüsü/teslim kapanışı kaydı: `0f0a4653` exact Bronze etki analizi 95 hedefli test dosyası hesapladı; hedefli turda 600 test PASS iken PR-240 current-mutation `preflightStatus` alanındaki tarihsel FAIL metni `operation-rule-check-policy.test.ts` tarafından reddedildi ve `50f4d9e5` ile korundu. Alan `NOT_RUN_CURRENT_MUTATION` olarak düzeltilir; tarihsel retler QA kayıtlarında kalır. Bronze/Silver/Gold checkpoint yolları her kanalda 1.428/1.428 ve eksik 0 PASS'tir. `IS-0211`, `IS-0215` ve `IS-0601` yeni exact kapılar bitene kadar `DEVAM` kalır.

Final sertifika/hash kaydı: `cc01412c` exact Bronze hedefli turu 95 dosya/601 test ve filtresiz tam turu 399 dosya/2.472 test PASS verdi. Preflight sertifika commit'inin değiştirdiği sekiz izlenen indeks/kanıt dosyasının hash'leri kaynak manifestinde eski kaldığı için kaynak bütünlüğü FAIL oldu ve `6a0840d4` ile korundu. `IS-0211`, `IS-0215` ve `IS-0601`; manifest/SHA yenilenip yeni exact kaynak bütünlüğü, read-only pre/postflight ve kurulu UI UAT bitene kadar `DEVAM` kalır.

Dış kaynak koruma final makbuzu kaydı: `96377fb9` exact hedefli/tam test, kaynak bütünlüğü, governed pre/postflight ve ana/kanal eşitliği PASS sonrasında paket kapısı dış USB `PASS` durumlu `LATEST` ile ilk yerel `PENDING` değişmez makbuzun byte farkını reddetti; gerçek sonuç `b87ebe2e` ile korundu ve installer üretilmedi. İlk kayıt ezilmeden dış receipt SHA-256 kimliğine bağlı ikinci değişmez final kayıt ve sidecar yerelde/D: geri okumalı saklanır. `IS-0211`, `IS-0215` ve `IS-0601` yeni exact bütün kapılar, paket ve kurulu tam UI UAT bitene kadar `DEVAM` kalır.

Kaynak koruma düzeltmesi belge QA kaydı: `a7b0f3c3` aşamasındaki master DOCX 29/29 sayfa PASS; 2–29 önceki onaylı renderla byte-exact aynı, yalnız HEAD satırı değişen 1. sayfa özgün çözünürlükte kusursuzdur. Bu belge PASS'i yeni exact test/yedek/paket/kurulu UAT zorunluluğunu kaldırmaz.

Kanal eşitleme çağrı kaydı: `1745095c` sonrası var olan kanallar fast-forward edilmeden eşitleyici doğrulaması commit farkını yazım yapmadan reddetti ve `d5540157` ile korundu. Doğru sıra Bronze/Silver/Gold dallarını yalnız `--ff-only` ilerletmek, sonra payload hydrate ve exact readback yapmaktır. `IS-0211`, `IS-0215` ve `IS-0601` yeni exact kapılar bitene kadar `DEVAM` kalır.

Kanal-portatif npm CLI kaydı: `5179a170` exact hedefli 95 dosya/601 test ve filtresiz 399 dosya/2.472 test PASS iken 34-B/C/D/F ek runtime'ları Bronze kanalında bulunmayan geçici npm CLI yoluna düştüğü için tur FAIL olmuş ve `f8946730` ile korunmuştur; tanı `1cb33525`tir. 34-B–34-F aktif Node npm CLI fallback'iyle düzeltildi; odaklı 1 dosya/6 test ve gerçek no-write runtime sonuçları 13/13, 14/14, 14/14, 15/15, 15/15 PASS. `IS-0211`, `IS-0215` ve `IS-0601` yeni exact kapanış bitene kadar `DEVAM` kalır.

Son belge QA araç zinciri kaydı: eksik LibreOffice PATH'i `c5879c9a`, eksik Poppler `pdfinfo` PATH'i `194a8281`, temas sayfası yardımcı komutu sözdizimi hatası `62d0b1d8` ile korunmuştur. Doğru mutlak araç yollarıyla 29/29 sayfa PASS; 6–8 ve 27–29 özgün çözünürlükte kusursuzdur. `IS-0211`, `IS-0215` ve `IS-0601` yeni exact kapanış bitene kadar `DEVAM` kalır.

Preflight/paket fingerprint kapsam kaydı: `af2d15fa` erken kesilen canlı paket doğrulamasını, `151384be` ise 2.795 çalışma ağacı / 2.793 Git kapsam farkını korur. Fark yalnız ignored `scripts/__pycache__/*.pyc` dosyalarıdır; fingerprint taraması `__pycache__` dizinlerini dışlayarak Git otoritesiyle eşitlenmiştir ve odaklı 1 dosya/6 test PASS'tir. `IS-0211`, `IS-0214`, `IS-0215` ve `IS-0601` yeni exact zincir tamamlanana kadar `DEVAM` kalır.

Fingerprint düzeltmesi belge QA kaydı: ilk temas yardımcısı Font overload hatası `3bc57c12` ile korunmuş; açık tipli retry 29/29 sayfa temaslarda ve 7–8/27–29 özgün çözünürlükte PASS vermiştir. Yeni exact kapanış yükümlülükleri sürer.

Final kanal doğrulayıcı çağrı kaydı: zorunlu `--kind` olmadan yapılan ilk ek çağrı `2ab9cddf` ile korunmuş; doğru `--kind build` retry ana ve üç kanalın exact commit/dal/ortak Git deposu/temiz ağaç eşitliğini PASS vermiştir. `IS-0211`, `IS-0214`, `IS-0215` ve `IS-0601` yeni exact kapanış bitene kadar `DEVAM` kalır.

ADR kaynak bütünlüğü kaydı: V5 30 sayfa ilk çoklu önizleme raporundaki sayfa 12/14 kırpılma yorumu `d1e0b803` ile tarihsel yanlış pozitif olarak korunmuş; ayrı tam sayfa/piksel doğrulaması 30/30 görsel PASS vermiştir. Ana karar sicilinin bağlayıcı saydığı halde kaynakta bulunmayan ADR-067 gerçek FAIL'i `f1590772` ile korunmuştur. ADR-067 DEC-084/Migrasyon 38 gerçeğinden geri kurulur; kesintisiz ADR numarası ve ana sicil referans eşliği kural kapısına alınır. `IS-0211`, `IS-0215`, `IS-0216` ve `IS-0601` yeni exact test, indeks, manifest, paket ve kurulu UAT bitene kadar `DEVAM` kalır.

V5 PDF okunabilirlik kaydı: 26 sayfanın 1–3 ve 6–26 aralığı görsel PASS, 4/5. sayfalarda Yerel makine durumlarının token ortasında bölünmesi gerçek FAIL'dir ve `6d94ab9e` ile korunmuştur. Görünür durumlar kanonik değeri değiştirmeden alt çizgi yerine boşluklarla sarılır. `IS-0211`, `IS-0215`, `IS-0216` ve `IS-0601`; yeni DOCX/PDF tam görsel QA, exact kapılar, paket ve kurulu UAT tamamlanana kadar `DEVAM` kalır.

Final V5 belge QA kaydı: görünür durum düzeltmesi sonrası DOCX 30/30 ve PDF 26/26, toplam 56/56 özgün çözünürlük sayfa PASS'tir. ADR-067 iki formatta doğru sırada/exact yolla görünür; önceki token-ortası bölünmeler ve hiçbir taşma, örtüşme, kırpılma, font/glyph, tablo, footer veya sayfa numarası kusuru tekrarlanmamıştır. `IS-0211`, `IS-0215`, `IS-0216` ve `IS-0601` exact ürün ve kurulu UAT kapanışına kadar `DEVAM` kalır.

Final-freeze çağrı kaydı: ilk `render_docx.py` çağrısı desteklenmeyen iki seçenek nedeniyle render başlamadan durmuş ve `764e856b` ile korunmuştur. PATH tabanlı doğru retry DOCX 30 ve PDF 26 sayfayı eksiksiz üretmiştir. Çağrı reddi ürün/belge kusuru değildir; exact test, bütünlük, yedek, paket ve kurulu UAT bekleyen işlerin durumunu değiştirmez.

Final-freeze2 görsel kaydı: DOCX 2/7 ve PDF çift sayfa footer kırpması tam sayfa readback ile önizleme yanlış pozitifi çıkmıştır. PDF 9 karar dizinindeki exact dosya yolunun karakter ortasından sarılması gerçek FAIL'dir ve `17ad92d0` ile korunur. Exact yol metni değişmeden ayraç sonrası görünmez kırma noktaları uygulanır; tam belge QA ile exact ürün/UAT kapanışı yeniden kanıtlanır.

Final-freeze3 yol kaydı: U+200B görünmez noktaları ReportLab'in uzun sözcük bölmesini durdurmamış; PDF karar/ADR yollarındaki ayraç dışı token bölünmesi `a0d9df42` ile korunmuştur. Yol üreticisi artık exact metni yalnız `/`, `-`, `_` sonrası en çok 48 karakterlik deterministik satırlara ayırır. Tam belge QA, exact ürün ve kurulu UAT kapıları yeniden çalıştırılır.

Assessment commit kimliği kaydı: `0099e39e` yanlış ana kaynak kökü çağrısını fail-closed korur. Exact Bronze retry 109 yol/21 hedef test ve analysis 109 yol PASS üretmiştir. Assessment `sourceCommit` canlı provenance HEAD, `baselineCommit` doğrulanmış harici baseline pointer HEAD ile exact eşleşmeden yedi tüketici ilerlemez. Odaklı 2 dosya/8 test PASS; `IS-0211`, `IS-0215`, `IS-0216` ve `IS-0601` yeni exact test/bütünlük, paket ve kurulu UAT bitene kadar `DEVAM` kalır.

Final-freeze4 belge QA kapanışı: deterministik ayraç satırları sonrası DOCX 30/30 ve PDF 27/27, toplam 57/57 tam tek-sayfa özgün çözünürlük PASS'tir. Yollar yalnız güvenli ayraçlarda sarılır; ADR-067 sıra/exact yol, tablo, header/footer, marj ve sayfa numaraları eksiksizdir. Exact ürün, paket ve kurulu UAT kapıları tamamlanana kadar ilgili işler `DEVAM` kalır.

Final-freeze6 P2 belge QA kapanışı: önceki onayla byte-exact aynı 25 sayfa korunmuş; değişen DOCX 1 ve 9-19 ile PDF 1 ve 9-27 sayfaları üç bağımsız denetimde 32/32 PASS bulunmuştur. Toplam 57/57 sayfada görsel bütünlük ve güvenli yol sarımı PASS'tir; exact ürün, paket ve kurulu UAT kapıları ayrıca zorunludur.

Bronze 52 güncel master belge QA kapanışı: DOCX 30/30 ve PDF 28/28, toplam 58/58 sayfa özgün çözünürlükte incelenmiş ve PASS vermiştir. Taşma, örtüşme, kırpılma, token-ortası sarım, font/glyph, tablo, header/footer, marj veya sayfa numarası kusuru yoktur; exact ürün, paket ve kurulu UAT kapıları ayrıca zorunludur.

PPK-015 current-ratchet kaydı: `f4f84896` hedefli 19 dosya/191 test PASS ve filtresiz 399 dosya/2.483 test PASS iken stale kaynak özeti FAIL `8ea2dfe1` ile; ilk exact `migration 117` tarihsel ayırıcı contract FAIL'i `24e6bd71` ile korunmuştur. Ayırıcı düzeltmesi sonrası contract 43/43, runtime 10/10, iki odaklı test dosyası 23/23 ve ticari temel 1.254 kontrol PASS'tir. Canlı sınır ve ağ yetkisi değişmemiştir; yeni exact ürün zinciri zorunludur.

PPK-015 kayıtlarıyla yeniden üretilen güncel master DOCX 31/31 ve PDF 28/28, toplam 59/59 sayfada görsel QA PASS'tir. Taşma, örtüşme, kırpılma, token-ortası sarım, font/glyph, tablo, header/footer, marj veya sayfa numarası kusuru yoktur; exact ürün, paket ve kurulu UAT kapıları ayrıca zorunludur.

PR-229 ve preflight strict CLI kaydı: Eski `.51` release EXE/blockmap kalıntısı `4462706a`, yanlış `--no-write` bayrağının writer moda sessiz düşmesi `0854a4ec` ile korunmuştur. Eski installer çıktıları silinmiş, kurulu `.51` predecessor ve immutable provenance korunmuştur. Governed preflight yalnız argümansız writer veya exact `--read-only` kabul eder; negatif CLI ve odaklı 2 dosya/12 test PASS'tir. `IS-0211`, `IS-0212`, `IS-0215`, `IS-0216` ve `IS-0601` yeni exact kapanışa kadar `DEVAM` kalır.
