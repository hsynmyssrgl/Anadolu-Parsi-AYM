# ADR-069 — Aktif Temiz-Yedek Politika Parametreleri Değiştirilemez

**Aktif sürüm:** 01.08.2026.219  

## Durum
Kabul edildi — Bronze RC2 Build 196.

## Karar
Aktif bir temiz-yedek çalışması varken otomatik etkinlik, saklama günü, manuel/otomatik geri çekilme ve yüksek yük erteleme süreleri terminal geçişe kadar değiştirilemez. SQLite migrasyon 40 bu sınırı doğrudan uygular ve terminal cümlesi içine parametre değişikliği gizlenmesini reddeder.
