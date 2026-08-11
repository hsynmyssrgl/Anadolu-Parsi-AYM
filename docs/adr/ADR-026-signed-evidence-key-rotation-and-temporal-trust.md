# ADR-026 — İmzalı kanıt sağlayıcısı anahtar döndürme ve zamansal güven

- Durum: Kabul edildi
- Build: 141
- Aşama: Bronze RC2 Active Development

## Bağlam

Uzun ömürlü sağlayıcı anahtarlarının değiştirilmesi gerekir. Yeni anahtarı yalnız
kullanıcı girişiyle güvenilir saymak zinciri koparır; eski anahtarı süresiz etkin
bırakmak ise saldırı yüzeyini büyütür.

## Karar

Yeni Ed25519 açık anahtarı, etkin önceki anahtarın sabit kanonik döndürme makbuzu
üzerindeki imzasıyla yetkilendirilir. Önceki anahtarın bitişi ile ardıl anahtarın
başlangıcı aynı transaction ve kesim zamanında kaydedilir. İmha makbuzları güncel
anahtar durumuna göre değil, makbuzun düzenlendiği andaki güven aralığına göre
doğrulanır.

## Sonuçlar

- Anahtar zinciri ve kesim anı denetlenebilir olur.
- Replay, anahtar çakışması ve ikinci döndürme reddedilir.
- Tarihsel makbuzlar kendi düzenlenme anındaki güvene göre değerlendirilebilir.
- Gerçek sağlayıcı kimlik doğrulaması ve çevrimiçi iptal altyapısı ayrı entegrasyon kapısıdır.
