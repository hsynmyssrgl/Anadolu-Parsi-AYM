# ADR-056 — Otomatik Temiz Yedek Yeniden Yazımı ve Karantina

**Aktif sürüm:** 01.08.2026.219  

- Durum: Kabul edildi
- Tarih: 2026-07-30
- Build: 183
- Karar: DEC-073
- Politika: `PPT-LIFECYCLE-STRICT-V1`

## Bağlam

Canlı veriden kalıcı imha edilen bir kayıt, imha öncesinde oluşturulmuş yönetilen
tam yedeklerde saklama süresi boyunca bulunabilir. Eski yedeğin doğrudan silinmesi
geri dönüş ve denetim kanıtını; süresiz tutulması ise veri minimizasyonunu bozar.

## Karar

Saklama süresi dolan tombstone kayıtları için önce yeni ve doğrulanmış tam yedek
oluşturulur. Yalnız bu adım başarılıysa eski yönetilen kopya manifestli karantinaya
alınır. Çalışma sahipliği, geri çekilme, erteleme ve hata durumu veritabanında
kalıcı tutulur. Manuel ve otomatik başarısızlıklar sırasıyla 60 ve 360 dakika;
yüksek sistem yükü 30 dakika ertelenir. Etkin hedef yokluğu sessiz başarı değildir.

## Sonuçlar

- Kesinti sonrası çalışma kaldığı yerden güvenli yönetişimle uzlaştırılır.
- Eski kopya hemen yok edilmez; mevcut karantina saklama/hukuki bekletme kuralları geçerlidir.
- Haricî ve yönetilmeyen kopyalar ayrı envanter/kanıt sınırında kalır.
- Silver'da yeni özellik eklenmeden tam test kampanyası yürütülür.
