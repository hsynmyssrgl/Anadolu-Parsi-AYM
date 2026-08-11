# OPEN-022 Windows Kapanış Prosedürü — Build218

**Aktif sürüm:** 02.08.2026.224
**Package:** 1.8.2026-218  
**Açık iş:** OPEN-022 — Hassas yan-artifact şifreleme ve sanitizasyon kapanışı

## Tek tık yürütme

Gerçek Windows bilgisayarda Build218 kaynak klasörünün kökünde:

`OPEN022_WINDOWS_KAPAT.cmd`

çalıştırılır.

## Resmî PASS koşulları

1. Exact Build218 `manifest.json` / `SHA256SUMS.txt` kaynak bütünlüğü PASS.
2. Dependency bootstrap tamamlanır. Bu adım OPEN-002'yi otomatik kapatmaz.
3. Windows installer gerçek olarak üretilir.
4. Development Electron iki çalıştırmada `safeStorage/DPAPI + Protected Side Artifact` kanıtı PASS verir.
5. Installer current-user bağlamında kurulur.
6. Kurulu/paketli Electron iki çalıştırmada aynı OPEN-022 kanıtı PASS verir.
7. Kurulum kaldırılır ve yaşam döngüsü PASS olur.
8. `build218-open022-windows-closure-result.json` sonucu `PASS / READY_TO_CLOSE` olur.
9. Kanıt ZIP'i ve SHA-256 dosyası üretilir.

## OPEN-022 kanıtı

Her launch run için:

- startup `protectionProvider = windows-dpapi`
- Electron `safeStorage selectedBackend = dpapi`
- key-envelope `protectionId = electron-safe-storage-v1`
- açık `dataKey` bulunmaması
- `.pplog/.pptdiag/.pptreport` ciphertext plaintext marker sızdırmaması
- decrypt round-trip = PASS
- startup security evidence encrypted-at-rest = PASS
- `sessionData` ve `crashDumps` volatil runtime root altında = PASS
- sandbox / contextIsolation / nodeIntegration / webSecurity politikaları güvenli = PASS

zorunludur.

## Kapsam sınırı

Bu build gerçek Windows çalıştırmasını bu ortamda gerçekleştirmez. Kaynak/contract/runtime hazırlığı PASS olsa bile OPEN-022, gerçek Windows evidence bundle geri dönüp ayrı ledger kararına bağlanana kadar `IN_PROGRESS` kalır. OPEN-021 değiştirilmez.
