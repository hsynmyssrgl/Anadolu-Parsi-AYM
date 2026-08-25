# Active Release Status

- Product: ParsYuva Aile Yaşam Merkezi
- Application Version: `22.08.2026.50`
- Package Version: `22.8.2026-50`
- Stage: **Bronze Active Development**
- Monthly Sequence: **50**
- Channel flow: **Bronze development → Silver validation/fixes → Gold production**
- Silver status: **BLOCKED**

## Current validation status

- PR-235 bootstrap producer pointer-sourceCommit/ancestry fix: **TARGETED PASS (d8746da8; 76 dosya / 509 test); FULL REGRESSION FAIL KÖK NEDEN DÜZELTİLİYOR**
- PR-235 historical full-diff `.gitattributes` dependency mapping: **IMPLEMENTED; EXACT EVIDENCE PENDING**
- PR-240 dependent-record closure: **IMPLEMENTED; EXACT EVIDENCE PENDING** — değişmez 32-K tarihsel scope yalnız tetikleyici/değişmezlik kapısıdır; güncel PPK-015 ratchet ve makbuzlar bağımlı kayıttır. 34-F'nin üç resmî makbuzu Git teslim kapsamına alınmıştır.
- PR-235/PR-240 kanal hedefli test taşınabilirliği: **FIXED; EXACT EVIDENCE PENDING** — gerçek 76 dosyalık FAIL, izole Bronze Windows packager bağımlılığı ve ana checkout'a sabit iki fixture olarak teşhis edildi. Packager Bronze içinde kuruldu; fixture yolları checkout bağımsızdır ve FAIL makbuzu güvenli dosya/test kimliklerini taşır.
- PR-240 filtrelenmemiş kanal regresyonu: **FAIL KAYITLI; EXACT HEDEFLİ 94 DOSYA / 598 TEST PASS, TESPİT EDİLEN NO-WRITE SIZINTILARI DÜZELTİLDİ, YENİ EXACT EVIDENCE PENDING** — `65db62ad`, 34-B–34-F alt doğrulayıcı aktarımını; `90b5ad40`, 34-G–34-K remaining-package aktarımını; `4c6652e0` ise tüm Vitest ve 47 ek komut tamamlandıktan sonra PPK-022 içindeki masaüstü başlangıç sarmalayıcısının `--no-write` bayrağını son çalışma doğrulayıcısına iletmemesini gerçek FAIL olarak korur. Son boşluk PPK-022 çağrısında, sarmalayıcıda ve çalışma/sözleşme makbuzu üreticilerinde kapatıldı. Odaklı kaynak regresyonu 1 dosya/6 test, masaüstü çalışma 51/51, sözleşme 41/41 ve uçtan uca PPK-022 matrisi 24/24 PASS verdi; 1.571 doğrulama dosyasının hiçbiri eklenmedi veya değişmedi. Önceki 34-B 13/13 + altı makbuz 6/6 ve 34-G 37/37 + üç makbuz 3/3 SHA-256 değişmezlik sonuçları da korunur. Hata bytesları geri döndürülebilir stash `9ba3a77b5e7ae0f456ef98feb1fd2240c00c000f` içindedir. Bunlar yeni exact tam regresyonun yerine geçmez; temiz exact commit tam regresyonu ve kaynak bütünlüğü olmadan paket yoktur.
- PR-240 ana belge ve karar kimliği QA: **FAIL KAYITLARI KORUNDU; GÜNCEL 28/28 GÖRSEL QA VE KİMLİK KAPISI PASS** — `47af84bd` ilk LibreOffice PATH, `b34e951b` Poppler PATH ve `6ec632c8` bundled render çağrısındaki yinelenen LibreOffice PATH çözümleme hatasını; `10282bf4` çift `ADR-039` kimliğini reddedilmiş checkpoint olarak korur. `6ec632c8` sonrasında doğrulanmış mutlak LibreOffice ve Poppler dizinleriyle DOCX 28/28 sayfa render edildi; önceki onaylı renderla aynı 2–6 ve 27–28. sayfalar SHA-256 özdeş, değişen 1 ve 7–26. sayfalar görsel olarak taşma, örtüşme, kesilme ve bozuk karakter olmadan PASS verdi. Build 164 `ADR-039` kalır; Build 169 `ADR-107` olmuştur. İlk kimlik kapısı yanlış-pozitifi `9f2aaf86` ile korunmuş, düzeltilmiş kapı 2 dosya/12 test PASS vermiştir.
- PR-240 hedefli test çağrı sözleşmesi: **FAIL KAYITLI; EXPLICIT 94 DOSYALI YENİDEN KOŞU BEKLİYOR** — `4c8b6b7d`, etki değerlendirmesi ve analizi 577 değişen yol/94 test dosyası PASS verdikten sonra hedefli test üreticisinin zorunlu `-- -- <repo-içi-testler>` listesinin verilmemesi nedeniyle fail-closed durmasını korur. Test kodu veya hesaplanan kapsam değiştirilmemiştir; sonraki koşu analizden türetilen 94 dosyayı exact sırayla açıkça aktaracaktır. Bu checkpoint PASS değildir ve yeni exact hedefli/tam regresyon zorunluluğunu kaldırmaz.
- PR-240 artefakt indeks doğrulama modu: **FAIL KAYITLI; KANONİK GIT-INDEX MODU PASS** — `47f441e1`, `--git-index` ile üretilmiş kanonik indeksin varsayılan canlı-ağaç modunda doğrulanması nedeniyle ignored tarihsel artefakt farklarında fail-closed durmasını korur. Üreticiyle aynı `--git-index --no-report` doğrulaması 13.146 kontrol/4.407 dosya/2.143 belge PASS; kaynak bütünlüğü 4.868 manifest dosyası/4.868 canlı kaynak/4.869 SHA PASS vermiştir. Yanlış-mod ret PASS sayılmaz.
- PR-240 Bronze runtime önkoşulu ve kalan no-write zinciri: **FAIL KAYITLARI KORUNDU; 16/16 EK RUNTIME VE ÜÇ BYTE-EXACT NO-WRITE KONTROLÜ PASS** — `703be65a`, `cb20d2e5` exact kaynağında 398 Vitest dosyası/2.469 test PASS iken Bronze workspace `dist` önkoşulları yokluğunda 16 ek runtime komutunun FAIL olmasını korur. `0a118f5f` resmî `npm_execpath` ortamı taşınmadan yapılan tanı çağrısını; `7fb288cd` ise paket workspace derlemesinden sonra hâlâ eksik `apps/core-service/dist/main.js` nedeniyle 34-I DPAPI alt testinin durmasını kaydeder. Resmî `build:packages`, core-service ve desktop build önkoşullarıyla 16/16 komut PASS olmuştur. `ddb1abff`, 33-Y/33-Z/34-A dış `--no-write` bayrağının migration/smoke/politika alt süreçlerine aktarılmaması sonucu izlenen migration manifestinde yalnız `generatedAt` yan etkisini korur. Ortak aktarım düzeltmesi 1 dosya/6 test ve üç gerçek runtime PASS; manifest SHA-256 her üçünde de byte-exact değişmeden kalmıştır. Yeni exact commit hedefli/tam regresyon ve kaynak bütünlüğü hâlâ zorunludur.
- PR-240 güncel master DOCX render retry: **FAIL KAYITLI; 28/28 GÖRSEL QA PASS** — `dd675310`, LibreOffice DOCX→PDF dönüşümü geçtikten sonra bundled Poppler `pdfinfo` dizini PATH'e eklenmediği için PNG renderın fail-closed durmasını korur. Exact bundled Poppler ve LibreOffice yollarıyla yeniden deneme 28/28 sayfa üretmiştir; 10–25 önceki onaylı renderla byte-identical, değişen 1–9 ve 26–28 sayfalar özgün çözünürlükte taşma, örtüşme, kesilme ve bozuk karakter olmadan PASS vermiştir.
- PR-240 kaynak bütünlüğü worktree sınırı: **FAIL KAYITLI; DOĞRU BRONZE RETRY BEKLİYOR** — `99ad48dd`, release kaynak bütünlüğü doğrulayıcısının ana `app` çalışma ağacında çağrılmasını fail-closed ret olarak korur. Bu sonuç ürün kaynak bozulması değildir; doğrulama exact Bronze çalışma ağacında yeniden çalıştırılmadan PASS sayılamaz ve paket üretilemez.
- PR-240 final master DOCX görsel QA: **28/28 PASS** — `0669cb38` kaynak commitinden yeniden üretilen belge exact bundled LibreOffice/Poppler yollarıyla 28 PNG sayfa verdi. Önceki onaylı renderla 2–6 byte-exact aynı; değişen 1 ve 7–28 sayfalar özgün çözünürlükte tek tek incelendi, taşma, örtüşme, kesilme veya bozuk karakter bulunmadı.
- PR-240 exact tam regresyon sonu no-write koruması: **FAIL KAYITLI; KÖK NEDEN DÜZELTİLDİ, YENİ EXACT EVIDENCE PENDING** — `80cf2a39` exact Bronze kaynağında hedefli 94 dosya/598 test ile filtresiz 398 dosya/2.469 test PASS oldu; ek komutlar sonrasında yalnız migration manifesti `generatedAt` alanı değiştiği için temiz ağaç kapısı reddetti ve `c7a3c130` ile korundu. `33-R` dış `--no-write` bayrağını migration/smoke/PPK-021/PPK-022 alt süreçlerine aktaracak şekilde düzeltildi. Odaklı 1 dosya/6 test ve gerçek 33-R matrisi 11/11, 8 dosya/30 test PASS; migration manifest SHA-256 önce/sonra byte-exact aynıdır. Yeni temiz exact commit hedefli/tam regresyonu ve exact Bronze kaynak bütünlüğü olmadan paket yoktur.

- Source preflight gate: **NOT_RUN**
- Source integrity: **NOT_RUN**
- Clean install gate: **NOT_RUN**
- Full root `tsc --noEmit`: **PASS (24.08.2026; UAT110 V3 kaynak turu)**
- UAT110 V3 bootstrap/continuation targeted contract tests: **PASS (12 dosya / 94 test)**
- Unit and integration tests: **FULL REGRESSION PENDING**
- Electron production build: **NOT_RUN**
- Blocking smoke chain: **NOT_RUN**
- Windows launch / installer: **NOT_RUN**

These statuses are updated only after the corresponding check runs against the current source. `NOT_RUN` is never treated as `PASS`.

Bronze sequence 50 artık governed bootstrap olarak `previousPackageProvenance=null`, yok kanonik hedef ve `fresh-install + same-version maintenance` kanıtı ister. Sequence 51 ve üzeri exact immutable previous package + canlı installed N runtime ile `N→N+1 + maintenance` uygular. UAT110 makbuzu V3'tür; yeni installer henüz üretilmemiştir.

## Active authorities

- `config/release-ledger.json`
- `config/canonical-rule-registry.json`
- `docs/current/00_AKTIF_ANA_KAPSAM.md`
- `docs/current/11_GUNCEL_KARAR_KURAL_IS_AKISI_SICILI.md`
- `docs/17_MASTER_BUILD_LEDGER.md`

Historical global-build documents remain immutable evidence and do not define the active monthly release.
