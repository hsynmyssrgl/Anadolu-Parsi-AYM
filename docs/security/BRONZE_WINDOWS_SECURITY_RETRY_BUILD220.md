# Build220 — Bronze Windows Güvenlik Yeniden Testi

**Aktif sürüm:** 02.08.2026.224

## Neden yeniden test

Build219 gerçek Windows koşusunda exact-source integrity ve root npm ci PASS oldu; installer build ise izole Windows packager dependency graph kurulmadığı için exit code 1 ile durdu. OPEN-021 ve OPEN-022 probları bu nedenle çalışmadı.

## Çalıştırma

Build220 kaynak ZIP'i Windows bilgisayarda tamamen çıkarılır ve kökteki:

`BRONZE_WINDOWS_GUVENLIK_KAPAT_BUILD220.cmd`

çalıştırılır.

Runner sırası:

1. exact source integrity
2. root `npm ci`
3. `npm run windows-packager:install`
4. isolated electron-builder CLI existence check
5. tek installer build
6. OPEN-021 ve OPEN-022 development probe
7. silent current-user install
8. OPEN-021 ve OPEN-022 installed/package probe
9. uninstall
10. bağımsız readiness doğrulaması
11. exact-source-bound evidence ZIP + `.sha256`

## Sonuç kodları

- `0`: OPEN-021 ve OPEN-022 birlikte `READY_TO_CLOSE`
- `21`: yalnız OPEN-021 `READY_TO_CLOSE`
- `22`: yalnız OPEN-022 `READY_TO_CLOSE`
- diğer: iki kalem de kapanışa hazır değil

Kanıt dosyası: `artifacts/validation/Bronze_Guvenlik_Windows_Kanitlari_Build220_*.zip` ve aynı adın `.sha256` dosyası.

## Kapanış sınırı

Runner Ana Build Defteri'ni değiştirmez. `npm ci` bu akışta prerequisite'tir; OPEN-002'yi otomatik kapatmaz. OPEN-021/OPEN-022 yalnız geri dönen exact Build220 Windows evidence doğrulandıktan sonra yeni governed build içinde `COMPLETED` yapılabilir.
