# Bronze RC2 Build 147 Sürüm Notları

## Sürüm

- Uygulama: `29.07.2026.147`
- Paket: `29.7.2026-147`
- Aşama: **Bronze RC2 Active Development**

## Ana konu

Büyük soy ağacı, zaman tüneli ve arşiv için performans sertleştirmesi.

## Değişiklikler

- Üç görünüm için sınırlı ve ölçümlü read-model API’leri eklendi.
- Offset yerine kararlı anahtar tabanlı imleç sayfalaması kullanıldı.
- Varsayılan 80, en fazla 200 kayıt sınırı uygulandı.
- Soy ağacı ilişki sayıları indeksli iki yönlü sorgularla üretildi.
- Zaman tüneli arama, kişi, tür ve yıl filtreleri SQLite tarafına taşındı.
- Arşiv arama, kategori, hassasiyet, etiket, MIME ve etkinlik filtreleri SQLite
  tarafına taşındı.
- Tam arşiv listesinin açılışta renderer belleğine alınması kaldırıldı.
- İçe aktarma sonrası arşiv yalnız revizyon sinyaliyle sayfalı olarak yenileniyor.
- Sayfa ölçümleri kullanıcı arayüzünde gösteriliyor.
- Migration 25 ile büyük veri sorgu indeksleri eklendi.

## Aşama notu

Bu paket Bronze RC2 Final, Code Freeze, Silver veya Gold değildir. Geniş doğrulama
kapıları Build 149 toplu doğrulamasına bırakılmıştır.
