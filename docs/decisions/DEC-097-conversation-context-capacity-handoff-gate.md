# DEC-097 — Her build sonrası sohbet kapasitesi ölçülür; %90 kullanımda yeni build durur

**Durum:** Aktif  
**Tarih:** 01.08.2026  
**Build:** 207  
**ADR:** ADR-080

Her tamamlanan build sonrasında sohbet bağlamının tahmini kullanılan ve kalan yüzdesi Ana Build Defteri'ne kaydedilir ve kullanıcıya build sonu durum bildiriminde gösterilir. %85–89 tahmini kullanım uyarı bölgesidir. %90 veya üzeri kullanım istisnasız zorunlu sohbet devir eşiğidir; aynı sohbette yeni build başlatılamaz. Bu durumda yeni sohbet için son build, kural sürümü/hash, yetkili Ana Build Defteri, sıradaki iş ve kalan işleri içeren kopyalanabilir devir promptu üretilir. Yeni sohbet kuralları kullanıcıdan yeniden istemez; doğrudan Ana Build Defteri'nden okur.
