# Bronze RC2 Build 207 — Sürüm Notları

## Sohbet bağlam kapasitesi yönetişimi

- PR-106…PR-111 eklendi; bağlayıcı kural seti 111 maddeye çıktı.
- Her build tamamlaması tahmini kullanılan/kalan sohbet yüzdesi kaydını zorunlu tutar.
- %85–89 uyarı bölgesi, %90+ istisnasız yeni-sohbet devir eşiği olarak sabitlendi.
- %90+ önceki build ile yeni build başlatma ve sürüm yükseltme fail-closed engellenir.
- %90+ tamamlamada kopyalanabilir yeni-sohbet devir promptu üretilir.
- Yeni sohbet Ana Build Defteri ve devir promptundan devam eder; kurallar kullanıcıdan yeniden istenmez.
- DEC-097 / ADR-080 / `PPT-BUILD-LEDGER-CONTINUITY-V3` bağlayıcıdır.
