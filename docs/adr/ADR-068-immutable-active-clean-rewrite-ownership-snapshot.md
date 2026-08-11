# ADR-068 — Değiştirilemez Aktif Temiz-Yedek Sahiplik Anlık Görüntüsü

**Aktif sürüm:** 01.08.2026.219  

## Durum
Kabul edildi — Bronze RC2 Build 195.

## Sorun
Build 194 claim rezervasyonu başlangıç sahipliğini koruyordu; ancak aktif politika saati veya defter iş yükü alanları sonradan doğrudan değiştirilebiliyordu.

## Karar
Aktif politika ve `running` defter anlık görüntüsü terminal geçişe kadar SQLite tetikleyicileriyle değiştirilemez. Repository claim sonrası ve terminal öncesi tüketilmiş rezervasyon eşleşmesini doğrular.

## Sonuç
Sahte sayaç, kesim veya kronoloji değişikliği fail-closed reddedilir; meşru terminal geçiş korunur.
