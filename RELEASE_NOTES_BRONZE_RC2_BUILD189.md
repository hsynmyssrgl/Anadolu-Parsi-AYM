# Bronze RC2 Build 189 Sürüm Notları

## Yeni

- `DEC-079` ve `ADR-062`: aktif temiz-yedek çalışması operasyonel izolasyonu.
- Politika `running` iken etkinlik ve saklama ayarı değişikliği reddedilir.
- Kesinti kurtarma tabanı çalışma defteri `updated_at` dahil bütün kalıcı
  kronolojinin en ileri değeridir.
- Migrasyon 34, aktif ayar kilidi ve terminal politika/çalışma eşleşmesi sağlar.

## Güvenlik ve bütünlük

- Kullanıcı ayarı çalışma ortasında kronolojiyi ileri taşıyamaz.
- Kesinti kurtarması ileri defter zamanı nedeniyle `running` durumda kilitlenmez.
- Çelişkili terminal durum, sonuç, hata veya yeniden deneme yazımı fail-closed reddedilir.

## Doğrulama sınırı

Bronze kaynak kanıtları çalıştırılır. Temiz kurulum, tam test, production build,
smoke ve gerçek Windows/installer kapıları Silver için NOT_RUN kalır.
