# Bronze MVP-37 Sürüm Notları

**Sürüm:** 21.07.2026.37

## Performans ve dayanıklılık

- SQLite WAL çalışma profili `synchronous=NORMAL`, 5 saniyelik busy timeout, bellek içi geçici tablolar, 20 MiB sayfa önbelleği ve 256 MiB mmap üst sınırıyla iyileştirildi.
- Aile olayları, finans, sağlık, yaşam, arşiv, tanılama, performans, yedekleme, görev kuyruğu, denetim ve bakım geçmişi için yeni bileşik indeksler eklendi.
- Büyük görev kuyruğu ve tanılama geçmişlerinde güvenli liste üst sınırları otomatik testlerle doğrulandı.
- Mevcut veri modeli ve geriye dönük veritabanı uyumluluğu korundu.
