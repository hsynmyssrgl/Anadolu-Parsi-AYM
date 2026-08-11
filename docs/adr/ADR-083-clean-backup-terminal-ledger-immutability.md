# ADR-083 — Terminal temiz-yedek ledger satırlarını SQLite düzeyinde değişmez kılma

## Bağlam

Temiz-yedek çalışma defteri `running` durumundan terminal sonuca geçtikten sonra tarihsel kanıt niteliği taşır. Önceki migrasyonlar çalışma sahipliği, terminal tutarlılığı, kronoloji ve propagation kanıtını korurken terminal satırın tüm alanlarını genel bir değişmezlik sınırına bağlamıyordu. Ayrıca SQLite `INSERT OR REPLACE`, `recursive_triggers=0` altında iç DELETE tetikleyicilerine güvenilerek güvenli kabul edilemez.

## Karar

Migrasyon 49 üç fail-closed tetikleyici kurar:

1. `OLD.status <> 'running'` olan satırda herhangi bir alan gerçekten değişiyorsa `BEFORE UPDATE` reddeder.
2. Terminal satırın `DELETE` işlemini reddeder.
3. Aynı `id` ile mevcut terminal satır varken yeni `INSERT` girişini reddeder; böylece `INSERT OR REPLACE` çatışma çözümü başlamadan kesilir.

No-op `UPDATE` alan bazlı `IS NOT` karşılaştırmalarıyla izinli kalır. `running → terminal` geçişi bu yeni tetikleyicinin `OLD.status` koşuluna takılmaz ve mevcut atomik terminal sonuçlandırma kuralları tarafından doğrulanır.

## Sonuçlar

- Terminal çalışma kanıtı append/finalize-once semantiğine kavuşur.
- Repository dışı doğrudan SQLite yazımı da aynı sınırdadır.
- Geriye dönük tarihsel terminal kayıtlar korunur.
- Gerekli düzeltmeler eski satırı değiştirmek yerine yeni karar/build veya ayrı düzeltme kanıtı üretmelidir.
