# ADR-058 — Monotonik Yönetilen Yedek Yayılım Kronolojisi

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Tarih: 2026-07-30
- Build: 185
- Karar: DEC-075
- Politika: `PPT-LIFECYCLE-STRICT-V1`

## Bağlam

Build 184 kaynağında `propagatePurgedDataToManagedBackups` hem `startedAt` hem de
`completedAt` değerini dosya ve karantina işlemleri başlamadan önce üretiyordu.
Uzun süren yedekleme sırasında çalışma geçmişi, denetim kaydı ve tombstone güncelleme
zamanı gerçek tamamlanma anından önce kalabiliyordu. Duvar saatinin işlem sırasında
değişmesi de kronolojik sıralamayı bozabilirdi.

## Karar

Başlangıçta duvar saati ve monotonik süreç saati birlikte alınır. Application
use-case karantina ve final zamanlarını, başlangıç duvar saatine geçen monotonik
süreyi ekleyerek üretir. Final zaman yalnız hedef döngüsü bittikten sonra alınır ve
bekleyen tombstone kayıtlarının `updated_at` değeriyle aynı olur. Geçersiz veya
geriye giden monotonik okuma fail-closed reddedilir.

## Sonuçlar

- Çalışma `completedAt` değeri gerçek hedef işlemlerinden önce üretilemez.
- Her hedef karantinası kendi işlem noktasına ait sıralı zaman taşır.
- Tombstone tamamlama zamanı ile kalıcı propagation çalışma zamanı aynıdır.
- Duvar saati değişikliği devam eden işin zaman sırasını tersine çeviremez.
- Silver gerçek Windows uyku/uyanma, saat değiştirme, uzun disk I/O ve installer
  testlerini yeni özellik eklemeden tamamlar.
