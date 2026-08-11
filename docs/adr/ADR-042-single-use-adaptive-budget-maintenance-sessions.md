# ADR-042 — Tek Kullanımlık Adaptif Bütçe Bakım Oturumları

- Durum: Kabul edildi
- Tarih: 2026-07-29
- Aşama: Bronze RC2 Active Development

## Karar

Adaptif IPC bütçesini sıfırlama ve tanı paketi dışa aktarma işlemleri doğrudan çalıştırılamaz. Her işlem önce ana süreçte kullanıcı onayıyla işlem türüne özel bir bakım oturumu açar. Oturum 90 saniye geçerlidir; sender kimliği, renderer oturum kimliği ve mevcut kimlik doğrulama bağlamının SHA-256 parmak izine bağlanır ve yalnız bir kez tüketilebilir.

## Gerekçe

- Aynı onayın farklı bir operatör işleminde yeniden kullanılmasını engellemek.
- Gecikmiş veya replay edilen renderer çağrılarını fail-closed reddetmek.
- Oturum değişimi ve pencere kapanışında bakım yetkisini otomatik düşürmek.
- Operatör müdahalelerini ayrı denetim olaylarıyla izlenebilir kılmak.

## Güvenlik sonucu

Bakım oturumu kullanıcı adı, IPC argümanı veya payload saklamaz. İşlem, sender, renderer oturumu, kimlik bağlamı, süre ve işlem türünden herhangi biri uyuşmazsa uygulanmaz.
