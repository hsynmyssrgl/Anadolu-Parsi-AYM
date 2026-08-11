# Panthera pardus tulliana Aile — Bronze MVP-32

**Sürüm:** 21.07.2026.32  
**Aşama:** Bronze / MVP-32  
**Tarih:** 21 Temmuz 2026

## Tamamlanan geliştirmeler

- Uygulama adı, edition, sürüm, sahip ve aşama bilgileri `APP_META` adlı tek bir ortak kaynağa taşındı.
- Electron ana süreç ve React arayüzünün aynı sürüm bilgisini kullanması sağlandı.
- Eski MVP-18, MVP-29 ve MVP-30 fallback değerleri kaldırıldı.
- Kök paket, masaüstü paketi ve package-lock sürümleri `21.7.2026-32` olarak eşitlendi.
- Depo metadata kaydı `21.07.2026.32` sürümüne güncellendi.
- Geçici arayüz sınıf adları üretim odaklı adlarla değiştirildi:
  - `placeholder-grid` → `workspace-grid`
  - `roadmap-panel` → `workspace-form`
  - `module-context` → `workspace-summary`
  - `roadmap-badge` → `status-badge`
  - `roadmap-item` → `summary-row`
- Mevcut işlev ve veri davranışları korunarak UI kaynak kodunun anlamlılığı artırıldı.

## Doğrulama

- TypeScript typecheck: başarılı
- Vitest: 4 test dosyası, 30/30 test başarılı
- Electron main/preload build: başarılı
- React/Vite production build: başarılı
- npm audit: 0 güvenlik açığı
- Repository integrity verification: başarılı

## Not

Bu sürüm Windows kurulum paketi/EXE değildir. Doğrulanmış kaynak kod sürümüdür.
