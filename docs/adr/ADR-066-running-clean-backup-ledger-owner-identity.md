# ADR-066 — Çalışan Temiz-Yedek Defteri Sahip Kimliği

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Kanal: Bronze RC2 Active Development
- Build: 193
- Karar: DEC-083

## Bağlam

Önceki kronoloji ve tek-çalışma korumaları, policy claim ile repository tarafından eklenen çalışma defterini güvenli tutuyordu. Ancak doğrudan veya hatalı bir SQLite yazımı, politika sahibiyle eşleşmeyen `running` satırı ekleyebiliyor; kısmi benzersiz indeks bu yetim satır nedeniyle sonraki meşru claim'leri engelleyebiliyordu.

## Karar

Migrasyon 37, `running` çalışma defteri insert/update/delete işlemlerine sahip kimliği tetikleyicileri ekler. Repository, çalışma satırı yazım sayısını ve policy–ledger sahiplik join'ini transaction içinde ayrıca doğrular.

## Sonuçlar

- Yetim veya sahte çalışan satır fail-closed reddedilir.
- Claim kimliği, tetikleyicisi ve kronolojisi iki katmanlı doğrulanır.
- Aktif çalışan defter silinemez veya başka sahibin kimliğine dönüştürülemez.
- Geçerli terminal geçişleri ve kesinti kurtarma zinciri değişmeden kalır.
