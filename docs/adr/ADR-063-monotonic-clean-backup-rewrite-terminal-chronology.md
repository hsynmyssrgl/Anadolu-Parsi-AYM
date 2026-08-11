# ADR-063 — Monotonik Temiz Yedek Terminal Kronolojisi

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Karar: DEC-080
- Kanal: Bronze RC2 Active Development

## Bağlam

Build 185 yönetilen yedek yayılımını monotonik zamana bağladı. Ancak yayılım üretmeyen yüksek yük ertelemesi, etkin hedef yokluğu ve hata yolları terminal zamanı için duvar saatini yeniden okuyordu. Saat sıçraması çalışma süresini sıfırlayabiliyor veya geri çekilmeyi ölçüsüz biçimde ileri taşıyabiliyordu.

## Karar

`AutomaticCleanBackupRewriteService`, güvenli claim zamanı ile birlikte monotonik başlangıç alır. `deferred`, `attention` ve `failed` tamamlanma zamanlarını geçen monotonik süreyle üretir. Retry/erteleme bu tamamlanma zamanına bağlanır. Geçersiz veya geriye giden monotonik saat terminal yazımını reddeder; kalıcı sahiplik kesinti kurtarmasına bırakılır. Bağlı propagation başarı/kısmi kronolojisi değiştirilmez.

## Sonuçlar

- Duvar saati ileri/geri değişimi retry penceresini bozamaz.
- Gerçek terminal süreleri kalıcı politika ve çalışma defterinde aynı kalır.
- Monotonik saat hatası sessiz başarıya veya uydurma tamamlanma zamanına dönüştürülmez.
