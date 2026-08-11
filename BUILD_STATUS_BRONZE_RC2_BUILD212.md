# Build 212 — Bronze RC2 Active Development

- Application Version: `01.08.2026.212`
- Package Version: `1.8.2026-212`
- Stage: **Bronze RC2 Active Development**
- Scope: Onaylı UI Görsel Referans Manifestosu provenance düzeltmesi ve hash sabitlemesi
- Project Rules: `PROJECT-RULES-2026-08-01-V4` / `6259d2c757caf865aedfe99a7bcea0a1a333551415b0912a856ac571876274f9`

## Durum

Onaylı açık-tema Anadolu parsı UI manifestosu aktif baseline olarak düzeltildi. Legacy koyu baseline aktif yoldan kaldırıldı. Hash drift koruması eklendi.

## Doğrulama sınırı

Build212 yalnız UI baseline teslim/regresyon düzeltmesidir. Clean npm ci Build211'deki dış bağımlılık erişim engeli nedeniyle halen FAIL/OPEN-002; tam tsc/test/Electron/Windows zinciri bu buildde PASS sayılmaz.
