# Sürüm Notları — Bronze RC2 Build 125

## Zaman tüneli

- Başlık, açıklama, konum ve notlarda birleşik arama eklendi.
- Kişisel/aile görünümü ile kişi, olay türü ve yıl filtreleri birleştirildi.
- Her olaydan tam düzenleme, bağlı arşiv ve geri alınabilir arşivleme
  işlemlerine erişim sağlandı.
- Güncelleme zamanı olay kartında görünür oldu.

## Önemli günler

- Tarih-saat, konum, gizlilik, katılımcı, davetiye, not, tekrar, hatırlatma ve
  yapay zekâ izni aynı erişilebilir modal içinde düzenlenebilir.
- Arşivlenmiş önemli günler ayrı alanda listelenir.
- Yanlışlıkla arşivlenen kayıt tek işlemle geri alınabilir.
- Önemli gün ile ilişkili fotoğraf, video ve belgelere arşiv filtresiyle geçilir.

## Veri ve güvenlik

- Migration 15 olaylara `updated_at` ve `archived_at` alanlarını ekler.
- Aktif olay sorguları arşiv kayıtlarını varsayılan olarak dışarıda bırakır.
- Güncelleme, arşivleme ve geri alma mevcut yetkilendirme ve audit/outbox
  sınırlarının arkasında çalışır.
- Arşivleme fiziksel silme yapmaz; geri alınabilirlik korunur.

Bu sürüm Bronze RC2 Active Development kapsamındadır; Final değildir.
