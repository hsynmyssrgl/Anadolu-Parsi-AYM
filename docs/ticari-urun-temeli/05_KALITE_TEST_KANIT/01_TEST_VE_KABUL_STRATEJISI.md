# Test ve Kabul Stratejisi

## Test piramidi

1. Domain birim testleri.
2. Application use-case ve durum makinesi testleri.
3. Repository + gercek SQLite migration/trigger testleri.
4. Security parser, kripto ve negatif testleri.
5. Main adapter, IPC ve preload sozlesme testleri.
6. Renderer islev, erisilebilirlik ve gorsel kontrat testleri.
7. Uygulama butunlugu ve tam regresyon.
8. Temiz makine kurulum/guncelleme/kaldirma UAT.
9. Gercek cihaz ve saglayici UAT.

## Zorunlu negatif testler

- Yetkisiz aile/hesap/sahip erisimi.
- Stale revision ve degisik fingerprint ile replay.
- IPC extra key, prototype, accessor, buyuk payload ve gizli veri.
- Dosya path traversal, symlink, hard-link ve content drift.
- Ag redirect, private IP, DNS rebinding, TLS/pin ve boyut asimi.
- Sifreleme tag/hash/metadata tahrifi.
- Migration kesintisi ve geri donus.
- Disk dolu, izin yok, dosya kilitli ve proses kapanisi.
- Saglayici eksikligi ve timeout.

## Kabul siniflari

| Seviye | Anlam | Kapanis |
|---|---|---|
| P0 | Veri kaybi, yetki bypass, acilmama | Sifir olmadan ilerlenmez |
| P1 | Ana akis bozuk veya ciddi guvenlik | Sifir olmadan yayinlanmaz |
| P2 | Ikincil akis/UX sorunu | Plan ve kabul gerekir |
| P3 | Kozmetik/iyilestirme | Backlog olabilir |

## Kanit kurali

Her test kaniti komut, tarih, kaynak HEAD, dosya/test sayisi, PASS/FAIL, hata metni ve uretilen artifact hashini tasir. Onceki snapshot yeni kaynak icin PASS sayilmaz.

## Ticari yayin kabul kapilari

- Temiz git calisma agaci.
- Governed preflight ve postflight PASS.
- Typecheck ve build PASS.
- Tam test PASS.
- Migration verifier PASS.
- SBOM ve lisans envanteri PASS.
- Uretim imzasi ve kurulu EXE Authenticode PASS.
- Kurulum/acilis/kapanis/guncelleme/kaldirma UAT PASS.
- Gercek cihaz/saglayici kapsaminda destek iddiasi kadar UAT PASS.
- Hukuk/gizlilik onayi veya yayin kapsami disinda oldugunun acik kaydi.

