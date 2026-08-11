# Temiz Yedek Tetikleyiciye Duyarlı Geri Çekilme V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Manuel ve otomatik temiz-yedek yeniden yazımı sonuçlarının aynı geri çekilme süresini kullanmasını engellemek ve kalıcı politika/çalışma defteri kronolojisini çalışma tetikleyicisine bağlamak.

## Bağlayıcı davranış

- `manual` attention, partial, failed ve interrupted sonuçları **60 dakika** geri çekilir.
- `automatic` attention, partial, failed ve interrupted sonuçları **360 dakika** geri çekilir.
- `deferred` sonucu tetikleyiciden bağımsız **30 dakika** yüksek yük ertelemesi kullanır.
- Başarılı sonuçta `nextAttemptAt` tutulmaz.
- Kesinti kurtarması, kalıcı `last_trigger` değerini kullanır; geçersiz tetikleyici fail-closed reddedilir.
- Politika ve çalışma defteri `next_attempt_at` değeri, terminal tamamlanma zamanından doğru gecikme kadar ileride olmalıdır.
- SQLite tetikleyicileri yanlış gecikmeyi doğrudan yazımda da reddeder.

## Güvenlik sınırı

Geri çekilme süresi, kullanıcı veya doğrudan SQL tarafından çalışma tetikleyicisinden koparılamaz. Yanlış gecikme atomik sonuçlandırmayı durdurur; mevcut sahiplik/kurtarma mekanizması korunur.

## Sürüm

Build 191 · `31.07.2026.191` · Bronze RC2 Active Development · `PPT-LIFECYCLE-STRICT-V1`
