# Temiz Yedek Yeniden Yazım — Bağlı Kronoloji Sözleşmesi V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Otomatik temiz-yedek çalışma defteri ile yönetilen yedek propagation kaydının
tek ve doğrulanabilir zaman sırası içinde kalmasını sağlamak.

## Kurallar

1. `success` ve `partial` çalışma kayıtları geçerli `propagationRunId` taşır.
2. Üst çalışma `completedAt` değeri bağlı propagation `completedAt` değeridir.
3. Propagation başlangıcı üst temiz-yedek çalışma başlangıcından önce olamaz.
4. Propagation tamamlanması propagation başlangıcından önce olamaz.
5. SQLite, eksik propagation kaydını ve geriye giden bağlı kronolojiyi reddeder.
6. Başarısız, dikkat veya ertelenmiş sonuç propagation kimliği olmadan saklanabilir.
7. Hata yolunda geriye giden duvar saati üst çalışma başlangıç zamanının altına inemez.
8. Tarihsel Build kanıtları değiştirilmez.

## Silver sınırı

Gerçek Windows saat değişikliği, uyku/uyanma, süreç öldürme ve dosya sistemi
kesintisi tam test kampanyasında doğrulanır.
