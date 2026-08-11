# ADR-098 — Deterministik NSIS lisans kaynak senkronizasyonu

## Bağlam

Build223 Windows testi Electron/renderer derlemesini geçti ancak NSIS installer ön doğrulaması, türetilmiş `LICENSE_TR.rtf` dosyasının `LICENSE_TR.txt` kaynağından geride kalması nedeniyle durdu.

## Karar

- `apps/desktop/build/LICENSE_TR.txt` tek insan tarafından düzenlenen lisans kaynağıdır.
- `apps/desktop/scripts/license-rtf-lib.mjs` normalize/escape/RTF render algoritmasının tek otoritesidir.
- `generate-license-rtf.mjs` aynı renderer ile ASCII-only RTF üretir.
- `verify-license-rtf-sync.mjs` aynı renderer ile mevcut RTF'nin exact byte-semantic eşliğini doğrular.
- `verify-installer.mjs` duplicate encoder taşımaz; aynı renderer'ı kullanır.
- `package:win` ve `package:win:dir` önce `verify:license-sync` çalıştırır; mismatch durumunda build başlamadan fail-closed durur.
- Paketleme exact-source snapshotını otomatik olarak yeniden yazmaz. `sync:license:rtf` bilinçli authoring komutudur.

## Sonuç

Build224 kaynak snapshotında TXT/RTF eşliği deterministik ve test edilebilir hale gelir. Gerçek Windows installer/EFS/DPAPI sonucu yine platform kanıtı gerektirir.
