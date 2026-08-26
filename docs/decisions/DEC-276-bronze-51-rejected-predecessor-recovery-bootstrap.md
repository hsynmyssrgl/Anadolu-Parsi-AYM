# DEC-276 — Bronze 51 rejected predecessor recovery bootstrap

- Tarih: 2026-08-26
- Durum: ACTIVE
- Bağlayıcı kural: PR-241
- Kullanıcı yetkisi: Hatalı eski kararları düzeltme, bütün sorunları kayda alma, tam test ve temiz kurulum dosyası üretme yetkisi

## Karar

Bronze `22.08.2026.50`, paketleme öncesi sertifika fingerprint kapsamı ile exact Git kaynak kapsamının eşit olmaması nedeniyle `REJECTED_INVALID_PACKAGE` durumundadır. Bu sürümün immutable paket geçmişi ve harici append-only kaynak zinciri silinmez, yeniden yazılmaz, PASS sayılmaz ve kurulu güvenilir predecessor olarak kullanılmaz.

Bronze `26.08.2026.51`, yalnız aşağıdaki makine-okunur bağların tamamı exact olduğunda tek seferlik recovery bootstrap yolunu kullanabilir:

- release ledger içindeki Bronze 50 kaydı `REJECTED_INVALID_PACKAGE` durumundadır;
- Bronze 51 kaydı `RECOVERY_BOOTSTRAP_AFTER_REJECTED_50` kararını taşır;
- Bronze 51 `parentRelease` değeri exact `Bronze 22.08.2026.50` değeridir;
- Bronze 51 top-level current kaydı ile exact tek release entry statusu birbirine eşit ve exact `IN_PROGRESS` olmalıdır; reddedilmiş, çoğaltılmış veya yaşam döngüsü kayan current kayıt paketleme yetkisi vermez;
- kanonik Bronze program kökü, ana EXE ve uninstall kaydı kurulumdan önce yoktur;
- Bronze 50 installer veya kurulu runtime girdisi trusted UAT/paketleme otoritesi olarak verilmez; immutable Bronze 50 provenance bundle yalnız `REJECTED_PARENT_HISTORY_ANCHOR_ONLY` lineage kanıtı olarak zorunludur.
- immutable package-provenance transaction yayımlanmadan hemen önce parent Bronze 50 bundle kanonik path, size, SHA-256, rejected-parent kimliği ve iç archived receipt bağıyla canlı yeniden okunur.

Bu koşullarda Bronze 51 önce `RECOVERY_BOOTSTRAP_FRESH_INSTALL_SEQUENCE_51`, ardından ayrı same-version maintenance veri koruma fazını çalıştırır. Fresh-install sonucu, bakım öncesi veri ve kimlik durumu ile bakım sonrası readback birbirine bağlanır. Sequence 50 bootstrap semantiği ile sequence 52 ve sonrası exact N→N+1 continuation semantiği değişmez.

## Sınırlar

Bu karar waiver değildir. Exact commit etki analizi, hedefli test, filtresiz tam regresyon, TypeScript, sözdizimi, kaynak bütünlüğü, governed preflight/postflight, ana/kanal commit eşitliği, kaynak koruma, installer-experience, UAT110, UAT111, sesli anlatım ve final teslim geri-okuma kapılarının tümü zorunludur. Eski `.50` installer artefaktı teslim edilemez; `.51` paketi yalnız bütün kapılar aynı temiz committe PASS olduğunda üretilebilir.

## Kayıt ve iş etkisi

- `PR-241` yalnız Bronze 51 recovery bootstrap istisnasını fail-closed uygular.
- `IS-0216` recovery bootstrap kod, kayıt, paket, kurulum ve tam kurulu uygulama UAT kapanışını izler.
- `1490bb9f`, preflight sertifikası ile exact Git kaynak kapsamı arasındaki tek artık tracked Python bytecode farkını gerçek `wip(rejected)` checkpoint olarak korur.
- Bronze 50 paket bundle'ı ve dış append-only tarihsel zinciri değiştirilmez; release ledger önceki `IN_PROGRESS` durumunu rejection alt kaydında koruyarak `REJECTED_INVALID_PACKAGE` etkili durumuna geçer.
- Bronze 51 exact kanıtları tamamlanana kadar paket ve kurulu uygulama teslimi `NOT_RUN`/`IN_PROGRESS` kalır.

## İlk odaklı doğrulama kaydı

`4ec0820d`, güncel V29 governed-preflight üretilmeden test önkoşulunun fail-closed durmasını; `de8776f1`, iş sicili 61'e çıktığı halde ticari temel doğrulayıcısının sabit 60 beklemesini; `6a401791`, test alt sürecine `PPT_WORK_STEP` aktarılmamasını; `cb7e8749` ise recovery negatif testinde güvenli reddin beklenenden daha genel mesaj üretmesini korur. V29 preflight düzeltmeden sonra PASS'tir. İlk gerçek odaklı tur 5 dosyada 65 testten 64 PASS vermiş; tek negatif assertion kabul davranışını gevşetmeden düzeltilmiştir. Retry ve exact tam zincir beklenmektedir.

## Güncel kod audit kapanışı

`cb7e8749` önceki rejected checkpoint olarak kalır; silinmez ve PASS sayılmaz. İlk 64/65 sonucu ile düzeltme sonrasındaki önceki 5 dosya/65 test ve 9 dosya/82 test ara doğrulama geçmişi de korunur. Bugünkü recovery kod auditinde sequence 52+ continuation'ın varsayımsal bir `fileVersion` alanına güvenmesi, mode union dallarında `false`/`null` ayrımının gevşek kalması, installer başlamadan önce installer ve packaged runtime `FileVersion` değerlerinin exact `packageVersion` ve görünür `Bronze DD.MM.YYYY.sequence` kimliğine bağlanmaması, alias kabul eden fixture yüzeyi, Bronze 51 `IN_PROGRESS` yaşam döngüsünün fail-closed sınırının eksikliği ve immutable parent bundle transaction'ından önce canlı path/size/SHA/identity geri-okumasının eksikliği kapatılmıştır. Yeni PR-241 hash ve operation-check zinciriyle en güncel odaklı doğrulama 7 dosya/84 test PASS'tir. Bu sonuç exact filtresiz tam regresyon, build, gerçek kurulum ve UAT110/UAT111/final kurulu uygulama UAT kapılarının yerine geçmez; bunların tamamı pendingdir.

## Son gerçek çağrı ret kaydı

Audit kapanışından sonraki hızlı PowerShell yardımcı taraması, `ConvertFrom-Json` boş anahtar sınırlaması ve karar değişiminden sonra zorunlu kural kontrolü yenilenmeden başlatılması nedeniyle fail-closed durmuştur. `4c83cee8` bu gerçek çağrı hatasını son rejected checkpoint olarak korur; önceki `cb7e8749` ve bütün ara odaklı geçmiş değişmeden kalır. Hata ürün JSON kusuru değildir ve PASS değildir. Exact full regresyon, build, kurulum, UAT110, UAT111 ve final kurulu uygulama UAT'i pendingdir.

İlk master belge üretim çağrısı PATH'te düz `python` komutu bulunmadığı için içerik üretimine başlamadan fail-closed durmuş ve `aae819cc` ile kaydedilmiştir. `aae819cc` güncel `latestRejectedCheckpoint`, `4c83cee8` ise önceki gerçek çağrı reddidir; ikisi de ürün veya belge içerik kusuru ve PASS değildir. Doğrulanmış bundled Python retry üretimi tamamlanmış, master DOCX 29/29 sayfada temas ve özgün çözünürlük görsel QA PASS vermiştir. Full exact test, kaynak bütünlüğü, build, kurulum, UAT110, UAT111 ve final kurulu uygulama UAT'i pending kalır.

Final render sırasında eski document-skill script yolu `ac2c02c1`, eski LibreOffice çalıştırılabilir çözümlemesi `5c07258c` ile ayrı gerçek araç çağrısı retleri olarak korunmuştur. Güncel `latestRejectedCheckpoint` `5c07258c` olur; bunlar ürün ya da belge içerik kusuru ve PASS değildir. Güncel script, doğrulanmış sistem LibreOffice ve bundled Poppler retry ile master DOCX'i 29/29 sayfada görsel QA PASS üretmiştir. Full exact test, kaynak bütünlüğü, build, kurulum, UAT110, UAT111 ve final kurulu uygulama UAT'i pending kalır.

29/29 görsel PASS sonrasında V5 makine doğrulayıcısının eski sabit 24.08 sürüm markerı güncel belgeyi reddetmiş ve `b0615638` ile korunmuştur. Güncel `latestRejectedCheckpoint` budur; sonuç belge içerik kusuru veya PASS değildir. Active document set ve doğrulayıcı 26.08.2026 kanonik sürüm/asOf bağına düzeltilmiştir. Makine retry, full exact test, kaynak bütünlüğü, build, kurulum, UAT110, UAT111 ve final kurulu uygulama UAT'i pending kalır.

Düzeltme sonrası makine retry 241 kural/185 karar/106 ADR/13 DOCX tablo/26 PDF sayfa ve governance 1/1 PASS vermiştir. Son DOCX 29/29 görsel QA PASS; 2–7 önceki onaylı renderla SHA-256 özdeş, değişen 1 ve 8–29 özgün çözünürlükte tek tek kusursuzdur. `b0615638` tarihsel ret olarak kalır. Full exact test, kaynak bütünlüğü, build, kurulum, UAT110, UAT111 ve final kurulu uygulama UAT'i pending kalır.

`b0615638` sonrasındaki taze odaklı matris master yönetişim sözleşmesi dahil 8 dosya/85 test; ticari temel doğrulaması 1.254 kontrol/87 dosya/61 iş/241 kural PASS vermiştir. Önceki bölümlerdeki “son” veya “güncel” nitelemeleri yalnız o tarihsel aşamayı anlatır; aktif son rejected checkpoint `b0615638` olur. Exact hedefli/tam regresyon, kaynak bütünlüğü, build, recovery fresh-install, same-version maintenance, installer experience, UAT110, UAT111 ve final kurulu tam UI UAT tamamlanmadan paket teslim edilmez.

Manifest üreticisinin desteklemediği `--help` kipinde dosyaları yazması, çağrı öncesinde ayrı mutation kural kontrolü bulunmadığından fail-closed süreç reddi olarak `3eec5426` ile korunur ve aktif son rejected checkpoint olur. Olay Bronze 51 ürün kusuru veya PASS değildir; exact test, build ya da paket yetkisi vermez. Manifest kapanışta ayrı kural kontrolünden sonra yeniden üretilecektir.

Master makine doğrulaması PASS sonrasında Vitest 4.1.10'un desteklemediği `--minWorkers` seçeneği nedeniyle governance testi başlamadan durmuş ve `86602f7a` ile o aşamadaki son rejected checkpoint olarak korunmuştur. Olay Bronze 51 veya master belge kusuru ve PASS değildir. Test desteklenen seçeneklerle yeniden çalıştırılır; exact ürün kapıları değişmeden zorunludur.

Sonraki exact Bronze etki değerlendirmesi `tools/windows-packager/package-lock.json` yolunu fail-closed bağımlılık sicilinde eşlenmemiş bulmuş ve `3e496f47` ile aktif son rejected checkpoint olarak korumuştur. Kök neden paketleyici aracının `tools/` ağacının genel güvenlik ağı dışında kalmasıdır. Güvenlik ağı `tools/` ile genişletilir; izole Windows paketleyici manifesti ve lockfile'ı sürüm, supply-chain ve paket provenance hedefli testlerine ayrıca bağlanır. Olay Bronze 51 çalışma zamanı kusuru veya PASS değildir; yeni exact etki/hedefli/tam/bütünlük zinciri tamamlanmadan paket yoktur.

Windows paketleyici etki haritasının odaklı sözleşme testinde davranış doğru olmasına rağmen `ruleIds` assertionı kanonik alfabetik sıranın tersini beklemiş ve 13/14 sonucu `398de9c8` ile reddedilmiştir. Aktif son rejected checkpoint budur; assertion kanonik sıraya düzeltilip taze PASS alınır. Olay Bronze 51 çalışma zamanı kusuru veya PASS değildir ve paket yetkisi vermez.

Assertionın kanonik sıra düzeltmesi sonrasında odaklı retry 3 dosyada 14/14 test PASS vermiştir. `398de9c8` o aşamadaki son, bugün tarihsel rejected checkpoint olarak korunur; exact kanıt, paket ve kurulu uygulama UAT zinciri hâlâ zorunludur.

Aktif V5 görsel QA çağrısındaki desteklenmeyen render yolu argümanları `75e4072c`, yanlış Poppler PATH retryı `0f98c7cc` ile gerçek araç retleri olarak korunur; `0f98c7cc` o aşamadaki son, bugün tarihsel checkpointtir. Doğrulanmış native Poppler ve sistem LibreOffice ile güncel V5 DOCX 29/29 sayfa yeniden üretilmiş ve bütün sayfalar özgün çözünürlükte tek tek taşma, örtüşme, kesilme, font ve bozuk karakter açısından temiz bulunmuştur. Bu belge QA sonucu exact ürün, paket veya kurulu uygulama UAT kapılarının yerine geçmez.

DEC-275/DEC-276 metni ile kullanıcı karar sicili SHA-256 bağının geçici ayrışması operation-rule-check tarafından fail-closed reddedilmiş; buna rağmen generator çağrısının başlaması gerçek süreç kusuru olarak `9a370e51` boş `wip(rejected)` checkpointiyle korunmuştur. Aktif son rejected checkpoint budur. Olay Bronze 51 ürün kusuru veya PASS değildir ve paket yetkisi vermez; karar/hash eşliği ve taze PASS kapısı olmadan sonraki üretici çalıştırılmaz.

Temiz `9f16699d` kaynak kapanışından sonra kanal setup doğrulayıcısının, henüz `89c4332f` üzerinde duran Bronze worktree için exact HEAD eşliği arayıp durması `dbefb586` boş `wip(rejected)` checkpointiyle korunur ve aktif son rejected checkpoint olur. Olay Bronze 51 ürün kusuru veya PASS değildir; üç kanal ayrı açık `ff-only` ile nihai kaynak commitine taşınıp setup/eşitlik kapısı taze PASS vermeden exact kanıt veya paket yoktur.
