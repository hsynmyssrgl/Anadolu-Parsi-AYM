# ADR-027 — İmzalı kanıt sağlayıcısı iptal listesi ve çevrimdışı güven önbelleği

## Durum

Kabul edildi — Bronze RC2 Build 142 Active Development.

## Bağlam

Build 140 ve 141 güvenilen Ed25519 sağlayıcı anahtarlarını, imzalı imha
makbuzlarını ve anahtar döndürme zincirini oluşturdu. Yalnız yerel iptal işlemi,
sağlayıcının dışarıda yayımladığı iptal durumunu çevrimdışı veya gecikmeli
ortamda güvenilir ve geri alma saldırısına dayanıklı biçimde taşıyamıyordu.

## Karar

- İptal listesi sabit kanonik JSON şemasına ve Ed25519 detached imzasına bağlıdır.
- Liste kimliği ve monoton sıra numarası aynı kök güven zincirinde benzersizdir.
- Daha düşük veya eşit sıra numarası replay/rollback olarak reddedilir.
- `thisUpdate` gelecekte en fazla beş dakika toleranslıdır; `nextUpdate` geçmişte
  olamaz ve geçerlilik penceresi 31 günü aşamaz.
- İmzalayan anahtar `thisUpdate` anında güvenilir olmalıdır.
- Her hedef aynı kök güven zincirinde bulunmalı; imzalayan anahtar kendisini iptal
  edememelidir.
- Uygulama transaction içinde eski listeyi `superseded`, yenisini `current`
  yapar; hedef sağlayıcıları `signed_list` kaynağıyla iptal eder.
- İptal zamanı ve sonrasında düzenlenen bağlı imha kanıtları `revoked` olur;
  tarihsel kayıtlar silinmez.
- Liste kaynak URL'si yalnız HTTPS metadata'sıdır. Otomatik ağ fetch'i veya gerçek
  sağlayıcı API'si Build 142 kapsamı değildir.

## Sonuçlar

- Çevrimdışı güven önbelleği imzalı ve denetlenebilir olur.
- Geri alma saldırısı ve liste tekrar kullanımı fail-closed engellenir.
- Süresi geçmiş önbellek güveni yükseltemez; kullanıcı yeni liste gereksinimini
  görebilir.
- Gerçek sağlayıcı endpoint kimliği, TLS/pinning ve ağ senkronizasyonu ayrı
  promotion kapısı olarak kalır.
