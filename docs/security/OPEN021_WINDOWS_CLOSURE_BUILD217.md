# OPEN-021 Windows Kapanış Prosedürü — Build217

**Aktif sürüm:** 02.08.2026.224
**Package:** 1.8.2026-217  
**Açık iş:** OPEN-021 — Aktif oturumda sayfa-seviyesi kullanıcı verisi koruması

## Tek tık yürütme

Gerçek Windows bilgisayarda Build217 kaynak klasörünün kökünde:

`OPEN021_WINDOWS_KAPAT.cmd`

çalıştırılır.

## Resmî PASS koşulları

1. Exact Build217 `manifest.json` / `SHA256SUMS.txt` kaynak bütünlüğü PASS.
2. Dependency bootstrap tamamlanır. Bu adım OPEN-002'yi otomatik kapatmaz.
3. Windows installer gerçek olarak üretilir.
4. Development Electron iki çalıştırmada OPEN-021 EFS kanıtı PASS verir.
5. Installer current-user bağlamında kurulur.
6. Kurulu/paketli Electron iki çalıştırmada aynı OPEN-021 EFS kanıtı PASS verir.
7. Kurulum kaldırılır ve yaşam döngüsü PASS olur.
8. `build217-open021-windows-closure-result.json` sonucu `PASS / READY_TO_CLOSE` olur.
9. Kanıt ZIP'i ve SHA-256 dosyası üretilir.

## OPEN-021 EFS kanıtı

Her launch run için:

- `activeDatabase = memory-only`
- `protectionStatus = windows-efs`
- staging directory encrypted attribute = PASS
- SQLite snapshot encrypted attribute = PASS
- SQLite round-trip = PASS
- staging cleanup = PASS

zorunludur.

## Kapsam sınırı

Bu build gerçek Windows çalıştırmasını bu ortamda gerçekleştirmez. Kaynak/contract/runtime hazırlığı PASS olsa bile OPEN-021, gerçek Windows evidence bundle geri dönüp ayrı ledger kararına bağlanana kadar `IN_PROGRESS` kalır. OPEN-022 değiştirilmez.

