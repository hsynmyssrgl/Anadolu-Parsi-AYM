# ADR-065 — Otomatik Politikadan Bağımsız Manuel Temiz-Yedek Kullanılabilirliği

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Tarih: 31.07.2026
- Karar: DEC-082
- Kanal: Bronze RC2 Active Development

## Bağlam

Arayüz otomatik zamanlamayı kapatan bir politika anahtarı ile ayrı bir “Şimdi çalıştır” komutu sunuyordu. Buna rağmen servis ve repository `enabled=false` durumunu bütün tetikleyiciler için sahiplenme yasağı olarak yorumluyor, yetkili manuel komutu da reddediyordu.

## Karar

Servis yalnız otomatik çevrimi `enabled=false` nedeniyle atlar. Repository manuel claim için otomatik etkinlik koşulunu aramaz; otomatik claim için aramaya devam eder. Manuel claim mevcut `next_attempt_at`, tek çalışma sahipliği, saklama kesimi ve kronoloji kurallarını aynen uygular.

Migrasyon 36, devre dışı politika `running` durumuna geçecekse tetikleyicinin yalnız `manual` olmasını zorunlu tutar. Otomatik devre dışı claim doğrudan SQL ile de reddedilir.

## Sonuçlar

- Acil veya kullanıcı tarafından başlatılan manuel yeniden yazım otomatik planlamadan bağımsızdır.
- Otomatik çevrim kapalı kalır ve sessizce yeniden etkinleşmez.
- Geri çekilme veya eşzamanlılık korumaları için ayrıcalıklı manuel bypass oluşmaz.
