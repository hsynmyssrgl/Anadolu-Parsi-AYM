# ADR-080 — Sohbet bağlam kapasitesi ve zorunlu yeni-sohbet devir kapısı

- Durum: Kabul edildi
- Tarih: 01.08.2026
- Build: 207
- Karar: DEC-097
- Politika: `PPT-BUILD-LEDGER-CONTINUITY-V3`
- Kural seti: `PROJECT-RULES-2026-08-01-V2`

## Bağlam

Projenin uzun sohbetlerde ilerlemesi, bağlam alanı kritik seviyeye geldiğinde yeni build başlatılırsa eksik kural okuma, yarım teslim veya devam noktası kaybı riski oluşturur. Platform kesin bir kullanıcı-görünür bağlam sayacı sağlamadığında yardımcı yalnız tahmini oran verebilir; bu nedenle oran kesin ölçüm iddiası taşımaz fakat yönetişim kapısı olarak muhafazakâr kullanılabilir.

## Karar

1. Build 207 ve sonrasında her tamamlanan build `conversationCapacityAssessment` kaydı taşır.
2. Kayıt `assistant_estimate` yöntemiyle tahmini kullanılan ve kalan yüzdeyi içerir.
3. %85–89 kullanım `WARNING` bölgesidir.
4. %90 ve üzeri kullanım `HARD_STOP` bölgesidir.
5. `HARD_STOP` durumunda aynı sohbet içinde bir sonraki build başlatılamaz. Bu kuralın teknik bypass yolu yoktur.
6. `HARD_STOP` tamamlaması yeni sohbet için kopyalanabilir devir promptu üretmek zorundadır.
7. Devir promptu son build/sürüm, güncel kural seti/hash, Ana Build Defteri, sıradaki iş ve kalan işleri içerir.
8. Yeni sohbet geçmiş kuralların kullanıcı tarafından yeniden öğretilmesini istemez; Ana Build Defteri tek yetkili devam kaynağıdır.

## Sonuç

Sohbet değişimi kontrollü bir proje devir işlemine dönüşür; bağlam riski yeni buildin ortasına taşınmaz.
