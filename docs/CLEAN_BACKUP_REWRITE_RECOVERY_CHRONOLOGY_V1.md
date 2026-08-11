# Temiz Yedek Yeniden Yazımı Kesinti Kurtarma Kronolojisi V1

**Aktif sürüm:** 02.08.2026.228

**Politika:** `PPT-LIFECYCLE-STRICT-V1`  
**Karar:** `DEC-077`  
**ADR:** `ADR-060`

## Amaç

Uygulama veya işletim sistemi otomatik temiz-yedek yeniden yazımı sırasında
kapanırsa kalıcı `running` kaydı güvenli biçimde sonlandırılır. Sistem duvar
saati çalışma başlangıcının gerisine alınmış olsa bile politika kilitli kalmaz
ve tarihsel kayıt geriye giden bir tamamlanma zamanı içermez.

## Güvenli zaman tabanı

- Gözlenen yeniden başlatma zamanı geçerli ISO-8601 zamanı olmalıdır.
- Kalıcı çalışma defterindeki `started_at`, politika satırındaki
  `in_progress_started_at` değerinden önceliklidir.
- Kurtarma tamamlanma zamanı `max(observedAt, persistedStartedAt)` olarak
  üretilir.
- Otomatik 360 dakikalık geri çekilme bu güvenli tamamlanma zamanından
  hesaplanır.
- Kurtarma zamanı, geri çekilme zamanı veya kalıcı çalışma başlangıcı
  geçersizse işlem fail-closed reddedilir.

## Atomik durum sınırı

- Kesilen çalışma `interrupted` durumuna geçirilir.
- Politika `backoff` durumuna alınır, sahiplik alanları temizlenir ve hata
  sayacı artırılır.
- Çalışma defteri ile politika aynı repository transaction sınırında
  güncellenir.
- Yeni bir çalışma sahiplenilirken önceki `next_attempt_at` temizlenir.

## SQLite koruması

Migrasyon 32 aşağıdaki durumları insert ve update tetikleyicileriyle reddeder:

- `running` politika için eksik çalışma sahibi veya başlangıç zamanı,
- `running` ya da `idle` politika üzerinde kalmış sonraki deneme zamanı,
- `backoff`, `deferred` veya `attention` politika için eksik sonraki deneme,
- politika güncelleme zamanından önceki sonraki deneme,
- tamamlanmış çalışma için eksik `completed_at`,
- başarısız/kısmi/ertelenmiş/dikkat/kesilmiş çalışma için eksik sonraki deneme,
- tamamlanmadan önceki sonraki deneme,
- başarı kaydında kalmış sonraki deneme.

## Kullanıcı görünürlüğü

Saat geri alınması nedeniyle kayıtlı başlangıç zamanı taban olarak
kullanıldığında `backup.clean_rewrite_recovered_clock_adjusted` tanısı üretilir.
Tanı, gözlenen zamanı ve kayıtlı çalışma başlangıcını içerir; kullanıcı verisi,
yedek içeriği veya sır içermez.
