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
- PR-240 ana belge ve karar kimliği QA: **FAIL KAYITLARI KORUNDU; NİHAİ 28/28 GÖRSEL QA VE KİMLİK KAPISI PASS** — `47af84bd` LibreOffice yürütülebilirinin PATH üzerinde bulunmamasını, `b34e951b` Poppler `pdfinfo` yürütülebilirinin PATH üzerinde bulunmamasını ve `10282bf4` iki ayrı kararın aynı `ADR-039` kimliğini taşımasını reddedilmiş checkpoint olarak kaydeder. Mutlak LibreOffice/Poppler araç yollarıyla nihai DOCX/PDF yeniden üretildi; 24 değişmeyen sayfa önceki onaylı render ile SHA-256 özdeşliğiyle, değişen 1/15/16/17. sayfalar özgün çözünürlükte yeniden incelenerek toplam 28/28 sayfa taşma, örtüşme, kesilme ve bozuk karakter olmadan PASS verdi. Build 164 kaynak bütçesi `ADR-039` olarak korunur; Build 169 güçlü yeniden doğrulama kararı benzersiz `ADR-107` kimliğine taşınır. İlk tekillik kapısının tarihsel başlık ayraçlarını yanlış reddetmesi `9f2aaf86` ile kaydedildi; kapı kimlik eşliği ve ad alanı tekilliğine daraltıldı, 2 dosya/12 test PASS verdi.

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
