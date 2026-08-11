# Build 162 Mimari Doğrulama Raporu

- Application Version: `29.07.2026.162`
- Package Version: `29.7.2026-162`
- Stage: **Bronze RC2 Active Development**

## Mimari sınır

Build 159–161 taşıma, iptal ve geri basınç katmanları korunur. Build 162 yalnız
allowlist'teki salt okumaları renderer oturumu, oturum çağı, kanal, revizyon özeti
ve kanonik argümanlardan türetilen SHA-256 anahtarla paylaşır.

Preload eşzamanlı aynı okumaları tek Promise üzerinde birleştirir. Ana süreç kısa
TTL'li, sender-isolated ve byte/giriş sınırları olan sonuç cache'i kullanır. Cache
hit'i özgün istek bağlamına bağlı yeni yanıt zarfıyla döner.

Mutasyonlar paylaşım dışıdır. Mutasyon başlangıcı cache'i ve aktif paylaşılabilir
okumaları geçersiz kılar. Sender cache nesli, daha önce başlamış bir okumanın eski
sonucu yeniden saklamasını engeller.

## Mimari sonuç

- Concurrent read coalescing: **PASS**
- Session/epoch/revision/argument key binding: **PASS**
- Sender-isolated bounded cache: **PASS**
- Clone isolation: **PASS**
- Mutation and stale-generation invalidation: **PASS**
- Error/oversize non-caching: **PASS**
- Build 159–161 continuity: **PASS**
- Active stage preservation: **PASS**
