# Build219 — Birleşik Bronze Windows Güvenlik Kapanışı

**Aktif sürüm:** 02.08.2026.224

Bu prosedür OPEN-021 ve OPEN-022 için tek güncel Build219 kaynak snapshotından resmi gerçek Windows kanıtı üretir.

## Çalıştırma

Build219 kaynak ZIP'i Windows bilgisayarda tamamen çıkarılır ve kökteki:

`BRONZE_WINDOWS_GUVENLIK_KAPAT.cmd`

çalıştırılır.

## Tek çalıştırmada doğrulananlar

### OPEN-021

- aktif SQLite `memory-only`,
- Windows EFS staging dizini `Encrypted` attribute,
- snapshot dosyası EFS `Encrypted` attribute,
- SQLite snapshot round-trip,
- staging kalıntısı temizliği,
- development ve installed/package Electron launch.

### OPEN-022

- Electron `safeStorage` backend=`dpapi`,
- stabil key-envelope protection id=`electron-safe-storage-v1`,
- plaintext data key bulunmaması,
- `.pplog`, `.pptdiag`, `.pptreport` şifreli kapsayıcıları,
- plaintext marker sızıntısı olmaması ve decrypt round-trip,
- startup-security evidence şifreli saklama,
- browser session/crash alanlarının volatil kökte olması,
- development ve installed/package Electron launch.

## Sonuç kodları

- `0`: OPEN-021 ve OPEN-022 birlikte `READY_TO_CLOSE`.
- `21`: yalnız OPEN-021 `READY_TO_CLOSE`.
- `22`: yalnız OPEN-022 `READY_TO_CLOSE`.
- diğer: iki kalem de henüz kapanışa hazır değil.

Her durumda mümkün olduğunda `artifacts/validation/Bronze_Guvenlik_Windows_Kanitlari_Build219_*.zip` ve `.sha256` üretilir. Kanıt paketi Build219 `manifest.json` ve `SHA256SUMS.txt` hashlerine bağlanır.

## Kapanış sınırı

Runner Ana Build Defteri'ni değiştirmez. Kanıt paketi geri alınıp doğrulandıktan sonra yalnız PASS olan OPEN kalemi yeni build kararında `COMPLETED` yapılabilir. `npm ci` burada yalnız prerequisite'tir ve OPEN-002'yi otomatik kapatmaz.
