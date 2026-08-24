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
| IS-0211 | Mutasyon sonrasi exact commit kanit ve taze kurulu EXE UAT kapisi | Codex | DEVAM | Exact hedefli 94 dosya/598 test PASS. 65db62ad 34-B-34-F, 90b5ad40 34-G-34-K ve 4c6652e0 PPK-022 masaustu baslangic no-write aktarim kusurlarini FAIL olarak korur. Son duzeltmeden sonra kaynak regresyonu 1 dosya/6 test, masaustu calisma 51/51, sozlesme 41/41 ve uctan uca PPK-022 24/24 PASS; 1.571 dogrulama dosyasinda sifir degisiklik. Onceki 34-B 13/13 + alti makbuz 6/6 ve 34-G 37/37 + uc makbuz 3/3 hash degismezlik PASS. 47af84bd/b34e951b render altyapi, 10282bf4 cift ADR ve 9f2aaf86 ilk kimlik kapisi yanlis-pozitifi FAIL kayitlari da korunur. Yeni exact tam regresyon/kaynak butunlugu PASS olmadan paket veya kurulu EXE UAT yok |
| IS-0212 | Acik tek seferli surum tahsisi ve onceden tahsisli paket kimligi | Codex | DEVAM | Yanlis veya ikinci expected release ID hicbir yazim/temizlik yapmadan FAIL; signed/local/dir ayni preallocated kimligi tuketir |
| IS-0213 | Kanonik kurulu Windows yukseltme maintenance ve on yuz UAT zinciri | Codex | DEVAM | Gercek N->N+1 ve same-version metadata-only koruma UAT110, source/package bagli schema2 UAT111 ve exact installed/package/registry PASS |
| IS-0214 | Adversarial Windows package kurulum ve final teslim kanit zinciri | Codex | DEVAM | UAT110 V3 Bronze 50 bootstrap / Bronze 51+ exact continuation modlari; tracked TypeScript exact 4 modul/22 rota, tum uygun kontroller, 17 native dialog gercek CANCEL/ACCEPT, 8 durum, exact scroll, 50 gorsel yuzey ve exclusive reparse-korumali evidence root sozlesmesi var; guard kaybinda path cleanup yok, canli kosular NOT_RUN |
| IS-0215 | En kucuk degisiklikte tum kayit ve test kapanisi | Codex | DEVAM | 65db62ad, 90b5ad40 ve 4c6652e0 no-write zinciri kusurlarini; 47af84bd/b34e951b belge render altyapisini; 10282bf4 cift ADR-039 kimligini ve 9f2aaf86 yanlis-pozitif kimlik kapisini gercek FAIL olarak korur. Son duzeltme kaynak regresyonu 1 dosya/6 test, masaustu calisma 51/51, sozlesme 41/41, PPK-022 24/24 ve 1.571 dogrulama dosyasinda sifir degisiklik PASS vermistir. Onceki 34-B 13/13 + alti makbuz 6/6 ve 34-G 37/37 + uc makbuz 3/3 hash degismezlik de korunur. Nihai ana belge QA 28/28 ve kimlik kapisi 2 dosya/12 test PASS. Yeni exact hedefli/tam/typecheck/sozdizimi/kaynak butunlugu ve UI etkisinde tam UAT PASS olmadan ara installer yok |

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
| IS-0601 | Tam regresyonu yeni kaynakta tekrar kos | Codex | DEVAM | Onceki regresyon kaniti tarihsel; guncel V28 exact kaynak icin filtresiz tam Vitest ve mutation source-integrity makbuzlari NOT_RUN |
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
