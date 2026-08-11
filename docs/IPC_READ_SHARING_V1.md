# IPC Salt Okuma Paylaşımı V1

## Amaç

Aynı renderer oturumu, oturum çağı, kanal, argüman ve revizyon özetiyle yinelenen
salt IPC okumalarının gereksiz tekrarını azaltmak; bunu mutasyon, yetki ve oturum
sınırlarını aşmadan yapmak.

## Paylaşım anahtarı

Anahtar SHA-256 ile aşağıdaki kanonik içerikten türetilir:

- renderer oturum kimliği,
- oturum çağı,
- IPC kanal adı,
- graph/timeline/katalog/dashboard/bildirim/arşiv revizyonları,
- sıralı ve kanonikleştirilmiş uygulama argümanları.

Bu alanlardan biri değişirse cache veya eşzamanlı yürütme paylaşılmaz.

## İki katman

1. Preload katmanı aynı anahtardaki eşzamanlı çağrıları tek Promise üzerinde
   birleştirir ve her çağırana ayrı `structuredClone` sonucu döndürür.
2. Ana süreç yalnız kısa TTL içinde, göndericiye özel ve boyutu sınırlı salt okuma
   sonucunu yeniden kullanır. Cache hit'i normal taşıma yanıt zarfına bağlanır.

## Fail-closed kurallar

- Mutasyon ve ağ senkronizasyonu paylaşım dışıdır.
- Mutasyon başlamadan önce preload aktif paylaşılabilir okumaları iptal eder.
- Ana süreç gönderici cache neslini artırır ve önce başlamış okumanın eski sonucu
  cache'i yeniden dolduramaz.
- Hatalar cache'lenmez.
- Döngüsel, desteklenmeyen veya boyut sınırını aşan sonuç cache'e alınmaz.
- Pencere kapanışı ve uygulama çıkışı gönderici cache'ini temizler.

## Sınırlar

Bu mekanizma yetkilendirme kararı değildir. Her cache miss normal güvenilir renderer,
payload, entegrasyon, yaşam döngüsü ve geri basınç kontrollerinden geçer. Geniş
production/Windows kapıları bağımlılık yanıtı geldikten sonra ayrıca çalıştırılır.
