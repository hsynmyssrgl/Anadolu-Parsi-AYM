# ADR-055 — Kurum Dışı Çift Kanıtlı Kök Güven Doğrulaması

**Aktif sürüm:** 01.08.2026.219  

## Durum

Kabul edildi — Bronze Build 182.

## Bağlam

Haricî imha/yedek kanıtlarının güveni, uygulamaya kayıtlı sağlayıcı Ed25519 kök
anahtarına dayanır. Önceki akış yöneticiye ad ve PUBLIC KEY PEM girerek kökü
anında güvenilir yapma olanağı veriyordu. Bu, yanlış kaynaktan kopyalanmış veya
saldırgan tarafından değiştirilmiş anahtar için kurum dışı kimlik bağı kurmuyordu.

## Karar

Yeni kökler iki farklı kanıt kanalıyla doğrulanır: biri resmî tüzel kişi kimliğine,
diğeri tam SHA-256 anahtar parmak izine ayrılır. Parmak izi gerçek Ed25519
anahtarından ana süreçte hesaplanır ve beklenen değerle eşleşir. Tanık ve kontrol
zamanı zorunludur. Doğrulama sabit kanonik makbuz ve SHA-256 özetine bağlanır.
Ön kontroller güçlü doğrulamadan ve repository yazımından önce yapılır.

Mevcut kayıtlar geriye dönük veri kaybı yaratmamak için `legacy_unverified`
olarak korunur ve UI'da uyarılır. Ardıl anahtar yalnız önceki anahtarın geçerli
Ed25519 döndürme makbuzuyla kabul edildiğinde `rotation_inherited` olur.

## Sonuçlar

- Tek yönetici beyanı güven kökü oluşturamaz.
- Gerçek sağlayıcı API'si olmadan güvenli yerel prosedür kullanılabilir.
- Ham belgeler yerine sınırlı referanslar ve kanonik makbuz özeti saklanır.
- Eski kayıtlar görünür risk etiketi taşır; sessizce yeni güven seviyesine
  yükseltilmez.
- Gerçek insan prosedürü ve bağımsız belge denetimi Silver test kampanyasının
  dış kanıtıdır.
