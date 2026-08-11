# Automatic Clean Backup Rewrite V1

**Aktif sürüm:** 02.08.2026.228

## Amaç

Kalıcı imha tombstone kaydının saklama süresi dolduğunda, onu içerebilecek eski
yönetilen tam yedeği doğrulanmış temiz bir yedekle değiştirmek ve eski kopyayı
doğrudan silmek yerine denetlenebilir karantinaya almaktır.

## Politika

- Kimlik: `backup_clean_rewrite_policy/default`
- Varsayılan saklama: 30 gün
- Manuel başarısızlık geri çekilmesi: 60 dakika
- Otomatik başarısızlık geri çekilmesi: 360 dakika
- Yüksek yük ertelemesi: 30 dakika
- Yük eşiği: CPU veya bellek yüzde 85
- Politika değişikliği: `family_admin` ve güçlü yeniden doğrulama

## Güvenli akış

1. Süresi dolmuş ve `backup_propagation_pending=1` tombstone kayıtlarını seç.
2. Kalıcı çalışma sahipliği al; aynı anda ikinci çalışmayı reddet.
3. Etkin hedef yoksa `attention` durumu ve görünür tanı kaydı üret.
4. Yük yüksekse kalıcı `deferred` durumu ve sonraki deneme zamanı yaz.
5. Her hedefte yeni tam yedek oluştur ve SHA-256/bütünlük kontrolünü tamamla.
6. Eski yönetilen yedekleri manifestli karantinaya taşı.
7. Yalnız bütün etkin hedefler yenilendiyse tombstone kayıtlarını tamamlanmış işaretle.
8. Sonuç, hata, tetikleyici ve sonraki deneme zamanını kalıcı politikaya yaz.

## Kesinti devamlılığı

`state=running` ve `in_progress_run_id` yeniden başlatmada bulunursa çalışma başarılı
sayılmaz. Durum `backoff` yapılır, hata tanısı yazılır ve otomatik 360 dakikalık
geri çekilme uygulanır. Önceki kısmi dosya hareketleri mevcut karantina uzlaştırma
akışıyla tekrar denetlenir.

## Veri ve güven sınırı

Manuel dosyalar, çevrimdışı diskler ve bulut sürüm geçmişleri otomatik kapsamda
değildir. Bunlar haricî yedek envanteri ve ayrı imha kanıtı yönetişimi altında kalır.
Parola, TOTP, yedek parolası veya kullanıcı veri içeriği politika/tanı kayıtlarına yazılmaz.

## Silver doğrulaması

Temiz kurulum, tam test paketi, production build, performans, güvenlik,
kullanılabilirlik ve gerçek Windows/installer senaryoları Silver'da çalıştırılır.
