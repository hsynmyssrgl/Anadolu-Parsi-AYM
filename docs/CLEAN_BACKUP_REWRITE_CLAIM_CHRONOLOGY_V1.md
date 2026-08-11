# Temiz Yedek Yeniden Yazımı Sahiplenme Kronolojisi V1

**Aktif sürüm:** 02.08.2026.228

**Politika:** `PPT-LIFECYCLE-STRICT-V1`  
**Karar:** `DEC-078`  
**ADR:** `ADR-061`

## Amaç

Yeni bir otomatik temiz-yedek yeniden yazım çalışması, işletim sistemi duvar
saati geriye alınmış olsa bile kalıcı politika kronolojisini geriye götürmeden
sahiplenilir. Saklama kesimi, durum değerlendirmesi ve çalışma defteri aynı
güvenli başlangıç zamanına bağlanır.

## Güvenli sahiplenme zamanı

- Gözlenen saat geçerli ISO-8601 zamanı olmalıdır.
- Güvenli çalışma başlangıcı; gözlenen saat, politika `updatedAt`, son deneme,
  son başarı ve varsa devam eden çalışma başlangıcının en ileri olanıdır.
- `nextAttemptAt` güvenli saat tabanına katılmaz; gelecekteki geri çekilme
  süresi böylece erkenden aşılmaz.
- Saat düzeltmesi varsa bekleyen kayıt durumu güvenli başlangıç zamanında yeniden
  hesaplanır.
- Saklama kesimi, güvenli başlangıçtan politika saklama günü çıkarılarak üretilir.
- Geçersiz kalıcı zaman veya geriye giden doğrudan repository girdisi fail-closed
  reddedilir.

## Repository ve SQLite sınırı

Migrasyon 33 aşağıdaki koşulları korur:

- politika `updated_at`, `last_attempt_at` ve `last_success_at` geriye gidemez,
- `running` sahiplenmede `last_attempt_at`, `in_progress_started_at` ve
  `updated_at` aynı güvenli zamanı taşır,
- yeni sahiplenme eski politika güncellemesi, son deneme veya son başarıdan önce
  olamaz,
- çalışma başlangıcı ve saklama kesimi sonradan değiştirilemez,
- çalışma `updated_at` değeri başlangıçtan veya önceki güncellemeden önce olamaz,
- aynı anda yalnız bir `running` temiz-yedek çalışma defteri kaydı bulunabilir.

Repository ayrıca güvenli başlangıç ile saklama kesiminin politika günüyle tam
uyumunu ve sayaçların negatif olmadığını doğrular.

## Kullanıcı görünürlüğü

Saat geri alma nedeniyle sahiplenme zamanı yükseltildiğinde
`backup.clean_rewrite_claim_clock_adjusted` tanısı üretilir. Tanı yalnız gözlenen
saat, güvenli çalışma başlangıcı ve kullanılan kronoloji tabanını içerir; yedek
içeriği, kişisel kayıt veya sır içermez.
