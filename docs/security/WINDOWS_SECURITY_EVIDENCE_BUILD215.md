# Build215 — Windows Security Evidence Harness

**Aktif sürüm:** 01.08.2026.215  
**Package:** 1.8.2026-215  
**Build:** 215  
**Hedef:** OPEN-021 + OPEN-022 platform kanıtı

## Resmî Windows PASS koşulları

| Kanıt | Zorunlu sonuç |
|---|---|
| Development Electron startup security | PASS |
| Development Electron Windows EFS probe | PASS |
| Development Electron safeStorage/DPAPI | PASS |
| Development Protected Side Artifact | PASS |
| İkinci process DPAPI/sentinel devamlılığı | PASS |
| Paketli/kurulmuş Electron startup security | PASS |
| Paketli Windows EFS probe | PASS |
| Paketli safeStorage/DPAPI | PASS |
| Paketli Protected Side Artifact | PASS |
| Installer lifecycle | PASS |
| Resmî sandbox policy | PASS |

## Çalıştırma

Windows üzerinde proje kökünden:

`BRONZE_FINAL_WINDOWS_DOGRULAMA.cmd`

Runner güncel `APP_META` sürümünü dinamik çözer; Build122 gibi tarihsel sabit adları kullanmaz. Kanıtlar `artifacts/validation/` altında ve ayrıca build numaralı Windows kanıt ZIP'inde toplanır.

## Mevcut ortam sınırı

Bu Build215 geliştirme ortamı Windows değildir. Bu nedenle:

- gerçek EFS: **NOT_RUN**
- gerçek Electron `safeStorage`/DPAPI: **NOT_RUN**
- paketli Windows Electron: **NOT_RUN**
- installer lifecycle: **NOT_RUN**

Kaynak harness sözleşmesi ve kontrollü TypeScript doğrulaması bu platform kanıtlarının yerine geçmez.
